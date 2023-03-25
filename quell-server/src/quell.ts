import { Response, Request, NextFunction, RequestHandler } from 'express';
import { parse } from 'graphql/language/parser';
import { visit, BREAK } from 'graphql/language/visitor';
import { graphql } from 'graphql';
import type { RedisClientType } from 'redis';
import { createClient } from 'redis';

import type {
  GraphQLSchema,
  ExecutionResult,
  ASTNode,
  DocumentNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  FieldNode,
  SelectionSetNode,
  ArgumentNode,
  FragmentSpreadNode
} from 'graphql';
import type {
  ConstructorOptions,
  IdCacheType,
  CostParamsType,
  ProtoObjType,
  FragsType,
  MutationMapType,
  QueryMapType,
  FieldsMapType,
  ParseASTOptions,
  ArgsObjType,
  FieldArgsType,
  AuxObjType,
  ValidArgumentNodeType,
  FieldsObjectType,
  FieldsValuesType,
  GQLNodeWithDirectivesType,
  ItemFromCacheType,
  RedisOptionsType,
  RedisStatsType,
  ServerErrorType,
  ResponseDataType,
  QueryObject,
  QueryFields,
  DatabaseResponseDataRaw,
  Type,
  MergedResponse,
  DataResponse,
  Data,
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
    this.redisCache.connect().then((): void => {
      console.log('Connected to redisCache');
    });
  }

  /**
   * A redis-based IP rate limiter middleware function that limits the number of requests per second based on IP address using Redis.
   *  @param {Request} req - Express request object, including request body with GraphQL query string.
   *  @param {Response} res - Express response object, will carry query response to next middleware.
   *  @param {NextFunction} next - Express next middleware function, invoked when QuellCache completes its work.
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
      return next({
        log: 'Error: no GraphQL query found on request body',
        status: 400, // Bad Request
        message: { err: 'Error in rateLimiter' }
      });
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
        return next({
          status: 429, // Too Many Requests
          log: `Redis cache error: Express error handler caught too many requests from this IP address (${ipAddress}): limit is: ${ipRateLimit} requests per second`
        });
      }

      console.log(
        `IP ${ipAddress} made a request. Limit is: ${ipRateLimit} requests per second. Result: OK.`
      );

      return next();
    } catch (error) {
      return next({
        status: 500, // Internal Server Error
        log: `Redis cache error: ${error}`
      });
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
      return next({
        log: 'Error: no GraphQL query found on request body',
        status: 400, // Bad Request
        message: { err: 'Error in rateLimiter' }
      });
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
          return next(`graphql library error: ${error}`);
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
          return next({ log: 'graphql library error: ', error });
        });

      /*
       * BUG: The code from here to the end of the current if block was left over from a previous
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
            return next(`graphql library error: ${error}`);
          });
      }
    } else if (operationType === 'mutation') {
      // BUG: If the operation is a mutation, we are currently clearing the cache because it is stale.
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
          return next(`graphql library error: ${error}`);
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
            return next({ log: 'graphql library error: ', error });
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
    } catch (err) {
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
          // Use the subID argument if it is a string (used for recursive calls within buildFromCache)
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
              } catch (err: Error | unknown) {
                console.log(`Error in buildFromCache: ${err}`);
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
            } catch (err: Error | unknown) {
              console.log(`Error in buildFromCache: ${err}`);
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
            // if the responseData at cacheID to lower case at name is not undefined, store under name variable and copy logic of writing to cache, want to update cache with same things, all stored under name
            // store objKey as cacheID without ID added
            const cacheIDForIDCache: string = cacheID;
            cacheID += `--${currField[key]}`;
            // call IdCache here idCache(cacheIDForIDCache, cacheID)
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
   * Removes key-value from the cache unless the key indicates that the item is not available.
   * @param {string} key - Unique id under which the cached data is stored that needs to be removed.
   */
  async deleteCacheById(key: string) {
    try {
      await this.redisCache.del(key);
    } catch (err) {
      console.log('err in deleteCacheById: ', err);
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
          .catch((err: ServerErrorType) => {
            return next(err);
          });
      };

      getStats();
    } catch (err) {
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
      .catch((err: ServerErrorType) => {
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
        .catch((err: ServerErrorType) => {
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
          message: { err: 'Error in depthLimit' }
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
          message: { err: 'Error in determineDepth' }
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
      {
        const err: ServerErrorType = {
          log: 'Invalid request, no query found in req.body',
          status: 400,
          message: { err: 'Error in costLimit' }
        };
        return next(err);
      }
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
          message: { err: 'Error in determineCost' }
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
          message: { err: 'Error in determineDepthCost' }
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

// Modularized functions
/**
 * Traverses over a supplied query Object and uses the fields on there to create a query string reflecting the data.
 * This query string is a modified version of the query string received by Quell that has references to data found within the cache removed
 * so that the final query is faster and reduced in scope.
 * @param {Object} queryObject - A modified version of the prototype with only values we want to pass onto the queryString.
 * @param {string} operationType - A string indicating the GraphQL operation type- 'query', 'mutation', etc.
 */
function createQueryStr(
  queryObject: QueryObject | ProtoObjType,
  operationType: string
): string {
  if (Object.keys(queryObject).length === 0) return '';
  const openCurly = '{';
  const closeCurly = '}';
  const openParen = '(';
  const closeParen = ')';

  let mainStr = '';

  // iterate over every key in queryObject
  // place key into query object
  for (const key in queryObject) {
    mainStr += ` ${key}${getAliasType(
      queryObject[key] as QueryFields
    )}${getArgs(queryObject[key] as QueryFields)} ${openCurly} ${stringify(
      queryObject[key] as QueryFields
    )}${closeCurly}`;
  }

  /**
   * Helper function that is used to recursively build a GraphQL query string from a nested object,
   * ignoring any __values (ie __alias and __args).
   * @param {QueryFields} fields - An object whose properties need to be converted to a string to be used for a GraphQL query.
   * @returns {string} innerStr - A graphQL query string.
   */
  function stringify(fields: QueryFields): string {
    // initialize inner string
    let innerStr = '';
    // iterate over KEYS in OBJECT
    for (const key in fields) {
      // is fields[key] string? concat with inner string & empty space
      if (typeof fields[key] === 'boolean') {
        innerStr += key + ' ';
      }
      // is key object? && !key.includes('__'), recurse stringify
      if (typeof fields[key] === 'object' && !key.includes('__')) {
        const fieldsObj: QueryFields = fields[key] as QueryFields;
        // TODO try to fix this error
        const type: string = getAliasType(fieldsObj);
        const args: string = getArgs(fieldsObj);
        innerStr += `${key}${type}${args} ${openCurly} ${stringify(
          fieldsObj
        )}${closeCurly} `;
      }
    }

    return innerStr;
  }

  /**
   * Helper function that iterates through arguments object for current field and creates
   * an argument string to attach to the query string.
   * @param {QueryFields} fields - Object whose arguments will be attached to the query string.
   * @returns {string} - Argument string to be attached to the query string.
   */
  function getArgs(fields: QueryFields): string {
    let argString = '';
    if (!fields.__args) return '';

    Object.keys(fields.__args).forEach((key) => {
      argString
        ? (argString += `, ${key}: "${(fields.__args as QueryFields)[key]}"`)
        : (argString += `${key}: "${(fields.__args as QueryFields)[key]}"`);
    });

    // return arg string in parentheses, or if no arguments, return an empty string
    return argString ? `${openParen}${argString}${closeParen}` : '';
  }

  /**
   * Helper function that formats the field's alias, if it exists, for the query string.
   * @param {QueryFields} fields - Object whose alias will be attached to the query string.
   * @returns {string} - Alias string to be attached to the query string.
   */
  function getAliasType(fields: QueryFields): string {
    return fields.__alias ? `: ${fields.__type}` : '';
  }

  // Create the final query string.
  const queryStr: string = openCurly + mainStr + ' ' + closeCurly;
  return operationType ? operationType + ' ' + queryStr : queryStr;
}

/**
 * Takes in a map of fields and true/false values (the prototype) and creates a query object containing any values missing from the cache.
 * The resulting queryObj is then used as a template to create GraphQL query strings.
 * @param {ProtoObjType} map - Map of fields and true/false values from initial request, should be the prototype.
 * @returns {Object} queryObject that includes only the values to be requested from GraphQL endpoint.
 */
function createQueryObj(map: ProtoObjType): ProtoObjType {
  const output: ProtoObjType = {};
  // iterate over every key in map
  // true values are filtered out, false values are placed on output
  for (const key in map) {
    const reduced: ProtoObjType = reducer(map[key] as ProtoObjType);
    if (Object.keys(reduced).length > 0) {
      output[key] = reduced;
    }
  }

  /**
   * Takes in a fields object and returns only the values needed from the server.
   * @param {Object} fields - Object containing true or false values that determines what should be
   * retrieved from the server.
   * @returns {Object} - Filtered object of only queries without a value or an empty object.
   */
  function reducer(fields: ProtoObjType): ProtoObjType {
    // Create a filter object to store values needed from server.
    const filter: ProtoObjType = {};
    // Create a propsFilter object for properties such as args, aliases, etc.
    const propsFilter: ProtoObjType = {};

    for (const key in fields) {
      // If value is false, place directly on filter
      if (fields[key] === false) {
        filter[key] = false;
      }
      // Force the id onto the query object
      if (key === 'id' || key === '_id' || key === 'ID' || key === 'Id') {
        filter[key] = false;
      }

      // If value is an object, recurse to determine nested values
      if (typeof fields[key] === 'object' && !key.includes('__')) {
        const reduced: ProtoObjType = reducer(fields[key] as ProtoObjType);
        // if reduced object has any values to pass, place on filter
        if (Object.keys(reduced).length > 1) {
          filter[key] = reduced;
        }
      }

      // If reserved property such as args or alias, place on propsFilter
      if (key.includes('__')) {
        propsFilter[key] = fields[key];
      }
    }

    const numFields: number = Object.keys(fields).length;

    // If the filter has any values to pass, return filter & propsFilter; otherwise return empty object
    return Object.keys(filter).length > 1 && numFields > 5
      ? { ...filter, ...propsFilter }
      : {};
  }
  return output;
}

/**
 * Combines two objects containing results from separate sources and outputs a single object with information from both sources combined,
 * formatted to be delivered to the client, using the queryProto as a template for how to structure the final response object.
 * @param {Object} cacheResponse - Response data from the cache.
 * @param {Object} serverResponse - Response data from the server or external API.
 * @param {Object} queryProto - Current slice of the prototype being used as a template for final response object structure.
 * @param {boolean} fromArray - Whether or not the current recursive loop came from within an array (should NOT be supplied to function call).
 */
function joinResponses(
  cacheResponse: DataResponse,
  serverResponse: DataResponse,
  queryProto: QueryObject | ProtoObjType,
  fromArray = false
): MergedResponse {
  let mergedResponse: MergedResponse = {};

  // loop through fields object keys, the "source of truth" for structure
  // store combined responses in mergedResponse
  for (const key in queryProto) {
    // for each key, check whether data stored at that key is an array or an object
    const checkResponse: DataResponse = Object.prototype.hasOwnProperty.call(
      serverResponse,
      key
    )
      ? serverResponse
      : cacheResponse;
    if (Array.isArray(checkResponse[key])) {
      // merging logic depends on whether the data is on the cacheResponse, serverResponse, or both
      // if both of the caches contain the same keys...
      if (cacheResponse[key] && serverResponse[key]) {
        // we first check to see if the responses have identical keys to both avoid
        // only returning 1/2 of the data (ex: there are 2 objects in the cache and
        // you query for 4 objects (which includes the 2 cached objects) only returning
        // the 2 new objects from the server)
        // if the keys are identical, we can return a "simple" merge of both
        const cacheKeys: string[] = Object.keys(
          (cacheResponse[key] as Data)[0]
        );
        const serverKeys: string[] = Object.keys(
          (serverResponse[key] as Data)[0]
        );
        let keysSame = true;
        for (let n = 0; n < cacheKeys.length; n++) {
          if (cacheKeys[n] !== serverKeys[n]) keysSame = false;
        }
        if (keysSame) {
          mergedResponse[key] = [
            ...(cacheResponse[key] as Data[]),
            ...(serverResponse[key] as Data[])
          ];
        }
        // otherwise, we need to combine the responses at the object level
        else {
          const mergedArray = [];
          for (let i = 0; i < (cacheResponse[key] as Data[]).length; i++) {
            // for each index of array, combine cache and server response objects
            const joinedResponse: MergedResponse = joinResponses(
              { [key]: (cacheResponse[key] as Data[])[i] },
              { [key]: (serverResponse[key] as Data[])[i] },
              { [key]: queryProto[key] },
              true
            );
            mergedArray.push(joinedResponse);
          }
          mergedResponse[key] = mergedArray;
        }
      } else if (cacheResponse[key]) {
        mergedResponse[key] = cacheResponse[key];
      } else {
        mergedResponse[key] = serverResponse[key];
      }
    } else {
      if (!fromArray) {
        // if object doesn't come from an array, we must assign on the object at the given key
        mergedResponse[key] = {
          ...cacheResponse[key],
          ...serverResponse[key]
        };
      } else {
        // if the object comes from an array, we do not want to assign to a key as per GQL spec
        (mergedResponse as object) = {
          ...cacheResponse[key],
          ...serverResponse[key]
        };
      }

      for (const fieldName in queryProto[key] as ProtoObjType) {
        // check for nested objects
        if (
          typeof (queryProto[key] as ProtoObjType)[fieldName] === 'object' &&
          !fieldName.includes('__')
        ) {
          // recurse joinResponses on that object to create deeply nested copy on mergedResponse
          let mergedRecursion: MergedResponse = {};
          if (cacheResponse[key] && serverResponse[key]) {
            if (
              (cacheResponse[key] as Data)[fieldName] &&
              (serverResponse[key] as Data)[fieldName]
            ) {
              mergedRecursion = joinResponses(
                {
                  [fieldName]: (cacheResponse[key] as DataResponse)[fieldName]
                },
                {
                  [fieldName]: (serverResponse[key] as DataResponse)[fieldName]
                },
                { [fieldName]: (queryProto[key] as QueryObject)[fieldName] }
              );
            } else if ((cacheResponse[key] as Data)[fieldName]) {
              mergedRecursion[fieldName] = (
                cacheResponse[key] as MergedResponse
              )[fieldName];
            } else {
              mergedRecursion[fieldName] = (
                serverResponse[key] as MergedResponse
              )[fieldName];
            }
          }
          // place on merged response, spreading the mergedResponse[key] if it
          // is an object or an array, or just adding it as a value at key otherwise
          if (
            typeof mergedResponse[key] === 'object' ||
            Array.isArray(mergedResponse[key])
          ) {
            mergedResponse[key] = {
              ...(mergedResponse[key] as MergedResponse | MergedResponse[]),
              ...mergedRecursion
            };
          } else {
            // case for when mergedResponse[key] is not an object or array and possibly
            // boolean or a string
            mergedResponse[key] = {
              key: mergedResponse[key] as Data | boolean,
              ...mergedRecursion
            };
          }
        }
      }
    }
  }
  return mergedResponse;
}

/**
 * Traverses the abstract syntax tree depth-first to create a template for future operations, such as
 * request data from the cache, creating a modified query string for additional information needed, and joining cache and database responses.
 * @param {Object} AST - An abstract syntax tree generated by GraphQL library that we will traverse to build our prototype.
 * @param {Object} options - (not fully integrated) A field for user-supplied options.
 * @returns {Object} prototype object
 * @returns {string} operationType
 * @returns {Object} frags object
 */
function parseAST(
  AST: DocumentNode,
  options: ParseASTOptions = { userDefinedID: null }
): { proto: ProtoObjType; operationType: string; frags: FragsType } {
  // Initialize prototype and frags as empty objects.
  // Information from the AST is distilled into the prototype for easy
  // access during caching, rebuilding query strings, etc.
  const proto: ProtoObjType = {};

  // The frags object will contain the fragments defined in the query in a format
  // similar to the proto.
  const frags: FragsType = {};

  // Create operation type variable. This will be 'query', 'mutation', 'subscription', 'noID', or 'unQuellable'.
  let operationType = '';

  // Initialize a stack to keep track of depth first parsing path.
  const stack: string[] = [];

  // Create field arguments object, which will track the id, type, alias, and args for the fields.
  // The field arguments object will eventually be merged with the prototype object.
  const fieldArgs: FieldArgsType = {};

  // Extract the userDefinedID from the options object, if provided.
  const userDefinedID: string | null | undefined = options.userDefinedID;

  /**
   * visit is a utility provided in the graphql-JS library. It performs a
   * depth-first traversal of the abstract syntax tree, invoking a callback
   * when each SelectionSet node is entered. That function builds the prototype.
   * Invokes a callback when entering and leaving Field node to keep track of nodes with stack
   *
   * Find documentation at:
   * https://graphql.org/graphql-js/language/#visit
   */
  visit(AST, {
    // The enter function will be triggered upon entering each node in the traversal.
    enter(node: ASTNode) {
      // Quell cannot cache directives, so we need to return as unQuellable if the node has directives.
      if ((node as GQLNodeWithDirectivesType)?.directives) {
        if ((node as GQLNodeWithDirectivesType)?.directives?.length ?? 0 > 0) {
          operationType = 'unQuellable';
          // Return BREAK to break out of the current traversal branch.
          return BREAK;
        }
      }
    },

    // If the current node is of type OperationDefinition, this function will be triggered upon entering it.
    // It checks the type of operation being performed.
    OperationDefinition(node: OperationDefinitionNode) {
      // Quell cannot cache subscriptions, so we need to return as unQuellable if the type is subscription.
      operationType = node.operation;
      if (node.operation === 'subscription') {
        operationType = 'unQuellable';
        // Return BREAK to break out of the current traversal branch.
        return BREAK;
      }
    },

    // If the current node is of type FragmentDefinition, this function will be triggered upon entering it.
    FragmentDefinition(node: FragmentDefinitionNode) {
      // Add the fragment name to the stack.
      stack.push(node.name.value);

      // Get the name of the fragment.
      const fragName = node.name.value;

      // Add the fragment name as a key in the frags object, initialized to an empty object.
      frags[fragName] = {};
      // Loop through the selections in the selection set for the current FragmentDefinition node.
      for (let i = 0; i < node.selectionSet.selections.length; i++) {
        // Below, we get the 'name' property from the SelectionNode.
        // However, InlineFragmentNode (one of the possible types for SelectionNode) does
        // not have a 'name' property, so we will want to skip nodes with that type.
        if (node.selectionSet.selections[i].kind !== 'InlineFragment') {
          // Add base-level field names in the fragment to the frags object.
          frags[fragName][
            (
              node.selectionSet.selections[i] as FieldNode | FragmentSpreadNode
            ).name.value
          ] = true;
        }
      }
    },

    Field: {
      // If the current node is of type Field, this function will be triggered upon entering it.
      enter(node: FieldNode) {
        // Return introspection queries as unQuellable so that we do not cache them.
        // "__keyname" syntax is later used for Quell's field-specific options, though this does not create collision with introspection.
        if (node.name.value.includes('__')) {
          operationType = 'unQuellable';
          // Return BREAK to break out of the current traversal branch.
          return BREAK;
        }

        // Create an args object that will be populated with the current node's arguments.
        const argsObj: ArgsObjType = {};

        // Auxiliary object for storing arguments, aliases, field-specific options, and more
        // query-wide options should be handled on Quell's options object
        const auxObj: AuxObjType = {
          __id: null
        };

        // Loop through the field's arguments.
        if (node.arguments) {
          node.arguments.forEach((arg: ArgumentNode) => {
            const key: string = arg.name.value;

            // Quell cannot cache queries with variables, so we need to return unQuellable if the query has variables.
            if (arg.value.kind === 'Variable' && operationType === 'query') {
              operationType = 'unQuellable';
              // Return BREAK to break out of the current traversal branch.
              return BREAK;
            }

            /*
             * In the next step, we get the value from the argument node's value node.
             * This assumes that the value node has a 'value' property.
             * If the 'kind' of the value node is ObjectValue, ListValue, NullValue, or ListValue
             * then the value node will not have a 'value' property, so we must first check that
             * the 'kind' does not match any of those types.
             */
            if (
              arg.value.kind === 'NullValue' ||
              arg.value.kind === 'ObjectValue' ||
              arg.value.kind === 'ListValue'
            ) {
              operationType = 'unQuellable';
              // Return BREAK to break out of the current traversal branch.
              return BREAK;
            }

            // Assign argument values to argsObj (key will be argument name, value will be argument value),
            // skipping field-specific options ('__') provided as arguments.
            if (!key.includes('__')) {
              // Get the value from the argument node's value node.
              argsObj[key] = (arg.value as ValidArgumentNodeType).value;
            }

            // If a userDefinedID was included in the options object and the current argument name matches
            // that ID, update the auxiliary object's id.
            if (userDefinedID ? key === userDefinedID : false) {
              auxObj.__id = (arg.value as ValidArgumentNodeType).value;
            } else if (
              // If a userDefinedID was not provided, determine the uniqueID from the args.
              // Note: do not use key.includes('id') to avoid assigning fields such as "idea" or "idiom" as uniqueID.
              key === 'id' ||
              key === '_id' ||
              key === 'ID' ||
              key === 'Id'
            ) {
              // If the name of the argument is 'id', '_id', 'ID', or 'Id',
              // set the '__id' field on the auxObj equal to value of that argument.
              auxObj.__id = (arg.value as ValidArgumentNodeType).value;
            }
          });
        }

        // Gather other auxiliary data such as aliases, arguments, query type, and more to append to the prototype for future reference.

        // Set the fieldType (which will be the key in the fieldArgs object) equal to either the field's alias or the field's name.
        const fieldType: string = node.alias
          ? node.alias.value
          : node.name.value;

        // Set the '__type' property of the auxiliary object equal to the field's name, converted to lower case.
        auxObj.__type = node.name.value.toLowerCase();

        // Set the '__alias' property of the auxiliary object equal to the field's alias if it has one.
        auxObj.__alias = node.alias ? node.alias.value : null;

        // Set the '__args' property of the auxiliary object equal to the args
        auxObj.__args = Object.keys(argsObj).length > 0 ? argsObj : null;

        // Add auxObj fields to prototype, allowing future access to type, alias, args, etc.
        fieldArgs[fieldType] = {
          ...auxObj
        };
        // Add the field type to stacks to keep track of depth-first parsing path.
        stack.push(fieldType);
      },

      // If the current node is of type Field, this function will be triggered after visiting it and all of its children.
      leave() {
        // Pop stacks to keep track of depth-first parsing path
        stack.pop();
      }
    },

    SelectionSet: {
      // If the current node is of type SelectionSet, this function will be triggered upon entering it.
      // The selection sets contain all of the sub-fields.
      // Iterate through the sub-fields to construct fieldsObject
      enter(
        node: SelectionSetNode,
        key: string | number | undefined,
        parent: ASTNode | readonly ASTNode[] | undefined,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        path: readonly (string | number)[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ancestors: readonly (ASTNode | readonly ASTNode[])[]
      ) {
        /*
         * Exclude SelectionSet nodes whose parents are not of the kind
         * 'Field' to exclude nodes that do not contain information about
         *  queried fields.
         */
        // FIXME: It is possible for the parent to be an array. This happens when the selection set
        // is a fragment spread. In that case, the parent will not have a 'kind' property. For now,
        // add a check that parent is not an array.
        if (
          parent && // parent is not undefined
          !Array.isArray(parent) && // parent is not readonly ASTNode[]
          (parent as ASTNode).kind === 'Field' // can now safely cast parent to ASTNode
        ) {
          const fieldsValues: FieldsValuesType = {};

          /*
           * Create a variable called fragment, initialized to false, to indicate whether the selection set includes a fragment spread.
           * Loop through the current selection set's selections array.
           * If the array contains a FragmentSpread node, set the fragment variable to true.
           * This is reset to false upon entering each new selection set.
           */
          let fragment = false;
          for (const field of node.selections) {
            if (field.kind === 'FragmentSpread') fragment = true;
            /*
             * If the current selection in the selections array is not a nested object
             * (i.e. does not have a SelectionSet), set its value in fieldsValues to true.
             * Below, we get the 'name' property from the SelectionNode.
             * However, InlineFragmentNode (one of the possible types for SelectionNode) does
             * not have a 'name' property, so we will want to skip nodes with that type.
             * Furthermore, FragmentSpreadNodes never have a selection set property.
             */
            if (
              field.kind !== 'InlineFragment' &&
              (field.kind === 'FragmentSpread' || !field.selectionSet)
            )
              fieldsValues[field.name.value] = true;
          }
          // If ID was not included on the request and the current node is not a fragment, then the query
          // will not be included in the cache, but the request will be processed.
          if (
            !Object.prototype.hasOwnProperty.call(fieldsValues, 'id') &&
            !Object.prototype.hasOwnProperty.call(fieldsValues, '_id') &&
            !Object.prototype.hasOwnProperty.call(fieldsValues, 'ID') &&
            !Object.prototype.hasOwnProperty.call(fieldsValues, 'Id') &&
            !fragment
          ) {
            operationType = 'noID';
            // Return BREAK to break out of the current traversal branch.
            return BREAK;
          }

          // place current fieldArgs object onto fieldsObject so it gets passed along to prototype
          // fieldArgs contains arguments, aliases, etc.
          const fieldsObject: FieldsObjectType = {
            ...fieldsValues,
            ...fieldArgs[stack[stack.length - 1]]
          };
          // Loop through stack to get correct path in proto for temp object
          stack.reduce(
            (prev: ProtoObjType, curr: string, index: number): ProtoObjType => {
              // if last item in path, set value
              if (index + 1 === stack.length) prev[curr] = { ...fieldsObject };
              return prev[curr] as ProtoObjType;
            },
            proto
          );
        }
      },

      // If the current node is of type SelectionSet, this function will be triggered upon entering it.
      leave() {
        // Pop stacks to keep track of depth-first parsing path
        stack.pop();
      }
    }
  });
  return { proto, operationType, frags };
}

/**
 * Takes collected fragments and integrates them onto the prototype where referenced.
 * @param {Object} protoObj - Prototype before it has been updated with fragments.
 * @param {Object} frags - Fragments object to update prototype with.
 * @returns {Object} Updated prototype object.
 */
function updateProtoWithFragment(
  protoObj: ProtoObjType,
  frags: FragsType
): ProtoObjType {
  // If the proto or frags objects are null/undefined, return the protoObj.
  if (!protoObj || !frags) return protoObj;

  // Loop through the fields in the proto object.
  for (const key in protoObj) {
    // If the field is a nested object and not an introspection field (fields starting with '__'
    // that provide information about the underlying schema)
    if (typeof protoObj[key] === 'object' && !key.includes('__')) {
      // Update the field to the result of recursively calling updateProtoWithFragment,
      // passing the field and fragments.
      protoObj[key] = updateProtoWithFragment(
        protoObj[key] as ProtoObjType,
        frags
      );
    }

    // If the field is a reference to a fragment, replace the reference to the fragment with
    // the actual fragment.
    if (Object.prototype.hasOwnProperty.call(frags, key)) {
      protoObj = { ...protoObj, ...frags[key] };
      delete protoObj[key];
    }
  }

  // Return the updated proto
  return protoObj;
}

/**
 *  Generates a map of mutation to GraphQL object types. This mapping is used
 *  to identify references to cached data when mutation occurs.
 *  @param {Object} schema - GraphQL defined schema that is used to facilitate caching by providing valid queries,
 *  mutations, and fields.
 *  @returns {Object} mutationMap - Map of mutations to GraphQL types.
 */
function getMutationMap(schema: GraphQLSchema): MutationMapType {
  const mutationMap: MutationMapType = {};
  // get object containing all root mutations defined in the schema
  const mutationTypeFields: GraphQLSchema['_mutationType'] = schema
    ?.getMutationType()
    ?.getFields();
  // if queryTypeFields is a function, invoke it to get object with queries
  const mutationsObj =
    typeof mutationTypeFields === 'function'
      ? mutationTypeFields()
      : mutationTypeFields;
  for (const mutation in mutationsObj) {
    // get name of GraphQL type returned by query
    // if ofType --> this is collection, else not collection
    let returnedType;
    if (mutationsObj[mutation].type.ofType) {
      returnedType = [];
      returnedType.push(mutationsObj[mutation].type.ofType.name);
    }
    if (mutationsObj[mutation].type.name) {
      returnedType = mutationsObj[mutation].type.name;
    }
    mutationMap[mutation] = returnedType;
  }
  return mutationMap;
}

/**
 *  Generates a map of queries to GraphQL object types. This mapping is used
 *  to identify and create references to cached data.
 *  @param {Object} schema - GraphQL defined schema that is used to facilitate caching by providing valid queries,
 *  mutations, and fields.
 *  @returns {Object} queryMap - Map of queries to GraphQL types.
 */
function getQueryMap(schema: GraphQLSchema): QueryMapType {
  const queryMap: QueryMapType = {};
  // get object containing all root queries defined in the schema
  const queryTypeFields: GraphQLSchema['_queryType'] = schema
    ?.getQueryType()
    ?.getFields();
  // if queryTypeFields is a function, invoke it to get object with queries
  const queriesObj =
    typeof queryTypeFields === 'function' ? queryTypeFields() : queryTypeFields;
  for (const query in queriesObj) {
    // get name of GraphQL type returned by query
    // if ofType --> this is collection, else not collection
    let returnedType;
    if (queriesObj[query].type.ofType) {
      returnedType = [];
      returnedType.push(queriesObj[query].type.ofType.name);
    }
    if (queriesObj[query].type.name) {
      returnedType = queriesObj[query].type.name;
    }
    queryMap[query] = returnedType;
  }
  return queryMap;
}

/**
 *  Generates of map of fields to GraphQL types. This mapping is used to identify
 *  and create references to cached data.
 *  @param {Object} schema - GraphQL defined schema that is used to facilitate caching by providing valid queries,
 *  mutations, and fields.
 *  @returns {Object} fieldsMap - Map of fields to GraphQL types.
 */
function getFieldsMap(schema: GraphQLSchema): FieldsMapType {
  const fieldsMap: FieldsMapType = {};
  const typesList: GraphQLSchema['_typeMap'] = schema?.getTypeMap();
  const builtInTypes: string[] = [
    'String',
    'Int',
    'Float',
    'Boolean',
    'ID',
    'Query',
    '__Type',
    '__Field',
    '__EnumValue',
    '__DirectiveLocation',
    '__Schema',
    '__TypeKind',
    '__InputValue',
    '__Directive'
  ];
  // exclude built-in types
  const customTypes = Object.keys(typesList).filter(
    (type) =>
      !builtInTypes.includes(type) && type !== schema.getQueryType()?.name
  );
  // loop through types
  for (const type of customTypes) {
    const fieldsObj: FieldsObjectType = {};
    let fields = typesList[type]._fields;
    if (typeof fields === 'function') fields = fields();
    for (const field in fields) {
      const key: string = fields[field].name;
      const value: string = fields[field].type.ofType
        ? fields[field].type.ofType.name
        : fields[field].type.name;
      fieldsObj[key] = value;
    }
    // place assembled types on fieldsMap
    fieldsMap[type] = fieldsObj;
  }
  return fieldsMap;
}

// // TODO: Unused functions for QuellCache Class
// /**
//  * createRedisKey creates key based on field name and argument id and returns string or null if key creation is not possible
//  * @param {Object} mutationMap -
//  * @param {Object} proto -
//  * @param {Object} protoArgs -
//  * @returns {Object} redisKey if possible, e.g. 'Book-1' or 'Book-2', where 'Book' is name from mutationMap and '1' is id from protoArgs
//  * and isExist if we have this key in redis
//  *
//  */
// // BUG: createRedisKey is an unused function -- types should be assigned if function is used
// async function createRedisKey(mutationMap, proto, protoArgs) {
//   let isExist = false;
//   let redisKey;
//   let redisValue = null;
//   for (const mutationName in proto) {
//     const mutationArgs = protoArgs[mutationName];
//     redisKey = mutationMap[mutationName];
//     for (const key in mutationArgs) {
//       let identifier = null;
//       if (key === 'id' || key === '_id') {
//         identifier = mutationArgs[key];
//         redisKey = mutationMap[mutationName] + '-' + identifier;
//         isExist = await this.checkFromRedis(redisKey);
//         if (isExist) {
//           redisValue = await this.getFromRedis(redisKey);
//           redisValue = JSON.parse(redisValue);
//           // combine redis value and protoArgs
//           let argumentsValue;
//           for (const mutationName in protoArgs) {
//             // change later, now we assume that we have only one mutation
//             argumentsValue = protoArgs[mutationName];
//           }
//           // updateObject is not defined anywhere
//           redisValue = this.updateObject(redisValue, argumentsValue);
//         }
//       }
//     }
//   }
//   return { redisKey, isExist, redisValue };
// }

// // BUG: getIdMap is an unused function -- types should be assigned if function is used
// function getIdMap() {
//   const idMap = {};
//   for (const type in this.fieldsMap) {
//     const userDefinedIds = [];
//     const fieldsAtType = this.fieldsMap[type];
//     for (const key in fieldsAtType) {
//       if (fieldsAtType[key] === 'ID') userDefinedIds.push(key);
//     }
//     idMap[type] = userDefinedIds;
//   }
//   return idMap;
// }

// /**
//  * Toggles to false all values in a nested field not present in cache so that they will
//  * be included in the reformulated query.
//  * @param {Object} proto - The prototype or a nested field within the prototype
//  * @returns {Object} proto - updated proto with false values for fields not present in cache
//  */
// // BUG: toggleProto is an unused function -- types should be assigned if function is used
// function toggleProto(proto) {
//   if (proto === undefined) return proto;
//   for (const key in proto) {
//     if (Object.keys(proto[key]).length > 0) this.toggleProto(proto[key]);
//     else proto[key] = false;
//   }
//   return proto;
// }

// /**
//  * checkFromRedis reads from Redis cache and returns a promise.
//  * @param {String} key - the key for Redis lookup
//  * @returns {Promise} A promise that represents if the key was found in the redisCache
//  */
// // BUG: checkFromRedis is an unused function -- types should be assigned if function is used
// async function checkFromRedis(key: string): Promise<number> {
//   try {
//     // will return 0 if key does not exists
//     const existsInRedis: number = await this.redisCache.exists(key);
//     return existsInRedis;
//   } catch (err) {
//     console.log('err in checkFromRedis: ', err);
//     return 0;
//   }
// }

// /**
//  * execRedisRunQueue executes all previously queued transactions in Redis cache
//  * @param {String} redisRunQueue - Redis queue of transactions awaiting execution
//  */
// // BUG: execRedisRunQueue is an unused function -- types should be assigned if function is used
// async function execRedisRunQueue(
//   redisRunQueue: ReturnType<typeof this.redisCache.multi>
// ): Promise<void> {
//   try {
//     await redisRunQueue.exec();
//   } catch (err) {
//     console.log('err in execRedisRunQueue: ', err);
//   }
// }
/*
map:  {
[1]   song: 'Song',
[1]   album: 'Album',
[1]   artist: [ 'Artist' ],
[1]   country: 'Country',
[1]   city: 'City',
[1]   attractions: 'Attractions'
[1] }
responseData:  {
[1]   artist: [
[1]     {
[1]       id: '6365be1ff176b90f3b81f0e9',
[1]       name: 'Frank Ocean',
[1]       albums: [Array]
[1]     }
[1]   ]
[1] }
protoField:  {
[1]   artist: {
[1]     id: false,
[1]     name: false,
[1]     __id: null,
[1]     __type: 'artist',
[1]     __alias: null,
[1]     __args: { name: 'Frank Ocean' },
[1]     albums: {
[1]       id: false,
[1]       name: false,
[1]       __id: null,
[1]       __type: 'albums',
[1]       __alias: null,
[1]       __args: null
[1]     }
[1]   }
[1] }
cacheID:  Artist
[1] cacheID2:  Artist--6365be1ff176b90f3b81f0e9
[1] currName:  string it should not be again
[1] cacheID:  albums
[1] cacheID2:  albums--6359930abeb03be432d17785
[1] currName:  string it should not be again
[1] cacheID:  albums
[1] cacheID2:  albums--63599379beb03be432d17786
[1] currName:  string it should not be again
[1] idCache:  {
[1]   'string it should not be again': {
[1]     Artist: 'Artist--6365be1ff176b90f3b81f0e9',
[1]     albums: [ 'albums--6359930abeb03be432d17785' ]
[1]   }
[1] }
*/

/*
map:  {
[1]   song: 'Song',
[1]   album: 'Album',
[1]   artist: [ 'Artist' ],
[1]   country: 'Country',
[1]   city: 'City',
[1]   attractions: 'Attractions'
[1] }
responseData:  {
[1]   artist: [
[1]     {
[1]       id: '6365be1ff176b90f3b81f0e9',
[1]       name: 'Frank Ocean',
[1]       albums: [Array]
[1]     }
[1]   ]
[1] }
protoField:  {
[1]   artist: {
[1]     id: false,
[1]     name: false,
[1]     __id: null,
[1]     __type: 'artist',
[1]     __alias: null,
[1]     __args: { name: 'Frank Ocean' },
[1]     albums: {
[1]       id: false,
[1]       name: false,
[1]       __id: null,
[1]       __type: 'albums',
[1]       __alias: null,
[1]       __args: null
[1]     }
[1]   }
[1] }
cacheID:  Artist
[1] cacheID2:  Artist--6365be1ff176b90f3b81f0e9
[1] currName:  string it should not be again
[1] cacheID:  albums
[1] cacheID2:  albums--6359930abeb03be432d17785
[1] currName:  string it should not be again
[1] cacheID:  albums
[1] cacheID2:  albums--63599379beb03be432d17786
[1] currName:  string it should not be again
[1] idCache:  {
[1]   'string it should not be again': {
[1]     Artist: 'Artist--6365be1ff176b90f3b81f0e9',
[1]     albums: [ 'albums--6359930abeb03be432d17785' ]
[1]   }
[1] }
*/
// /**
//  * normalizeForCache2 traverses over response data and formats it appropriately so we can store it in the cache.
//  * @param {Object} responseData - data we received from an external source of data such as a database or API
//  * @param {Object} map - a map of queries to their desired data types, used to ensure accurate and consistent caching
//  * @param {Object} protoField - a slice of the prototype currently being used as a template and reference for the responseData to send information to the cache
//  * @param {String} currName - parent object name, used to pass into updateIDCache
//  *
//  * Logic Wanted - If responseData is an object, save the object with its properties to the IDcache(?)
//  * but only the ID string is used as the value inside the nested object.
//  * inside IDCache - the data's object can be stored with key:value with key being the object's ID
//  * when the parent object is referenced, the nested response can grab the ID off the object, reference the IDCache,
//  * and replace the reference with the actual value
//  *
//  * if DB response has nested values as well, keep recursing but only saving the IDs as the actual references
//  *
//  * currName needs to be looked at, currently is weird string (see comments above)
//  * the IDCache is nesting the object's correcly with the right type--ID --> may be able to change the implementation for
//  * nested structure
//  *
//  * query string should be saved to redisCache
//  * where should ID:ID's Object be stored
//  * where should the actual object with references be stored?
//  * and should the Nested Object be saved to the IDCache?
//  * attempt at refactoring normalizeForCache2
//  */
// async function normalizeForCache2(
//   responseData: ResponseDataType,
//   map: QueryMapType = {},
//   protoField: ProtoObjType,
//   currName: string
// ) {
//   // loop through each resultName in response data
//   for (const resultName in responseData) {
//     // currField is assigned to the nestedObject or array on responseData
//     const currField = responseData[resultName];
//     const currProto: ProtoObjType = protoField[resultName] as ProtoObjType;
//     if (Array.isArray(currField)) {
//       for (let i = 0; i < currField.length; i++) {
//         const el: ResponseDataType = currField[i];

//         const dataType: string | undefined | string[] = map[resultName];

//         if (typeof el === 'object' && typeof dataType === 'string') {
//           await normalizeForCache2(
//             { [dataType]: el },
//             map,
//             {
//               [dataType]: currProto
//             },
//             currName
//           );
//         }
//       }
//       // need currField to always have an ID property so it can be used for caching
//       // need to modify each query to add ID for each object/subobject being requested
//     } else if (typeof currField === 'object') {
//       // need to get non-Alias ID for cache

//       // temporary store for field properties
//       const fieldStore: ResponseDataType = {};

//       //set cacheID to ID value on currField (object)
//       let cacheID: string = Object.prototype.hasOwnProperty.call(
//         map,
//         currProto.__type as string
//       )
//         ? (map[currProto.__type as string] as string)
//         : (currProto.__type as string);

//       cacheID += currProto.__id ? `--${currProto.__id}` : '';

//       // iterate over keys in nested object
//       // need to save the actual object inside the object cache
//       // and only the ID is placed as a reference inside the nested object
//       for (const key in currField) {
//         // if prototype has no ID, check field keys for ID (mostly for arrays)
//         if (
//           !currProto.__id &&
//           (key === 'id' || key === '_id' || key === 'ID' || key === 'Id')
//         ) {
//           // if currname is undefined, assign to responseData at cacheid to lower case at name
//           if (responseData[cacheID.toLowerCase()]) {
//             const responseDataAtCacheID = responseData[cacheID.toLowerCase()];
//             if (
//               typeof responseDataAtCacheID !== 'string' &&
//               !Array.isArray(responseDataAtCacheID)
//             ) {
//               if (typeof responseDataAtCacheID.name === 'string') {
//                 currName = responseDataAtCacheID.name;
//               }
//             }
//           }
//           // if the responseData at cacheid to lower case at name is not undefined, store under name variable and copy logic of writing to cache, want to update cache with same things, all stored under name
//           // store objKey as cacheID without ID added
//           const cacheIDForIDCache: string = cacheID;
//           cacheID += `--${currField[key]}`;
//           // call idcache here idCache(cacheIDForIDCache, cacheID)
//           updateIdCache(cacheIDForIDCache, cacheID, currName);
//         }

//         fieldStore[key] = currField[key];

//         // if object, recurse normalizeForCache assign in that object
//         if (typeof currField[key] === 'object') {
//           if (protoField[resultName] !== null) {
//             await normalizeForCache2(
//               { [key]: currField[key] },
//               map,
//               {
//                 [key]: (protoField[resultName] as ProtoObjType)[key]
//               },
//               currName
//             );
//           }
//         }
//       }
//       // store "current object" on cache in JSON format
//       this.writeToCache(cacheID, fieldStore);
//     }
//   }
// }
