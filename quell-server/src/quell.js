const redis = require('redis');
const { parse } = require('graphql/language/parser');
const { visit, BREAK } = require('graphql/language/visitor');
const { graphql } = require('graphql');

class QuellCache {
  constructor(schema, redisPort, cacheExpiration = 1000) {
    this.schema = schema;
    this.queryMap = this.getQueryMap(schema);
    this.mutationMap = this.getMutationMap(schema);
    this.fieldsMap = this.getFieldsMap(schema);
    this.idMap = this.getIdMap();
    this.redisPort = redisPort;
    this.cacheExpiration = cacheExpiration;
    this.redisCache = redis.createClient(redisPort);
    this.query = this.query.bind(this);
    this.clearCache = this.clearCache.bind(this);
    this.buildFromCache = this.buildFromCache.bind(this);
    this.generateCacheID = this.generateCacheID.bind(this);
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
    // console.log('AST after parsing ', AST);
    // create response prototype, referenses for arguments and operation type
    const { proto, operationType, frags } = this.parseAST(AST);
    // console.log('proto after parseing ast is ', proto, ' and operationType is ', operationType, ' and frags are ', frags);
    // TO-DO: filter out introspection queries and set operationType to unquellable 
    // if (operationDefinition.name.value == ''
    // not a deep protype copy
    // TO-DO: why do we need a deep copy
    // const protoDeepCopy = { ...prototype };

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
      // get redis key if possible and potential combined value for future update
      let { redisKey, isExist, redisValue } = await this.createRedisKey(
        this.mutationMap,
        prototype
      );

      graphql(this.schema, queryString)
        .then((mutationResult) => {
          // if redis needs to be updated, write to cache and send result back, we don't need to wait untill writeToCache is finished
          if (isExist) {
            this.writeToCache(redisKey, redisValue);
          }
          res.locals.queryResponse = mutationResult;
          next();
        })
        .catch((error) => {
          return next('graphql library error: ', error);
        });
    } else {
      // if QUERY
      // TO-DO: invoke function that checks if fragments were included in the client request and updates prototype accordingly
      const prototype = Object.keys(frags).length > 0 ? this.updateProtoWithFragment(proto, frags) : proto;
      // build response from cache
      // countries -> [country--1, country--2]
      // TO-DO: test that buildFromCache w/o queryMap doesn't produce changes
      // update buildFromCache to update with redis info
      const prototypeKeys = Object.keys(prototype);
      // console.log('prototype keys', prototypeKeys);
      const cacheResponse = await this.buildFromCache(prototype, prototypeKeys);
      // console.log('cache resonse is ', cacheResponse);
      // console.log('prototype after buildfrom cache', prototype);
      // const responseFromCache = await buildFromCache(
      //   prototype,
      //   this.queryMap,
      // );

      // query for additional information, if necessary
      let mergedResponse, databaseResponse;

      // create query object to check if we have to get something from database
      const queryObject = this.createQueryObj(prototype);
      // console.log('queryObj before fetch', queryObject);
      // if cached response is incomplete, reformulate query, handoff query, join responses, and cache joined responses
      if (Object.keys(queryObject).length > 0) {
        // create new query sting
        const newQueryString = this.createQueryStr(queryObject);
        // console.log('queryString to gql', newQueryString);
        graphql(this.schema, newQueryString)
          .then(async (databaseResponseRaw) => {
            // console.log('raw response', databaseResponseRaw);
            const databaseResponse = JSON.parse(JSON.stringify(databaseResponseRaw));
            // console.log('parsed response', databaseResponse);
            // databaseResponse = queryResponse.data;
            // join uncached and cached responses, prototype is used as a "template" for final mergedResponse
            // if the cacheresponse does not contain any of the data requested by the client 
            // initialize a cacheHasData to false
            let cacheHasData = false;
            // iterate over the keys in cacheresponse data
            for (const key in cacheResponse.data) {
              // if the current element does have more than 1 key on it, then set cacheHas Datat tot true and break
              if (Object.keys(cacheResponse.data[key]).length > 0) {
                cacheHasData = true;
                // break;
              }
            }
            mergedResponse = cacheHasData  
              ? this.joinResponses(
                cacheResponse.data,
                databaseResponse.data,
                prototype
              ) 
              : databaseResponse;
            // TO-DO: update this.cache to use prototype instead of protoArgs
            // TO-DO check if await is needed here
            // console.log('before normazliing for cache, merged response', mergedResponse);
            const successfulCache = await this.normalizeForCache(mergedResponse.data, this.queryMap, prototype);
            // console.log('after normalizing for cache, merged response', mergedResponse);
            // const successfullyCached = await this.cache(
              //   mergedResponse,
              //   prototype
              // );
              // TO-DO: what to do if not successfully cached?
              // we want to still send response to the client
              // do we care that cache calls are asynchronous, is it worth pausing the client response?
              

            res.locals.queryResponse = { ...mergedResponse };
            return next();
          })
          .catch((error) => {
            return next('graphql library error: ', error);
          });
      } else {
        // if nothing left to query, response from cache is full response
        res.locals.queryResponse = { ...cacheResponse };
        return next();
      }
    }
  }
  
  parseAST (AST, options = {userDefinedID: null}) {
    // initialize prototype as empty object
    // information from AST is distilled into the prototype for easy access during caching, rebuilding query strings, etc.
    const proto = {};
    const frags = {};
    // target Object will be updated to point to prototype when iterating through Field and it will point to frags when iterating through Fragment Definition
    let targetObj;
  
    let operationType = '';
  
    // initialize stack to keep track of depth first parsing path
    const stack = [];
  
    // tracks depth of selection Set
    let selectionSetDepth = 0;
  
    // tracks arguments, aliases, etc. for specific fields
    // eventually merged with prototype object
    const fieldArgs = {};
  
    // extract options
    const userDefinedID = options.__userDefinedID;

    let counter = 0;
  
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
        //TO-DO: cannot cache directives, return as unquellable until support
        if (node.directives) {
          if (node.directives.length > 0) {
            operationType = 'unQuellable';
            return BREAK;
          }
        }
      },
      OperationDefinition(node) {
        targetObj = proto;
        //TO-DO: cannot cache subscriptions or mutations, return as unquellable
        operationType = node.operation;
        if (node.operation === 'subscription' || node.operation === 'mutation') {
          operationType = 'unQuellable';
          return BREAK;
        }
      },

      FragmentDefinition: {
        enter(node) {
          // update stack 
          stack.push(node.name.value);
          // point the targetObj that we update to the frags object while inside the loop
          targetObj = frags;
          // extract all fields in the fragment
          const fragName = node.name.value;
          targetObj[fragName] = {};
          // iterate through selections in selectionSet
          for (let i = 0; i < node.selectionSet.selections.length; i++) {
            // create a property for this selection on the frags obj (aka target obj)
            targetObj[fragName][node.selectionSet.selections[i].name.value] = true;
          }
        },
        leave() {
          stack.pop();
        }
      },
      Field: {
        // enter the node to construct a unique fieldType for critical fields
        enter(node) {
          // populates argsObj from current node's arguments
          // generates uniqueID from arguments
          const argsObj = {};
          // Introspection queries will not be cached
          if (node.name.value.includes('__')) {
            operationType = 'unQuellable';
            return BREAK;
          }
          // TO-DO: document viable options
          // NOTE: type-specific options are still experimental, not integrated through Quell's lifecycle
          // non-viable options should not break system but /shouldn't change app behavior/
  
          // auxillary object for storing arguments, aliases, type-specific options, and more
          // query-wide options should be handled on Quell's options object
          const auxObj = {
            __id: null,
          };
  
          node.arguments.forEach(arg => {
            const key = arg.name.value;
            // TO-DO: cannot currently handle variables in query
            if (arg.value.kind === 'Variable' && operationType === 'query') {
              operationType = 'unQuellable';
              return BREAK;
            }
            // assign args to argsObj, skipping type-specific options ('__')
            if (!key.includes('__')) {
              argsObj[key] = arg.value.value;
            };
  
            // identify uniqueID from args, options
            // note: does not use key.includes('id') to avoid automatically assigning fields such as "idea" or "idiom"
            if (userDefinedID ? key === userDefinedID : false) {
              // assigns ID as userDefinedID if one is supplied on options object
              auxObj.__id = arg.value.value;
            } else if (key === 'id' || key === '_id' || key === 'ID' || key === 'Id') {
              // assigns ID automatically from args
              auxObj.__id = arg.value.value;
            }
  
            // handle custom options passed in as arguments (ie customCache)
            // TO-DO: comment out before production build if we have not thoroughly tested type-specific options for app stability and safety
            if (key.includes('__')) {
              auxObj[key] = arg.value.value;
            }
          });
  
          // specifies whether field is stored as fieldType or Alias Name
          const fieldType = node.alias ? node.alias.value : node.name.value;
  
          // stores node Field Type on aux object, 
          // lower case to ensure consistent caching
          auxObj.__type = node.name.value.toLowerCase();
  
          // TO-DO: clean up __alias, should be deprecated
          // stores alias for Field on auxillary object
          auxObj.__alias = node.alias ? node.alias.value : null;
  
          // if argsObj has no values, set as null, then set on auxObj
          auxObj.__args = Object.keys(argsObj).length > 0 ? argsObj : null;
  
          // if 
  
          // adds auxObj fields to prototype, allowing future access to type, alias, args, etc.
          fieldArgs[fieldType] = {
            ...fieldArgs[fieldType],
            ...auxObj
          };
  
          // TO-DO: stack and stackIDs should now be identical, deprecated
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
            // loop through selections to collect fields
            const fieldsValues = {};
            for (let field of node.selections) {
              // sets any fields values to true
              // UNLESS they are a nested object
              if (!field.selectionSet) fieldsValues[field.name.value] = true;
            };
            // if ID was not included on the request then the query will not be included in the cache, but the request will be processed
            if (!fieldsValues.hasOwnProperty('id') && !fieldsValues.hasOwnProperty('_id') && !fieldsValues.hasOwnProperty('ID') && !fieldsValues.hasOwnProperty('Id')) {
              operationType = 'unQuellable';
              return BREAK;
            }
  
            // place fieldArgs object onto fieldsObject so it gets passed along to prototype
            // fieldArgs contains arguments, aliases, etc.
            const fieldsObject = { ...fieldsValues, ...fieldArgs[stack[stack.length - 1]] };
  
            /* For nested objects, we must prevent duplicate entries for nested queries with arguments (ie "city" and "city--3")
            * We go into the prototype and delete the duplicate entry
            */
            // if (selectionSetDepth > 2) {
            //   let miniProto = targetObj;
            //   // loop through stack to access layers of prototype object
            //   for (let i = 0; i < stack.length; i++) {
            //     // access layers of prototype object
            //     miniProto = miniProto[stack[i]]
            //     if (i === stack.length - 2) {
            //       // when final index, delete
            //       delete miniProto[stack[i + 1]];
            //     }
            //   }
            // }
            
            // loop through stack to get correct path in proto for temp object;
            // mutates original prototype object WITH values from tempObject
            // "prev" is accumulator ie the prototype
            stack.reduce((prev, curr, index) => {
              return index + 1 === stack.length // if last item in path
                ? (prev[curr] = {...fieldsObject}) //set value
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
  };

  updateProtoWithFragment (protoObj, frags) {
    if (!protoObj) return; 
    // iterate over the typeKeys on proto
    for (const key in protoObj) {
      // if the current value is an object, then recruse through prototype 
      if (typeof protoObj[key] === 'object' && !key.includes('__')) {
        protoObj[key] = this.updateProtoWithFragment(protoObj[key], frags);
      }
      // else if the current key is the fragment key, then add all properties from frags onto prototype
      else if (frags.hasOwnProperty(key)) {
        protoObj = {...protoObj, ...frags[key]};
        // remove the fragment key from the prototype object
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

  /**
   * getFromRedis reads from Redis cache and returns a promise.
   * @param {String} key - the key for Redis lookup
   */
  getFromRedis(key) {
    const lowerKey = key.toLowerCase();
    // console.log('key to get from redis is ', key);
    // console.log('typeof key is ', typeof key);
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
    if (proto === undefined) return proto
    for (const key in proto) {
      if (Object.keys(proto[key]).length > 0) this.toggleProto(proto[key]);
      else proto[key] = false;
    }
    return proto;
  }

  async buildFromCache(prototype, prototypeKeys, itemFromCache = {}, firstRun = true, subID = false) {
  
    // can we build prototypeKeys within the application?
    // const prototypeKeys = Object.keys(prototype)
  
    // update function to include responseFromCache
    // const buildProtoFunc = buildPrototypeKeys(prototype);
    // const prototypeKeys = buildProtoFunc();

    // console.log(`the input prototype has keys of ${Object.keys(prototype)}`);
    for (let typeKey in prototype) {
      // check if typeKey is a rootQuery (i.e. if it includes '--') or if its a field nested in a query
      // end goal: delete typeKey.includes('--') and check if protoObj.includes(typeKey)
      if (prototypeKeys.includes(typeKey)) {
        const cacheID = subID ? subID : this.generateCacheID(prototype[typeKey]);
        //To do - won't always cache, bring map back or persist -- in parsedAST function?
        // if typeKey is a rootQuery, then clear the cache and set firstRun to true 
        // cached data must persist 
        // create a property on itemFromCache and set the value to the fetched response from cache
        // console.log('cacheID is ', cacheID);
        const isExist = await this.checkFromRedis(cacheID);
        const cacheResponse = await this.getFromRedis(cacheID);
        // console.log('cacheresponse inside of buildfrom cache', cacheResponse);
        itemFromCache[typeKey] = cacheResponse ? JSON.parse(cacheResponse) : {};
        // console.log('cache response in buildfrom cache is ', cacheResponse);
      }
      // if itemFromCache is an array (Array.isArray()) 
      if (Array.isArray(itemFromCache[typeKey])) {
        // iterate over countries
        for (let i = 0; i < itemFromCache[typeKey].length; i++) {
          const currTypeKey = itemFromCache[typeKey][i];
          // TO-DO: error handling in the getFromRedis test
          // console.log('item From cache is ', itemFromCache);
          // console.log('curr type key is ', currTypeKey);
          const cacheResponse = await this.getFromRedis(currTypeKey);
          let tempObj = {};
          if (cacheResponse) {
            const interimCache = JSON.parse(cacheResponse);
            // loop through prototype at typeKey
            for (const property in prototype[typeKey]) {
              // if interimCache has the property
              if (interimCache.hasOwnProperty(property) && !property.includes('__')) {
                // place on tempObj, set into array
                tempObj[property] = interimCache[property]
              } else if (!property.includes('__') && typeof prototype[typeKey][property] === 'object') {
                const tempData = this.buildFromCache(prototype[typeKey][property], prototypeKeys, {}, false, `${currTypeKey}--${property}`);
                tempObj[property] = tempData.data;
              }
              
              else if (!property.includes('__') && typeof prototype[typeKey][property] !== 'object') {
                // if interimCache does not have property, set to false on prototype so it is fetched
                prototype[typeKey][property] = false;
              }
            }
            itemFromCache[typeKey][i] = tempObj;
        }
        // if there is nothing in the cache for this key, then toggle all fields to false
        // TO-DO make sure this works for nested objects
        else {
          // console.log(`nothing in the cache for property ${typeKey}`);
          for (const property in prototype[typeKey]) {
            // if interimCache has the property
            if (!property.includes('__') && typeof prototype[typeKey][property] !== 'object') {
              // if interimCache does not have property, set to false on prototype so it is fetched
              prototype[typeKey][property] = false;
            } 
          }
        }

        }
        // reasign itemFromCache[typeKey] to false
        // itemFromCache[typeKey] = false;
      }
        // recurse through buildFromCache using typeKey, prototype
      // if itemFromCache is empty, then check the cache for data, else, persist itemFromCache
      // if this iteration is a nested query (i.e. if typeKey is a field in the query)
      else if (firstRun === false) {
        // console.log('iFC', itemFromCache);
  
        // if this field is NOT in the cache, then set this field's value to false
        if (
          (itemFromCache === null || !itemFromCache.hasOwnProperty(typeKey)) && 
          typeof prototype[typeKey] !== 'object' && !typeKey.includes('__')) {
            prototype[typeKey] = false; 
        } 
        // if this field is a nested query, then recurse the buildFromCache function and iterate through the nested query
        if (
          (itemFromCache === null || itemFromCache.hasOwnProperty(typeKey)) && 
          !typeKey.includes('__') && // do not iterate through __args or __alias
          typeof prototype[typeKey] === 'object') {
            const cacheID = this.generateCacheID(prototype);
            // console.log('cacheID not first Run', cacheID, 'typeKey', typeKey);
            const cacheResponse = this.getFromRedis(currTypeKey);
            itemFromCache[typeKey] = JSON.parse(cacheResponse);
            // repeat function inside of the nested query
          this.buildFromCache(prototype[typeKey], prototypeKeys, itemFromCache[typeKey], false);
        } 
      }
      // if the current element is not a nested query, then iterate through every field on the typeKey
      else {
        for (let field in prototype[typeKey]) {
          // console.log('typeKey', typeKey, 'field: ', field);
          // console.log('itemFromCache: ', itemFromCache)
          // if itemFromCache[typeKey] === false then break
          // TO-DO find the issue with queries from the demo client
          // console.log('item from cache inside the buildfrom cache ', itemFromCache[typeKey]);
          if (
            // if field is not found in cache then toggle to false
            itemFromCache[typeKey] &&
            !itemFromCache[typeKey].hasOwnProperty(field) && 
            !field.includes("__") && // ignore __alias and __args
            typeof prototype[typeKey][field] !== 'object') {
              // console.log(`itemFromCache[typeKey] is ${itemFromCache[typeKey]}`);
              // console.log(`field is ${field} and typeof itemFromCache[typeKey] is ${typeof itemFromCache[typeKey]}`);
              prototype[typeKey][field] = false; 
          }
          
          if ( 
            // if field contains a nested query, then recurse the function and iterate through the nested query
            !field.includes('__') && 
            typeof prototype[typeKey][field] === 'object' &&
            itemFromCache[typeKey]) {
              // console.log("PRE-RECURSE prototype[typeKey][field]: ", prototype[typeKey][field]);
              // console.log('itemFromCache', itemFromCache)
              // console.log(`prototype[typeKey][field] is ${prototype[typeKey][field]}`); 
              // console.log(`prototypeKeys are ${prototypeKeys}`);
              // console.log(`itemFromCache's keys are ${Object.keys(itemFromCache)}`);
              // console.log(`itemFromCache[typeKey] is ${itemFromCache[typeKey]}`);
              // console.log(`itemFromCache at the property ${typeKey} has keys ${Object.keys(itemFromCache[typeKey])}`);
            // TO-DO: when the demo starts up, this line of code throws the following error -> TypeError: Cannot read property 'queryType' of undefined
            this.buildFromCache(prototype[typeKey][field], prototypeKeys, itemFromCache[typeKey][field], false);
            }
          // if there are no data in itemFromCache
          else if (!itemFromCache[typeKey] && !field.includes('__') && typeof prototype[typeKey][field] !== 'object') {
            // then toggle to false
            prototype[typeKey][field] = false;
          }
          // else {
          //   this.buildFromCache(prototype[typeKey], prototypeKeys, {}, false);
          // }
        }  
      }
    }
    // assign the value of an object with a key of data and a value of itemFromCache and return
    return { data: itemFromCache }
  }
  
  // helper function to take in queryProto and generate a cacheID from it
  generateCacheID(queryProto) {
  
    // if ID field exists, set cache ID to 'fieldType--ID', otherwise just use fieldType
    const cacheID = queryProto.__id ? `${queryProto.__type}--${queryProto.__id}` : queryProto.__type;
  
    return cacheID;
  }

  /**
 createQueryObj takes in a map of field(keys) and true/false(values) creating an query object containing the fields (false) missing from cache. 
 This will then be converted into a GQL query string in the next step.
 */
  createQueryObj(map) {
    const output = {};
    // iterate over every key in map
    // send fields object to reducer to filter out trues
    // place all false categories on output object
    for (let key in map) {
      const reduced = reducer(map[key]);
      // greater than args & alias
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
          // add key & value to filter
          filter[key] = false;
        }
        // force the id onto the query object
        if (key === 'id' || key === '_id' || key === 'ID' || key === 'Id') {
          filter[key] = false;
        }

        // if value is an object, recurse to determine nested values
        if (typeof fields[key] === 'object' && !key.includes('__')) {
          // check keys of object to see if those values are false via recursion
          const reduced = reducer(fields[key]);
          // if reduced object has any values to pass, place on filter
          if (Object.keys(reduced).length > 0) {
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
 createQueryStr converts the query object into a formal GQL query string.
 */
createQueryStr(queryObject, operationType) {
  if (Object.keys(queryObject).length === 0) return ''
  const openCurly = '{';
  const closeCurly = '}';
  const openParen = '(';
  const closeParen = ')';

  let mainStr = '';

  // iterate over every key in queryObject
  // place key into query object
  for (let key in queryObject) {
    mainStr += ` ${key}${getAliasType(queryObject[key])}${getArgs(queryObject[key])} ${openCurly} ${stringify(queryObject[key])}${closeCurly}`;
  }

  // recurse to build nested query strings
  // ignore all __values (ie __alias and __args)
  function stringify(fields) {
    // initialize inner string
    let innerStr = '';
    // iterate over KEYS in OBJECT
    for (const key in fields) {
      // is fields[key] string? concat with inner string & empty space
      if (typeof fields[key] === "boolean") {
        innerStr += key + ' ';
      }
      // is key object? && !key.includes('__'), recurse stringify
      if (typeof fields[key] === 'object' && !key.includes('__')) {
        innerStr += `${key}${getAliasType(fields[key])}${getArgs(
          fields[key])} ${openCurly} ${stringify(
            fields[key])}${closeCurly} `;
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
  };

  // create final query string
  const queryStr = openCurly + mainStr + ' ' + closeCurly;
  // if operation type supplied, place in front of queryString, otherwise just pass queryStr
  return operationType ? operationType + ' ' + queryStr : queryStr;
};

  /**
 joinResponses combines two objects containing results from the cached response and fetched (uncached) and outputs a single array response 
 that will ultimately be formatted and delivered to the client. 
 the copied Proto parameter sets a reference to combine the fields in the same order as the original query.
 */
  joinResponses(cacheResponse, serverResponse, queryProto, fromArray = false) {
    // initialize a "merged response" to be returned
    let mergedResponse = {};
  
    // loop through fields object keys, the "source of truth" for structure
    // store combined responses in mergedResponse
  
    // first loop for different queries on response
    for (const key in queryProto) {
  
      // TO-DO: caching for arrays is likely imperfect, needs more edge-case testing
      // for each key, check whether data stored at that key is an array or an object
      const checkResponse = serverResponse.hasOwnProperty(key) ? serverResponse : cacheResponse;  
      if (Array.isArray(checkResponse[key])) {
        // merging data stored as array
        // remove reserved properties from queryProto so we can compare # of properties on prototype to # of properties on responses
        // const filterKeys = Object.keys(queryProto[key]).filter(propKey => !propKey.includes('__'));
        // if # of keys is the same between prototype & cached response, then the objects on the array represent different things
        if (cacheResponse.hasOwnProperty(key) && serverResponse.hasOwnProperty(key)) {
          // if # of keys is not the same, cache was missing data for each object, need to merge cache objects with server objects
          // iterate over an array
          const mergedArray = [];
          for (let i = 0; i < cacheResponse[key].length; i++) {
  
            // for each index of array, combine cache and server response objects
            const joinedResponse = this.joinResponses(
              { [key]: cacheResponse[key][i] },
              { [key]: serverResponse[key][i] },
              { [key]: queryProto[key] },
              true
            );
  
            // place joinedResponse on our array of all merged objects
            mergedArray.push(joinedResponse);
          }
          // set merged array to mergedResponse at key
          mergedResponse[key] = mergedArray;
        }
        else if (cacheResponse.hasOwnProperty(key)) {
          mergedResponse[key] = cacheResponse[key];
        }
        else {
          mergedResponse[key] = serverResponse[key];
        }
      }
      else {
        // if not an array, it is a regular object data structure
  
        // object spread
        if (!fromArray) {
          // if object doesn't come from an array, we must assign on the object at the given key
          // results in { key: values }
          mergedResponse[key] = { ...cacheResponse[key], ...serverResponse[key] };
        } else {
          // if the object comes from an array, we do not want to assign to a key as per GQL spec
          // results in [{fields}, {fields}, {fields}]
          mergedResponse = { ...cacheResponse[key], ...serverResponse[key] }
        }
        
        // loop through fields on queryProto
        for (const fieldName in queryProto[key]) {
  
          // check for nested objects
          if (typeof queryProto[key][fieldName] === 'object' && !fieldName.includes('__')) {
            // recurse joinResponses on that object to create deep copy on mergedResponse
            // TO-DO: before recursing, if the cacheResponse and serverResponse contain keys that are not the same, then 
            let mergedRecursion = {};
            // console.log('key is ', key, ' and field name is ', fieldName);
            if (cacheResponse.hasOwnProperty(key) && serverResponse.hasOwnProperty(key)) {
               mergedRecursion = this.joinResponses(
                { [fieldName]: cacheResponse[key][fieldName] },
                { [fieldName]: serverResponse[key][fieldName] }, 
                { [fieldName]: queryProto[key][fieldName] }
              );
            }
            else if (cacheResponse.hasOwnProperty(key)) {
              mergedRecursion[fieldName] = cacheResponse[key][fieldName];
            }
            else {
              mergedRecursion[fieldName] = serverResponse[key][fieldName];
            }
    
            // place on merged response
            mergedResponse[key] = { ...mergedResponse[key], ...mergedRecursion };
  
            // // delete shallow copy of cacheResponse's nested object from mergedResponse
            // if (fieldName !== fieldStrip.key) delete mergedResponse[stripped.key][fieldName]
          }
        }
      }
    }
    // return result should be { data: { country { ...cacheValues, ...serverValues } }
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

  async normalizeForCache(responseData, map = {}, protoField, fieldsMap = {}) {
    // iterate over keys in our response data object 
    for (const resultName in responseData) {
      // currentField we are iterating over & corresponding Prototype
      const currField = responseData[resultName];
      const currProto = protoField[resultName];
      // console.log('prototype in the normalize for cache on the server', protoField);
      // console.log('currField is ', currField);
      // check if the value stored at that key is array 
      if (Array.isArray(currField)) {
        // console.log('iterating over keys on the ', currField);
        // RIGHT NOW: countries: [{}, {}]
        // GOAL: countries: ["Country--1", "Country--2"]
  
        // create empty array to store refs
        // ie countries: ["country--1", "country--2"]
        const refList = [];
        // iterate over countries array
        for (let i = 0; i < currField.length; i++) {
          const el = currField[i];
          // el1 = {id: 1, name: Andorra}, el2 =  {id: 2, name: Bolivia}
          // for each object
          // "resultName" is key on "map" for our Data Type
          const dataType = map[resultName];
  
          // grab ID from object we are iterating over
          let fieldID = dataType;
  
          for (const key in el) {
            // if key is an ID, append to fieldID for caching
            if (key === 'id' || key === '_id' || key === 'ID' || key === 'Id') {
              fieldID += `--${el[key]}`;
              // push fieldID onto refList
            }
          }
  
          refList.push(fieldID);
          // if object, recurse to add all nested values of el to cache as individual entries
          if (typeof el === 'object') {
            await this.normalizeForCache({ [dataType]: el }, map,  { [dataType]: currProto});
          }
        }
        // 
        this.writeToCache(resultName, refList);
      }
      else if (typeof currField === 'object') {
        // need to get non-Alias ID for cache
        // const cacheID = currProto.__id ? `${currProto.__type}--${currProto.__id}` : currProto.__type;
        // temporary store for field properties
        const fieldStore = {};
        
        // if object has id, generate fieldID 
        let cacheID = map.hasOwnProperty(currProto.__type)
          ? map[currProto.__type]
          : currProto.__type;
        
        // if prototype has ID, append it to cacheID
        cacheID += currProto.__id
          ? `--${currProto.__id}`
          : '';
  
        // iterate over keys in object
        // "id, name, cities"
        for (const key in currField) {
          // if prototype has no ID, check field keys for ID (mostly for arrays)
          if (!currProto.__id && (key === 'id' || key === '_id' || key === 'ID' || key === 'Id')) {
            cacheID += `--${currField[key]}`;
          }
          fieldStore[key] = currField[key];
  
          // if object, recurse normalizeForCache assign in that object
          // must also pass in protoFields object to pair arguments, aliases with response
          if (typeof currField[key] === 'object') {
            await this.normalizeForCache({ [key]: currField[key] }, map, { [key]: protoField[resultName][key]});
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