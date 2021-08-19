const redis = require('redis');
const { parse } = require('graphql/language/parser');
const { visit, BREAK } = require('graphql/language/visitor');
const { graphql } = require('graphql');

class QuellCache {
  // default expiry time is 14 days in milliseconds
  constructor(schema, redisPort, cacheExpiration = 1209600000) {
    this.schema = schema;
    this.queryMap = this.getQueryMap(schema);
    this.mutationMap = this.getMutationMap(schema);
    this.fieldsMap = this.getFieldsMap(schema);
    this.idMap = this.getIdMap();
    this.redisPort = redisPort;
    this.cacheExpiration = cacheExpiration;
    this.redisReadBatchSize = 10;
    this.redisCache = redis.createClient(redisPort);
    this.query = this.query.bind(this);
    this.clearCache = this.clearCache.bind(this);
    this.buildFromCache = this.buildFromCache.bind(this);
    this.generateCacheID = this.generateCacheID.bind(this);
    this.updateCacheByMutation = this.updateCacheByMutation.bind(this);
    this.deleteCacheById = this.deleteCacheById.bind(this);
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
      return next('Error: no GraphQL query found on request body');
    }
    // retrieve GraphQL query string from request object;
    const queryString = req.body.query;

    // create abstract syntax tree with graphql-js parser
    const AST = parse(queryString);

    // create response prototype, and operation type, and fragments object
    // the response prototype is used as a template for most operations in quell including caching, building modified requests, and more
    const { proto, operationType, frags } = this.parseAST(AST);

