import { Response, Request, NextFunction, RequestHandler } from 'express';
import { parse } from 'graphql/language/parser';
import { graphql } from 'graphql';
import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import {
  getFieldsMap,
  updateProtoWithFragment,
  parseAST,
  joinResponses,
  getQueryMap,
  getMutationMap,
  createQueryStr,
  createQueryObj
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
 *    - it takes in a schema, redis specifications grouped into an object, cache expiration time in seconds,
 *    and cost parameters as an object
 *    - if there is no cache expiration provided by the user, cacheExpiration defaults to 14 days in seconds,
 *    - if there are no cost parameters provided by the user, costParameters is given the default values
 *    found in defaultCostParameters
 *  @param {Object} schema - GraphQL defined schema that is used to facilitate caching by providing valid queries,
 *  mutations, and fields
 *  @param {Number} cacheExpiration - Time in seconds for redis values to be evicted from the cache
 *  @param {Object} costParameters - An object with key-pair values for maxCost, mutationCost, objectCost,
 *  scalarCost, depthCostFactor, maxDepth, ipRate
 *  @param {Number} redisPort - Redis port that Quell uses to facilitate caching
 *  @param {String} redisHost - Redis host URI
 *  @param {String} redisPassword - Redis password to host URI
 */
// default host is localhost, default expiry time is 14 days in milliseconds
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
    cacheExpiration = 1209600, // default expiry time is 14 days in milliseconds;
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
          log: 'Error when trying to connect to redisCache',
          status: 400,
          message: { err: `Error trying to connect to redisCache ${error}` }
        };
        console.log(err);
      });
  }

  /**
   * A redis-based IP rate limiter method. It:
   *    - receives the ipRate in requests per second from the request object on the front-end,
   *    - if there is no ipRate set on front-end, it'll default to the value in the defaultCostParameters,
   *    - creates a key using the IP address and current time in seconds,
   *    - increments the value at this key for each new call received,
   *    - if the value of calls is greater than the ipRate limit, it will not process the query,
   *    - keys are set to expire after 1 second
   *  @param {Object} req - Express request object, including request body with GraphQL query string
   *  @param {Object} res - Express response object, will carry query response to next middleware
   *  @param {Function} next - Express next middleware function, invoked when QuellCache completes its work
   */
  async rateLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // Set ipRate to the ipRate limit from the request body or use default.
    const ipRateLimit: number =
      req.body.costOptions?.ipRate ?? this.costParameters.ipRate;
    // Get the IP address from the request.
    const ipAddress: string = req.ip;
    // Get the current time in seconds.
    const currentTimeSeconds: number = Math.floor(Date.now() / 1000);
    // Create a Redis IP key using the IP address and current time.
    const redisIpTimeKey = `${ipAddress}:${currentTimeSeconds}`;

    // Return an error if no query is found in the request.
    if (!req.body.query) {
      const err: ServerErrorType = {
        log: 'Error: no GraphQL query found on request body, inside rateLimiter',
        status: 400,
        message: { err: 'Error: no GraphQL query found on request body' }
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
          status: 429,
          message: {
            err: 'Error in rateLimiter middleware'
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
        log: 'Catch block in rateLimiter middleware',
        status: 500,
        message: { err: `Error in rateLimiter, ${error}` }
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
   *  @param {Object} req - Express request object, including request body with GraphQL query string
   *  @param {Object} res - Express response object, will carry query response to next middleware
   *  @param {Function} next - Express next middleware function, invoked when QuellCache completes its work
   */
  async query(req: Request, res: Response, next: NextFunction): Promise<void> {
    // handle request without query
    if (!req.body.query) {
      const err: ServerErrorType = {
        log: 'Error: no GraphQL query found on request body',
        status: 400,
        message: { err: 'Error: no GraphQL query found on request body' }
      };
      return next(err);
    }

    // Retrieve GraphQL query string from request body.
    const queryString: string = req.body.query;

    // Create abstract syntax tree with graphql-js parser.
    // If depth limit was implemented, then we can get the parsed query from res.locals.
    const AST: DocumentNode = res.locals.AST
      ? res.locals.AST
      : parse(queryString);

    // create response prototype, and operation type, and fragments object
    // the response prototype is used as a template for most operations in quell including caching, building modified requests, and more
    const {
      proto,
      operationType,
      frags
    }: { proto: ProtoObjType; operationType: string; frags: FragsType } =
      res.locals.parsedAST ?? parseAST(AST);

    // Determine if Quell is able to handle the operation.
    // Quell can handle mutations and queries.

    /*
     * If the operation is unQuellable (cannot be cached), execute the operation,
     * add the result to the response, and return.
     */
    if (operationType === 'unQuellable') {
      graphql({ schema: this.schema, source: queryString })
        .then((queryResult: ExecutionResult): void => {
          res.locals.queryResponse = queryResult;
          return next();
        })
        .catch((error: Error): void => {
          const err: ServerErrorType = {
            log: 'Error inside catch block of operationType === unQuellable of query',
            status: 400,
            message: { err: `Error in query, ${error}` }
          };
          return next(err);
        });

      /*
       * we can have two types of operation to take care of
       * MUTATION OR QUERY
       */
    } else if (operationType === 'noID') {
      graphql({ schema: this.schema, source: queryString })
        .then((queryResult: ExecutionResult): void => {
          res.locals.queryResponse = queryResult;
          return next();
        })
        .catch((error: Error): void => {
          const err: ServerErrorType = {
            log: 'Error inside catch block of operationType === noID of query',
            status: 400,
            message: { err: `Error in query, ${error}` }
          };
          return next(err);
        });

      // Check Redis for the query string.
      let redisValue: string | null | void = await this.getFromRedis(
        queryString
      );

      // If the query string is found in Redis, add the result to the response and return.
      if (redisValue != null) {
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
              log: 'Error inside catch block of operationType === noID of query, graphQL query failed',
              status: 400,
              message: { err: `Error in query, ${error}` }
            };
            return next(err);
          });
      }
      /*
       * If the operation is a mutation
       */
    } else if (operationType === 'mutation') {
      /*
       * Currently clearing the cache on mutation because it is stale.
       * We should instead be updating the cache following a mutation.
       */
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
      //Can possibly modify query to ALWAYS have an ID but not necessarily return it back to client
      // unless they also queried for it.
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
            log: 'Error inside catch block of operationType === mutation of query',
            status: 400,
            message: { err: `Error in query ${error}` }
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
      const prototypeKeys = Object.keys(prototype);

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
              log: 'Error inside catch block of operationType === query of query',
              status: 400,
              message: { err: `Error in query ${error}` }
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
   * getFromRedis reads from Redis cache and returns a promise (Redis v4 natively returns a promise).
   * @param {String} key - the key for Redis lookup
   * @returns {Promise} A promise representing the value from the redis cache with the provided key
   */
  async getFromRedis(key: string): Promise<string | null | void> {
    try {
      if (typeof key !== 'string' || key === undefined) return;
      const lowerKey: string = key.toLowerCase();
      const redisResult: string | null = await this.redisCache.get(lowerKey);
      return redisResult;
    } catch (error) {
      const err: ServerErrorType = {
        log: 'Error in QuellCache trying to getFromRedis',
        status: 400,
        message: { err: `Error in getFromRedis, ${error}` }
      };
      console.log('err in getFromRedis: ', err);
    }
  }

  /**
   * buildFromCache finds any requested information in the cache and assembles it on the cacheResponse
   * uses the prototype as a template for cacheResponse, marks any data not found in the cache on the prototype for future retrieval from database
   * @param {Object} prototype - unique id under which the cached data will be stored
   * @param {Array} prototypeKeys - keys in the prototype
   * @param {Object} itemFromCache - item to be cached
   * @param {boolean} firstRun - boolean indicated if this is the first run
   * @param {boolean|string} subID - used to pass id to recursive calls
   * @returns {Object} cacheResponse, mutates prototype
   */
  async buildFromCache(
    prototype: ProtoObjType,
    prototypeKeys: string[],
    itemFromCache: ItemFromCacheType = {},
    firstRun = true,
    subID: boolean | string = false
  ): Promise<{ data: ItemFromCacheType }> {
    for (const typeKey in prototype) {
      // if current key is a root query, check cache and set any results to itemFromCache
      if (prototypeKeys.includes(typeKey)) {
        let cacheID: string = this.generateCacheID(
          prototype[typeKey] as ProtoObjType
        );
        let keyName: string | undefined;
        if (typeof subID === 'string') {
          cacheID = subID;
        }
        // let cacheID: string = subID || this.generateCacheID(prototype[typeKey]);
        // value won't always be at .name on the args object
        if ((prototype[typeKey] as ProtoObjType)?.__args === null) {
          keyName = undefined;
        } else {
          keyName = Object.values(
            (prototype[typeKey] as ProtoObjType)?.__args as object
          )[0];
        }
        // is this also redundent
        if (idCache[keyName as string] && idCache[keyName as string][cacheID]) {
          cacheID = idCache[keyName as string][cacheID] as string;
        }
        // capitalize first letter of cache id just in case
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

      // if itemFromCache at the current key is an array, iterate through and gather data
      if (Array.isArray(itemFromCache[typeKey])) {
        // Create a new Redis run queue.
        let redisRunQueue: ReturnType<typeof this.redisCache.multi> =
          this.redisCache.multi();

        for (let i = 0; i < itemFromCache[typeKey].length; i++) {
          if (typeof itemFromCache[typeKey] === 'string') {
            /**
             * getCommandCallback is a helper function that will be called for each response in the
             * array of responses returned by Redis' exec() command within buildFromCache.
             * @param {String} cacheResponse - response from one of the get commands in the Redis queue
             */
            const getCommandCallback = (cacheResponse: string): void => {
              const tempObj: ItemFromCacheType = {};

              if (cacheResponse) {
                const interimCache: ItemFromCacheType =
                  JSON.parse(cacheResponse);

                for (const property in prototype[typeKey] as ProtoObjType) {
                  // if property exists, set on tempObj
                  if (
                    Object.prototype.hasOwnProperty.call(
                      interimCache,
                      property
                    ) &&
                    !property.includes('__')
                  ) {
                    tempObj[property] = interimCache[property];
                  }
                  // if prototype is nested at this field, recurse
                  else if (
                    !property.includes('__') &&
                    typeof (prototype[typeKey] as ProtoObjType)[property] ===
                      'object'
                  ) {
                    // same as return type for buildfromcache
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
                  // if cache does not have property, set to false on prototype so that it is sent to graphQL
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
              // if there is nothing in the cache for this key, then toggle all fields to false so it is fetched later
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
                  log: 'Error inside 1st-catch block of buildFromCache',
                  status: 400,
                  message: { err: `Error in buildFromCache, ${error}` }
                };
                console.log(err);
              }
              redisRunQueue = this.redisCache.multi();
            }

            // Otherwise, add a get command for the current type key to the queue.
            redisRunQueue.get(currTypeKey.toLowerCase());

            // Execute any remnants in redis run queue.
            try {
              const cacheResponseRaw = await redisRunQueue.exec();
              cacheResponseRaw.forEach((cacheResponse) =>
                getCommandCallback(JSON.stringify(cacheResponse))
              );
            } catch (error: Error | unknown) {
              const err: ServerErrorType = {
                log: 'Error inside 2nd-catch block of buildFromCache',
                status: 400,
                message: { err: `Error in buildFromCache, ${error}` }
              };
              console.log(err);
            }
          }
        }
      }
      // recurse through buildFromCache using typeKey, prototype
      // if itemFromCache is empty, then check the cache for data, else, persist itemFromCache
      // if this iteration is a nested query (i.e. if typeKey is a field in the query)
      else if (firstRun === false) {
        // if this field is NOT in the cache, then set this field's value to false
        if (
          (itemFromCache === null ||
            !Object.prototype.hasOwnProperty.call(itemFromCache, typeKey)) &&
          typeof prototype[typeKey] !== 'object' &&
          !typeKey.includes('__') &&
          !itemFromCache[0]
        ) {
          prototype[typeKey] = false;
        }
        // if this field is a nested query, then recurse the buildFromCache function and iterate through the nested query
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
      // if not an array and not a recursive call, handle normally
      else {
        for (const field in prototype[typeKey] as ProtoObjType) {
          // if field is not found in cache then toggle to false
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

          // if field contains a nested query, then recurse the function and iterate through the nested query
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
          // if there are no data in itemFromCache, toggle to false
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
    // return itemFromCache on a data property to resemble graphQL response format
    return { data: itemFromCache };
  }
  /**
   * normalizeForCache traverses over response data and formats it appropriately so we can store it in the cache.
   * @param {Object} responseData - data we received from an external source of data such as a database or API
   * @param {Object} map - a map of queries to their desired data types, used to ensure accurate and consistent caching
   * @param {Object} protoField - a slice of the prototype currently being used as a template and reference for the responseData to send information to the cache
   * @param {String} currName - parent object name, used to pass into updateIDCache
   */
  async normalizeForCache(
    responseData: ResponseDataType,
    map: QueryMapType = {},
    protoField: ProtoObjType,
    currName: string
  ) {
    // loop through each resultName in response data
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
        // need to get non-Alias ID for cache

        // temporary store for field properties
        const fieldStore: ResponseDataType = {};

        // create a cacheID based on __type and __id from the prototype
        let cacheID: string = Object.prototype.hasOwnProperty.call(
          map,
          currProto.__type as string
        )
          ? (map[currProto.__type as string] as string)
          : (currProto.__type as string);

        cacheID += currProto.__id ? `--${currProto.__id}` : '';

        // iterate over keys in nested object
        // need to save the actual object inside the object cache
        // and only the ID is placed as a reference inside the nested object
        for (const key in currField) {
          // if prototype has no ID, check field keys for ID (mostly for arrays)
          if (
            !currProto.__id &&
            (key === 'id' || key === '_id' || key === 'ID' || key === 'Id')
          ) {
            // if currname is undefined, assign to responseData at cacheid to lower case at name
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
            // if the responseData at cacheid to lower case at name is not undefined, store under name variable and copy logic of writing to cache, want to update cache with same things, all stored under name
            // store objKey as cacheID without ID added
            const cacheIDForIDCache: string = cacheID;
            cacheID += `--${currField[key]}`;
            // call idcache here idCache(cacheIDForIDCache, cacheID)
            this.updateIdCache(cacheIDForIDCache, cacheID, currName);
          }

          fieldStore[key] = currField[key];

          // if object, recurse normalizeForCache assign in that object
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
        // store "current object" on cache in JSON format
        this.writeToCache(cacheID, fieldStore);
      }
    }
  }
  /**
   * helper function
   * generateCacheID creates cacheIDs based on information from the prototype
   * format of 'field--ID'
   * @param {String} key - unique id under which the cached data will be stored
   * @param {Object} item - item to be cached
   */
  generateCacheID(queryProto: ProtoObjType): string {
    const cacheID: string = queryProto.__id
      ? `${queryProto.__type}--${queryProto.__id}`
      : (queryProto.__type as string);
    return cacheID;
  }
  /**
   * writeToCache writes a value to the cache unless the key indicates that the item is uncacheable. Note: writeToCache will JSON.stringify the input item
   * writeTochache will set expiration time for each item written to cache
   * @param {String} key - unique id under which the cached data will be stored
   * @param {Object} item - item to be cached
   */
  writeToCache(key: string, item: Type | string[] | ExecutionResult): void {
    const lowerKey: string = key.toLowerCase();
    if (!key.includes('uncacheable')) {
      this.redisCache.set(lowerKey, JSON.stringify(item));
      this.redisCache.EXPIRE(lowerKey, this.cacheExpiration);
    }
  }
  /**
   * UpdateIdCache:
   *    - stores keys in a nested object under parent name
   *    - if the key is a duplication, they are stored in an array
   *  @param {String} objKey - Object key; key to be cached without ID string
   *  @param {String} keyWithID - Key to be cached with ID string attatched; redis data is stored under this key
   *  @param {String} currName - The parent object name
   */
  updateIdCache(objKey: string, keyWithID: string, currName: string): void {
    // BUG: Add check - If any of the arguments are missing, return immediately.
    // Currently, if currName is undefined, this function is adding 'undefined' as a
    // key in the idCache.

    // if the parent object is not yet defined
    if (!idCache[currName]) {
      idCache[currName] = {};
      idCache[currName][objKey] = keyWithID;
      return;
    }
    // if parent obj is defined, but this is the first child key
    else if (!idCache[currName][objKey]) {
      idCache[currName][objKey] = [];
    }
    // update ID cache under key of currName in an array
    (idCache[currName][objKey] as string[]).push(keyWithID);
  }
  /**
   * updateCacheByMutation updates the Redis cache when the operation is a mutation.
   * - For update and delete mutations, checks if the mutation query includes an id.
   * If so, it will update the cache at that id. If not, it will iterate through the cache to find the appropriate fields to update/delete.
   * @param {Object} dbRespDataRaw - raw response from the database returned following mutation
   * @param {String} mutationName - name of the mutation (e.g. addItem)
   * @param {String} mutationType - type of mutation (add, update, delete)
   * @param {Object} mutationQueryObject - arguments and values for the mutation
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
      // in the form of an object
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
     * Helper function that takes in a list of fields to remove from the
     * @param {Set<string> | Array<string>} fieldKeysToRemove - field keys to be removed from the cached field list
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
            // index position of field key to remove from list of field keys
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
     * fieldKeys should be deleted and passes those fields to removeFromFieldKeysList for removal
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
                  // how can argValue ever be a boolean?
                  // argValue is the value at each argument of the query
                  // and that is typically a string/value you are adding/removing
                  // with the mutation query
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

        // iterate through field key field key values in redis, and compare to user
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
            // arg in forEach method is a string such as name
            // argVal is the actual value 'San Diego'
            // how would this work if it's a mutation query with arguments?
            Object.entries(mutationQueryObject.__args as ProtoObjType).forEach(
              ([arg, argVal]) => {
                if (arg in fieldKeyValue && fieldKeyValue[arg] === argVal) {
                  // foreign keys are not fields to update by
                  if (arg.toLowerCase().includes('id') === false) {
                    // arg.toLowerCase
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
    // if there is no id property on dbRespDataRaw.data[mutationName]
    // dbRespId defaults to an empty string and no redisKey will be found
    const hypotheticalRedisKey = `${mutationType.toLowerCase()}--${dbRespId}`;
    const redisKey: string | void | null = await this.getFromRedis(
      hypotheticalRedisKey
    );

    if (redisKey) {
      // key was found in redis server cache so mutation is either update or delete mutation

      // if user specifies dbRespId as an arg in mutation, then we only need to update/delete a single cache entry by dbRespId
      if (mutationQueryObject.__id) {
        if (mutationName.substring(0, 3) === 'del') {
          // if the first 3 letters of the mutationName are 'del' then mutation is a delete mutation
          // users have to prefix their delete mutations with 'del' so that quell can distinguish between delete/update mutations
          // toLowerCase on both mutation types
          this.deleteCacheById(
            `${mutationType.toLowerCase()}--${mutationQueryObject.__id}`
          );
          removeFromFieldKeysList([`${mutationType}--${dbRespId}`]);
        } else {
          // update mutation for single dbRespId
          this.writeToCache(
            `${mutationType.toLowerCase()}--${mutationQueryObject.__id}`,
            dbRespData
          );
        }
      } else {
        // user didn't specify dbRespId so we need to iterate through all key value pairs and determine which key values match dbRespData
        // might have edge case here if there are no queries that have type GraphQLList
        // if (!fieldsListKey) throw 'error: schema must have a GraphQLList';

        // unused variable
        const removalFieldKeysList = [];
        // TODO - look into what this is being used for if anything
        if (mutationName.substring(0, 3) === 'del') {
          // mutation is delete mutation
          deleteApprFieldKeys();
        } else {
          updateApprFieldKeys();
        }
      }
    } else {
      // key was not found in redis server cache so mutation is an add mutation
      this.writeToCache(hypotheticalRedisKey, dbRespData);
    }
  }

  /**
   * deleteCacheById removes key-value from the cache unless the key indicates that the item is not available.
   * @param {String} key - unique id under which the cached data is stored that needs to be removed
   */
  async deleteCacheById(key: string) {
    try {
      await this.redisCache.del(key);
    } catch (error) {
      const err: ServerErrorType = {
        log: 'Error inside deleteCacheById function',
        status: 400,
        message: { err: `Error in deleteCacheById, ${error}` }
      };
      console.log(err);
    }
  }

  /**
   * clearCache flushes the Redis cache. To clear the cache from the client, establish an endpoint that
   * passes the request and response objects to an instance of QuellCache.clearCache.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */

  clearCache(req: Request, res: Response, next: NextFunction) {
    console.log('Clearing Redis Cache');
    this.redisCache.flushAll();
    idCache = {};
    return next();
  }

  /**
   * The getRedisInfo returns a chain of middleware based on what information
   * (if any) the user would like to request from the specified redisCache. It
   * requires an appropriately configured Express route and saves the specified stats
   * to res.locals, for instance:
   * @example
   *  app.use('/redis', ...quellCache.getRedisInfo({
   *    getStats: true,
   *    getKeys: true,
   *    getValues: true
   *  }));
   * @param {Object} options - three properties with boolean values:
   *                           getStats, getKeys, getValues
   * @returns {Array} An array of middleware functions that retrieves specified Redis info
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
     * getOptions is a helper function within the getRedisInfo function that returns
     * what redis data should be retrieved based off the passed in options
     * @param {Object} opts - Options object containing a boolean value for getStats, getKeys, and getValues
     * @returns {string} a string that indicates which data should be retrieved from redis instance
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
   * getStatsFromRedis gets information and statistics about the server and adds them to the response.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getStatsFromRedis(req: Request, res: Response, next: NextFunction): void {
    try {
      const getStats = () => {
        // redisCache.info returns information and statistics about the server as an array of field:value
        this.redisCache
          .info()
          .then((response: string) => {
            const dataLines: string[] = response.split('\r\n');
            // dataLines is an array of strings
            const output: RedisStatsType = {
              // SERVER
              server: [
                // redis version
                {
                  name: 'Redis version',
                  value: dataLines
                    .find((line) => line.match(/redis_version/))
                    ?.split(':')[1]
                },
                // redis build id
                {
                  name: 'Redis build id',
                  value: dataLines
                    .find((line) => line.match(/redis_build_id/))
                    ?.split(':')[1]
                },
                // redis mode
                {
                  name: 'Redis mode',
                  value: dataLines
                    .find((line) => line.match(/redis_mode/))
                    ?.split(':')[1]
                },
                // os hosting redis system
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
                // server time
                // {
                //   name: 'System time',
                //   value: dataLines
                //     .find((line) => line.match(/server_time_in_usec/))
                //     .split(':')[1],
                // },
                // num of seconds since Redis server start
                {
                  name: 'Server uptime (seconds)',
                  value: dataLines
                    .find((line) => line.match(/uptime_in_seconds/))
                    ?.split(':')[1]
                },
                // num of days since Redis server start
                {
                  name: 'Server uptime (days)',
                  value: dataLines
                    .find((line) => line.match(/uptime_in_days/))
                    ?.split(':')[1]
                },
                // path to server's executable
                // {
                //   name: 'Path to executable',
                //   value: dataLines
                //     .find((line) => line.match(/executable/))
                //     .split(':')[1],
                // },
                // path to server's configuration file
                {
                  name: 'Path to configuration file',
                  value: dataLines
                    .find((line) => line.match(/config_file/))
                    ?.split(':')[1]
                }
              ],
              // CLIENT
              client: [
                // number of connected clients
                {
                  name: 'Connected clients',
                  value: dataLines
                    .find((line) => line.match(/connected_clients/))
                    ?.split(':')[1]
                },
                // number of sockets used by cluster bus
                {
                  name: 'Cluster connections',
                  value: dataLines
                    .find((line) => line.match(/cluster_connections/))
                    ?.split(':')[1]
                },
                // max clients
                {
                  name: 'Max clients',
                  value: dataLines
                    .find((line) => line.match(/maxclients/))
                    ?.split(':')[1]
                },
                // number of clients being tracked
                // {
                //   name: 'Tracked clients',
                //   value: dataLines
                //     .find((line) => line.match(/tracking_clients/))
                //     .split(':')[1],
                // },
                // blocked clients
                {
                  name: 'Blocked clients',
                  value: dataLines
                    .find((line) => line.match(/blocked_clients/))
                    ?.split(':')[1]
                }
              ],
              // MEMORY
              memory: [
                // total allocated memory
                {
                  name: 'Total allocated memory',
                  value: dataLines
                    .find((line) => line.match(/used_memory_human/))
                    ?.split(':')[1]
                },
                // peak memory consumed
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
                // initial amount of memory consumed at startup
                // {
                //   name: 'Memory consumed at startup',
                //   value: dataLines
                //     .find((line) => line.match(/used_memory_startup/))
                //     .split(':')[1],
                // },
                // size of dataset
                // {
                //   name: 'Dataset size (bytes)',
                //   value: dataLines
                //     .find((line) => line.match(/used_memory_dataset/))
                //     .split(':')[1],
                // },
                // percent of data out of net mem usage
                // {
                //   name: 'Dataset memory % total',
                //   value: dataLines
                //     .find((line) => line.match(/used_memory_dataset_perc/))
                //     .split(':')[1],
                // },
                // total system memory
                // {
                //   name: 'Total system memory',
                //   value: dataLines
                //     .find((line) => line.match(/total_system_memory_human/))
                //     .split(':')[1],
                // },
              ],
              // STATS
              stats: [
                // total number of connections accepted by server
                {
                  name: 'Total connections',
                  value: dataLines
                    .find((line) => line.match(/total_connections_received/))
                    ?.split(':')[1]
                },
                // total number of commands processed by server
                {
                  name: 'Total commands',
                  value: dataLines
                    .find((line) => line.match(/total_commands_processed/))
                    ?.split(':')[1]
                },
                // number of commands processed per second
                {
                  name: 'Commands processed per second',
                  value: dataLines
                    .find((line) => line.match(/instantaneous_ops_per_sec/))
                    ?.split(':')[1]
                },
                // total number of keys being tracked
                // {
                //   name: 'Tracked keys',
                //   value: dataLines
                //     .find((line) => line.match(/tracking_total_keys/))
                //     .split(':')[1],
                // },
                // total number of items being tracked(sum of clients number for each key)
                // {
                //   name: 'Tracked items',
                //   value: dataLines
                //     .find((line) => line.match(/tracking_total_items/))
                //     .split(':')[1],
                // },
                // total number of read events processed
                // {
                //   name: 'Reads processed',
                //   value: dataLines
                //     .find((line) => line.match(/total_reads_processed/))
                //     .split(':')[1],
                // },
                // total number of write events processed
                // {
                //   name: 'Writes processed',
                //   value: dataLines
                //     .find((line) => line.match(/total_writes_processed/))
                //     .split(':')[1],
                // },
                // total number of error replies
                {
                  name: 'Error replies',
                  value: dataLines
                    .find((line) => line.match(/total_error_replies/))
                    ?.split(':')[1]
                },
                // total number of bytes read from network
                {
                  name: 'Bytes read from network',
                  value: dataLines
                    .find((line) => line.match(/total_net_input_bytes/))
                    ?.split(':')[1]
                },
                // networks read rate per second
                {
                  name: 'Network read rate (Kb/s)',
                  value: dataLines
                    .find((line) => line.match(/instantaneous_input_kbps/))
                    ?.split(':')[1]
                },
                // total number of bytes written to network
                // {
                //   name: 'Bytes written to network',
                //   value: dataLines
                //     .find((line) => line.match(/total_net_output_bytes/))
                //     .split(':')[1],
                // },
                // networks write rate per second
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
              log: 'Error inside catch block of getting info within getStatsFromRedis',
              status: 400,
              message: { err: `Error in getStatsFromRedis, ${error}` }
            };
            return next(err);
          });
      };
      getStats();
    } catch (error) {
      const err: ServerErrorType = {
        log: 'Error inside catch block of getStatsFromRedis',
        status: 400,
        message: { err: `Error in getStatsFromRedis, ${error}` }
      };
      return next(err);
    }
  }

  /**
   * getRedisKeys gets the key names from the redis cache and adds them to the response.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
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
          log: 'Error inside catch block of getRedisKeys, keys potentially undefined',
          status: 400,
          message: { err: `Error in getRedisKeys, ${error}` }
        };
        return next(err);
      });
  }

  /**
   * getRedisValues gets the values associated with the redis cache keys and adds them to the response.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
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
            log: 'Error inside catch block of getRedisValues',
            status: 400,
            message: { error: `Error in getRedisValues, ${error}` }
          };
          return next(err);
        });
    } else {
      res.locals.redisValues = [];
      return next();
    }
  }

  /**
   * depthLimit takes in the query, parses it, and identifies the general shape of the request.
   * depthLimit then checks the depth limit set on server connection and compares it against the current queries depth.
   *
   * In the instance of a malicious or overly nested query, depthLimit short-circuits the query before it goes to the database,
   * sending a status code 400 (bad request) back to the client/requester.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  // what parameters should they take? If middleware, good as is, has to take in query obj in request, limit set inside.
  // If function inside whole of Quell, (query, limit), so they are explicitly defined and passed in
  depthLimit(req: Request, res: Response, next: NextFunction): void {
    // get depth max limit from cost parameters
    let { maxDepth } = this.costParameters;
    // maxDepth can be reassigned to get depth max limit from req.body if user selects depth limit
    if (req.body.costOptions.maxDepth) maxDepth = req.body.costOptions.maxDepth;
    // return error if no query in request.
    if (!req.body.query) {
      {
        const err: ServerErrorType = {
          log: 'Invalid request, no query found in req.body',
          status: 400,
          message: { err: 'Error in depthLimit' }
        };
        return next(err);
      }
    }
    // assign graphQL query string to variable queryString
    const queryString: string = req.body.query;

    // create AST
    const AST: DocumentNode = parse(queryString);

    // create response prototype, and operation type, and fragments object
    // the response prototype is used as a template for most operations in quell including caching, building modified requests, and more
    const { proto, operationType, frags } = parseAST(AST);
    // check for fragments
    const prototype =
      Object.keys(frags).length > 0
        ? updateProtoWithFragment(proto, frags)
        : proto;

    /**
     * determineDepth is a helper function to pass an error if the depth of the proto is greater than the maxDepth.
     * will be using this function to recursively go deeper into the nested query
     * @param {Object} proto - the prototype
     * @param {Number} currentDepth - initialized to 0, increases for each nested level within proto
     */
    const determineDepth = (proto: ProtoObjType, currentDepth = 0): void => {
      if (currentDepth > maxDepth) {
        const err: ServerErrorType = {
          log: `Depth limit exceeded, tried to send query with the depth of ${currentDepth}.`,
          status: 413,
          message: { err: 'Error in determineDepth' }
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // for each field
      Object.keys(proto).forEach((key) => {
        // if the field is nested, recurse, increasing currentDepth by 1
        if (typeof proto[key] === 'object' && !key.includes('__')) {
          determineDepth(proto[key] as ProtoObjType, currentDepth + 1);
        }
      });
    };
    // call helper function
    determineDepth(prototype);
    // attach to res.locals so query doesn't need to re run these functions again.
    res.locals.AST = AST;
    res.locals.parsedAST = { proto, operationType, frags };
    // if (currentDepth > this.limit) return res.status(400).send("Too many nested queries!");
    return next();
  }

  /**
   * costLimit checks the cost of the query and, in the instance of a malicious or overly nested query,
   * costLimit short-circuits the query before it goes to the database,
   * sending a status code 400 (bad request) back to the client/requester.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  costLimit(req: Request, res: Response, next: NextFunction): void {
    // get default values for costParameters
    let { maxCost } = this.costParameters;
    const { mutationCost, objectCost, depthCostFactor, scalarCost } =
      this.costParameters;
    // maxCost can be reassigned to get maxcost limit from req.body if user selects cost limit
    if (req.body.costOptions.maxCost) maxCost = req.body.costOptions.maxCost;
    // return error if no query in request.
    if (!req.body.query) {
      const err: ServerErrorType = {
        log: 'Invalid request, no query found in req.body',
        status: 400,
        message: { err: 'Error in costLimit' }
      };
      return next(err);
    }
    // assign graphQL query string to variable queryString
    const queryString: string = req.body.query;
    // create AST
    const AST: DocumentNode = parse(queryString);

    // create response prototype, and operation type, and fragments object
    // the response prototype is used as a template for most operations in quell including caching, building modified requests, and more
    const { proto, operationType, frags } = parseAST(AST);
    // check for fragments
    const prototype =
      Object.keys(frags).length > 0
        ? updateProtoWithFragment(proto, frags)
        : proto;

    let cost = 0;

    // mutation check
    operationType === 'mutation'
      ? (cost += Object.keys(prototype).length * mutationCost)
      : null;

    /**
     * helper function to pass an error if the cost of the proto is greater than the maxCost
     * @param {Object} proto - the prototype
     */
    const determineCost = (proto: ProtoObjType): void => {
      // create error if maxCost exceeded
      if (cost > maxCost) {
        const err: ServerErrorType = {
          log: `Cost limit exceeded, tried to send query with a cost exceeding ${maxCost}.`,
          status: 413,
          message: { err: 'Error in determineCost' }
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // for each field
      Object.keys(proto).forEach((key) => {
        // if the field is nested, increase the total cost by objectCost and recurse
        if (typeof proto[key] === 'object' && !key.includes('__')) {
          cost += objectCost;
          return determineCost(proto[key] as ProtoObjType);
        }
        // if scalar, increase the total cost by scalarCost
        if (proto[key] === true && !key.includes('__')) {
          cost += scalarCost;
        }
      });
    };

    determineCost(prototype);

    /**
     * helper function to pass an error if the cost of the proto, taking into account depth levels, is greater than the maxCost
     * essentially multiplies the cost by a depth cost adjustment, which is equal to depthCostFactor raised to the power of the depth
     * @param {Object} proto - the prototype
     * @param {Number} totalCost - cost of the proto
     */
    const determineDepthCost = (
      proto: ProtoObjType,
      totalCost = cost
    ): void => {
      // create error if maxCost exceeded
      if (totalCost > maxCost) {
        const err: ServerErrorType = {
          log: `Cost limit exceeded, tried to send query with a cost exceeding ${maxCost}.`,
          status: 413,
          message: { err: 'Error in determineDepthCost' }
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // for each field
      Object.keys(proto).forEach((key) => {
        // if the field is nested, recurse, multiplying the current total cost by the depthCostFactor
        if (typeof proto[key] === 'object' && !key.includes('__')) {
          determineDepthCost(
            proto[key] as ProtoObjType,
            totalCost * depthCostFactor
          );
        }
      });
    };

    determineDepthCost(prototype);
    // attach to res.locals so query doesn't need to re run these functions again.
    res.locals.AST = AST;
    res.locals.parsedAST = { proto, operationType, frags };
    // return next
    return next();
  }
}
