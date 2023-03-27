import { Response, Request, NextFunction, RequestHandler } from 'express';
import { parse } from 'graphql/language/parser';
import { graphql } from 'graphql';
import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import {
  createQueryStr,
  createQueryObj,
  joinResponses,
  parseAST,
  updateProtoWithFragment,
  getMutationMap,
  getQueryMap,
  getFieldsMap
} from './helpers/quellHelpers';
import type { GraphQLSchema, ExecutionResult, DocumentNode } from 'graphql';
import type {
  ConstructorOptions,
  IdCacheType,
  CostParamsType,
  ProtoObjType,
  FragsType,
  MutationMapType,
  QueryMapType,
  FieldsMapType,
  ItemFromCacheType,
  RedisOptionsType,
  RedisStatsType,
  ServerErrorType,
  ResponseDataType,
  QueryFields,
  DatabaseResponseDataRaw,
  Type,
  MergedResponse,
  DataResponse,
  TypeData
} from './types';

const defaultCostParams: CostParamsType = {
  maxCost: 5000, // maximum cost allowed before a request is rejected
  mutationCost: 5, // cost of a mutation
  objectCost: 2, // cost of retrieving an object
  scalarCost: 1, // cost of retrieving a scalar
  depthCostFactor: 1.5, // multiplicative cost of each depth level
  maxDepth: 10, // depth limit parameter
  ipRate: 3 // requests allowed per second
};

let idCache: IdCacheType = {};

/**
 * Creates a QuellCache instance that provides middleware for caching between the graphQL endpoint and
 * front-end requests, connects to redis cloud store via user-specified parameters.
 *    - If there is no cache expiration provided by the user, cacheExpiration defaults to 14 days in seconds.
 *    - If there are no cost parameters provided by the user, costParameters is given the default values.
 *    - If redisPort, redisHost, and redisPassword are omitted, will use local Redis instance.
 *     See https://redis.io/docs/getting-started/installation/ for instructions on installing Redis and starting a Redis server.
 *  @param {ConstructorOptions} options - The options to use for the cache.
 *  @param {GraphQLSchema} options.schema - GraphQL defined schema that is used to facilitate caching by providing valid queries,
 *  mutations, and fields.
 *  @param {number} [options.cacheExpiration=1209600] - Time in seconds for redis values to be evicted from the cache. Defaults to 14 days.
 *  @param {CostParamsType} [options.costParameters=defaultCostParams] - The cost parameters to use for caching. Defaults to:
 *    - maxCost: 5000 (maximum cost allowed before a request is rejected)
 *    - mutationCost: 5 (cost of a mutation)
 *    - objectCost: 2 (cost of retrieving an object)
 *    - scalarCost: 1 (cost of retrieving a scalar)
 *    - depthCostFactor: 1.5 (multiplicative cost of each depth level)
 *    - maxDepth: 10 (depth limit parameter)
 *    - ipRate: 3 (requests allowed per second)
 *  @param {number} options.redisPort - (optional) The Redis port to connect to.
 *  @param {string} options.redisHost - (optional) The Redis host URI to connect to.
 *  @param {string} options.redisPassword - (optional) The Redis password to the host URI.
 *  @example // Omit redisPort, redisHost, and redisPassword to use a local Redis instance.
 *  const quellCache = new QuellCache({
 *    schema: schema,
 *    cacheExpiration: 3600, // 1 hour in seconds
 *    });
 */
export class QuellCache {
  idCache: IdCacheType;
  schema: GraphQLSchema;
  costParameters: CostParamsType;
  queryMap: QueryMapType;
  mutationMap: MutationMapType;
  fieldsMap: FieldsMapType;
  cacheExpiration: number;
  redisReadBatchSize: number;
  redisCache: RedisClientType;
  constructor({
    schema,
    cacheExpiration = 1209600, // Default expiry time is 14 days in seconds
    costParameters = defaultCostParams,
    redisPort,
    redisHost,
    redisPassword
  }: ConstructorOptions) {
    this.idCache = idCache;
    this.schema = schema;
    this.costParameters = Object.assign(defaultCostParams, costParameters);
    this.depthLimit = this.depthLimit.bind(this);
    this.costLimit = this.costLimit.bind(this);
    this.rateLimiter = this.rateLimiter.bind(this);
    this.queryMap = getQueryMap(schema);
    this.mutationMap = getMutationMap(schema);
    this.fieldsMap = getFieldsMap(schema);
    this.cacheExpiration = cacheExpiration;
    this.redisReadBatchSize = 10;
    this.redisCache = createClient({
      socket: { host: redisHost, port: redisPort },
      password: redisPassword
    });
    this.query = this.query.bind(this);
    this.clearCache = this.clearCache.bind(this);
    this.buildFromCache = this.buildFromCache.bind(this);
    this.generateCacheID = this.generateCacheID.bind(this);
    this.updateCacheByMutation = this.updateCacheByMutation.bind(this);
    this.deleteCacheById = this.deleteCacheById.bind(this);
    this.getStatsFromRedis = this.getStatsFromRedis.bind(this);
    this.getRedisInfo = this.getRedisInfo.bind(this);
    this.getRedisKeys = this.getRedisKeys.bind(this);
    this.getRedisValues = this.getRedisValues.bind(this);
    this.redisCache
      .connect()
      .then((): void => {
        console.log('Connected to redisCache');
      })
      .catch((error) => {
        const err: ServerErrorType = {
          log: `Error when trying to connect to redisCache, ${error}`,
          status: 400,
          message: {
            err: 'Could not connect to redisCache. Check server log for more details.'
          }
        };
        console.log(err);
      });
  }

  /**
   * A redis-based IP rate limiter middleware function that limits the number of requests per second based on IP address using Redis.
   *  @param {Request} req - Express request object, including request body with GraphQL query string.
   *  @param {Response} res - Express response object, will carry query response to next middleware.
   *  @param {NextFunction} next - Express next middleware function, invoked when QuellCache completes its work.
   *  @returns {void} Passes an error to Express if no query was included in the request or if the number of requests by the current IP
   *  exceeds the IP rate limit.
   */
  async rateLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // Get IP rate limit from the cost parameters set on server connection.
    const ipRateLimit: number = this.costParameters.ipRate;
    // Get the IP address from the request.
    const ipAddress: string = req.ip;
    // Get the current time in seconds.
    const currentTimeSeconds: number = Math.floor(Date.now() / 1000);
    // Create a Redis IP key using the IP address and current time.
    const redisIpTimeKey = `${ipAddress}:${currentTimeSeconds}`;

    // Return an error if no query is found on the request.
    if (!req.body.query) {
      const err: ServerErrorType = {
        log: 'Error: no GraphQL query found on request body, inside rateLimiter',
        status: 400,
        message: {
          err: 'Error in rateLimiter: Bad Request. Check server log for more details.'
        }
      };
      return next(err);
    }