    // pass-through for queries and operations that QuellCache cannot handle
    if (operationType === 'unQuellable') {
      graphql(this.schema, queryString)
        .then((queryResult) => {
          res.locals.queryResponse = queryResult;
          next();
        })
        .catch((error) => {
          return next('graphql library error: ', error);
        });

      /*
       * we can have two types of operation to take care of
       * MUTATION OR QUERY
       */
      // if MUTATION
    } else if (operationType === 'mutation') {
      let mutationQueryObject;
      let mutationName;
      let mutationType;
      for (let mutation in this.mutationMap) {
        if (proto.hasOwnProperty(mutation)) {
          mutationName = mutation;
          mutationType = this.mutationMap[mutation];
          mutationQueryObject = proto[mutation];
          break;
        }
      }

      graphql(this.schema, queryString)
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
          next();
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
        const newQueryString = this.createQueryStr(queryObject);
        graphql(this.schema, newQueryString)
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

            const successfulCache = await this.normalizeForCache(
              mergedResponse.data,
              this.queryMap,
              prototype
            );

            res.locals.queryResponse = { ...mergedResponse };
            return next();
          })
          .catch((error) => {
            return next('graphql library error: ', error);
          });
      } else {
        // if queryObject is empty, there is nothing left to query, can directly send information from cache
        res.locals.queryResponse = { ...cacheResponse };
        return next();
      }
    }
  }

  /**
   * parseAST traverses the abstract syntax tree depth-first to create a template for future operations, such as
   * request data from the cache, creating a modified query string for additional information needed, and joining cache and database responses
   * @param {Object} AST - an abstract syntax tree generated by gql library that we will traverse to build our prototype
   * @param {Object} options - a field for user-supplied options, not fully integrated
   * RETURNS prototype, operationType, and frags object
   */
  parseAST(AST, options = { userDefinedID: null }) {
    // initialize prototype as empty object
    // information from AST is distilled into the prototype for easy access during caching, rebuilding query strings, etc.
    const proto = {};
    const frags = {};

    // target Object points to prototype when iterating through Field, and will point to frags when iterating through Fragment Definition
    let targetObj;

    // will be query, mutation, subscription, or unQuellable
    let operationType = '';

    // initialize stack to keep track of depth first parsing path
    const stack = [];

    // tracks depth of selection Set
    let selectionSetDepth = 0;

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
        //cannot cache directives, return as unquellable
        if (node.directives) {
          if (node.directives.length > 0) {
            operationType = 'unQuellable';
            return BREAK;
          }
        }
      },
      OperationDefinition(node) {
        targetObj = proto;
        //cannot cache subscriptions or mutations, return as unquellable
        operationType = node.operation;
        if (node.operation === 'subscription') {
          operationType = 'unQuellable';
          return BREAK;
        }
      },
      // set-up for fragment definition traversal
      FragmentDefinition: {
        enter(node) {
          // update stack for path tracking
          stack.push(node.name.value);
          // point the targetObj that we update to the frags object while inside the loop
          targetObj = frags;

          // extract base-level fields in the fragment into frags object
          const fragName = node.name.value;
          targetObj[fragName] = {};
          for (let i = 0; i < node.selectionSet.selections.length; i++) {
            targetObj[fragName][
              node.selectionSet.selections[i].name.value
            ] = true;
          }
        },
        leave() {
          stack.pop();
        },
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

            // handle custom field-specific options passed in as arguments (ie __customCacheTime)
            // arguments parsed in this way should not pass from client to server
            // downstream support not fully integrated
            if (key.includes('__')) {
              auxObj[key] = arg.value.value;
            }
          });

          // gather auxillary data such as aliases, arguments, query type, and more to append to the prototype for future reference

          const fieldType = node.alias ? node.alias.value : node.name.value;

          // query type is forced lower case to ensure consistent caching
          auxObj.__type = node.name.value.toLowerCase();

          auxObj.__alias = node.alias ? node.alias.value : null;

          auxObj.__args = Object.keys(argsObj).length > 0 ? argsObj : null;

          // adds auxObj fields to prototype, allowing future access to type, alias, args, etc.
          fieldArgs[fieldType] = {
            ...fieldArgs[fieldType],
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
          selectionSetDepth++;

          /* Exclude SelectionSet nodes whose parents' are not of the kind
           * 'Field' to exclude nodes that do not contain information about
           *  queried fields.
           */
          if (parent.kind === 'Field') {
            const fieldsValues = {};
            for (let field of node.selections) {
              // sets any fields values to true, unless it is a nested object (ie has selectionSet)
              if (!field.selectionSet) fieldsValues[field.name.value] = true;
            }

            // if ID was not included on the request then the query will not be included in the cache, but the request will be processed
            if (
              !fieldsValues.hasOwnProperty('id') &&
              !fieldsValues.hasOwnProperty('_id') &&
              !fieldsValues.hasOwnProperty('ID') &&
              !fieldsValues.hasOwnProperty('Id')
            ) {
              operationType = 'unQuellable';
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
              return index + 1 === stack.length // if last item in path
                ? (prev[curr] = { ...fieldsObject }) //set value
                : (prev[curr] = prev[curr]); // otherwise, if index exists, keep value
            }, targetObj);
          }
        },
        leave() {
          // tracking depth of selection set
          selectionSetDepth--;
        },
      },
    });
    return { proto, operationType, frags };
  }

  /**
   * updateProtoWithFragment takes collected fragments and integrates them onto the prototype where referenced
   * @param {Object} protoObj - prototype before it has been updated with fragments
   * @param {Object} frags - fragments object to update prototype with
   * RETURNS updated prototype
   */
  updateProtoWithFragment(protoObj, frags) {
    if (!protoObj) return;

    for (const key in protoObj) {
      // if nested field, recurse
      if (typeof protoObj[key] === 'object' && !key.includes('__')) {
        protoObj[key] = this.updateProtoWithFragment(protoObj[key], frags);
      }

      // if field is a reference to a fragment, add fragment to field in place of the reference to the fragment
      else if (frags.hasOwnProperty(key)) {
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
   * returns redisKey if possible, e.g. 'Book-1' or 'Book-2', where 'Book' is name from mutationMap and '1' is id from protoArgs
   * and isExist if we have this key in redis
   *
   */
  async createRedisKey(mutationMap, proto) {
    let isExist = false;
    let redisKey;
    let redisValue = null;
    for (const mutationName in proto) {
      // proto.__args
      // mutation { country { id: 123, name: 'asdlkfasldkfa' } }
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
            for (let mutationName in protoArgs) {
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
   */
  checkFromRedis(key) {
    return new Promise((resolve, reject) => {
      this.redisCache.exists(key, (error, result) =>
        error ? reject(error) : resolve(result)
      );
    });
  }

  execRedisRunQueue(redisRunQueue) {
    return new Promise((resolve, reject) => {
      redisRunQueue.exec((error, result) =>
        error ? reject(error) : resolve(result)
      );
    });
  }

  /**
   * getFromRedis reads from Redis cache and returns a promise.
   * @param {String} key - the key for Redis lookup
   */
  getFromRedis(key) {
    const lowerKey = key.toLowerCase();
    return new Promise((resolve, reject) => {
      this.redisCache.get(lowerKey, (error, result) =>
        error ? reject(error) : resolve(result)
      );
    });
  }

  /**
   *  getMutationMap generates a map of mutation to GraphQL object types. This mapping is used
   *  to identify references to cached data when mutation occurs.
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
   * getFieldsMap generates of map of fields to GraphQL types. This mapping is used to identify
   * and create references to cached data.
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
   * RETURNS cacheResponse, mutates prototype
   */
  async buildFromCache(
    prototype,
    prototypeKeys,
    itemFromCache = {},
    firstRun = true,
    subID = false
  ) {
    for (let typeKey in prototype) {
      // if current key is a root query, check cache and set any results to itemFromCache
      if (prototypeKeys.includes(typeKey)) {
        const cacheID = subID
          ? subID
          : this.generateCacheID(prototype[typeKey]);
        const cacheResponse = await this.getFromRedis(cacheID);
        itemFromCache[typeKey] = cacheResponse ? JSON.parse(cacheResponse) : {};
      }

      // if itemFromCache at the current key is an array, iterate through and gather data
      if (Array.isArray(itemFromCache[typeKey])) {
        let redisRunQueue = this.redisCache.multi();
        let cachedTypeKeyArrLength = itemFromCache[typeKey].length;
        for (let i = 0; i < cachedTypeKeyArrLength; i++) {
          const currTypeKey = itemFromCache[typeKey][i];

          if (i !== 0 && i % this.redisReadBatchSize === 0) {
            this.execRedisRunQueue(redisRunQueue);
            redisRunQueue = this.redisCache.multi();
          }

          redisRunQueue.get(currTypeKey.toLowerCase(), (err, cacheResponse) => {
            let tempObj = {};

            if (cacheResponse) {
              const interimCache = JSON.parse(cacheResponse);
              for (const property in prototype[typeKey]) {
                // if property exists, set on tempObj
                if (
                  interimCache.hasOwnProperty(property) &&
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
          (itemFromCache === null || !itemFromCache.hasOwnProperty(typeKey)) &&
          typeof prototype[typeKey] !== 'object' &&
          !typeKey.includes('__')
        ) {
          prototype[typeKey] = false;
        }
        // if this field is a nested query, then recurse the buildFromCache function and iterate through the nested query
        if (
          // (itemFromCache === null || itemFromCache.hasOwnProperty(typeKey)) &&
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
        for (let field in prototype[typeKey]) {
          // if field is not found in cache then toggle to false
          if (
            itemFromCache[typeKey] &&
            !itemFromCache[typeKey].hasOwnProperty(field) &&
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
   * RETURNS queryObject with only values to be requested from GQL
   */
  createQueryObj(map) {
    const output = {};
    // iterate over every key in map
    // true values are filtered out, false values are placed on output
    for (let key in map) {
      const reduced = reducer(map[key]);
      if (Object.keys(reduced).length > 0) {
        output[key] = reduced;
      }
    }

    // filter fields object to contain only values needed from server
    function reducer(fields) {
      // filter stores values needed from server
      const filter = {};
      // propsFilter for properties such as args, aliases, etc.
      const propsFilter = {};

      for (let key in fields) {
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
    for (let key in queryObject) {
      mainStr += ` ${key}${getAliasType(queryObject[key])}${getArgs(
        queryObject[key]
      )} ${openCurly} ${stringify(queryObject[key])}${closeCurly}`;
    }

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
          ? (argString += `, ${key}: ${fields.__args[key]}`)
          : (argString += `${key}: ${fields.__args[key]}`);
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
   * joinresponses combines two objects containing results from separate sources and outputs a single object with information from both sources combined,
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
      const checkResponse = serverResponse.hasOwnProperty(key)
        ? serverResponse
        : cacheResponse;
      if (Array.isArray(checkResponse[key])) {
        // merging logic depends on whether the data is on the cacheResponse, serverResponse, or both
        if (
          cacheResponse.hasOwnProperty(key) &&
          serverResponse.hasOwnProperty(key)
        ) {
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
        } else if (cacheResponse.hasOwnProperty(key)) {
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
              cacheResponse.hasOwnProperty(key) &&
              serverResponse.hasOwnProperty(key)
            ) {
              mergedRecursion = this.joinResponses(
                { [fieldName]: cacheResponse[key][fieldName] },
                { [fieldName]: serverResponse[key][fieldName] },
                { [fieldName]: queryProto[key][fieldName] }
              );
            } else if (cacheResponse.hasOwnProperty(key)) {
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
  writeToCache(key, item) {
    const lowerKey = key.toLowerCase();
    if (!key.includes('uncacheable')) {
      this.redisCache.set(lowerKey, JSON.stringify(item));
      this.redisCache.EXPIRE(lowerKey, this.cacheExpiration);
    }
  }

  async updateCacheByMutation(
    dbRespDataRaw,
    mutationName,
    mutationType,
    mutationQueryObject
  ) {
    let fieldsListKey;
    let dbRespId = dbRespDataRaw.data[mutationName]?.id;
    let dbRespData = JSON.parse(
      JSON.stringify(dbRespDataRaw.data[mutationName])
    );

    if (!dbRespData) dbRespData = {};

    for (let queryKey in this.queryMap) {
      let queryKeyType = this.queryMap[queryKey];

      if (JSON.stringify(queryKeyType) === JSON.stringify([mutationType])) {
        fieldsListKey = queryKey;
        break;
      }
    }

    const removeFromFieldKeysList = async (fieldKeysToRemove) => {
      if (fieldsListKey) {
        let cachedFieldKeysListRaw = await this.getFromRedis(fieldsListKey);
        let cachedFieldKeysList = JSON.parse(cachedFieldKeysListRaw);

        await fieldKeysToRemove.forEach((fieldKey) => {
          // index position of field key to remove from list of field keys
          let removalFieldKeyIdx = cachedFieldKeysList.indexOf(fieldKey);

          if (removalFieldKeyIdx !== -1)
            cachedFieldKeysList.splice(removalFieldKeyIdx, 1);
        });

        this.writeToCache(fieldsListKey, cachedFieldKeysList);
      }
    };

    const deleteApprFieldKeys = async () => {
      if (fieldsListKey) {
        let cachedFieldKeysListRaw = await this.getFromRedis(fieldsListKey);
        let cachedFieldKeysList = JSON.parse(cachedFieldKeysListRaw);

        let fieldKeysToRemove = new Set();
        for (let i = 0; i < cachedFieldKeysList.length; i++) {
          let fieldKey = cachedFieldKeysList[i];
          let fieldKeyValueRaw = await this.getFromRedis(
            fieldKey.toLowerCase()
          );
          let fieldKeyValue = JSON.parse(fieldKeyValueRaw);

          let remove = true;
          console.log(mutationQueryObject);
          for (let arg in mutationQueryObject.__args) {
            if (fieldKeyValue.hasOwnProperty(arg)) {
              let argValue = mutationQueryObject.__args[arg];
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

    const updateApprFieldKeys = async () => {
      let cachedFieldKeysListRaw = await this.getFromRedis(fieldsListKey);
      // list of field keys stored on redis
      let cachedFieldKeysList = JSON.parse(cachedFieldKeysListRaw);

      // iterate through field key field key values in redis, and compare to user
      // specified mutation args to determine which fields are used to update by
      // and which fields need to be updated.

      cachedFieldKeysList.forEach(async (fieldKey) => {
        let fieldKeyValueRaw = await this.getFromRedis(fieldKey.toLowerCase());
        let fieldKeyValue = JSON.parse(fieldKeyValueRaw);

        let fieldsToUpdateBy = [];
        let updatedFieldKeyValue = fieldKeyValue;

        Object.entries(mutationQueryObject.__args).forEach(([arg, argVal]) => {
          if (arg in fieldKeyValue && fieldKeyValue[arg] === argVal) {
            // foreign keys are not fields to update by
            if (arg.toLowerCase().includes('id') === false) {
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

    // const deleteFieldKeys = () => {};

    let hypotheticalRedisKey = `${mutationType.toLowerCase()}--${dbRespId}`;
    let redisKey = await this.getFromRedis(hypotheticalRedisKey);

    if (redisKey) {
      // key was found in redis server cache so mutation is either update or delete mutation

      // if user specifies dbRespId as an arg in mutation, then we only need to update/delete a single cache entry by dbRespId
      if (mutationQueryObject.__id) {
        if (mutationName.substr(0, 3) === 'del') {
          // if the first 3 letters of the mutationName are 'del' then mutation is a delete mutation
          // users have to prefix their delete mutations with 'del' so that quell can distinguish between delete/update mutations
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

        let removalFieldKeysList = [];

        if (mutationName.substr(0, 3) === 'del') {
          // mutation is delete mutation
          deleteApprFieldKeys();
        } else {
          updateApprFieldKeys();
        }
      }
    } else {
      // key was not found in redis server cache so mutation is an add mutation
      this.writeToCache(hypotheticalRedisKey, dbRespData);
      if (fieldsListKey) {
        let cachedItemRaw = await this.getFromRedis(fieldsListKey);
        let cachedItem = JSON.parse(cachedItemRaw);
        // merge cachedItem with item
        if (cachedItem) cachedItem.push(`${mutationType}--${dbRespId}`);
        else cachedItem = [`${mutationType}--${dbRespId}`];
        this.writeToCache(fieldsListKey, cachedItem);
      }
    }
  }

  /**
   * deleteCacheById removes key-value from the cache unless the key indicates that the item is not available. // Note: writeToCache will JSON.stringify the input item
   * @param {String} key - unique id under which the cached data is stored that needs to be removed
   */

  deleteCacheById(key) {
    return new Promise((resolve, reject) => {
      this.redisCache.del(key, (error, result) => {
        error ? reject(error) : resolve(result);
      });
    });
  }

  /**
   * normalizeForCache traverses over response data and formats it appropriately so we can store it in the cache.
   * @param {Object} responseData - data we received from an external source of data such as a database or API
   * @param {Object} map - a map of queries to their desired data types, used to ensure accurate and consistent caching
   * @param {Object} protoField - a slice of the prototype currently being used as a template and reference for the responseData to send information to the cache
   * @param {Object} fieldsMap - another map of queries to desired data types, deprecated but untested
   */
  async normalizeForCache(responseData, map = {}, protoField, fieldsMap = {}) {
    for (const resultName in responseData) {
      const currField = responseData[resultName];
      const currProto = protoField[resultName];

      if (Array.isArray(currField)) {
        // create empty array to store references to data types in the form of their cacheID
        const refList = [];

        for (let i = 0; i < currField.length; i++) {
          const el = currField[i];

          const dataType = map[resultName];

          // build a separate fieldID for caching
          let fieldID = dataType;

          for (const key in el) {
            if (key === 'id' || key === '_id' || key === 'ID' || key === 'Id') {
              fieldID += `--${el[key]}`;
            }
          }

          refList.push(fieldID);

          // if current element is an object, recurse in order to normalize data in nested objects
          if (typeof el === 'object') {
            await this.normalizeForCache({ [dataType]: el }, map, {
              [dataType]: currProto,
            });
          }
        }
        this.writeToCache(resultName, refList);
      } else if (typeof currField === 'object') {
        // need to get non-Alias ID for cache

        // temporary store for field properties
        const fieldStore = {};

        // create a cacheID based on __type and __id from the prototype
        let cacheID = map.hasOwnProperty(currProto.__type)
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
            cacheID += `--${currField[key]}`;
          }
          fieldStore[key] = currField[key];

          // if object, recurse normalizeForCache assign in that object
          if (typeof currField[key] === 'object') {
            await this.normalizeForCache({ [key]: currField[key] }, map, {
              [key]: protoField[resultName][key],
            });
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
   * @param {Object} req
   * @param {Object} res
   * @param {Function} next
   */
  clearCache(req, res, next) {
    this.redisCache.flushall();
    next();
  }
}

module.exports = QuellCache;
