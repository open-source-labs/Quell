import { Response, Request, NextFunction, RequestHandler } from "express";
import { parse } from "graphql/language/parser";
import { RedisClientType } from "redis";
import { redisCacheMain } from "./helpers/redisConnection";
import { graphql, GraphQLSchema, ExecutionResult, DocumentNode } from "graphql";
import { createServerError } from "./helpers/cacheUtils";

// import middleware functions
import { createRateLimiter } from "./middleware/rateLimiter";
import { createCostLimit } from "./middleware/costLimit";
import { createDepthLimit } from "./middleware/depthLimit";

// Import cache operations
import {
  createBuildFromCache,
  createGenerateCacheID,
} from "./cacheOperations/readCache";
import {
  createWriteToCache,
  createUpdateIdCache,
} from "./cacheOperations/writeCache";
import { createNormalizeForCache } from "./cacheOperations/normalizeCache";
import { createUpdateCacheByMutation } from "./cacheOperations/updateCache";
import {
  createClearCache,
  createDeleteCacheById,
  createClearAllCaches,
} from "./cacheOperations/invalidateCache";
import {
  createBuildCacheFromResponse,
  createBuildCacheFromMergedResponse,
  createHandleQueryCaching,
} from "./cacheOperations/buildCache";

// Import helper functions
import {
  createQueryStr,
  createQueryObj,
  joinResponses,
  parseAST,
  updateProtoWithFragment,
} from "./helpers/quellHelpers";

import {
  anySchemaToQuellSchema,
  getMutationMap,
  getQueryMap,
  getFieldsMap,
} from "./helpers/schemaHelpers";

// Import types
import type {
  ConstructorOptions,
  IdCacheType,
  CostParamsType,
  ProtoObjType,
  MutationMapType,
  QueryMapType,
  FieldsMapType,
  ServerErrorType,
  ParsedASTType,
  RequestType,
  ResponseDataType,
} from "./types/types";

// Import function types
import type {
  BuildFromCacheFunction,
  GenerateCacheIDFunction,
  CacheResponse,
} from "./types/readCacheTypes";
import type {
  WriteToCacheFunction,
  UpdateIdCacheFunction,
} from "./types/writeCacheTypes";
import type { NormalizeForCacheFunction } from "./cacheOperations/normalizeCache";
import type { UpdateCacheByMutationFunction } from "./types/updateCacheTypes";
import type {
  ClearCacheFunction,
  DeleteCacheByIdFunction,
  ClearAllCachesFunction,
} from "./types/invalidateCacheTypes";
import type {
  BuildCacheFromResponseFunction,
  BuildCacheFromMergedResponseFunction,
  HandleQueryCachingFunction,
} from "./types/buildCacheTypes";

/*
 * Note: This file is identical to the main quell-server file, except that the
 * rateLimiter, depthLimit, and costLimit have been modified to allow the limits
 * to be set in the request body to allow for demoing these features.
 */