    try {
      // Create a Redis multi command queue.
      const redisRunQueue: ReturnType<typeof this.redisCache.multi> =
        this.redisCache.multi();

      // Add to queue: increment the key associated with the current IP address and time in Redis.
      redisRunQueue.incr(redisIpTimeKey);

      // Add to queue: set the key to expire after 1 second.
      redisRunQueue.expire(redisIpTimeKey, 1);

      // Execute the Redis multi command queue.
      const redisResponse: string[] = (await redisRunQueue.exec()).map(
        (result) => JSON.stringify(result)
      );

      // Save result of increment command, which will be the number of requests made by the current IP address in the last second.
      // Since the increment command was the first command in the queue, it will be the first result in the returned array.
      const numRequestsString: string = redisResponse[0] ?? '0';
      const numRequests: number = parseInt(numRequestsString, 10);

      // If the number of requests is greater than the IP rate limit, throw an error.
      if (numRequests > ipRateLimit) {
        const err: ServerErrorType = {
          log: `Redis cache error: Express error handler caught too many requests from this IP address (${ipAddress}): limit is: ${ipRateLimit} requests per second, inside rateLimiter`,
          status: 429, // Too Many Requests
          message: {
            err: 'Error in rateLimiter middleware. Check server log for more details.'
          }
        };
        return next(err);
      }

      console.log(
        `IP ${ipAddress} made a request. Limit is: ${ipRateLimit} requests per second. Result: OK.`
      );

      return next();
    } catch (error) {
      const err: ServerErrorType = {
        log: `Catch block in rateLimiter middleware, ${error}`,
        status: 500,
        message: {
          err: 'IPRate Limiting Error. Check server log for more details.'
        }
      };
      return next(err);
    }
  }

  /**
   * The class's controller method. It:
   *    - reads the query string from the request object,
   *    - tries to construct a response from cache,
   *    - reformulates a query for any data not in cache,
   *    - passes the reformulated query to the graphql library to resolve,
   *    - joins the cached and uncached responses,
   *    - decomposes and caches the joined query, and
   *    - attaches the joined response to the response object before passing control to the next middleware.
   *  @param {Request} req - Express request object, including request body with GraphQL query string.
   *  @param {Response} res - Express response object, will carry query response to next middleware.
   *  @param {NextFunction} next - Express next middleware function, invoked when QuellCache completes its work.
   */
  async query(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Return an error if no query is found on the request.
    if (!req.body.query) {
      const err: ServerErrorType = {
        log: 'Error: no GraphQL query found on request body',
        status: 400,
        message: {
          err: 'Error in quellCache.query: Check server log for more details.'
        }
      };
      return next(err);
    }

    // Retrieve GraphQL query string from request body.
    const queryString: string = req.body.query;

    // Create the abstract syntax tree with graphql-js parser.
    // If depth limit or cost limit were implemented, then we can get the AST and parsed AST from res.locals.
    const AST: DocumentNode = res.locals.AST
      ? res.locals.AST
      : parse(queryString);

    // Create response prototype, operation type, and fragments object.
    // The response prototype is used as a template for most operations in Quell including caching, building modified requests, and more.
    const {
      proto,
      operationType,
      frags
    }: { proto: ProtoObjType; operationType: string; frags: FragsType } =
      res.locals.parsedAST ?? parseAST(AST);

    // Determine if Quell is able to handle the operation.
    // Quell can handle mutations and queries.

    if (operationType === 'unQuellable') {
      /*
       * If the operation is unQuellable (cannot be cached), execute the operation,
       * add the result to the response, and return.
       */
      graphql({ schema: this.schema, source: queryString })
        .then((queryResult: ExecutionResult): void => {
          res.locals.queryResponse = queryResult;
          return next();
        })
        .catch((error: Error): void => {
          const err: ServerErrorType = {
            log: `Error inside catch block of operationType === unQuellable of query, ${error}`,
            status: 400,
            message: {
              err: 'GraphQL query Error: Check server log for more details.'
            }
          };
          return next(err);
        });
    } else if (operationType === 'noID') {
      /*
       * If ID was not included in the query, it will not be included in the cache. Execute the GraphQL
       * operation without writing the result to cache and return.
       */
      // FIXME: Can possibly modify query to ALWAYS have an ID but not necessarily return it back to client
      // unless they also queried for it.
      graphql({ schema: this.schema, source: queryString })
        .then((queryResult: ExecutionResult): void => {
          res.locals.queryResponse = queryResult;
          return next();
        })
        .catch((error: Error): void => {
          const err: ServerErrorType = {
            log: `Error inside catch block of operationType === noID of query, ${error}`,
            status: 400,
            message: {
              err: 'GraphQL query Error: Check server log for more details.'
            }
          };
          return next(err);
        });

      /*
       * The code from here to the end of the current if block was left over from a previous
       * implementation and is not currently being used.
       * For the previous implementation: if the ID was not included, used the cache result
       * if the query string was found in the Redis cache. Otherwise, used the result of
       * executing the operation and stored the result in cache.
       */

      // Check Redis for the query string .
      let redisValue: string | null | void = await this.getFromRedis(
        queryString
      );

      if (redisValue != null) {
        // If the query string is found in Redis, add the result to the response and return.
        redisValue = JSON.parse(redisValue);
        res.locals.queriesResponse = redisValue;
        return next();
      } else {
        // Execute the operation, add the result to the response, write the query string and result to cache, and return.
        graphql({ schema: this.schema, source: queryString })
          .then((queryResult: ExecutionResult): void => {
            res.locals.queryResponse = queryResult;
            this.writeToCache(queryString, queryResult);
            return next();
          })
          .catch((error: Error): void => {
            const err: ServerErrorType = {
              log: `Error inside catch block of operationType === noID of query, graphQL query failed, ${error}`,
              status: 400,
              message: {
                err: 'GraphQL query Error: Check server log for more details.'
              }
            };
            return next(err);
          });
      }
    } else if (operationType === 'mutation') {
      // TODO: If the operation is a mutation, we are currently clearing the cache because it is stale.
      // The goal would be to instead have a normalized cache and update the cache following a mutation.
      this.redisCache.flushAll();
      idCache = {};

      // Determine if the query string is a valid mutation in the schema.
      // Declare variables to store the mutation proto, mutation name, and mutation type.
      let mutationQueryObject: ProtoObjType;
      let mutationName = '';
      let mutationType = '';
      // Loop through the mutations in the mutationMap.
      for (const mutation in this.mutationMap) {
        // If any mutation from the mutationMap is found on the proto, the query string includes
        // a valid mutation. Update the mutation query object, name, type variables.
        if (Object.prototype.hasOwnProperty.call(proto, mutation)) {
          mutationName = mutation;
          mutationType = this.mutationMap[mutation] as string;
          mutationQueryObject = proto[mutation] as ProtoObjType;
          break;
        }
      }

      // Execute the operation and add the result to the response.
      graphql({ schema: this.schema, source: queryString })
        .then((databaseResponse: ExecutionResult): void => {
          res.locals.queryResponse = databaseResponse;

          // If there is a mutation, update the cache with the response.
          // We don't need to wait until writeToCache is finished.
          if (mutationQueryObject) {
            this.updateCacheByMutation(
              databaseResponse,
              mutationName,
              mutationType,
              mutationQueryObject
            );
          }
          return next();
        })
        .catch((error: Error): void => {
          const err: ServerErrorType = {
            log: `Error inside catch block of operationType === mutation of query, ${error}`,
            status: 400,
            message: {
              err: 'GraphQL query (mutation) Error: Check server log for more details.'
            }
          };
          return next(err);
        });
    } else {
      /*
       * Otherwise, the operation type is a query.
       */
      // Combine fragments on prototype so we can access fragment values in cache.
      const prototype: ProtoObjType =
        Object.keys(frags).length > 0
          ? updateProtoWithFragment(proto, frags)
          : proto;
      // Create a list of the keys on prototype that will be passed to buildFromCache.
      const prototypeKeys: string[] = Object.keys(prototype);

      // Check the cache for the requested values.
      // buildFromCache will modify the prototype to mark any values not found in the cache
      // so that they may later be retrieved from the database.
      const cacheResponse: {
        data: ItemFromCacheType;
        cached?: boolean;
      } = await this.buildFromCache(prototype, prototypeKeys);

      // Create merged response object to merge the data from the cache and the data from the database.
      let mergedResponse: MergedResponse;

      // Create query object containing the fields that were not found in the cache.
      // This will be used to create a new GraphQL string.
      const queryObject: ProtoObjType = createQueryObj(prototype);

      // If the cached response is incomplete, reformulate query,
      // handoff query, join responses, and cache joined responses.
      if (Object.keys(queryObject).length > 0) {
        // Create a new query string that contains only the fields not found in the cache so that we can
        // request only that information from the database.
        const newQueryString: string = createQueryStr(
          queryObject,
          operationType
        );

        // Execute the query using the new query string.
        graphql({ schema: this.schema, source: newQueryString })
          .then(async (databaseResponseRaw: ExecutionResult): Promise<void> => {
            // The GraphQL must be parsed in order to join with it with the data retrieved from
            // the cache before sending back to user.
            const databaseResponse: DataResponse = JSON.parse(
              JSON.stringify(databaseResponseRaw)
            );

            // Check if the cache response has any data by iterating over the keys in cache response.
            let cacheHasData = false;
            for (const key in cacheResponse.data) {
              if (Object.keys(cacheResponse.data[key]).length > 0) {
                cacheHasData = true;
              }
            }

            // Create merged response object to merge the data from the cache and the data from the database.
            // If the cache response does not have data then just use the database response.
            mergedResponse = cacheHasData
              ? joinResponses(
                  cacheResponse.data,
                  databaseResponse.data as DataResponse,
                  prototype
                )
              : databaseResponse;

            const currName = 'string it should not be again';
            await this.normalizeForCache(
              mergedResponse.data as ResponseDataType,
              this.queryMap,
              prototype,
              currName
            );

            // The response is given a cached key equal to false to indicate to the front end of the demo site that the
            // information was *NOT* entirely found in the cache.
            mergedResponse.cached = false;
            res.locals.queryResponse = { ...mergedResponse };
            return next();
          })
          .catch((error: Error): void => {
            const err: ServerErrorType = {
              log: `Error inside catch block of operationType === query of query, ${error}`,
              status: 400,
              message: {
                err: 'GraphQL query Error: Check server log for more details.'
              }
            };
            return next(err);
          });
      } else {
        // If the query object is empty, there is nothing left to query and we can send the information from cache.
        // The response is given a cached key equal to true to indicate to the front end of the demo site that the
        // information was entirely found in the cache.
        cacheResponse.cached = true;
        res.locals.queryResponse = { ...cacheResponse };
        return next();
      }
    }
  }

  /**
   * Reads from Redis cache and returns a promise (Redis v4 natively returns a promise).
   * @param {string} key - The key for Redis lookup.
   * @returns {Promise} - A promise representing the value from the redis cache with the provided key.
   */
  async getFromRedis(key: string): Promise<string | null | void> {
    try {
      if (typeof key !== 'string' || key === undefined) return;
      const lowerKey: string = key.toLowerCase();
      const redisResult: string | null = await this.redisCache.get(lowerKey);
      return redisResult;
    } catch (error) {
      const err: ServerErrorType = {
        log: `Error in QuellCache trying to getFromRedis, ${error}`,
        status: 400,
        message: {
          err: 'Error in getFromRedis. Check server log for more details.'
        }
      };
      console.log('err in getFromRedis: ', err);
    }
  }

  /**
   * Finds any requested information in the cache and assembles it on the cacheResponse.
   * Uses the prototype as a template for cacheResponse and marks any data not found in the cache
   * on the prototype for future retrieval from database.
   * @param {Object} prototype - Unique id under which the cached data will be stored.
   * @param {Array} prototypeKeys - Keys in the prototype.
   * @param {Object} itemFromCache - Item to be cached.
   * @param {boolean} firstRun - Boolean indicated if this is the first run.
   * @param {boolean|string} subID - Used to pass id to recursive calls.
   * @returns {Object} cacheResponse, mutates prototype.
   */
  async buildFromCache(
    prototype: ProtoObjType,
    prototypeKeys: string[],
    itemFromCache: ItemFromCacheType = {},
    firstRun = true,
    subID: boolean | string = false
  ): Promise<{ data: ItemFromCacheType }> {
    for (const typeKey in prototype) {
      // If the current key is a root query, check cache and set any results to itemFromCache.
      if (prototypeKeys.includes(typeKey)) {
        // Create a variable cacheID, used to determine what ID should be used for the Redis lookup.
        let cacheID: string;
        if (typeof subID === 'string') {
          // Use the subID argument if it is a string (used for recursive calls within buildFromCache).
          cacheID = subID;
        } else {
          cacheID = this.generateCacheID(prototype[typeKey] as ProtoObjType);
        }

        let keyName: string | undefined;
        // Value won't always be at .name on the args object
        if ((prototype[typeKey] as ProtoObjType)?.__args === null) {
          keyName = undefined;
        } else {
          keyName = Object.values(
            (prototype[typeKey] as ProtoObjType)?.__args as object
          )[0];
        }

        if (idCache[keyName as string] && idCache[keyName as string][cacheID]) {
          cacheID = idCache[keyName as string][cacheID] as string;
        }

        // Capitalize first letter of cache ID just in case
        const capitalized: string =
          (cacheID as string).charAt(0).toUpperCase() + cacheID.slice(1);
        if (
          idCache[keyName as string] &&
          idCache[keyName as string][capitalized]
        ) {
          cacheID = idCache[keyName as string][capitalized] as string;
        }

        const cacheResponse: string | null | void = await this.getFromRedis(
          cacheID
        );
        itemFromCache[typeKey] = cacheResponse ? JSON.parse(cacheResponse) : {};
      }

      // If itemFromCache at the current key is an array, iterate through and gather data.
      if (Array.isArray(itemFromCache[typeKey])) {
        // Create a new Redis run queue.
        let redisRunQueue: ReturnType<typeof this.redisCache.multi> =
          this.redisCache.multi();

        for (let i = 0; i < itemFromCache[typeKey].length; i++) {
          if (typeof itemFromCache[typeKey] === 'string') {
            /**
             * Helper function that will be called for each response in the
             * array of responses returned by Redis' exec() command within buildFromCache.
             * @param {string} cacheResponse - Response from one of the get commands in the Redis queue.
             */
            const getCommandCallback = (cacheResponse: string): void => {
              const tempObj: ItemFromCacheType = {};

              if (cacheResponse) {
                const interimCache: ItemFromCacheType =
                  JSON.parse(cacheResponse);

                for (const property in prototype[typeKey] as ProtoObjType) {
                  // If property exists, set on tempObj
                  if (
                    Object.prototype.hasOwnProperty.call(
                      interimCache,
                      property
                    ) &&
                    !property.includes('__')
                  ) {
                    tempObj[property] = interimCache[property];
                  }
                  // If prototype is nested at this field, recurse
                  else if (
                    !property.includes('__') &&
                    typeof (prototype[typeKey] as ProtoObjType)[property] ===
                      'object'
                  ) {
                    this.buildFromCache(
                      (prototype[typeKey] as ProtoObjType)[
                        property
                      ] as ProtoObjType,
                      prototypeKeys,
                      {},
                      false,
                      `${currTypeKey}--${property}`
                    ).then((tempData) => (tempObj[property] = tempData.data));
                  }
                  // If cache does not have property, set to false on prototype so that it is sent to GraphQL
                  else if (
                    !property.includes('__') &&
                    typeof (prototype[typeKey] as ProtoObjType)[property] !==
                      'object'
                  ) {
                    (prototype[typeKey] as ProtoObjType)[property] = false;
                  }
                }
                itemFromCache[typeKey][i] = tempObj;
              }
              // If there is nothing in the cache for this key, toggle all fields to false so they will be fetched later.
              else {
                for (const property in prototype[typeKey] as ProtoObjType) {
                  if (
                    !property.includes('__') &&
                    typeof (prototype[typeKey] as ProtoObjType)[property] !==
                      'object'
                  ) {
                    (prototype[typeKey] as ProtoObjType)[property] = false;
                  }
                }
              }
            };

            const currTypeKey: string = itemFromCache[typeKey][i];

            // If the size of the current batch equals the redisReadBatchSize in the constructor
            // execute the current batch and reset the queue.
            if (i !== 0 && i % this.redisReadBatchSize === 0) {
              try {
                const cacheResponseRaw = await redisRunQueue.exec();
                cacheResponseRaw.forEach((cacheResponse) =>
                  getCommandCallback(JSON.stringify(cacheResponse))
                );
              } catch (error: Error | unknown) {
                const err: ServerErrorType = {
                  log: `Error inside 1st-catch block of buildFromCache, ${error}`,
                  status: 400,
                  message: {
                    err: 'Error in buildFromCache. Check server log for more details.'
                  }
                };
                console.log(err);
              }
              redisRunQueue = this.redisCache.multi();
            }

            // Add a get command for the current type key to the queue.
            redisRunQueue.get(currTypeKey.toLowerCase());

            // Execute any remnants in redis run queue.
            try {
              const cacheResponseRaw = await redisRunQueue.exec();
              cacheResponseRaw.forEach((cacheResponse) =>
                getCommandCallback(JSON.stringify(cacheResponse))
              );
            } catch (error: Error | unknown) {
              const err: ServerErrorType = {
                log: `Error inside 2nd-catch block of buildFromCache, ${error}`,
                status: 400,
                message: {
                  err: 'Error in buildFromCache. Check server log for more details.'
                }
              };
              console.log(err);
            }
          }
        }
      }

      // Recurse through buildFromCache using typeKey and prototype.
      // If itemFromCache is empty, then check the cache for data; otherwise, persist itemFromCache
      // if this iteration is a nested query (i.e. if typeKey is a field in the query)
      else if (firstRun === false) {
        // If this field is not in the cache, then set this field's value to false.
        if (
          (itemFromCache === null ||
            !Object.prototype.hasOwnProperty.call(itemFromCache, typeKey)) &&
          typeof prototype[typeKey] !== 'object' &&
          !typeKey.includes('__') &&
          !itemFromCache[0]
        ) {
          prototype[typeKey] = false;
        }
        // If this field is a nested query, then recurse the buildFromCache function and iterate through the nested query.
        if (
          !(Object.keys(itemFromCache).length > 0) &&
          typeof itemFromCache === 'object' &&
          !typeKey.includes('__') &&
          typeof prototype[typeKey] === 'object'
        ) {
          const cacheID: string = await this.generateCacheID(prototype);
          const cacheResponse: string | null | void = await this.getFromRedis(
            cacheID
          );
          if (cacheResponse) itemFromCache[typeKey] = JSON.parse(cacheResponse);
          await this.buildFromCache(
            prototype[typeKey] as ProtoObjType,
            prototypeKeys,
            itemFromCache[typeKey],
            false
          );
        }
      }
      // If not an array and not a recursive call, handle normally
      else {
        for (const field in prototype[typeKey] as ProtoObjType) {
          // If field is not found in cache then toggle to false
          if (
            itemFromCache[typeKey] &&
            !Object.prototype.hasOwnProperty.call(
              itemFromCache[typeKey],
              field
            ) &&
            !field.includes('__') &&
            typeof (prototype[typeKey] as ProtoObjType)[field] !== 'object'
          ) {
            (prototype[typeKey] as ProtoObjType)[field] = false;
          }

          // If field contains a nested query, then recurse the function and iterate through the nested query
          if (
            !field.includes('__') &&
            typeof (prototype[typeKey] as ProtoObjType)[field] === 'object'
          ) {
            await this.buildFromCache(
              (prototype[typeKey] as ProtoObjType)[field] as ProtoObjType,
              prototypeKeys,
              itemFromCache[typeKey][field] || {},
              false
            );
          }
          // If there are no data in itemFromCache, toggle to false
          else if (
            !itemFromCache[typeKey] &&
            !field.includes('__') &&
            typeof (prototype[typeKey] as ProtoObjType)[field] !== 'object'
          ) {
            (prototype[typeKey] as ProtoObjType)[field] = false;
          }
        }
      }
    }
    // Return itemFromCache on a data property to resemble GraphQL response format.
    return { data: itemFromCache };
  }

  /**
   * Traverses over response data and formats it appropriately so that it can be stored in the cache.
   * @param {Object} responseData - Data we received from an external source of data such as a database or API.
   * @param {Object} map - Map of queries to their desired data types, used to ensure accurate and consistent caching.
   * @param {Object} protoField - Slice of the prototype currently being used as a template and reference for the responseData to send information to the cache.
   * @param {string} currName - Parent object name, used to pass into updateIDCache.
   */
  async normalizeForCache(
    responseData: ResponseDataType,
    map: QueryMapType = {},
    protoField: ProtoObjType,
    currName: string
  ) {
    // Loop through each resultName in response data
    for (const resultName in responseData) {
      // currField is assigned to the nestedObject on responseData
      const currField = responseData[resultName];
      const currProto: ProtoObjType = protoField[resultName] as ProtoObjType;
      if (Array.isArray(currField)) {
        for (let i = 0; i < currField.length; i++) {
          const el: ResponseDataType = currField[i];

          const dataType: string | undefined | string[] = map[resultName];

          if (typeof el === 'object' && typeof dataType === 'string') {
            await this.normalizeForCache(
              { [dataType]: el },
              map,
              {
                [dataType]: currProto
              },
              currName
            );
          }
        }
      } else if (typeof currField === 'object') {
        // Need to get non-Alias ID for cache

        // Temporary store for field properties
        const fieldStore: ResponseDataType = {};

        // Create a cacheID based on __type and __id from the prototype.
        let cacheID: string = Object.prototype.hasOwnProperty.call(
          map,
          currProto.__type as string
        )
          ? (map[currProto.__type as string] as string)
          : (currProto.__type as string);

        cacheID += currProto.__id ? `--${currProto.__id}` : '';

        // Iterate over keys in nested object
        for (const key in currField) {
          // If prototype has no ID, check field keys for ID (mostly for arrays)
          if (
            !currProto.__id &&
            (key === 'id' || key === '_id' || key === 'ID' || key === 'Id')
          ) {
            // If currname is undefined, assign to responseData at cacheid to lower case at name
            if (responseData[cacheID.toLowerCase()]) {
              const responseDataAtCacheID = responseData[cacheID.toLowerCase()];
              if (
                typeof responseDataAtCacheID !== 'string' &&
                !Array.isArray(responseDataAtCacheID)
              ) {
                if (typeof responseDataAtCacheID.name === 'string') {
                  currName = responseDataAtCacheID.name;
                }
              }
            }
            // If the responseData at lower-cased cacheID at name is not undefined, store under name variable
            // and copy the logic of writing to cache to update the cache with same things, all stored under name.
            // Store objKey as cacheID without ID added
            const cacheIDForIDCache: string = cacheID;
            cacheID += `--${currField[key]}`;
            // call IdCache here idCache(cacheIDForIDCache, cacheID)
            this.updateIdCache(cacheIDForIDCache, cacheID, currName);
          }

          fieldStore[key] = currField[key];

          // If object, recurse normalizeForCache assign in that object
          if (typeof currField[key] === 'object') {
            if (protoField[resultName] !== null) {
              await this.normalizeForCache(
                { [key]: currField[key] },
                map,
                {
                  [key]: (protoField[resultName] as ProtoObjType)[key]
                },
                currName
              );
            }
          }
        }
        // Store "current object" on cache in JSON format
        this.writeToCache(cacheID, fieldStore);
      }
    }
  }

  /**
   * Helper function that creates cacheIDs based on information from the prototype in the
   * format of 'field--ID'.
   * @param {string} key - Unique id under which the cached data will be stored.
   * @param {Object} item - Item to be cached.
   */
  generateCacheID(queryProto: ProtoObjType): string {
    const cacheID: string = queryProto.__id
      ? `${queryProto.__type}--${queryProto.__id}`
      : (queryProto.__type as string);
    return cacheID;
  }

  /**
   * Stringifies and writes an item to the cache unless the key indicates that the item is uncacheable.
   * Sets the expiration time for each item written to cache to the expiration time set on server connection.
   * @param {string} key - Unique id under which the cached data will be stored.
   * @param {Object} item - Item to be cached.
   */
  writeToCache(key: string, item: Type | string[] | ExecutionResult): void {
    const lowerKey: string = key.toLowerCase();
    if (!key.includes('uncacheable')) {
      this.redisCache.set(lowerKey, JSON.stringify(item));
      this.redisCache.EXPIRE(lowerKey, this.cacheExpiration);
    }
  }

  /**
   * Stores keys in a nested object under parent name.
   * If the key is a duplication, it is stored in an array.
   *  @param {string} objKey - Object key; key to be cached without ID string.
   *  @param {string} keyWithID - Key to be cached with ID string attached; Redis data is stored under this key.
   *  @param {string} currName - The parent object name.
   */
  updateIdCache(objKey: string, keyWithID: string, currName: string): void {
    // BUG: Add check - If any of the arguments are missing, return immediately.
    // Currently, if currName is undefined, this function is adding 'undefined' as a
    // key in the idCache.

    if (!idCache[currName]) {
      // If the parent object is not yet defined in the idCache, create the object and add the new key.
      idCache[currName] = {};
      idCache[currName][objKey] = keyWithID;
      return;
    } else if (!idCache[currName][objKey]) {
      // If parent object is defined in the idCache, but this is the first child ID, create the
      // array that the ID will be added to.
      idCache[currName][objKey] = [];
    }
    // Add the ID to the array in the idCache.
    (idCache[currName][objKey] as string[]).push(keyWithID);
  }

  /**
   * Updates the Redis cache when the operation is a mutation.
   * - For update and delete mutations, checks if the mutation query includes an id.
   * If so, it will update the cache at that id. If not, it will iterate through the cache
   * to find the appropriate fields to update/delete.
   * @param {Object} dbRespDataRaw - Raw response from the database returned following mutation.
   * @param {string} mutationName - Name of the mutation (e.g. addItem).
   * @param {string} mutationType - Type of mutation (add, update, delete).
   * @param {Object} mutationQueryObject - Arguments and values for the mutation.
   */
  async updateCacheByMutation(
    dbRespDataRaw: DatabaseResponseDataRaw | ExecutionResult,
    mutationName: string,
    mutationType: string,
    mutationQueryObject: QueryFields | ProtoObjType
  ) {
    let fieldsListKey: string;
    let dbRespId = '';
    let dbRespData: Type = {};
    if (dbRespDataRaw.data) {
      // TODO: Need to modify this logic if ID is not being requested back during
      // mutation query.
      // dbRespDataRaw.data[mutationName] will always return the value at the mutationName
      // in the form of an object.
      dbRespId = (dbRespDataRaw.data[mutationName] as TypeData)?.id as string;
      dbRespData = JSON.parse(JSON.stringify(dbRespDataRaw.data[mutationName]));
    }

    for (const queryKey in this.queryMap) {
      const queryKeyType: string | string[] = this.queryMap[queryKey] as
        | string
        | string[];

      if (JSON.stringify(queryKeyType) === JSON.stringify([mutationType])) {
        fieldsListKey = queryKey;
        break;
      }
    }

    /**
     * Helper function to delete field keys from cached field list.
     * @param {Set<string> | Array<string>} fieldKeysToRemove - Field keys to be removed from the cached field list.
     */
    const removeFromFieldKeysList = async (
      fieldKeysToRemove: Set<string> | Array<string>
    ) => {
      if (fieldsListKey) {
        const cachedFieldKeysListRaw = await this.getFromRedis(fieldsListKey);
        if (
          cachedFieldKeysListRaw !== null &&
          cachedFieldKeysListRaw !== undefined
        ) {
          const cachedFieldKeysList: string[] = JSON.parse(
            cachedFieldKeysListRaw
          );

          fieldKeysToRemove.forEach((fieldKey: string) => {
            // Index position of field key to remove from list of field keys
            const removalFieldKeyIdx: number =
              cachedFieldKeysList.indexOf(fieldKey);

            if (removalFieldKeyIdx !== -1) {
              cachedFieldKeysList.splice(removalFieldKeyIdx, 1);
            }
          });
          this.writeToCache(fieldsListKey, cachedFieldKeysList);
        }
      }
    };

    /**
     * Helper function that loops through the cachedFieldKeysList and helps determine which
     * fieldKeys should be deleted and passes those fields to removeFromFieldKeysList for removal.
     */
    const deleteApprFieldKeys = async () => {
      if (fieldsListKey) {
        const cachedFieldKeysListRaw = await this.getFromRedis(fieldsListKey);
        if (
          cachedFieldKeysListRaw !== null &&
          cachedFieldKeysListRaw !== undefined
        ) {
          const cachedFieldKeysList: string[] = JSON.parse(
            cachedFieldKeysListRaw
          );

          const fieldKeysToRemove: Set<string> = new Set();
          for (let i = 0; i < cachedFieldKeysList.length; i++) {
            const fieldKey: string = cachedFieldKeysList[i];

            const fieldKeyValueRaw = await this.getFromRedis(
              fieldKey.toLowerCase()
            );
            if (fieldKeyValueRaw !== null && fieldKeyValueRaw !== undefined) {
              const fieldKeyValue = JSON.parse(fieldKeyValueRaw);

              let remove = true;
              for (const arg in mutationQueryObject.__args as ProtoObjType) {
                if (Object.prototype.hasOwnProperty.call(fieldKeyValue, arg)) {
                  const argValue: string = (
                    mutationQueryObject.__args as ProtoObjType
                  )[arg] as string;
                  if (fieldKeyValue[arg] !== argValue) {
                    remove = false;
                    break;
                  }
                } else {
                  remove = false;
                  break;
                }
              }

              if (remove === true) {
                fieldKeysToRemove.add(fieldKey);
                this.deleteCacheById(fieldKey.toLowerCase());
              }
            }
          }
          removeFromFieldKeysList(fieldKeysToRemove);
        }
      }
    };

    /**
     * Helper function that loops through the cachedFieldKeysList and updates the appropriate
     * field key values and writes the updated values to the redis cache
     */
    const updateApprFieldKeys = async () => {
      const cachedFieldKeysListRaw = await this.getFromRedis(fieldsListKey);
      // conditional just in case the resolver wants to throw an error. instead of making quellCache invoke it's caching functions, we break here.
      if (cachedFieldKeysListRaw === undefined) return;
      // list of field keys stored on redis
      if (cachedFieldKeysListRaw !== null) {
        const cachedFieldKeysList: string[] = JSON.parse(
          cachedFieldKeysListRaw
        );

        // Iterate through field key field key values in Redis, and compare to user
        // specified mutation args to determine which fields are used to update by
        // and which fields need to be updated.

        cachedFieldKeysList.forEach(async (fieldKey) => {
          const fieldKeyValueRaw = await this.getFromRedis(
            fieldKey.toLowerCase()
          );
          if (fieldKeyValueRaw !== null && fieldKeyValueRaw !== undefined) {
            const fieldKeyValue: ResponseDataType =
              JSON.parse(fieldKeyValueRaw);

            const fieldsToUpdateBy: string[] = [];
            const updatedFieldKeyValue: ResponseDataType = fieldKeyValue;

            Object.entries(mutationQueryObject.__args as ProtoObjType).forEach(
              ([arg, argVal]) => {
                if (arg in fieldKeyValue && fieldKeyValue[arg] === argVal) {
                  // Foreign keys are not fields to update by
                  if (arg.toLowerCase().includes('id') === false) {
                    fieldsToUpdateBy.push(arg);
                  }
                } else {
                  if (typeof argVal === 'string')
                    updatedFieldKeyValue[arg] = argVal;
                }
              }
            );

            if (fieldsToUpdateBy.length > 0) {
              this.writeToCache(fieldKey, updatedFieldKeyValue);
            }
          }
        });
      }
    };
    // If there is no id property on dbRespDataRaw.data[mutationName]
    // dbRespId defaults to an empty string and no redisKey will be found.
    const hypotheticalRedisKey = `${mutationType.toLowerCase()}--${dbRespId}`;
    const redisKey: string | void | null = await this.getFromRedis(
      hypotheticalRedisKey
    );

    if (redisKey) {
      // If the key was found in the Redis server cache, the mutation is either update or delete mutation.
      if (mutationQueryObject.__id) {
        // If the user specifies dbRespId as an argument in the mutation, then we only need to
        // update/delete a single cache entry by dbRespId.
        if (mutationName.substring(0, 3) === 'del') {
          // If the first 3 letters of the mutationName are 'del' then the mutation is a delete mutation.
          // Users have to prefix their delete mutations with 'del' so that quell can distinguish between delete/update mutations.
          this.deleteCacheById(
            `${mutationType.toLowerCase()}--${mutationQueryObject.__id}`
          );
          removeFromFieldKeysList([`${mutationType}--${dbRespId}`]);
        } else {
          // Update mutation for single dbRespId
          this.writeToCache(
            `${mutationType.toLowerCase()}--${mutationQueryObject.__id}`,
            dbRespData
          );
        }
      } else {
        // If the user didn't specify dbRespId, we need to iterate through all key value pairs and determine which key values match dbRespData.
        // Note that there is a potential edge case here if there are no queries that have type GraphQLList.
        // if (!fieldsListKey) throw 'error: schema must have a GraphQLList';

        // Unused variable
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const removalFieldKeysList = [];

        if (mutationName.substring(0, 3) === 'del') {
          // Mutation is delete mutation
          deleteApprFieldKeys();
        } else {
          updateApprFieldKeys();
        }
      }
    } else {
      // If the key was not found in the Redis server cache, the mutation is an add mutation.
      this.writeToCache(hypotheticalRedisKey, dbRespData);
    }
  }

  /**
   * Removes key-value from the cache unless the key indicates that the item is not available.
   * @param {string} key - Unique id under which the cached data is stored that needs to be removed.
   */
  async deleteCacheById(key: string) {
    try {
      await this.redisCache.del(key);
    } catch (error) {
      const err: ServerErrorType = {
        log: `Error inside deleteCacheById function, ${error}`,
        status: 400,
        message: {
          err: 'Error in redis - deleteCacheById, Check server log for more details.'
        }
      };
      console.log(err);
    }
  }

  /**
   * Flushes the Redis cache. To clear the cache from the client, establish an endpoint that
   * passes the request and response objects to an instance of QuellCache.clearCache.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   */
  clearCache(req: Request, res: Response, next: NextFunction) {
    console.log('Clearing Redis Cache');
    this.redisCache.flushAll();
    idCache = {};
    return next();
  }

  /**
   * Returns a chain of middleware based on what information (if any) the user would
   * like to request from the specified redisCache. It requires an appropriately
   * configured Express route and saves the specified stats to res.locals, for instance:
   * @example
   *  app.use('/redis', ...quellCache.getRedisInfo({
   *    getStats: true,
   *    getKeys: true,
   *    getValues: true
   *  }));
   * @param {Object} options - Three properties with boolean values:
   *                           getStats, getKeys, getValues
   * @returns {Array} An array of middleware functions that retrieves specified Redis info.
   */
  getRedisInfo(
    options: RedisOptionsType = {
      getStats: true,
      getKeys: true,
      getValues: true
    }
  ): RequestHandler[] {
    console.log('Getting Redis Info');
    const middleware: RequestHandler[] = [];

    /**
     * Helper function within the getRedisInfo function that returns
     * what redis data should be retrieved based on the passed in options.
     * @param {Object} opts - Options object containing a boolean value for getStats, getKeys, and getValues.
     * @returns {string} String that indicates which data should be retrieved from Redis instance.
     */
    const getOptions = (opts: RedisOptionsType): string => {
      const { getStats, getKeys, getValues } = opts;
      if (!getStats && getKeys && getValues) return 'dontGetStats';
      else if (getStats && getKeys && !getValues) return 'dontGetValues';
      else if (!getStats && getKeys && !getValues) return 'getKeysOnly';
      else if (getStats && !getKeys && !getValues) return 'getStatsOnly';
      else return 'getAll';
    };

    switch (getOptions(options)) {
      case 'dontGetStats':
        middleware.push(this.getRedisKeys, this.getRedisValues);
        break;
      case 'dontGetValues':
        middleware.push(this.getStatsFromRedis, this.getRedisKeys);
        break;
      case 'getKeysOnly':
        middleware.push(this.getRedisKeys);
        break;
      case 'getStatsOnly':
        middleware.push(this.getStatsFromRedis);
        break;
      case 'getAll':
        middleware.push(
          this.getStatsFromRedis,
          this.getRedisKeys,
          this.getRedisValues
        );
        break;
    }

    return middleware;
  }

  /**
   * Gets information and statistics about the server and adds them to the response.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   */
  getStatsFromRedis(req: Request, res: Response, next: NextFunction): void {
    try {
      const getStats = () => {
        // redisCache.info returns information and statistics about the server as an array of field:value.
        this.redisCache
          .info()
          .then((response: string) => {
            const dataLines: string[] = response.split('\r\n');
            const output: RedisStatsType = {
              // SERVER
              server: [
                // Redis version
                {
                  name: 'Redis version',
                  value: dataLines
                    .find((line) => line.match(/redis_version/))
                    ?.split(':')[1]
                },
                // Redis build id
                {
                  name: 'Redis build id',
                  value: dataLines
                    .find((line) => line.match(/redis_build_id/))
                    ?.split(':')[1]
                },
                // Redis mode
                {
                  name: 'Redis mode',
                  value: dataLines
                    .find((line) => line.match(/redis_mode/))
                    ?.split(':')[1]
                },
                // OS hosting Redis system
                {
                  name: 'Host operating system',
                  value: dataLines
                    .find((line) => line.match(/os/))
                    ?.split(':')[1]
                },
                // TCP/IP listen port
                {
                  name: 'TCP/IP port',
                  value: dataLines
                    .find((line) => line.match(/tcp_port/))
                    ?.split(':')[1]
                },
                // Server time
                // {
                //   name: 'System time',
                //   value: dataLines
                //     .find((line) => line.match(/server_time_in_usec/))
                //     .split(':')[1],
                // },
                // Number of seconds since Redis server start
                {
                  name: 'Server uptime (seconds)',
                  value: dataLines
                    .find((line) => line.match(/uptime_in_seconds/))
                    ?.split(':')[1]
                },
                // Number of days since Redis server start
                {
                  name: 'Server uptime (days)',
                  value: dataLines
                    .find((line) => line.match(/uptime_in_days/))
                    ?.split(':')[1]
                },
                // Path to server's executable
                // {
                //   name: 'Path to executable',
                //   value: dataLines
                //     .find((line) => line.match(/executable/))
                //     .split(':')[1],
                // },
                // Path to server's configuration file
                {
                  name: 'Path to configuration file',
                  value: dataLines
                    .find((line) => line.match(/config_file/))
                    ?.split(':')[1]
                }
              ],
              // CLIENT
              client: [
                // Number of connected clients
                {
                  name: 'Connected clients',
                  value: dataLines
                    .find((line) => line.match(/connected_clients/))
                    ?.split(':')[1]
                },
                // Number of sockets used by cluster bus
                {
                  name: 'Cluster connections',
                  value: dataLines
                    .find((line) => line.match(/cluster_connections/))
                    ?.split(':')[1]
                },
                // Max clients
                {
                  name: 'Max clients',
                  value: dataLines
                    .find((line) => line.match(/maxclients/))
                    ?.split(':')[1]
                },
                // Number of clients being tracked
                // {
                //   name: 'Tracked clients',
                //   value: dataLines
                //     .find((line) => line.match(/tracking_clients/))
                //     .split(':')[1],
                // },
                // Blocked clients
                {
                  name: 'Blocked clients',
                  value: dataLines
                    .find((line) => line.match(/blocked_clients/))
                    ?.split(':')[1]
                }
              ],
              // MEMORY
              memory: [
                // Total allocated memory
                {
                  name: 'Total allocated memory',
                  value: dataLines
                    .find((line) => line.match(/used_memory_human/))
                    ?.split(':')[1]
                },
                // Peak memory consumed
                {
                  name: 'Peak memory consumed',
                  value: dataLines
                    .find((line) => line.match(/used_memory_peak_human/))
                    ?.split(':')[1]
                }
                // % of peak out of total
                // {
                //   name: 'Peak memory used % total',
                //   value: dataLines
                //     .find((line) => line.match(/used_memory_peak_perc/))
                //     .split(':')[1],
                // },
                // Initial amount of memory consumed at startup
                // {
                //   name: 'Memory consumed at startup',
                //   value: dataLines
                //     .find((line) => line.match(/used_memory_startup/))
                //     .split(':')[1],
                // },
                // Size of dataset
                // {
                //   name: 'Dataset size (bytes)',
                //   value: dataLines
                //     .find((line) => line.match(/used_memory_dataset/))
                //     .split(':')[1],
                // },
                // Percent of data out of net memory usage
                // {
                //   name: 'Dataset memory % total',
                //   value: dataLines
                //     .find((line) => line.match(/used_memory_dataset_perc/))
                //     .split(':')[1],
                // },
                // Total system memory
                // {
                //   name: 'Total system memory',
                //   value: dataLines
                //     .find((line) => line.match(/total_system_memory_human/))
                //     .split(':')[1],
                // },
              ],
              // STATS
              stats: [
                // Total number of connections accepted by server
                {
                  name: 'Total connections',
                  value: dataLines
                    .find((line) => line.match(/total_connections_received/))
                    ?.split(':')[1]
                },
                // Total number of commands processed by server
                {
                  name: 'Total commands',
                  value: dataLines
                    .find((line) => line.match(/total_commands_processed/))
                    ?.split(':')[1]
                },
                // Number of commands processed per second
                {
                  name: 'Commands processed per second',
                  value: dataLines
                    .find((line) => line.match(/instantaneous_ops_per_sec/))
                    ?.split(':')[1]
                },
                // Total number of keys being tracked
                // {
                //   name: 'Tracked keys',
                //   value: dataLines
                //     .find((line) => line.match(/tracking_total_keys/))
                //     .split(':')[1],
                // },
                // Total number of items being tracked(sum of clients number for each key)
                // {
                //   name: 'Tracked items',
                //   value: dataLines
                //     .find((line) => line.match(/tracking_total_items/))
                //     .split(':')[1],
                // },
                // Total number of read events processed
                // {
                //   name: 'Reads processed',
                //   value: dataLines
                //     .find((line) => line.match(/total_reads_processed/))
                //     .split(':')[1],
                // },
                // Total number of write events processed
                // {
                //   name: 'Writes processed',
                //   value: dataLines
                //     .find((line) => line.match(/total_writes_processed/))
                //     .split(':')[1],
                // },
                // Total number of error replies
                {
                  name: 'Error replies',
                  value: dataLines
                    .find((line) => line.match(/total_error_replies/))
                    ?.split(':')[1]
                },
                // Total number of bytes read from network
                {
                  name: 'Bytes read from network',
                  value: dataLines
                    .find((line) => line.match(/total_net_input_bytes/))
                    ?.split(':')[1]
                },
                // Networks read rate per second
                {
                  name: 'Network read rate (Kb/s)',
                  value: dataLines
                    .find((line) => line.match(/instantaneous_input_kbps/))
                    ?.split(':')[1]
                },
                // Total number of bytes written to network
                // {
                //   name: 'Bytes written to network',
                //   value: dataLines
                //     .find((line) => line.match(/total_net_output_bytes/))
                //     .split(':')[1],
                // },
                // Networks write rate per second
                {
                  name: 'Network write rate (Kb/s)',
                  value: dataLines
                    .find((line) => line.match(/instantaneous_output_kbps/))
                    ?.split(':')[1]
                }
              ]
            };
            res.locals.redisStats = output;
            return next();
          })
          .catch((error) => {
            const err: ServerErrorType = {
              log: `Error inside catch block of getting info within getStatsFromRedis, ${error}`,
              status: 400,
              message: {
                err: 'Error in redis - getStatsFromRedis. Check server log for more details.'
              }
            };
            return next(err);
          });
      };
      getStats();
    } catch (error) {
      const err: ServerErrorType = {
        log: `Error inside catch block of getStatsFromRedis, ${error}`,
        status: 400,
        message: {
          err: 'Error in redis - getStatsFromRedis. Check server log for more details.'
        }
      };
      return next(err);
    }
  }

  /**
   * Gets the key names from the Redis cache and adds them to the response.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   */
  getRedisKeys(req: Request, res: Response, next: NextFunction): void {
    this.redisCache
      .keys('*')
      .then((response: string[]) => {
        res.locals.redisKeys = response;
        return next();
      })
      .catch((error: ServerErrorType) => {
        const err: ServerErrorType = {
          log: `Error inside catch block of getRedisKeys, keys potentially undefined, ${error}`,
          status: 400,
          message: {
            err: 'Error in redis - getRedisKeys. Check server log for more details.'
          }
        };
        return next(err);
      });
  }

  /**
   * Gets the values associated with the Redis cache keys and adds them to the response.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   */
  getRedisValues(req: Request, res: Response, next: NextFunction): void {
    if (res.locals.redisKeys.length !== 0) {
      this.redisCache
        .mGet(res.locals.redisKeys)
        .then((response: (string | null)[]) => {
          res.locals.redisValues = response;
          return next();
        })
        .catch((error: ServerErrorType) => {
          const err: ServerErrorType = {
            log: `Error inside catch block of getRedisValues, ${error}`,
            status: 400,
            message: {
              error:
                'Error in redis - getRedisValues. Check server log for more details.'
            }
          };
          return next(err);
        });
    } else {
      res.locals.redisValues = [];
      return next();
    }
  }

  /**
   * Takes in the query, parses it, and identifies the general shape of the request in order
   * to compare the query's depth to the depth limit set on server connection.
   *
   * In the instance of a malicious or overly nested query, short-circuits the query before
   * it goes to the database and passes an error with a status code 413 (content too large).
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {void} Passes an error to Express if no query was included in the request or if the depth exceeds the maximum allowed depth.
   */
  // what parameters should they take? If middleware, good as is, has to take in query obj in request, limit set inside.
  // If function inside whole of Quell, (query, limit), so they are explicitly defined and passed in
  depthLimit(req: Request, res: Response, next: NextFunction): void {
    // Get maximum depth limit from the cost parameters set on server connection.
    const { maxDepth } = this.costParameters;

    // Get the GraphQL query string from request body.
    const queryString: string = req.body.query;

    // Pass error to Express if no query is found on the request.
    if (!queryString) {
      {
        const err: ServerErrorType = {
          log: 'Invalid request, no query found in req.body',
          status: 400,
          message: {
            err: 'Error in middleware function: depthLimit. Check server log for more details.'
          }
        };
        return next(err);
      }
    }

    // Create the abstract syntax tree with graphql-js parser.
    // If costLimit was included before depthLimit in middleware chain, we can get the AST and parsed AST from res.locals.
    const AST: DocumentNode = res.locals.AST
      ? res.locals.AST
      : parse(queryString);

    // Create response prototype, operation type, and fragments object.
    // The response prototype is used as a template for most operations in Quell including caching, building modified requests, and more.
    const {
      proto,
      operationType,
      frags
    }: { proto: ProtoObjType; operationType: string; frags: FragsType } =
      res.locals.parsedAST ?? parseAST(AST);

    // Combine fragments on prototype so we can access fragment values in cache.
    const prototype =
      Object.keys(frags).length > 0
        ? updateProtoWithFragment(proto, frags)
        : proto;

    /**
     * Recursive helper function that determines if the depth of the prototype object
     * is greater than the maxDepth.
     * @param {Object} proto - The prototype object to determine the depth of.
     * @param {number} [currentDepth=0] - The current depth of the object. Defaults to 0.
     * @returns {void} Passes an error to Express if the depth of the prototype exceeds the maxDepth.
     */
    const determineDepth = (proto: ProtoObjType, currentDepth = 0): void => {
      if (currentDepth > maxDepth) {
        // Pass error to Express if the maximum depth has been exceeded.
        const err: ServerErrorType = {
          log: `Depth limit exceeded, tried to send query with the depth of ${currentDepth}.`,
          status: 413, // Content Too Large
          message: {
            err: 'Error in QuellCache.determineDepth. Check server log for more details.'
          }
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // Loop through the fields, recursing and increasing currentDepth by 1 if the field is nested.
      Object.keys(proto).forEach((key) => {
        if (typeof proto[key] === 'object' && !key.includes('__')) {
          determineDepth(proto[key] as ProtoObjType, currentDepth + 1);
        }
      });
    };

    // Call the helper function.
    determineDepth(prototype);
    // Attach the AST and parsed AST to res.locals so that the next middleware doesn't need to determine these again.
    res.locals.AST = AST;
    res.locals.parsedAST = { proto, operationType, frags };
    return next();
  }

  /**
   * Checks the cost of the query. In the instance of a malicious or overly nested query,
   * short-circuits the query before it goes to the database and passes an error with a
   * status code 413 (content too large).
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   * @returns {void} Passes an error to Express if no query was included in the request or if the cost exceeds the maximum allowed cost.
   */
  costLimit(req: Request, res: Response, next: NextFunction): void {
    // Get the cost parameters set on server connection.
    const { maxCost, mutationCost, objectCost, depthCostFactor, scalarCost } =
      this.costParameters;

    // Get the GraphQL query string from request body.
    const queryString: string = req.body.query;

    // Pass error to Express if no query is found on the request.
    if (!queryString) {
      const err: ServerErrorType = {
        log: 'Invalid request, no query found in req.body',
        status: 400,
        message: {
          err: 'Error in QuellCache.costLimit. Check server log for more details.'
        }
      };
      return next(err);
    }

    // Create the abstract syntax tree with graphql-js parser.
    // If depthLimit was included before costLimit in middleware chain, we can get the AST and parsed AST from res.locals.
    const AST: DocumentNode = res.locals.AST
      ? res.locals.AST
      : parse(queryString);

    // Create response prototype, operation type, and fragments object.
    // The response prototype is used as a template for most operations in Quell including caching, building modified requests, and more.
    const {
      proto,
      operationType,
      frags
    }: { proto: ProtoObjType; operationType: string; frags: FragsType } =
      res.locals.parsedAST ?? parseAST(AST);

    // Combine fragments on prototype so we can access fragment values in cache.
    const prototype =
      Object.keys(frags).length > 0
        ? updateProtoWithFragment(proto, frags)
        : proto;

    // Set initial cost to 0.
    // If the operation is a mutation, add to the cost the mutation cost multiplied by the number of mutations.
    let cost = 0;
    if (operationType === 'mutation') {
      cost += Object.keys(prototype).length * mutationCost;
    }

    /**
     * Helper function to pass an error if the cost of the proto is greater than the maximum cost set on server connection.
     * @param {Object} proto - The prototype object to determine the cost of.
     * @returns {void} Passes an error to Express if the cost of the prototype exceeds the maxCost.
     */
    const determineCost = (proto: ProtoObjType): void => {
      // Pass error to Express if the maximum cost has been exceeded.
      if (cost > maxCost) {
        const err: ServerErrorType = {
          log: `Cost limit exceeded, tried to send query with a cost exceeding ${maxCost}.`,
          status: 413, // Content Too Large
          message: {
            err: 'Error in costLimit.determineCost(helper). Check server log for more details.'
          }
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // Loop through the fields on the prototype.
      Object.keys(proto).forEach((key) => {
        if (typeof proto[key] === 'object' && !key.includes('__')) {
          // If the current field is nested, recurse and increase the total cost by objectCost.
          cost += objectCost;
          return determineCost(proto[key] as ProtoObjType);
        }
        // If the current field is scalar, increase the total cost by the scalarCost.
        if (proto[key] === true && !key.includes('__')) {
          cost += scalarCost;
        }
      });
    };

    determineCost(prototype);

    /**
     * Helper function to pass an error if the cost of the proto, taking into account depth levels, is greater than
     * the maximum cost set on server connection.
     *
     * This function essentially multiplies the cost by a depth cost adjustment, which is equal to the
     * depthCostFactor raised to the power of the depth.
     * @param {Object} proto - The prototype object to determine the cost of.
     * @param {number} totalCost - Current cost of the prototype.
     * @returns {void} Passes an error to Express if the cost of the prototype exceeds the maxCost.
     */
    const determineDepthCost = (
      proto: ProtoObjType,
      totalCost = cost
    ): void => {
      // Pass error to Express if the maximum cost has been exceeded.
      if (totalCost > maxCost) {
        const err: ServerErrorType = {
          log: `Cost limit exceeded, tried to send query with a cost exceeding ${maxCost}.`,
          status: 413, // Content Too Large
          message: {
            err: 'Error in costLimit.determineDepthCost(helper). Check server log for more details.'
          }
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // Loop through the fields, recursing and multiplying the current total cost
      // by the depthCostFactor if the field is nested.
      Object.keys(proto).forEach((key) => {
        if (typeof proto[key] === 'object' && !key.includes('__')) {
          determineDepthCost(
            proto[key] as ProtoObjType,
            totalCost * depthCostFactor
          );
        }
      });
    };

    determineDepthCost(prototype);

    // Attach the AST and parsed AST to res.locals so that the next middleware doesn't need to determine these again.
    res.locals.AST = AST;
    res.locals.parsedAST = { proto, operationType, frags };
    return next();
  }
}
