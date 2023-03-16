import { Response, Request, NextFunction } from 'express';
import { createClient } from 'redis';
import { parse } from 'graphql/language/parser';
import { visit, BREAK } from 'graphql/language/visitor';
import { graphql } from 'graphql';

import type { RedisClientType } from 'redis';
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
  IdMapType,
  ParseASTOptions,
  ArgsObjType,
  FieldArgsType,
  AuxObjType,
  ValidArgumentNodeType,
  FieldsObjectType,
  FieldsValuesType,
  GQLResponseType,
  GQLNodeWithDirectivesType
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

interface QuellCache {
  idCache: IdCacheType;
  schema: GraphQLSchema;
  costParameters: CostParamsType;
  queryMap: QueryMapType;
  mutationMap: MutationMapType;
  fieldsMap: FieldsMapType;
  idMap: IdMapType;
  cacheExpiration: number;
  redisReadBatchSize: number;
  redisCache: RedisClientType;
}

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
class QuellCache implements QuellCache {
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
    this.queryMap = this.getQueryMap(schema);
    this.mutationMap = this.getMutationMap(schema);
    this.fieldsMap = this.getFieldsMap(schema);
    this.idMap = this.getIdMap();
    this.cacheExpiration = cacheExpiration;
    this.redisReadBatchSize = 10;
    this.redisCache = createClient({
      socket: { host: redisHost, port: redisPort },
      password: redisPassword
    });
    this.query = this.query.bind(this);
    this.parseAST = this.parseAST.bind(this);
    this.clearCache = this.clearCache.bind(this);
    this.buildFromCache = this.buildFromCache.bind(this);
    this.generateCacheID = this.generateCacheID.bind(this);
    this.updateCacheByMutation = this.updateCacheByMutation.bind(this);
    this.deleteCacheById = this.deleteCacheById.bind(this);
    this.getStatsFromRedis = this.getStatsFromRedis.bind(this);
    this.getRedisInfo = this.getRedisInfo.bind(this);
    this.getRedisKeys = this.getRedisKeys.bind(this);
    this.getRedisValues = this.getRedisValues.bind(this);
    this.joinResponses = this.joinResponses.bind(this);
    this.redisCache.connect().then((): void => {
      console.log('Connected to redisCache');
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
      return next({
        status: 400, // Bad Request
        log: 'Error: no GraphQL query found on request body'
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
   *  @param {Object} req - Express request object, including request body with GraphQL query string
   *  @param {Object} res - Express response object, will carry query response to next middleware
   *  @param {Function} next - Express next middleware function, invoked when QuellCache completes its work
   */
  async query(req: Request, res: Response, next: NextFunction): Promise<void> {
    // handle request without query
    if (!req.body.query) {
      return next({ log: 'Error: no GraphQL query found on request body' });
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
      res.locals.parsedAST ?? this.parseAST(AST);

    // Determine if Quell is able to handle the operation.
    // Quell can handle mutations and queries.

    /*
     * If the operation is unQuellable (cannot be cached), execute the operation,
     * add the result to the response, and return.
     */
    if (operationType === 'unQuellable') {
      graphql({ schema: this.schema, source: queryString })
        .then((queryResult: ExecutionResult) => {
          res.locals.queryResponse = queryResult;
          return next();
        })
        .catch((error) => {
          return next(`graphql library error: ${error}`);
        });

      /*
       * we can have two types of operation to take care of
       * MUTATION OR QUERY
       */
    } else if (operationType === 'noID') {
      graphql({ schema: this.schema, source: queryString })
        .then((queryResult: ExecutionResult) => {
          res.locals.queryResponse = queryResult;
          return next();
        })
        .catch((error) => {
          return next({ log: 'graphql library error: ', error });
        });

      // Check Redis for the query string.
      let redisValue: string | null | undefined = await this.getFromRedis(
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
          .then((queryResult: ExecutionResult) => {
            res.locals.queryResponse = queryResult;
            this.writeToCache(queryString, queryResult);
            return next();
          })
          .catch((error: Error) => {
            return next(`graphql library error: ${error}`);
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
      let mutationQueryObject: unknown | ProtoObjType;
      let mutationName = '';
      let mutationType = '';
      // Loop through the mutations in the mutationMap.
      for (const mutation in this.mutationMap) {
        // If any mutation from the mutationMap is found on the proto, the query string includes
        // a valid mutation. Update the mutation query object, name, type variables.
        if (Object.prototype.hasOwnProperty.call(proto, mutation)) {
          mutationName = mutation;
          mutationType = this.mutationMap[mutation];
          mutationQueryObject = proto[mutation];
          break;
        }
      }

      // Execute the operation and add the result to the response.
      graphql({ schema: this.schema, source: queryString })
        .then((databaseResponse: ExecutionResult) => {
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
        .catch((error) => {
          return next(`graphql library error: ${error}`);
        });
    } else {
      /*
       * Otherwise, the operation type is a query.
       */
      // Combine fragments on prototype so we can access fragment values in cache.
      const prototype: ProtoObjType =
        Object.keys(frags).length > 0
          ? this.updateProtoWithFragment(proto, frags)
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
      const queryObject: ProtoObjType = this.createQueryObj(prototype);

      // If the cached response is incomplete, reformulate query,
      // handoff query, join responses, and cache joined responses.
      if (Object.keys(queryObject).length > 0) {
        // Create a new query string that contains only the fields not found in the cache so that we can
        // request only that information from the database.
        const newQueryString: string = this.createQueryStr(
          queryObject,
          operationType
        );

        // Execute the query using the new query string.
        graphql({ schema: this.schema, source: newQueryString })
          .then(async (databaseResponseRaw: ExecutionResult) => {
            // The GraphQL must be parsed in order to join with it with the data retrieved from
            // the cache before sending back to user.
            const databaseResponse: GQLResponseType = JSON.parse(
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
              ? this.joinResponses(
                  cacheResponse.data,
                  databaseResponse.data,
                  prototype
                )
              : databaseResponse;

            const currName = 'string it should not be again';
            await this.normalizeForCache(
              mergedResponse.data,
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
          .catch((error) => {
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
   * parseAST traverses the abstract syntax tree depth-first to create a template for future operations, such as
   * request data from the cache, creating a modified query string for additional information needed, and joining cache and database responses
   * @param {Object} AST - an abstract syntax tree generated by gql library that we will traverse to build our prototype
   * @param {Object} options - a field for user-supplied options, not fully integrated
   * @returns {Object} prototype object
   * @returns {string} operationType
   * @returns {Object} frags object
   */
  parseAST(
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
          if (
            (node as GQLNodeWithDirectivesType)?.directives?.length ??
            0 > 0
          ) {
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
                node.selectionSet.selections[i] as
                  | FieldNode
                  | FragmentSpreadNode
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

          // auxillary object for storing arguments, aliases, field-specific options, and more
          // query-wide options should be handled on Quell's options object
          const auxObj: AuxObjType = {
            __id: null
          };

          // Loop through the field's arguments.
          if (node.arguments) {
            node.arguments.forEach((arg: ArgumentNode) => {
              const key = arg.name.value;

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
          /*
           * BUG: Should "...argsObj[fieldType]" be removed? Because we verified above that all the values in
           * argsObj will be string/boolean/null, argsObj[fieldType] will never be an object, so spreading it will
           * not result in key-value pairs.
           */
          fieldArgs[fieldType] = {
            ...argsObj[fieldType],
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
          path: readonly (string | number)[],
          ancestors: readonly (ASTNode | readonly ASTNode[])[]
        ) {
          /*
           * Exclude SelectionSet nodes whose parents' are not of the kind
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
            // if ID was not included on the request then the query will not be included in the cache, but the request will be processed
            // AND if current node is NOT a fragment.
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
            // loop through stack to get correct path in proto for temp object;
            stack.reduce(
              (
                prev: ProtoObjType,
                curr: string,
                index: number
              ): ProtoObjType => {
                // if last item in path, set value
                if (index + 1 === stack.length)
                  prev[curr] = { ...fieldsObject };
                return prev[curr] as ProtoObjType;
              },
              proto
            );
          }
        },

        // If the current node is of type SelectionSet, this function will be triggered upon entering it.
        leave() {
          // pop stacks to keep track of depth-first parsing path
          stack.pop();
        }
      }
    });
    return { proto, operationType, frags };
  }

  /**
   * updateProtoWithFragment takes collected fragments and integrates them onto the prototype where referenced
   * @param {Object} protoObj - prototype before it has been updated with fragments
   * @param {Object} frags - fragments object to update prototype with
   * @returns {Object} updated prototype object
   */
  updateProtoWithFragment(
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
        // Update the field to the result of recursively calling updateprotoWithFragment,
        // passing the field and fragments.
        protoObj[key] = this.updateProtoWithFragment(
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
   * createRedisKey creates key based on field name and argument id and returns string or null if key creation is not possible
   * @param {Object} mutationMap -
   * @param {Object} proto -
   * @param {Object} protoArgs -
   * @returns {Object} redisKey if possible, e.g. 'Book-1' or 'Book-2', where 'Book' is name from mutationMap and '1' is id from protoArgs
   * and isExist if we have this key in redis
   *
   */
  async createRedisKey(mutationMap, proto, protoArgs) {
    let isExist = false;
    let redisKey;
    let redisValue = null;
    for (const mutationName in proto) {
      const mutationArgs = protoArgs[mutationName];
      redisKey = mutationMap[mutationName];
      for (const key in mutationArgs) {
        let identifier = null;
        if (key === 'id' || key === '_id') {
          identifier = mutationArgs[key];
          redisKey = mutationMap[mutationName] + '-' + identifier;
          isExist = await this.checkFromRedis(redisKey);
          if (isExist) {
            redisValue = await this.getFromRedis(redisKey);
            redisValue = JSON.parse(redisValue);
            // combine redis value and protoArgs
            let argumentsValue;
            for (const mutationName in protoArgs) {
              // change later, now we assume that we have only one mutation
              argumentsValue = protoArgs[mutationName];
            }
            redisValue = this.updateObject(redisValue, argumentsValue);
          }
        }
      }
    }
    return { redisKey, isExist, redisValue };
  }

  /**
   * checkFromRedis reads from Redis cache and returns a promise.
   * @param {String} key - the key for Redis lookup
   * @returns {Promise} A promise that represents if the key was found in the redisCache
   */
  async checkFromRedis(key) {
    try {
      const existsInRedis = await this.redisCache.exists(key);
      return existsInRedis;
    } catch (err) {
      console.log('err in checkFromRedis: ', err);
    }
  }

  /**
   * execRedisRunQueue executes all previously queued transactions in Redis cache
   * @param {String} redisRunQueue - Redis queue of transactions awaiting execution
   */
  async execRedisRunQueue(redisRunQueue) {
    try {
      await redisRunQueue.exec();
    } catch (err) {
      console.log('err in execRedisRunQueue: ', err);
    }
  }

  /**
   * getFromRedis reads from Redis cache and returns a promise (Redis v4 natively returns a promise).
   * @param {String} key - the key for Redis lookup
   * @returns {Promise} A promise representing the value from the redis cache with the provided key
   */
  async getFromRedis(key) {
    try {
      if (typeof key !== 'string' || key === undefined) return;
      const lowerKey = key.toLowerCase();
      const redisResult = await this.redisCache.get(lowerKey);
      return redisResult;
    } catch (err) {
      console.log('err in getFromRedis: ', err);
    }
  }

  /**
   *  getMutationMap generates a map of mutation to GraphQL object types. This mapping is used
   *  to identify references to cached data when mutation occurs.
   *  @param {Object} schema - GraphQL defined schema that is used to facilitate caching by providing valid queries,
   *  mutations, and fields
   *  @returns {Object} mutationMap - map of mutations to GraphQL types
   */
  getMutationMap(schema) {
    const mutationMap = {};
    // get object containing all root mutations defined in the schema
    const mutationTypeFields = schema._mutationType._fields;
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
   *  getQueryMap generates a map of queries to GraphQL object types. This mapping is used
   *  to identify and create references to cached data.
   *  @param {Object} schema - GraphQL defined schema that is used to facilitate caching by providing valid queries,
   *  mutations, and fields
   *  @returns {Object} queryMap - map of queries to GraphQL types
   */
  getQueryMap(schema) {
    const queryMap = {};
    // get object containing all root queries defined in the schema
    const queryTypeFields = schema._queryType._fields;
    // if queryTypeFields is a function, invoke it to get object with queries
    const queriesObj =
      typeof queryTypeFields === 'function'
        ? queryTypeFields()
        : queryTypeFields;
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
   *  getFieldsMap generates of map of fields to GraphQL types. This mapping is used to identify
   *  and create references to cached data.
   *  @param {Object} schema - GraphQL defined schema that is used to facilitate caching by providing valid queries,
   *  mutations, and fields
   *  @returns {Object} fieldsMap - map of fields to GraphQL types
   */
  getFieldsMap(schema) {
    const fieldsMap = {};
    const typesList = schema._typeMap;
    const builtInTypes = [
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
      (type) => !builtInTypes.includes(type) && type !== schema._queryType.name
    );
    // loop through types
    for (const type of customTypes) {
      const fieldsObj = {};
      let fields = typesList[type]._fields;
      if (typeof fields === 'function') fields = fields();
      for (const field in fields) {
        const key = fields[field].name;
        const value = fields[field].type.ofType
          ? fields[field].type.ofType.name
          : fields[field].type.name;
        fieldsObj[key] = value;
      }
      // place assembled types on fieldsMap
      fieldsMap[type] = fieldsObj;
    }
    return fieldsMap;
  }

  getIdMap() {
    const idMap = {};
    for (const type in this.fieldsMap) {
      const userDefinedIds = [];
      const fieldsAtType = this.fieldsMap[type];
      for (const key in fieldsAtType) {
        if (fieldsAtType[key] === 'ID') userDefinedIds.push(key);
      }
      idMap[type] = userDefinedIds;
    }
    return idMap;
  }

  /**
   * Toggles to false all values in a nested field not present in cache so that they will
   * be included in the reformulated query.
   * @param {Object} proto - The prototype or a nested field within the prototype
   * @returns {Object} proto - updated proto with false values for fields not present in cache
   */
  toggleProto(proto) {
    if (proto === undefined) return proto;
    for (const key in proto) {
      if (Object.keys(proto[key]).length > 0) this.toggleProto(proto[key]);
      else proto[key] = false;
    }
    return proto;
  }

  /**
   * buildFromCache finds any requested information in the cache and assembles it on the cacheResponse
   * uses the prototype as a template for cacheResponse, marks any data not found in the cache on the prototype for future retrieval from database
   * @param {String} key - unique id under which the cached data will be stored
   * @param {Object} item - item to be cached
   * @returns {Object} cacheResponse, mutates prototype
   */
  async buildFromCache(
    prototype,
    prototypeKeys,
    itemFromCache = {},
    firstRun = true,
    subID = false
  ) {
    for (const typeKey in prototype) {
      // if current key is a root query, check cache and set any results to itemFromCache
      if (prototypeKeys.includes(typeKey)) {
        let cacheID = subID || this.generateCacheID(prototype[typeKey]);
        const keyName = prototype[typeKey].__args?.name;
        if (idCache[keyName] && idCache[keyName][cacheID]) {
          cacheID = idCache[keyName][cacheID];
        }
        // capitalize first letter of cache id just in case
        const capitalized = cacheID.charAt(0).toUpperCase() + cacheID.slice(1);
        if (idCache[keyName] && idCache[keyName][capitalized]) {
          cacheID = idCache[keyName][capitalized];
        }
        const cacheResponse = await this.getFromRedis(cacheID);
        itemFromCache[typeKey] = cacheResponse ? JSON.parse(cacheResponse) : {};
      }

      // if itemFromCache at the current key is an array, iterate through and gather data
      if (Array.isArray(itemFromCache[typeKey])) {
        let redisRunQueue = this.redisCache.multi();
        const cachedTypeKeyArrLength = itemFromCache[typeKey].length;
        for (let i = 0; i < cachedTypeKeyArrLength; i++) {
          const currTypeKey = itemFromCache[typeKey][i];

          if (i !== 0 && i % this.redisReadBatchSize === 0) {
            this.execRedisRunQueue(redisRunQueue);
            redisRunQueue = this.redisCache.multi();
          }
          redisRunQueue.get(currTypeKey.toLowerCase(), (err, cacheResponse) => {
            const tempObj = {};

            if (cacheResponse) {
              const interimCache = JSON.parse(cacheResponse);
              for (const property in prototype[typeKey]) {
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
                  typeof prototype[typeKey][property] === 'object'
                ) {
                  const tempData = this.buildFromCache(
                    prototype[typeKey][property],
                    prototypeKeys,
                    {},
                    false,
                    `${currTypeKey}--${property}`
                  );
                  tempObj[property] = tempData.data;
                }
                // if cache does not have property, set to false on prototype so that it is sent to graphQL
                else if (
                  !property.includes('__') &&
                  typeof prototype[typeKey][property] !== 'object'
                ) {
                  prototype[typeKey][property] = false;
                }
              }
              itemFromCache[typeKey][i] = tempObj;
            }
            // if there is nothing in the cache for this key, then toggle all fields to false so it is fetched later
            else {
              for (const property in prototype[typeKey]) {
                if (
                  !property.includes('__') &&
                  typeof prototype[typeKey][property] !== 'object'
                ) {
                  prototype[typeKey][property] = false;
                }
              }
            }
          });
        }
        // execute any remnants in redis run queue
        await this.execRedisRunQueue(redisRunQueue);
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
          !Object.keys(itemFromCache).length > 0 &&
          typeof itemFromCache === 'object' &&
          !typeKey.includes('__') &&
          typeof prototype[typeKey] === 'object'
        ) {
          const cacheID = await this.generateCacheID(prototype);
          const cacheResponse = await this.getFromRedis(cacheID);
          if (cacheResponse) itemFromCache[typeKey] = JSON.parse(cacheResponse);
          await this.buildFromCache(
            prototype[typeKey],
            prototypeKeys,
            itemFromCache[typeKey] || {},
            false
          );
        }
      }
      // if not an array and not a recursive call, handle normally
      else {
        for (const field in prototype[typeKey]) {
          // if field is not found in cache then toggle to false
          if (
            itemFromCache[typeKey] &&
            !Object.prototype.hasOwnProperty.call(
              itemFromCache[typeKey],
              field
            ) &&
            !field.includes('__') &&
            typeof prototype[typeKey][field] !== 'object'
          ) {
            prototype[typeKey][field] = false;
          }

          // if field contains a nested query, then recurse the function and iterate through the nested query
          if (
            !field.includes('__') &&
            typeof prototype[typeKey][field] === 'object'
          ) {
            await this.buildFromCache(
              prototype[typeKey][field],
              prototypeKeys,
              itemFromCache[typeKey][field] || {},
              false
            );
          }
          // if there are no data in itemFromCache, toggle to false
          else if (
            !itemFromCache[typeKey] &&
            !field.includes('__') &&
            typeof prototype[typeKey][field] !== 'object'
          ) {
            prototype[typeKey][field] = false;
          }
        }
      }
    }
    // return itemFromCache on a data property to resemble graphQL response format
    return { data: itemFromCache };
  }

  /**
   * helper function
   * generateCacheID creates cacheIDs based on information from the prototype
   * format of 'field--ID'
   * @param {String} key - unique id under which the cached data will be stored
   * @param {Object} item - item to be cached
   */
  generateCacheID(queryProto) {
    const cacheID = queryProto.__id
      ? `${queryProto.__type}--${queryProto.__id}`
      : queryProto.__type;
    return cacheID;
  }

  /**
   * createQueryObj takes in a map of fields and true/false values (the prototype), and creates a query object containing any values missing from the cache
   * the resulting queryObj is then used as a template to create GQL query strings
   * @param {String} map - map of fields and true/false values from initial request, should be the prototype
   * @returns {Object} queryObject with only values to be requested from GraphQL endpoint
   */
  createQueryObj(map) {
    const output = {};
    // iterate over every key in map
    // true values are filtered out, false values are placed on output
    for (const key in map) {
      const reduced = reducer(map[key]);
      if (Object.keys(reduced).length > 0) {
        output[key] = reduced;
      }
    }

    /**
     * reducer takes in a fields object and returns only the values needed from the server
     * @param {Object} fields - Object containing true or false values that determines what should be
     * retrieved from the server.
     * @returns {Object} Filtered object of only queries without a value or an empty object
     */
    // filter fields object to contain only values needed from server
    function reducer(fields) {
      // filter stores values needed from server
      const filter = {};
      // propsFilter for properties such as args, aliases, etc.
      const propsFilter = {};

      for (const key in fields) {
        // if value is false, place directly on filter
        if (fields[key] === false) {
          filter[key] = false;
        }
        // force the id onto the query object
        if (key === 'id' || key === '_id' || key === 'ID' || key === 'Id') {
          filter[key] = false;
        }

        // if value is an object, recurse to determine nested values
        if (typeof fields[key] === 'object' && !key.includes('__')) {
          const reduced = reducer(fields[key]);
          // if reduced object has any values to pass, place on filter
          if (Object.keys(reduced).length > 1) {
            filter[key] = reduced;
          }
        }

        // if reserved property such as args or alias, place on propsFilter
        if (key.includes('__')) {
          propsFilter[key] = fields[key];
        }
      }

      const numFields = Object.keys(fields).length;

      // if the filter has any values to pass, return filter & propsFilter, otherwise return empty object
      return Object.keys(filter).length > 1 && numFields > 5
        ? { ...filter, ...propsFilter }
        : {};
    }
    return output;
  }

  /**
   * createQueryStr traverses over a supplied query Object and uses the fields on there to create a query string reflecting the data,
   * this query string is a modified version of the query string received by Quell that has references to data found within the cache removed
   * so that the final query is reduced in scope and faster
   * @param {Object} queryObject - a modified version of the prototype with only values we want to pass onto the queryString
   * @param {String} operationType - a string indicating the GraphQL operation type- 'query', 'mutation', etc.
   */
  createQueryStr(queryObject, operationType) {
    if (Object.keys(queryObject).length === 0) return '';
    const openCurly = '{';
    const closeCurly = '}';
    const openParen = '(';
    const closeParen = ')';

    let mainStr = '';

    // iterate over every key in queryObject
    // place key into query object
    for (const key in queryObject) {
      mainStr += ` ${key}${getAliasType(queryObject[key])}${getArgs(
        queryObject[key]
      )} ${openCurly} ${stringify(queryObject[key])}${closeCurly}`;
    }

    /**
     * stringify is a helper function that is used to recursively build a graphQL query string from a nested object and
     * will ignore any __values (ie __alias and __args)
     * @param {Object} fields - an object whose properties need to be converted to a string to be used for a graphQL query
     * @returns {string} innerStr - a graphQL query string
     */
    // recurse to build nested query strings
    // ignore all __values (ie __alias and __args)
    function stringify(fields) {
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
          innerStr += `${key}${getAliasType(fields[key])}${getArgs(
            fields[key]
          )} ${openCurly} ${stringify(fields[key])}${closeCurly} `;
        }
      }

      return innerStr;
    }
    // iterates through arguments object for current field and creates arg string to attach to query string
    function getArgs(fields) {
      let argString = '';
      if (!fields.__args) return '';

      Object.keys(fields.__args).forEach((key) => {
        argString
          ? (argString += `, ${key}: "${fields.__args[key]}"`)
          : (argString += `${key}: "${fields.__args[key]}"`);
      });

      // return arg string in parentheses, or if no arguments, return an empty string
      return argString ? `${openParen}${argString}${closeParen}` : '';
    }

    // if Alias exists, formats alias for query string
    function getAliasType(fields) {
      return fields.__alias ? `: ${fields.__type}` : '';
    }

    // create final query string
    const queryStr = openCurly + mainStr + ' ' + closeCurly;
    return operationType ? operationType + ' ' + queryStr : queryStr;
  }

  /**
   * joinResponses combines two objects containing results from separate sources and outputs a single object with information from both sources combined,
   * formatted to be delivered to the client, using the queryProto as a template for how to structure the final response object.
   * @param {Object} cacheResponse - response data from the cache
   * @param {Object} serverResponse - response data from the server or external API
   * @param {Object} queryProto - current slice of the prototype being used as a template for final response object structure
   * @param {Boolean} fromArray - whether or not the current recursive loop came from within an array, should NOT be supplied to function call
   */
  joinResponses(cacheResponse, serverResponse, queryProto, fromArray = false) {
    let mergedResponse = {};

    // loop through fields object keys, the "source of truth" for structure
    // store combined responses in mergedResponse
    for (const key in queryProto) {
      // for each key, check whether data stored at that key is an array or an object
      const checkResponse = Object.prototype.hasOwnProperty.call(
        serverResponse,
        key
      )
        ? serverResponse
        : cacheResponse;
      if (Array.isArray(checkResponse[key])) {
        // merging logic depends on whether the data is on the cacheResponse, serverResponse, or both
        // if both of the caches contain the same keys...
        if (
          Object.prototype.hasOwnProperty.call(cacheResponse, key) &&
          Object.prototype.hasOwnProperty.call(serverResponse, key)
        ) {
          // we first check to see if the responses have identical keys to both avoid
          // only returning 1/2 of the data (ex: there are 2 objects in the cache and
          // you query for 4 objects (which includes the 2 cached objects) only returning
          // the 2 new objects from the server)
          // if the keys are identical, we can return a "simple" merge of both
          const cacheKeys = Object.keys(cacheResponse[key][0]);
          const serverKeys = Object.keys(serverResponse[key][0]);
          let keysSame = true;
          for (let n = 0; n < cacheKeys.length; n++) {
            if (cacheKeys[n] !== serverKeys[n]) keysSame = false;
          }

          if (keysSame) {
            mergedResponse[key] = [
              ...cacheResponse[key],
              ...serverResponse[key]
            ];
          }
          // otherwise, we need to combine the responses at the object level
          else {
            const mergedArray = [];
            for (let i = 0; i < cacheResponse[key].length; i++) {
              // for each index of array, combine cache and server response objects
              const joinedResponse = this.joinResponses(
                { [key]: cacheResponse[key][i] },
                { [key]: serverResponse[key][i] },
                { [key]: queryProto[key] },
                true
              );

              mergedArray.push(joinedResponse);
            }
            mergedResponse[key] = mergedArray;
          }
        } else if (Object.prototype.hasOwnProperty.call(cacheResponse, key)) {
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
          mergedResponse = { ...cacheResponse[key], ...serverResponse[key] };
        }

        for (const fieldName in queryProto[key]) {
          // check for nested objects
          if (
            typeof queryProto[key][fieldName] === 'object' &&
            !fieldName.includes('__')
          ) {
            // recurse joinResponses on that object to create deeply nested copy on mergedResponse
            let mergedRecursion = {};
            if (
              Object.prototype.hasOwnProperty.call(cacheResponse, key) &&
              Object.prototype.hasOwnProperty.call(serverResponse, key)
            ) {
              mergedRecursion = this.joinResponses(
                { [fieldName]: cacheResponse[key][fieldName] },
                { [fieldName]: serverResponse[key][fieldName] },
                { [fieldName]: queryProto[key][fieldName] }
              );
            } else if (
              Object.prototype.hasOwnProperty.call(cacheResponse, key)
            ) {
              mergedRecursion[fieldName] = cacheResponse[key][fieldName];
            } else {
              mergedRecursion[fieldName] = serverResponse[key][fieldName];
            }

            // place on merged response
            mergedResponse[key] = {
              ...mergedResponse[key],
              ...mergedRecursion
            };
          }
        }
      }
    }
    return mergedResponse;
  }

  /**
   * writeToCache writes a value to the cache unless the key indicates that the item is uncacheable. Note: writeToCache will JSON.stringify the input item
   * writeTochache will set expiration time for each item written to cache
   * @param {String} key - unique id under which the cached data will be stored
   * @param {Object} item - item to be cached
   */
  writeToCache(key, item) {
    const lowerKey = key.toLowerCase();
    if (!key.includes('uncacheable')) {
      this.redisCache.set(lowerKey, JSON.stringify(item));
      this.redisCache.EXPIRE(lowerKey, this.cacheExpiration);
    }
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
    dbRespDataRaw,
    mutationName,
    mutationType,
    mutationQueryObject
  ) {
    let fieldsListKey;
    const dbRespId = dbRespDataRaw.data[mutationName]?.id;
    let dbRespData = JSON.parse(
      JSON.stringify(dbRespDataRaw.data[mutationName])
    );

    if (!dbRespData) dbRespData = {};

    for (const queryKey in this.queryMap) {
      const queryKeyType = this.queryMap[queryKey];

      if (JSON.stringify(queryKeyType) === JSON.stringify([mutationType])) {
        fieldsListKey = queryKey;
        break;
      }
    }

    /**
     * Helper function that takes in a list of fields to remove from the
     * @param {Set<String> | Array} fieldKeysToRemove - field keys to be removed from the cached field list
     */
    const removeFromFieldKeysList = async (fieldKeysToRemove) => {
      if (fieldsListKey) {
        const cachedFieldKeysListRaw = await this.getFromRedis(fieldsListKey);
        const cachedFieldKeysList = JSON.parse(cachedFieldKeysListRaw);

        await fieldKeysToRemove.forEach((fieldKey) => {
          // index position of field key to remove from list of field keys
          const removalFieldKeyIdx = cachedFieldKeysList.indexOf(fieldKey);

          if (removalFieldKeyIdx !== -1) {
            cachedFieldKeysList.splice(removalFieldKeyIdx, 1);
          }
        });
        this.writeToCache(fieldsListKey, cachedFieldKeysList);
      }
    };

    /**
     * Helper function that loops through the cachedFieldKeysList and helps determine which
     * fieldKeys should be deleted and passes those fields to removeFromFieldKeysList for removal
     */
    const deleteApprFieldKeys = async () => {
      if (fieldsListKey) {
        const cachedFieldKeysListRaw = await this.getFromRedis(fieldsListKey);
        const cachedFieldKeysList = JSON.parse(cachedFieldKeysListRaw);

        const fieldKeysToRemove = new Set();
        for (let i = 0; i < cachedFieldKeysList.length; i++) {
          const fieldKey = cachedFieldKeysList[i];

          const fieldKeyValueRaw = await this.getFromRedis(
            fieldKey.toLowerCase()
          );
          const fieldKeyValue = JSON.parse(fieldKeyValueRaw);

          let remove = true;
          for (const arg in mutationQueryObject.__args) {
            if (Object.prototype.hasOwnProperty.call(fieldKeyValue, arg)) {
              const argValue = mutationQueryObject.__args[arg];
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
        removeFromFieldKeysList(fieldKeysToRemove);
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
      const cachedFieldKeysList = JSON.parse(cachedFieldKeysListRaw);

      // iterate through field key field key values in redis, and compare to user
      // specified mutation args to determine which fields are used to update by
      // and which fields need to be updated.

      cachedFieldKeysList.forEach(async (fieldKey) => {
        const fieldKeyValueRaw = await this.getFromRedis(
          fieldKey.toLowerCase()
        );
        const fieldKeyValue = JSON.parse(fieldKeyValueRaw);

        const fieldsToUpdateBy = [];
        const updatedFieldKeyValue = fieldKeyValue;

        Object.entries(mutationQueryObject.__args).forEach(([arg, argVal]) => {
          if (arg in fieldKeyValue && fieldKeyValue[arg] === argVal) {
            // foreign keys are not fields to update by
            if (arg.toLowerCase().includes('id') === false) {
              // arg.toLowerCase
              fieldsToUpdateBy.push(arg);
            }
          } else {
            updatedFieldKeyValue[arg] = argVal;
          }
        });

        if (fieldsToUpdateBy.length > 0) {
          this.writeToCache(fieldKey, updatedFieldKeyValue);
        }
      });
    };

    const hypotheticalRedisKey = `${mutationType.toLowerCase()}--${dbRespId}`;
    const redisKey = await this.getFromRedis(hypotheticalRedisKey);

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

        const removalFieldKeysList = [];

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
  async deleteCacheById(key) {
    try {
      await this.redisCache.del(key);
    } catch (err) {
      console.log('err in deleteCacheById: ', err);
    }
  }

  /**
   * normalizeForCache traverses over response data and formats it appropriately so we can store it in the cache.
   * @param {Object} responseData - data we received from an external source of data such as a database or API
   * @param {Object} map - a map of queries to their desired data types, used to ensure accurate and consistent caching
   * @param {Object} protoField - a slice of the prototype currently being used as a template and reference for the responseData to send information to the cache
   * @param {String} currName - parent object name, used to pass into updateIDCache
   */
  async normalizeForCache(responseData, map = {}, protoField, currName) {
    for (const resultName in responseData) {
      const currField = responseData[resultName];
      const currProto = protoField[resultName];
      if (Array.isArray(currField)) {
        for (let i = 0; i < currField.length; i++) {
          const el = currField[i];

          const dataType = map[resultName];

          if (typeof el === 'object') {
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
        const fieldStore = {};

        // create a cacheID based on __type and __id from the prototype
        let cacheID = Object.prototype.hasOwnProperty.call(
          map,
          currProto.__type
        )
          ? map[currProto.__type]
          : currProto.__type;

        cacheID += currProto.__id ? `--${currProto.__id}` : '';

        // iterate over keys in nested object
        for (const key in currField) {
          // if prototype has no ID, check field keys for ID (mostly for arrays)
          if (
            !currProto.__id &&
            (key === 'id' || key === '_id' || key === 'ID' || key === 'Id')
          ) {
            // if currname is undefined, assign to responseData at cacheid to lower case at name
            if (responseData[cacheID.toLowerCase()]) {
              const responseDataAtCacheID = responseData[cacheID.toLowerCase()];
              currName = responseDataAtCacheID.name;
            }
            // if the responseData at cacheid to lower case at name is not undefined, store under name variable and copy logic of writing to cache, want to update cache with same things, all stored under name
            // store objKey as cacheID without ID added
            const cacheIDForIDCache = cacheID;
            cacheID += `--${currField[key]}`;
            // call idcache here idCache(cacheIDForIDCache, cacheID)
            this.updateIdCache(cacheIDForIDCache, cacheID, currName);
          }

          fieldStore[key] = currField[key];

          // if object, recurse normalizeForCache assign in that object
          if (typeof currField[key] === 'object') {
            await this.normalizeForCache(
              { [key]: currField[key] },
              map,
              {
                [key]: protoField[resultName][key]
              },
              currName
            );
          }
        }
        // store "current object" on cache in JSON format
        this.writeToCache(cacheID, fieldStore);
      }
    }
  }

  /**
   * clearCache flushes the Redis cache. To clear the cache from the client, establish an endpoint that
   * passes the request and response objects to an instance of QuellCache.clearCache.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  clearCache(req, res, next) {
    console.log('Clearing Redis Cache');
    this.redisCache.flushAll();
    return next();
  }

  /**
   * The getRedisInfo returns a chain of middleware based on what information
   * (if any) the user would like to request from the specified redisCache. It
   * requires an appropriately configured Express route, for instance:
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
  getRedisInfo(options = { getStats: true, getKeys: true, getValues: true }) {
    console.log('Getting Redis Info');
    let middleware;

    /**
     * getOptions is a helper function within the getRedisInfo function that returns
     * what redis data should be retrieved based off the passed in options
     * @param {Object} opts - Options object containing a boolean value for getStats, getKeys, and getValues
     * @returns {string} a string that indicates which data should be retrieved from redis instance
     */
    const getOptions = (opts) => {
      const { getStats, getKeys, getValues } = opts;
      if (!getStats && getKeys && getValues) return 'dontGetStats';
      else if (getStats && getKeys && !getValues) return 'dontGetValues';
      else if (!getStats && getKeys && !getValues) return 'getKeysOnly';
      else if (getStats && !getKeys && !getValues) return 'getStatsOnly';
      else return 'getAll';
    };

    switch (getOptions(options)) {
      case 'dontGetStats':
        middleware = [
          this.getRedisKeys,
          this.getRedisValues,
          (req, res) => {
            return res.status(200).send(res.locals);
          }
        ];
        break;
      case 'dontGetValues':
        middleware = [
          this.getStatsFromRedis,
          this.getRedisKeys,
          (req, res) => {
            return res.status(200).send(res.locals);
          }
        ];
        break;
      case 'getKeysOnly':
        middleware = [
          this.getRedisKeys,
          (req, res) => {
            return res.status(200).send(res.locals);
          }
        ];
        break;
      case 'getStatsOnly':
        middleware = [
          this.getStatsFromRedis,
          (req, res) => {
            return res.status(200).send(res.locals);
          }
        ];
        break;
      case 'getAll':
        middleware = [
          this.getStatsFromRedis,
          this.getRedisKeys,
          this.getRedisValues,
          (req, res) => {
            return res.status(200).send(res.locals);
          }
        ];
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
  getStatsFromRedis(req, res, next) {
    try {
      const getStats = () => {
        // redisCache.info returns information and statistics about the server as an array of field:value
        this.redisCache
          .info()
          .then((response) => {
            const dataLines = response.split('\r\n');
            // dataLines is an array of strings

            const output = {
              // SERVER
              server: [
                // redis version
                {
                  name: 'Redis version',
                  value: dataLines
                    .find((line) => line.match(/redis_version/))
                    .split(':')[1]
                },
                // redis build id
                {
                  name: 'Redis build id',
                  value: dataLines
                    .find((line) => line.match(/redis_build_id/))
                    .split(':')[1]
                },
                // redis mode
                {
                  name: 'Redis mode',
                  value: dataLines
                    .find((line) => line.match(/redis_mode/))
                    .split(':')[1]
                },
                // os hosting redis system
                {
                  name: 'Host operating system',
                  value: dataLines
                    .find((line) => line.match(/os/))
                    .split(':')[1]
                },
                // TCP/IP listen port
                {
                  name: 'TCP/IP port',
                  value: dataLines
                    .find((line) => line.match(/tcp_port/))
                    .split(':')[1]
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
                    .split(':')[1]
                },
                // num of days since Redis server start
                {
                  name: 'Server uptime (days)',
                  value: dataLines
                    .find((line) => line.match(/uptime_in_days/))
                    .split(':')[1]
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
                    .split(':')[1]
                }
              ],
              // CLIENT
              client: [
                // number of connected clients
                {
                  name: 'Connected clients',
                  value: dataLines
                    .find((line) => line.match(/connected_clients/))
                    .split(':')[1]
                },
                // number of sockets used by cluster bus
                {
                  name: 'Cluster connections',
                  value: dataLines
                    .find((line) => line.match(/cluster_connections/))
                    .split(':')[1]
                },
                // max clients
                {
                  name: 'Max clients',
                  value: dataLines
                    .find((line) => line.match(/maxclients/))
                    .split(':')[1]
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
                    .split(':')[1]
                }
              ],
              // MEMORY
              memory: [
                // total allocated memory
                {
                  name: 'Total allocated memory',
                  value: dataLines
                    .find((line) => line.match(/used_memory_human/))
                    .split(':')[1]
                },
                // peak memory consumed
                {
                  name: 'Peak memory consumed',
                  value: dataLines
                    .find((line) => line.match(/used_memory_peak_human/))
                    .split(':')[1]
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
                    .split(':')[1]
                },
                // total number of commands processed by server
                {
                  name: 'Total commands',
                  value: dataLines
                    .find((line) => line.match(/total_commands_processed/))
                    .split(':')[1]
                },
                // number of commands processed per second
                {
                  name: 'Commands processed per second',
                  value: dataLines
                    .find((line) => line.match(/instantaneous_ops_per_sec/))
                    .split(':')[1]
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
                    .split(':')[1]
                },
                // total number of bytes read from network
                {
                  name: 'Bytes read from network',
                  value: dataLines
                    .find((line) => line.match(/total_net_input_bytes/))
                    .split(':')[1]
                },
                // networks read rate per second
                {
                  name: 'Network read rate (Kb/s)',
                  value: dataLines
                    .find((line) => line.match(/instantaneous_input_kbps/))
                    .split(':')[1]
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
                    .split(':')[1]
                }
              ]
            };
            res.locals.redisStats = output;
            return next();
          })
          .catch((err) => {
            return next(err);
          });
      };

      getStats();
    } catch (err) {
      return next(err);
    }
  }

  /**
   * getRedisKeys gets the key names from the redis cache and adds them to the response.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getRedisKeys(req, res, next) {
    this.redisCache
      .keys('*')
      .then((response) => {
        res.locals.redisKeys = response;
        return next();
      })
      .catch((err) => {
        return next(err);
      });
  }

  /**
   * getRedisValues gets the values associated with the redis cache keys and adds them to the response.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getRedisValues(req, res, next) {
    if (res.locals.redisKeys.length !== 0) {
      this.redisCache
        .mGet(res.locals.redisKeys)
        .then((response) => {
          res.locals.redisValues = response;
          return next();
        })
        .catch((err) => {
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
  depthLimit(req, res, next) {
    // get depth max limit from cost parameters
    let { maxDepth } = this.costParameters;
    // maxDepth can be reassigned to get depth max limit from req.body if user selects depth limit
    if (req.body.costOptions.maxDepth) maxDepth = req.body.costOptions.maxDepth;
    // return error if no query in request.
    if (!req.body.query) return res.status(400);
    // assign graphQL query string to variable queryString
    const queryString = req.body.query;

    // create AST
    const AST = parse(queryString);

    // create response prototype, and operation type, and fragments object
    // the response prototype is used as a template for most operations in quell including caching, building modified requests, and more
    const { proto, operationType, frags } = this.parseAST(AST);
    // check for fragments
    const prototype =
      Object.keys(frags).length > 0
        ? this.updateProtoWithFragment(proto, frags)
        : proto;

    /**
     * determineDepth is a helper function to pass an error if the depth of the proto is greater than the maxDepth.
     * will be using this function to recursively go deeper into the nested query
     * @param {Object} proto - the prototype
     * @param {Number} currentDepth - initialized to 0, increases for each nested level within proto
     */
    const determineDepth = (proto, currentDepth = 0) => {
      if (currentDepth > maxDepth) {
        const err = {
          log: `Depth limit exceeded, tried to send query with the depth of ${currentDepth}.`
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // for each field
      Object.keys(proto).forEach((key) => {
        // if the field is nested, recurse, increasing currentDepth by 1
        if (typeof proto[key] === 'object' && !key.includes('__')) {
          determineDepth(proto[key], currentDepth + 1);
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
  costLimit(req, res, next) {
    // get default values for costParameters
    let { maxCost } = this.costParameters;
    const { mutationCost, objectCost, depthCostFactor, scalarCost } =
      this.costParameters;
    // maxCost can be reassigned to get maxcost limit from req.body if user selects cost limit
    if (req.body.costOptions.maxCost) maxCost = req.body.costOptions.maxCost;
    // return error if no query in request.
    if (!req.body.query) return res.status(400);
    // assign graphQL query string to variable queryString
    const queryString = req.body.query;
    // create AST
    const AST = parse(queryString);

    // create response prototype, and operation type, and fragments object
    // the response prototype is used as a template for most operations in quell including caching, building modified requests, and more
    const { proto, operationType, frags } = this.parseAST(AST);
    // check for fragments
    const prototype =
      Object.keys(frags).length > 0
        ? this.updateProtoWithFragment(proto, frags)
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
    const determineCost = (proto) => {
      // create error if maxCost exceeded
      if (cost > maxCost) {
        const err = {
          log: `Cost limit exceeded, tried to send query with a cost above ${maxCost}.`
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // for each field
      Object.keys(proto).forEach((key) => {
        // if the field is nested, increase the total cost by objectCost and recurse
        if (typeof proto[key] === 'object' && !key.includes('__')) {
          cost += objectCost;
          return determineCost(proto[key]);
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
    const determineDepthCost = (proto, totalCost = cost) => {
      // create error if maxCost exceeded
      if (totalCost > maxCost) {
        const err = {
          log: `Cost limit exceeded, tried to send query with a cost exceeding ${maxCost}.`
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // for each field
      Object.keys(proto).forEach((key) => {
        // if the field is nested, recurse, multiplying the current total cost by the depthCostFactor
        if (typeof proto[key] === 'object' && !key.includes('__')) {
          determineDepthCost(proto[key], totalCost * depthCostFactor);
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

module.exports = QuellCache;