const defaultCostParams: CostParamsType = {
  maxCost: 5000, // maximum cost allowed before a request is rejected
  mutationCost: 5, // cost of a mutation
  objectCost: 2, // cost of retrieving an object
  scalarCost: 1, // cost of retrieving a scalar
  depthCostFactor: 1.5, // multiplicative cost of each depth level
  maxDepth: 10, // depth limit parameter
  ipRate: 3, // requests allowed per second
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
  // Properties
  idCache: IdCacheType;
  schema: GraphQLSchema;
  costParameters: CostParamsType;
  queryMap: QueryMapType;
  mutationMap: MutationMapType;
  fieldsMap: FieldsMapType;
  cacheExpiration: number;
  redisReadBatchSize: number;
  redisCache: RedisClientType;

  // Middleware functions
  costLimit: (req: Request, res: Response, next: NextFunction) => void;
  depthLimit: (req: Request, res: Response, next: NextFunction) => void;
  rateLimiter: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void>;

  // Cache operation functions
  buildFromCache: BuildFromCacheFunction;
  generateCacheID: GenerateCacheIDFunction;
  writeToCache: WriteToCacheFunction;
  normalizeForCache: NormalizeForCacheFunction;
  updateIdCache: UpdateIdCacheFunction;
  updateCacheByMutation: UpdateCacheByMutationFunction;
  clearCache: ClearCacheFunction;
  deleteCacheById: DeleteCacheByIdFunction;
  clearAllCaches: ClearAllCachesFunction;
  buildCacheFromResponse: BuildCacheFromResponseFunction;
  buildCacheFromMergedResponse: BuildCacheFromMergedResponseFunction;
  handleQueryCaching: HandleQueryCachingFunction;

  constructor({
    schema,
    cacheExpiration = 1209600, // Default expiry time is 14 days in seconds
    costParameters = defaultCostParams,
    redisPort,
    redisHost,
    redisPassword,
  }: ConstructorOptions) {
    // Convert schema to a standardized format
    const standardizedSchema = anySchemaToQuellSchema(schema);
    console.log("+++++++++++++++++++");

    // Initialize schema-related properties
    this.schema = schema;
    this.queryMap = getQueryMap(standardizedSchema);
    this.mutationMap = getMutationMap(standardizedSchema);
    this.fieldsMap = getFieldsMap(standardizedSchema);

    // Initialize cache properties
    this.idCache = idCache;
    this.redisCache = redisCacheMain;

    //connect to Redis
    if (!this.redisCache.isOpen) {
      this.redisCache.connect().catch((err) => {
        console.error('Redis connection error in QuellCache constructor:', err);
      });
    }

    this.redisReadBatchSize = 10;
    this.cacheExpiration = cacheExpiration;

    // Initialize cost parameters
    this.costParameters = Object.assign(defaultCostParams, costParameters);

    // Initialize middleware
    this.costLimit = createCostLimit({
      costParameters: this.costParameters,
      schema: this.schema, // if needed
    });
    this.depthLimit = createDepthLimit({
      maxDepth: this.costParameters.maxDepth,
    });
    this.rateLimiter = createRateLimiter({
      ipRate: this.costParameters.ipRate,
      redisCache: this.redisCache,
    });

    // Initialize invalidation operations
    this.clearCache = createClearCache({
      redisCache: this.redisCache,
      idCache: this.idCache,
    });

    this.deleteCacheById = createDeleteCacheById({
      redisCache: this.redisCache,
    });

    this.clearAllCaches = createClearAllCaches({
      redisCache: this.redisCache,
      idCache: this.idCache,
    });

    // Initialize read operations
    this.generateCacheID = createGenerateCacheID();
    this.buildFromCache = createBuildFromCache({
      redisCache: this.redisCache,
      redisReadBatchSize: this.redisReadBatchSize,
      idCache: this.idCache,
      generateCacheID: this.generateCacheID,
    });
    // Initialize write operations
    this.updateIdCache = createUpdateIdCache({
      redisCache: this.redisCache,
      cacheExpiration: this.cacheExpiration,
      idCache: this.idCache,
    });
    this.writeToCache = createWriteToCache({
      redisCache: this.redisCache,
      cacheExpiration: this.cacheExpiration,
      idCache: this.idCache,
    });

    this.normalizeForCache = createNormalizeForCache({
      writeToCache: this.writeToCache,
      updateIdCache: this.updateIdCache,
    });

    // Initialize update operations
    this.updateCacheByMutation = createUpdateCacheByMutation({
      redisCache: this.redisCache,
      queryMap: this.queryMap,
      writeToCache: this.writeToCache,
      deleteCacheById: this.deleteCacheById,
    });

    // Initialize build operations
    this.buildCacheFromResponse = createBuildCacheFromResponse({
      queryMap: this.queryMap,
      cacheExpiration: this.cacheExpiration,
      writeToCache: this.writeToCache,
      normalizeForCache: this.normalizeForCache,
    });
    this.buildCacheFromMergedResponse = createBuildCacheFromMergedResponse({
      queryMap: this.queryMap,
      cacheExpiration: this.cacheExpiration,
      writeToCache: this.writeToCache,
      normalizeForCache: this.normalizeForCache,
    });
    this.handleQueryCaching = createHandleQueryCaching({
      queryMap: this.queryMap,
      cacheExpiration: this.cacheExpiration,
      writeToCache: this.writeToCache,
      normalizeForCache: this.normalizeForCache,
      buildCacheFromResponse: this.buildCacheFromResponse,
      buildCacheFromMergedResponse: this.buildCacheFromMergedResponse,
    });

    this.query = this.query.bind(this);
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
  async query(
    req: RequestType,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // console.log('***RUNNING QUERY***');

    // Return an error if no query is found on the request.
    if (!req.body.query) {
      next(
        createServerError(
          "Error: no GraphQL query found on request body, inside rateLimiter",
          400,
          "Error in rateLimiter: Bad Request. Check server log for more details."
        )
      );
      return;
    }

    // Retrieve GraphQL query string from request body.
    const queryString: string = req.body.query;
    // console.log('+++QUELL+++ QUERY STRING:', queryString);

    // Create the abstract syntax tree with graphql-js parser.
    // If depth limit or cost limit were implemented, then we can get the AST and parsed AST from res.locals.

    const AST: DocumentNode = res.locals.AST
      ? res.locals.AST
      : parse(queryString);
    // console.log('+++QUELL+++ AST:', parse(queryString))

    // Create response prototype, operation type, and fragments object.
    // The response prototype is used as a template for most operations in Quell including caching, building modified requests, and more.
    const { proto, operationType, frags }: ParsedASTType =
      res.locals.parsedAST ?? parseAST(AST);

    // console.log('+++QUELL+++ PARSED AST:', parseAST(AST))
    // console.log('PROTO', proto)
    console.log("+++QUELL+++ OPERATION TYPE", operationType);
    // console.log('FRAGS', frags)
    // Determine if Quell is able to handle the operation.
    // Quell can handle mutations and queries.

    if (operationType === "unQuellable") {
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
              err: `GraphQL query Error: Check server log for more details. Error: ${error}`,
            },
          };
          return next(err);
        });
    } else if (operationType === "noID") {
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
              err: `GraphQL query Error: Check server log for more details. Error: ${error}`,
            },
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
      // let redisValue: RedisValue = await getFromRedis(
      //   queryString,
      //   this.redisCache
      // );

      // if (redisValue != null) {
      //   // If the query string is found in Redis, add the result to the response and return.
      //   redisValue = JSON.parse(redisValue);
      //   res.locals.queryResponse = redisValue;
      //   return next();
      // } else {
      //   // Execute the operation, add the result to the response, write the query string and result to cache, and return.
      //   graphql({ schema: this.schema, source: queryString })
      //     .then((queryResult: ExecutionResult): void => {
      //       res.locals.queryResponse = queryResult;
      //       this.writeToCache(queryString, queryResult);
      //       return next();
      //     })
      //     .catch((error: Error): void => {
      //       const err: ServerErrorType = {
      //         log: `Error inside catch block of operationType === noID of query, graphQL query failed, ${error}`,
      //         status: 400,
      //         message: {
      //           err: `GraphQL query Error: Check server log for more details. Error: ${error}`,
      //         },
      //       };
      //       return next(err);
      //     });
      // }
    } else if (operationType === "mutation") {
      // TODO: If the operation is a mutation, we are currently clearing the cache because it is stale.
      // The goal would be to instead have a normalized cache and update the cache following a mutation.
      this.redisCache.flushAll();
      idCache = {};

      // Execute the operation and add the result to the response.
      graphql({ schema: this.schema, source: queryString })
        .then((databaseResponse: ExecutionResult): void => {
          res.locals.queryResponse = databaseResponse;

          // Determine if the query string is a valid mutation in the schema.
          // Loop through the mutations in the mutationMap.
          for (const mutation in this.mutationMap) {
            // If any mutation from the mutationMap is found on the proto, the query string includes
            // a valid mutation. Update the mutation query object, name, type variables. Update the cache with the response.
            // We don't need to wait until writeToCache is finished.
            if (Object.prototype.hasOwnProperty.call(proto, mutation)) {
              const mutationName = mutation;
              const mutationType = this.mutationMap[mutation] as string;
              const mutationQueryObject = proto[mutation] as ProtoObjType;
              this.updateCacheByMutation(
                databaseResponse,
                mutationName,
                mutationType,
                mutationQueryObject
              );
              break;
            }
          }
          return next();
        })
        .catch((error: Error): void => {
          const err: ServerErrorType = {
            log: `Error inside catch block of operationType === mutation of query, ${error}`,
            status: 400,
            message: {
              err: "GraphQL query (mutation) Error: Check server log for more details.",
            },
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
      // const cacheResponse: {
      //   data: ItemFromCacheType;
      //   cached?: boolean;
      // } = await this.buildFromCache(prototype, prototypeKeys);

      const cacheResponse: CacheResponse = await this.buildFromCache(
        prototype,
        prototypeKeys
      );

      // Create query object containing the fields that were not found in the cache.
      // This will be used to create a new GraphQL string.
      const queryObject: ProtoObjType = createQueryObj(prototype);

      // If the cached response is incomplete, reformulate query,
      // handoff query, join responses, and cache joined responses.
      if (Object.keys(queryObject).length > 0) {
        // Create a new query string that contains only the fields not found in the cache so that we can
        // request only that information from the database.

        console.log(
          "QUERY OBJECT BEFORE createQueryStr:",
          JSON.stringify(queryObject, null, 2)
        );
        const newQueryString: string = createQueryStr(
          queryObject,
          operationType
        );
        console.log("NEW QUERY STRING:", newQueryString);

        // Execute the query using the new query string.
        graphql({ schema: this.schema, source: newQueryString })
          .then(async (databaseResponseRaw: ExecutionResult): Promise<void> => {
            // The GraphQL must be parsed in order to join with it with the data retrieved from
            // the cache before sending back to user.
            const databaseResponse = JSON.parse(
              JSON.stringify(databaseResponseRaw)
            );
            console.log(
              "DATABASE RESPONSE RAW:",
              JSON.stringify(databaseResponseRaw)
            );
            console.log(
              "DATABASE RESPONSE PARSED:",
              JSON.stringify(databaseResponse)
            );

            // Check cache data
            console.log(
              "CACHE RESPONSE DATA:",
              JSON.stringify(cacheResponse.data)
            );

            // Determine cache hit status
            let cacheHitStatus: "full" | "partial" | "none" = "none";

            // Check if cache has any data
            let cacheHasData = false;

            for (const key in cacheResponse.data) {
              if (Object.keys(cacheResponse.data[key]).length > 0) {
                cacheHasData = true;
                break;
              }
            }

            // Check if query needs any database data
            const needsDatabaseData = Object.keys(queryObject).length > 0;

            if (!needsDatabaseData) {
              // Everything found in cache
              cacheHitStatus = "full";
            } else if (cacheHasData) {
              // Some data from cache, some from database
              cacheHitStatus = "partial";
            } else {
              // No data from cache, everything from database
              cacheHitStatus = "none";
            }

            console.log("CACHE HAS DATA:", cacheHasData);
            console.log("NEEDS DATABASE DATA:", needsDatabaseData);
            console.log("CACHE HIT STATUS:", cacheHitStatus);

            // Create merged response object to merge the data from the cache and the data from the database.
            // If the cache response does not have data then just use the database response.
            const mergedResponse = cacheHasData
              ? joinResponses(
                  cacheResponse.data,
                  databaseResponse.data,
                  prototype
                )
              : databaseResponse;

            console.log("=== ABOUT TO CACHE ===");
            console.log(
              "Merged Response:",
              JSON.stringify(mergedResponse, null, 2)
            );
            console.log("Prototype:", JSON.stringify(prototype, null, 2));

            // CACHE THE COMPLETE MERGED RESPONSE
            if (cacheHitStatus === "partial" || cacheHitStatus === "none") {
 // Determine the correct data to cache based on the response structure
 const dataToCache = cacheHitStatus === "none" 
 ? mergedResponse.data as ResponseDataType  // Database response has .data wrapper
 : mergedResponse as ResponseDataType;      // Joined response is already unwrapped
 
await this.normalizeForCache(
 dataToCache,
 this.queryMap,
 prototype,
 "root"
);
}
            console.log("=== FINISHED CACHING ===");

            // const currName = "string it should not be again";
            // const test = await this.normalizeForCache(
            //   mergedResponse.data as ResponseDataType,
            //   this.queryMap,
            //   prototype,
            //   currName
            // );

            // The response is given a cached key equal to false to indicate to the front end of the demo site that the
            // information was *NOT* entirely found in the cache.
            mergedResponse.cacheHit = cacheHitStatus;

            res.locals.queryResponse = { ...mergedResponse };

            return next();
          })
          .catch((error: Error): void => {
            const err: ServerErrorType = {
              log: `Error inside catch block of operationType === query of query, ${error}`,
              status: 400,
              message: {
                err: `GraphQL query Error: Check server log for more details. Error: ${error}`,
              },
            };
            return next(err);
          });
      } else {
        // If the query object is empty, there is nothing left to query and we can send the information from cache.
        // The response is given a cached key equal to true to indicate to the front end of the demo site that the
        // information was entirely found in the cache.
        cacheResponse.cacheHit = "full";
        res.locals.queryResponse = { ...cacheResponse };
        return next();
      }
    }
  }
}
