const redis = require('redis');
const { parse } = require('graphql/language/parser');
const { visit, BREAK } = require('graphql/language/visitor');
const { graphql } = require('graphql');

import { Request, Response, NextFunction } from 'express';
import {
  QueryObject,
  QueryMapType,
  QueryFields,
  ItemToBeCached,
  MapType,
  DatabaseResponseDataRaw,
  TypeData,
  Type,
} from './types';

const defaultCostParams = {
  maxCost: 5000, // maximum cost allowed before a request is rejected
  mutationCost: 5, // cost of a mutation
  objectCost: 2, // cost of retrieving an object
  scalarCost: 1, // cost of retrieving a scalar
  depthCostFactor: 1.5, // multiplicative cost of each depth level
  maxDepth: 10, // depth limit parameter
  ipRate: 3, // requests allowed per second
};

let idCache = {};
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
class QuellCache {
  // default host is localhost, default expiry time is 14 days in milliseconds
  constructor(
    schema,
    cacheExpiration = 1209600,
    costParameters = defaultCostParams,
    redisPort,
    redisHost,
    redisPassword,
    idCache
  ) {
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
    this.redisCache = redis.createClient({
      socket: { host: redisHost, port: redisPort },
      password: redisPassword,
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
    this.redisCache.connect().then(() => {
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
  async rateLimiter(req, res, next) {
    let ipRates;
    // ipRate can be reassigned to get ipRate limit from req.body if user selects requests limit
    if (req.body.costOptions.ipRate) ipRates = req.body.costOptions.ipRate;
    //  else ipRates = this.costParameters.ipRate;
    // return error if no query in request.
    if (!req.body.query) {
      return next({ log: 'Error: no GraphQL query found on request body' });
    }
    const ip = req.ip;
    const now = Math.floor(Date.now() / 1000);
    const ipKey = `${ip}:${now}`;

    this.redisCache.incr(ipKey, (err, count) => {
      if (err) {
        console.error('Redis cache error: ', err);
        return next({ log: 'Internal Server Error in redis :(' });
      }

      this.redisCache.expire(ipKey, 1);
      console.error('Redis cache incremented:', ipKey, count);
      return next();
    });

    const calls = await this.getFromRedis(ipKey);

    if (calls > ipRates) {
      return next({
        log: `Express error handler caught too many requests from this IP address: ${ip}`,
      });
    }
    return next();
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
  async query(req, res, next) {
    // handle request without query
    if (!req.body.query) {
      return next({ log: 'Error: no GraphQL query found on request body' });
    }
    // retrieve GraphQL query string from request object;
    const queryString = req.body.query;

    // create abstract syntax tree with graphql-js parser
    // if depth limit was implemented, then we don't need to run parse again and instead grab from res.locals.
    const AST = res.locals.AST ? res.locals.AST : parse(queryString);
    // create response prototype, and operation type, and fragments object
    // the response prototype is used as a template for most operations in quell including caching, building modified requests, and more
    const { proto, operationType, frags } = res.locals.parsedAST
      ? res.locals.parsedAST
      : this.parseAST(AST);

    // pass-through for queries and operations that QuellCache cannot handle
    if (operationType === 'unQuellable') {
      graphql({ schema: this.schema, source: queryString })
        .then((queryResult) => {
          res.locals.queryResponse = queryResult;
          return next();
        })
        .catch((error) => {
          return next('graphql library error: ', error);
        });

      /*
       * we can have two types of operation to take care of
       * MUTATION OR QUERY
       */
    } else if (operationType === 'noID') {
      graphql({ schema: this.schema, source: queryString })
        .then((queryResult) => {
          res.locals.queryResponse = queryResult;
          return next();
        })
        .catch((error) => {
          return next({ log: 'graphql library error: ', error });
        });
      let redisValue = await this.getFromRedis(queryString);
      if (redisValue != null) {
        redisValue = JSON.parse(redisValue);
        res.locals.queriesResponse = redisValue;
        return next();
      } else {
        graphql({ schema: this.schema, source: queryString })
          .then((queryResult) => {
            res.locals.queryResponse = queryResult;
            this.writeToCache(queryString, queryResult);
            return next();
          })
          .catch((error) => {
            return next('graphql library error: ', error);
          });
      }
    } else if (operationType === 'mutation') {
      // clear cache on mutation because now cache data is stale
      /*
      NOTE: this is not the logic we should be using for mutations--rather than flushing the cache and resetting the idCache
        we should instead be updating the cache following a mutation.
      */
      // this.redisCache.flushAll();
      idCache = {};

      let mutationQueryObject;
      let mutationName;
      let mutationType;
      for (const mutation in this.mutationMap) {
        if (Object.prototype.hasOwnProperty.call(proto, mutation)) {
          mutationName = mutation;
          mutationType = this.mutationMap[mutation];
          mutationQueryObject = proto[mutation];
          break;
        }
      }

      graphql({ schema: this.schema, source: queryString })
        .then((databaseResponse) => {
          // if redis needs to be updated, write to cache and send result back, we don't need to wait untill writeToCache is finished
          res.locals.queryResponse = databaseResponse;

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
          return next('graphql library error: ', error);
        });
    } else {
      // if QUERY
      // combines fragments on prototype so we can access fragment values in cache
      const prototype =
        Object.keys(frags).length > 0
          ? this.updateProtoWithFragment(proto, frags)
          : proto;
      // list keys on prototype as reference for buildFromCache
      const prototypeKeys = Object.keys(prototype);

      // check cache for any requested values
      // modifies prototype to track any values not in the cache
      const cacheResponse = await this.buildFromCache(prototype, prototypeKeys);
      let mergedResponse;
      // create object of queries not found in cache, to create gql string
      const queryObject = this.createQueryObj(prototype);
      // if cached response is incomplete, reformulate query, handoff query, join responses, and cache joined responses
      if (Object.keys(queryObject).length > 0) {
        // the query string we send to GraphQL does not need any information found in the cache, so we create a new one
        const newQueryString = this.createQueryStr(queryObject, operationType);
        graphql({ schema: this.schema, source: newQueryString })
          .then(async (databaseResponseRaw) => {
            // databaseResponse must be parsed in order to join with cacheResponse before sending back to user
            const databaseResponse = JSON.parse(
              JSON.stringify(databaseResponseRaw)
            );
            // iterate over the keys in cacheresponse data to see if the cache has any data
            let cacheHasData = false;
            for (const key in cacheResponse.data) {
              if (Object.keys(cacheResponse.data[key]).length > 0) {
                cacheHasData = true;
              }
            }
            // join uncached and cached responses, if cache does not have data then just use the database response
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
            mergedResponse.cached = false;
            res.locals.queryResponse = { ...mergedResponse };
            return next();
          })
          .catch((error) => {
            return next({ log: 'graphql library error: ', error });
          });
      } else {
        // if queryObject is empty, there is nothing left to query, can directly send information from cache
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
  updateIdCache(objKey, keyWithID, currName) {
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
    idCache[currName][objKey].push(keyWithID);
    // update ID cache under key of currName in an array
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
  parseAST(AST, options = { userDefinedID: null }) {
    // options = { userDefinedID: null }
    // initialize prototype as empty object
    // information from AST is distilled into the prototype for easy access during caching, rebuilding query strings, etc.
    const proto = {};
    const frags = {};

    // will be query, mutation, subscription, or unQuellable
    let operationType = '';

    // initialize stack to keep track of depth first parsing path
    const stack = [];

    // tracks arguments, aliases, etc. for specific fields
    // eventually merged with prototype object
    const fieldArgs = {};

    // extract userDefinedID from options object, if provided
    const userDefinedID = options.userDefinedID;

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
      enter(node) {
        // cannot cache directives, return as unquellable
        if (node.directives) {
          if (node.directives.length > 0) {
            operationType = 'unQuellable';
            return BREAK;
          }
        }
      },
      OperationDefinition(node) {
        // cannot cache subscriptions, return as unquellable
        operationType = node.operation;
        if (node.operation === 'subscription') {
          operationType = 'unQuellable';
          return BREAK;
        }
      },
      // set-up for fragment definition traversal
      FragmentDefinition(node) {
        // update stack for path tracking
        stack.push(node.name.value);

        // extract base-level fields in the fragment into frags object
        const fragName = node.name.value;

        frags[fragName] = {}; // adding fragName to frags object as an empty object
        for (let i = 0; i < node.selectionSet.selections.length; i++) {
          frags[fragName][node.selectionSet.selections[i].name.value] = true;
        }
      },
      Field: {
        enter(node) {
          // return introspection queries as unQuellable to not cache them
          // "__keyname" syntax is later used for Quell's field-specific options, though this does not create collision with introspection
          if (node.name.value.includes('__')) {
            operationType = 'unQuellable';
            return BREAK;
          }

          // populates argsObj from current node's arguments
          // generates uniqueID
          const argsObj = {};

          // auxillary object for storing arguments, aliases, field-specific options, and more
          // query-wide options should be handled on Quell's options object
          const auxObj = {
            __id: null,
          };
          node.arguments.forEach((arg) => {
            const key = arg.name.value;
            // pass variables through
            if (arg.value.kind === 'Variable' && operationType === 'query') {
              operationType = 'unQuellable';
              return BREAK;
            }

            // assign args to argsObj, skipping field-specific options ('__') provided as arguments
            if (!key.includes('__')) {
              argsObj[key] = arg.value.value;
            }

            // identify uniqueID from args, options
            // assigns ID as userDefinedID if one is supplied on options object
            // note: do not use key.includes('id') to avoid assigning fields such as "idea" or "idiom" as uniqueID
            if (userDefinedID ? key === userDefinedID : false) {
              auxObj.__id = arg.value.value;
            } else if (
              key === 'id' ||
              key === '_id' ||
              key === 'ID' ||
              key === 'Id'
            ) {
              auxObj.__id = arg.value.value;
            }
          });

          // gather auxillary data such as aliases, arguments, query type, and more to append to the prototype for future reference

          const fieldType = node.alias ? node.alias.value : node.name.value;

          auxObj.__type = node.name.value.toLowerCase();

          auxObj.__alias = node.alias ? node.alias.value : null;

          auxObj.__args = Object.keys(argsObj).length > 0 ? argsObj : null;

          // adds auxObj fields to prototype, allowing future access to type, alias, args, etc.
          fieldArgs[fieldType] = {
            ...argsObj[fieldType],
            ...auxObj,
          };
          // add value to stacks to keep track of depth-first parsing path
          stack.push(fieldType);
        },
        leave() {
          // pop stacks to keep track of depth-first parsing path
          stack.pop();
        },
      },
      SelectionSet: {
        // selection sets contain all of the sub-fields
        // iterate through the sub-fields to construct fieldsObject
        enter(node, key, parent, path, ancestors) {
          /* Exclude SelectionSet nodes whose parents' are not of the kind
           * 'Field' to exclude nodes that do not contain information about
           *  queried fields.
           */
          if (parent.kind === 'Field') {
            const fieldsValues = {};

            // this fragment variable keeps track of whether or not the current node is a FragmentSpread.
            // it should reset back to false when traversing a new node.
            let fragment = false;
            for (const field of node.selections) {
              if (field.kind === 'FragmentSpread') fragment = true;
              // sets any fields values to true, unless it is a nested object (ie has selectionSet)
              if (!field.selectionSet) fieldsValues[field.name.value] = true;
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
              return BREAK;
            }

            // place current fieldArgs object onto fieldsObject so it gets passed along to prototype
            // fieldArgs contains arguments, aliases, etc.
            const fieldsObject = {
              ...fieldsValues,
              ...fieldArgs[stack[stack.length - 1]],
            };
            // loop through stack to get correct path in proto for temp object;
            stack.reduce((prev, curr, index) => {
              // if last item in path, set value
              if (index + 1 === stack.length) prev[curr] = { ...fieldsObject };
              return prev[curr];
            }, proto);
          }
        },
        leave() {
          // pop stacks to keep track of depth-first parsing path
          stack.pop();
        },
      },
    });
    return { proto, operationType, frags };
  }

  /**
   * updateProtoWithFragment takes collected fragments and integrates them onto the prototype where referenced
   * @param {Object} protoObj - prototype before it has been updated with fragments
   * @param {Object} frags - fragments object to update prototype with
   * @returns {Object} updated prototype object
   */
  updateProtoWithFragment(protoObj, frags) {
    if (!protoObj) return;
    for (const key in protoObj) {
      // if nested field, recurse
      if (typeof protoObj[key] === 'object' && !key.includes('__')) {
        protoObj[key] = this.updateProtoWithFragment(protoObj[key], frags);
      }

      // if field is a reference to a fragment, add fragment to field in place of the reference to the fragment
      if (Object.prototype.hasOwnProperty.call(frags, key)) {
        protoObj = { ...protoObj, ...frags[key] };
        delete protoObj[key];
      }
    }

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
      '__Directive',
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
  createQueryStr(queryObject: QueryObject, operationType: string): string {
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
          const fieldsObj: QueryFields = fields[key];
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
    // iterates through arguments object for current field and creates arg string to attach to query string
    function getArgs(fields: QueryFields): string {
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
    function getAliasType(fields: QueryFields): string {
      return fields.__alias ? `: ${fields.__type}` : '';
    }

    // create final query string
    const queryStr: string = openCurly + mainStr + ' ' + closeCurly;
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
  joinResponses(
    cacheResponse: TypeData,
    serverResponse: TypeData,
    queryProto: QueryObject,
    fromArray = false
  ): TypeData {
    let mergedResponse: TypeData = {};

    // loop through fields object keys, the "source of truth" for structure
    // store combined responses in mergedResponse
    for (const key in queryProto) {
      // for each key, check whether data stored at that key is an array or an object
      const checkResponse: TypeData = Object.prototype.hasOwnProperty.call(
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
          const cacheKeys: string[] = Object.keys(cacheResponse[key][0]);
          const serverKeys: string[] = Object.keys(serverResponse[key][0]);
          let keysSame = true;
          for (let n = 0; n < cacheKeys.length; n++) {
            if (cacheKeys[n] !== serverKeys[n]) keysSame = false;
          }
          if (keysSame) {
            mergedResponse[key] = [
              ...cacheResponse[key],
              ...serverResponse[key],
            ];
          }
          // otherwise, we need to combine the responses at the object level
          else {
            const mergedArray = [];
            for (let i = 0; i < cacheResponse[key].length; i++) {
              // for each index of array, combine cache and server response objects
              const joinedResponse: TypeData = this.joinResponses(
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
            ...serverResponse[key],
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
              ...mergedRecursion,
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
  writeToCache(key: string, item: ItemToBeCached): void {
    const lowerKey: string = key.toLowerCase();
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
    dbRespDataRaw: DatabaseResponseDataRaw,
    mutationName: string,
    mutationType: string,
    mutationQueryObject: QueryFields
  ) {
    let fieldsListKey: string;
    const dbRespId: string = dbRespDataRaw.data[mutationName]?.id;
    let dbRespData: Type = JSON.parse(
      JSON.stringify(dbRespDataRaw.data[mutationName])
    );

    if (!dbRespData) dbRespData = {};

    for (const queryKey in this.queryMap) {
      const queryKeyType: string = this.queryMap[queryKey];

      if (JSON.stringify(queryKeyType) === JSON.stringify([mutationType])) {
        fieldsListKey = queryKey;
        break;
      }
    }

    /**
     * Helper function that takes in a list of fields to remove from the
     * @param {Set<string> | Array} fieldKeysToRemove - field keys to be removed from the cached field list
     */
    const removeFromFieldKeysList = async (
      fieldKeysToRemove: Set<string> | Array<string>
    ) => {
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
    const redisKey: string | null = await this.getFromRedis(
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
  async deleteCacheById(key: string) {
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
  async normalizeForCache(
    responseData: TypeData,
    map: MapType = {},
    protoField: QueryFields,
    currName: string
  ) {
    for (const resultName in responseData) {
      const currField: Type = responseData[resultName];
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
                [dataType]: currProto,
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
                [key]: protoField[resultName][key],
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
  clearCache(req: Request, res: Response, next: NextFunction) {
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
          },
        ];
        break;
      case 'dontGetValues':
        middleware = [
          this.getStatsFromRedis,
          this.getRedisKeys,
          (req, res) => {
            return res.status(200).send(res.locals);
          },
        ];
        break;
      case 'getKeysOnly':
        middleware = [
          this.getRedisKeys,
          (req, res) => {
            return res.status(200).send(res.locals);
          },
        ];
        break;
      case 'getStatsOnly':
        middleware = [
          this.getStatsFromRedis,
          (req, res) => {
            return res.status(200).send(res.locals);
          },
        ];
        break;
      case 'getAll':
        middleware = [
          this.getStatsFromRedis,
          this.getRedisKeys,
          this.getRedisValues,
          (req, res) => {
            return res.status(200).send(res.locals);
          },
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
                    .split(':')[1],
                },
                // redis build id
                {
                  name: 'Redis build id',
                  value: dataLines
                    .find((line) => line.match(/redis_build_id/))
                    .split(':')[1],
                },
                // redis mode
                {
                  name: 'Redis mode',
                  value: dataLines
                    .find((line) => line.match(/redis_mode/))
                    .split(':')[1],
                },
                // os hosting redis system
                {
                  name: 'Host operating system',
                  value: dataLines
                    .find((line) => line.match(/os/))
                    .split(':')[1],
                },
                // TCP/IP listen port
                {
                  name: 'TCP/IP port',
                  value: dataLines
                    .find((line) => line.match(/tcp_port/))
                    .split(':')[1],
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
                    .split(':')[1],
                },
                // num of days since Redis server start
                {
                  name: 'Server uptime (days)',
                  value: dataLines
                    .find((line) => line.match(/uptime_in_days/))
                    .split(':')[1],
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
                    .split(':')[1],
                },
              ],
              // CLIENT
              client: [
                // number of connected clients
                {
                  name: 'Connected clients',
                  value: dataLines
                    .find((line) => line.match(/connected_clients/))
                    .split(':')[1],
                },
                // number of sockets used by cluster bus
                {
                  name: 'Cluster connections',
                  value: dataLines
                    .find((line) => line.match(/cluster_connections/))
                    .split(':')[1],
                },
                // max clients
                {
                  name: 'Max clients',
                  value: dataLines
                    .find((line) => line.match(/maxclients/))
                    .split(':')[1],
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
                    .split(':')[1],
                },
              ],
              // MEMORY
              memory: [
                // total allocated memory
                {
                  name: 'Total allocated memory',
                  value: dataLines
                    .find((line) => line.match(/used_memory_human/))
                    .split(':')[1],
                },
                // peak memory consumed
                {
                  name: 'Peak memory consumed',
                  value: dataLines
                    .find((line) => line.match(/used_memory_peak_human/))
                    .split(':')[1],
                },
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
                    .split(':')[1],
                },
                // total number of commands processed by server
                {
                  name: 'Total commands',
                  value: dataLines
                    .find((line) => line.match(/total_commands_processed/))
                    .split(':')[1],
                },
                // number of commands processed per second
                {
                  name: 'Commands processed per second',
                  value: dataLines
                    .find((line) => line.match(/instantaneous_ops_per_sec/))
                    .split(':')[1],
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
                    .split(':')[1],
                },
                // total number of bytes read from network
                {
                  name: 'Bytes read from network',
                  value: dataLines
                    .find((line) => line.match(/total_net_input_bytes/))
                    .split(':')[1],
                },
                // networks read rate per second
                {
                  name: 'Network read rate (Kb/s)',
                  value: dataLines
                    .find((line) => line.match(/instantaneous_input_kbps/))
                    .split(':')[1],
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
                    .split(':')[1],
                },
              ],
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
          log: `Depth limit exceeded, tried to send query with the depth of ${currentDepth}.`,
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
          log: `Cost limit exceeded, tried to send query with a cost above ${maxCost}.`,
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
          log: `Cost limit exceeded, tried to send query with a cost exceeding ${maxCost}.`,
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
