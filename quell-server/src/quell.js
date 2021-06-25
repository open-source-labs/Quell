const redis = require('redis');
const { parse } = require('graphql/language/parser');
const { visit, BREAK } = require('graphql/language/visitor');
const { graphql } = require('graphql');

// const normalizeForCache = require('./helpers/normalizeForCache');
// const createQueryObj = require('./helpers/createQueryObj');
// const createQueryStr = require('./helpers/createQueryStr');
// const joinResponses = require('./helpers/joinResponses');

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
    console.log('reached the server');
    console.log('req.body is ', req.body);
    // handle request without query
    if (!req.body.query) {
      return next('Error: no GraphQL query found on request body');
    }
    // retrieve GraphQL query string from request object;
    const queryString = req.body.query;

    // create abstract syntax tree with graphql-js parser
    const AST = parse(queryString);
    console.log('AST is ', AST);

    // create response prototype, referenses for arguments and operation type
    const { prototype, operationType } = this.parseAST(AST);
    console.log('prototype ', prototype);
    console.log('operation type is ', operationType);

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

      // build response from cache
      // countries -> [country--1, country--2]
      // TO-DO: test that buildFromCache w/o queryMap doesn't produce changes
      // update buildFromCache to update with redis info
      const prototypeKeys = Object.keys(prototype);
      console.log('prototype keys', prototypeKeys);
      const cacheResponse = await this.buildFromCache(prototype, prototypeKeys);
      console.log('cache resonse is ', cacheResponse);
      console.log('prototype after buildfrom cache', prototype);
      // const responseFromCache = await buildFromCache(
      //   prototype,
      //   this.queryMap,
      // );

      // query for additional information, if necessary
      let mergedResponse, databaseResponse;

      // create query object to check if we have to get something from database
      const queryObject = this.createQueryObj(prototype);
      console.log('queryObject is ', queryObject);

      // if cached response is incomplete, reformulate query, handoff query, join responses, and cache joined responses
      if (Object.keys(queryObject).length > 0) {
        // create new query sting
        const newQueryString = this.createQueryStr(queryObject);
        console.log('newQuery string ', newQueryString);

        graphql(this.schema, newQueryString)
          .then(async (databaseResponse) => {
            // databaseResponse = queryResponse.data;
            console.log('databaseResponse from graphql is ', databaseResponse);
            // const obj = Object.assign({}, databaseResponse);
            // console.log('after', obj);
            // To-DO remove this console log
            for (let prop in databaseResponse.data.countries) {
              console.log('merged reponse after joinResponses', databaseResponse.data.countries[prop]);
            }
            // join uncached and cached responses, prototype is used as a "template" for final mergedResponse
            mergedResponse = this.joinResponses(
              cacheResponse.data,
              databaseResponse.data,
              prototype
            );
            // TO-DO: update this.cache to use prototype instead of protoArgs
            // TO-DO check if await is needed here
            // this.normalizeForCache(mergedResponse.data, map, prototype);
            
            // const successfullyCached = await this.cache(
              //   mergedResponse,
              //   prototype
              // );
              // TO-DO: what to do if not successfully cached?
              // we want to still send response to the client
              // do we care that cache calls are asynchronous, is it worth pausing the client response?
              

            res.locals.queryResponse = { data: mergedResponse };
            console.log('data to be sent back to client ', res.locals.queryResponse);
            return next();
          })
          .catch((error) => {
            return next('graphql library error: ', error);
          });
      } else {
        // if nothing left to query, response from cache is full response
        res.locals.queryResponse = { data: cacheResponse };
        return next();
      }
    }
  }
  
  parseAST (AST, options = {userDefinedID: null}) {
    // initialize prototype as empty object
    // information from AST is distilled into the prototype for easy access during caching, rebuilding query strings, etc.
    const prototype = {};
  
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
      FragmentDefinition(node) {
        // storing fragment info
      },
      OperationDefinition(node) {
        //TO-DO: cannot cache subscriptions or mutations, return as unquellable
        operationType = node.operation;
        if (node.operation === 'subscription' || node.operation === 'mutation') {
          operationType = 'unQuellable';
          return BREAK;
        }
      },
      Field: {
        // enter the node to construct a unique fieldType for critical fields
        enter(node) {
          // populates argsObj from current node's arguments
          // generates uniqueID from arguments
          const argsObj = {};
  
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
          auxObj.__type = node.name.value;
  
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
  
            // place fieldArgs object onto fieldsObject so it gets passed along to prototype
            // fieldArgs contains arguments, aliases, etc.
            const fieldsObject = { ...fieldsValues, ...fieldArgs[stack[stack.length - 1]] };
  
            /* For nested objects, we must prevent duplicate entries for nested queries with arguments (ie "city" and "city--3")
            * We go into the prototype and delete the duplicate entry
            */
            if (selectionSetDepth > 2) {
              let miniProto = prototype;
              // loop through stack to access layers of prototype object
              for (let i = 0; i < stack.length; i++) {
                // access layers of prototype object
                miniProto = miniProto[stack[i]]
                if (i === stack.length - 2) {
                  // when final index, delete
                  delete miniProto[stack[i + 1]];
                }
              }
            }
            
            // loop through stack to get correct path in proto for temp object;
            // mutates original prototype object WITH values from tempObject
            // "prev" is accumulator ie the prototype
            stack.reduce((prev, curr, index) => {
              return index + 1 === stack.length // if last item in path
                ? (prev[curr] = {...fieldsObject}) //set value
                : (prev[curr] = prev[curr]); // otherwise, if index exists, keep value
            }, prototype);
          }
        },
        leave() {
          // tracking depth of selection set
          selectionSetDepth--;
        },
      },
    });
    return { prototype, operationType };
  };

  // TO-DO: update mutations
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
   * updateObject updates existing fields in primary object taking incoming value from incoming object, returns new value
   * @param {Object} objectPrimary - object
   * @param {Object} objectIncoming - object
   */
  updateObject(objectPrimary, objectIncoming) {
    const value = {};

    for (const prop in objectPrimary) {
      if (objectIncoming.hasOwnProperty(prop)) {
        if (
          Object.prototype.toString.call(objectPrimary[prop]) ===
          '[object Object]'
        ) {
          // if the property is a nested object
          value[prop] = merge(objectPrimary[prop], objectIncomin[prop]);
        } else {
          value[prop] = objectIncoming[prop] || objectPrimary[prop];
        }
      } else {
        value[prop] = objectPrimary[prop];
      }
    }
    return value;
  }

  /**
   * mergeObjects recursively combines objects together, next object overwrites previous
   * Used to rebuild response from cache and database
   * Uses a prototype to govern the order of fields
   * @param {Array} - rest parameters for all objects passed to function
   * @param {proto} - protoObject
   */
  mergeObjects(proto, ...objects) {
    const isObject = (obj) =>
      Object.prototype.toString.call(obj) === '[object Object]';

    const protoDeepCopy = { ...proto }; // create function to deep copy

    // return func that loop through arguments with reduce
    return objects.reduce((prev, obj) => {
      Object.keys(prev).forEach((key) => {
        const prevVal = prev[key];
        const objVal = obj[key];

        if (Array.isArray(objVal)) {
          const prevArray = Array.isArray(prevVal) ? prevVal : [];
          prev[key] = this.mergeArrays(proto[key], prevArray, objVal);
        } else if (isObject(objVal)) {
          const prevObject = isObject(prevVal) ? prevVal : {};
          prev[key] = this.mergeObjects(proto[key], prevObject, objVal);
        } else {
          prev[key] = objVal || prev[key];
        }
      });
      return prev;
    }, protoDeepCopy);
  }

  /**
   * mergeArrays combines arrays together, next array overwrites previous
   * Used as helper function for mergeObject to handle arrays
   * @param {Array} arrays - rest parameters for all arrays passed to function
   * @param {proto} - protoObject, needed only to pass it to mergeObjects
   */
  mergeArrays(proto, ...arrays) {
    const isObject = (obj) =>
      Object.prototype.toString.call(obj) === '[object Object]';

    return arrays.reduce((prev, arr) => {
      arr.forEach((el, index) => {
        const prevVal = prev[index];
        const arrVal = arr[index];

        if (isObject(prevVal) && isObject(arrVal)) {
          prev[index] = this.mergeObjects(proto, prevVal, arrVal);
        } else {
          prev[index] = arrVal;
        }
      });
      return prev;
    }, []);
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
    return new Promise((resolve, reject) => {
      this.redisCache.get(key, (error, result) =>
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
    for (const key in proto) {
      if (Object.keys(proto[key]).length > 0) this.toggleProto(proto[key]);
      else proto[key] = false;
    }
    return proto;
  }

  async buildFromCache(prototype, prototypeKeys, itemFromCache = {}, firstRun = true) {
  
    // can we build prototypeKeys within the application?
    // const prototypeKeys = Object.keys(prototype)
  
    // update function to include responseFromCache
    // const buildProtoFunc = buildPrototypeKeys(prototype);
    // const prototypeKeys = buildProtoFunc();
  
    console.log(`the input prototype has keys of ${Object.keys(prototype)}`);
    for (let typeKey in prototype) {
      // check if typeKey is a rootQuery (i.e. if it includes '--') or if its a field nested in a query
      // end goal: delete typeKey.includes('--') and check if protoObj.includes(typeKey)
      if (prototypeKeys.includes(typeKey)) {
        const cacheID = this.generateCacheID(prototype[typeKey]);
        //To do - won't always cache, bring map back or persist -- in parsedAST function?
        // if typeKey is a rootQuery, then clear the cache and set firstRun to true 
        // cached data must persist 
        // create a property on itemFromCache and set the value to the fetched response from cache
        const cacheResponse = await this.getFromRedis(cacheID);
        console.log('cacheresponse inside of buildfrom cache', cacheResponse);
        // const isExist = await this.checkFromRedis(cacheID);
        if (cacheResponse) {
          // console.log(`cacheResponse is ${cacheResponse}`);
          itemFromCache[typeKey] = JSON.parse(cacheResponse);
          console.log(`itemFromCache[typeKey] is`, itemFromCache[typeKey]);
          console.log(`keys saved to itemFromCache are ${Object.keys(itemFromCache)}`);
          // console.log(`itemFromCache: ${itemFromCache}`);
        }
      }
      // if itemFromCache is an array (Array.isArray()) 
      if (Array.isArray(itemFromCache[typeKey])) {
        // iterate over countries
        for (let i = 0; i < itemFromCache[typeKey].length; i++) {
          const currTypeKey = itemFromCache[typeKey][i];
          // TO-DO: error handling in the getFromRedis test
          const cacheResponse = await this.getFromRedis(currTypeKey);
          if (cacheResponse) {
            const interimCache = JSON.parse(cacheResponse);
            // loop through prototype at typeKey
            for (const property in prototype[typeKey]) {
              let tempObj = {};
              // if interimCache has the property
              if (interimCache.hasOwnProperty(property) && !property.includes('__')) {
                // place on tempObj, set into array
                tempObj[property] = interimCache[property]
                itemFromCache[typeKey][i] = tempObj;
              } else if (!property.includes('__') && typeof interimCache[property] !== 'object') {
                // if interimCache does not have property, set to false on prototype so it is fetched
                prototype[typeKey][property] = false;
              }
            }
        }
        // if there is nothing in the cache for this key, then toggle all fields to false
        // TO-DO make sure this works for nested objects
        else {
          console.log(`nothing in the cache for property ${typeKey}`);
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
          console.log('item from cache inside the buildfrom cache ', itemFromCache[typeKey]);
          if (
            // if field is not found in cache then toggle to false
            itemFromCache[typeKey] &&
            !itemFromCache[typeKey].hasOwnProperty(field) && 
            !field.includes("__") && // ignore __alias and __args
            typeof prototype[typeKey][field] !== 'object') {
              // console.log(`itemFromCache[typeKey] is ${itemFromCache[typeKey]}`);
              console.log(`field is ${field} and typeof itemFromCache[typeKey] is ${typeof itemFromCache[typeKey]}`);
              prototype[typeKey][field] = false; 
          }
          
          if ( 
            // if field contains a nested query, then recurse the function and iterate through the nested query
            !field.includes('__') && 
            typeof prototype[typeKey][field] === 'object') {
              // console.log("PRE-RECURSE prototype[typeKey][field]: ", prototype[typeKey][field]);
              // console.log("PRE-RECURSE itemFromCache: ", itemFromCache);
            console.log(`prototype[typeKey][field] is ${prototype[typeKey][field]}`); 
            console.log(`prototypeKeys are ${prototypeKeys}`);
            console.log(`itemFromCache's keys are ${Object.keys(itemFromCache)}`);
            console.log(`itemFromCache[typeKey] is ${itemFromCache[typeKey]}`);
            console.log(`itemFromCache at the property ${typeKey} has keys ${Object.keys(itemFromCache[typeKey])}`);
            this.buildFromCache(prototype[typeKey][field], prototypeKeys, itemFromCache[typeKey][field], false);
            }
          // if there are no data in itemFromCache
          else if (!itemFromCache[typeKey] && !field.includes('__') && typeof prototype[typeKey][field] !== 'object') {
            // then toggle to false
            prototype[typeKey][field] = false;
          }
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

      // if the filter has any values to pass, return filter & propsFilter, otherwise return empty object
      return Object.keys(filter).length > 0
        ? { ...filter, ...propsFilter }
        : {};
    }

    return output;
  }

  /**
 createQueryStr converts the query object into a formal GQL query string.
 */

// inputting a comment here to test git commits
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
   * buildCollection
   * @param {Object} proto
   * @param {Object} colleciton
   */

  async buildCollection(proto, collection) {
    const response = [];
    for (const superField in proto) {
      if (!collection) {
        collection = [];
      }
      if (collection.length === 0) {
        const toggledProto = this.toggleProto(proto[superField]); // have to refactor to create deep copy instead of mutation of proto
        proto[superField] = { ...toggledProto };
      }
      for (const item of collection) {
        let itemFromCache = await this.getFromRedis(item);
        itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
        const builtItem = await this.buildItem(
          proto[superField],
          itemFromCache
        );
        response.push(builtItem);
      }
    }
    return response;
  }
  

  /**
   * buildItem iterates through keys -- defined on pass-in prototype object, which is always a fragment of the
   * prototype, assigning to nodeObject the data at matching keys in the passed-in item. If a key on the prototype
   * has an object as its value, build array is recursively called.
   * If item does not have a key corresponding to prototype, that field is toggled to false on prototype object. Data
   * for that field will need to be queried.
   * @param {Object} proto
   * @param {Object} fieldsMap
   * @param {Object} item
   */
  async buildItem(proto, item) {
    const nodeObject = {};
    for (const key in proto) {
      if (typeof proto[key] === 'object') {
        // if field is an object, recursively call buildCollection
        const protoAtKey = { [key]: proto[key] };

        nodeObject[key] = await this.buildCollection(protoAtKey, item[key]); // it also can be object, needs to be refactored
      } else if (proto[key]) {
        // if current key has not been toggled to false because it needs to be queried
        if (item[key] !== undefined) nodeObject[key] = item[key];
        else proto[key] = false; // toggle proto key to false if cached item does not contain queried data
      }
    }
    return nodeObject;
  }


  /**
 joinResponses combines two objects containing results from the cached response and fetched (uncached) and outputs a single array response 
 that will ultimately be formatted and delivered to the client. 
 the copied Proto parameter sets a reference to combine the fields in the same order as the original query.
 */

// TO-DO: this could maybe be optimized by separating out some of the logic into a helper function we recurse upon
joinResponses(cacheResponse, serverResponse, queryProto, fromArray = false) {
  // initialize a "merged response" to be returned
  let mergedResponse = {};

  // loop through fields object keys, the "source of truth" for structure
  // store combined responses in mergedResponse

  // first loop for different queries on response
  for (const key in queryProto) {

    // TO-DO: caching for arrays is likely imperfect, needs more edge-case testing
    // for each key, check whether data stored at that key is an array or an object
    if (Array.isArray(cacheResponse[key]) || Array.isArray(serverResponse[key]) ) {
      // merging data stored as array
      // remove reserved properties from queryProto so we can compare # of properties on prototype to # of properties on responses
      const filterKeys = Object.keys(queryProto[key]).filter(propKey => !propKey.includes('__'));

      // if # of keys is the same between prototype & cached response, then the objects on the array represent different things
      if (filterKeys.length === Math.max(Object.keys(cacheResponse[key][0]).length, Object.keys(serverResponse[key][0]).length)) {
        //if the objects are "different", each object represents unique instance, we can concat
        mergedResponse[key] = [...cacheResponse[key], ...serverResponse[key]];
      } else {
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

          const mergedRecursion = this.joinResponses(
            { [fieldName]: cacheResponse[key][fieldName] },
            { [fieldName]: serverResponse[key][fieldName] }, 
            { [fieldName]: queryProto[key][fieldName] }
          );
  
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


  async joinArrays(cachedData, uncachedData) {
    let joinedData;

    // if we have an array run initial logic for array
    if (Array.isArray(uncachedData)) {
      joinedData = [];
      for (let i = 0; i < uncachedData.length; i += 1) {
        const joinedItem = await this.recursiveJoin(
          cachedData[i],
          uncachedData[i]
        );
        joinedData.push(joinedItem);
      }
      // if we have an obj skip array iteration and call recursiveJoin
    } else {
      joinedData = {};
      for (const key in uncachedData) {
        joinedData[key] = {};
        const joinedItem = await this.recursiveJoin(
          cachedData[key],
          uncachedData[key]
        );
        joinedData[key] = { ...joinedItem };
      }
    }
    return joinedData;
  }

  /**
   * recursiveJoin is a helper function called from within joinArrays, allowing nested fields to be merged before
   * returning the fully-merged item to joinResponses to be pushed onto results array. If same keys are present in
   * both cachedItem and uncached Item, uncachedItem -- which is the more up-to-date data -- will overwrite cachedItem.
   * @param {Object} cachedItem - base item
   * @param {Object} uncachedItem - item to be merged into base
   */
  async recursiveJoin(cachedItem, uncachedItem) {
    const joinedObject = cachedItem || {};

    for (const field in uncachedItem) {
      if (Array.isArray(uncachedItem[field])) {
        if (typeof uncachedItem[field][0] === 'string') {
          const temp = [];
          for (let reference of uncachedItem[field]) {
            let itemFromCache = await this.getFromRedis(reference);
            itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
            temp.push(itemFromCache);
          }
          uncachedItem[field] = temp;
        }
        if (cachedItem && cachedItem[field]) {
          joinedObject[field] = await this.joinArrays(
            cachedItem[field],
            uncachedItem[field]
          );
        } else {
          if (uncachedItem[field]) {
            joinedObject[field] = await this.joinArrays(
              [],
              uncachedItem[field]
            );
          } else {
            joinedObject[field] = uncachedItem[field];
          }
        }
      } else {
        joinedObject[field] = uncachedItem[field];
      }
    }
    return joinedObject;
  }
  /**
   * generateId generates a unique ID to refer to an item in cache. Each id concatenates the object type with an
   * id property (user-defined key from this.idMap, item.id or item._id). If no id property is present, the item is declared uncacheable.
   * @param {String} collection - name of schema type, used to identify each cacheable object
   * @param {Object} item - the object, including those keys that might identify it uniquely
   */
  generateId(collection, item) {
    let userDefinedId;
    const idMapAtCollection = this.idMap[collection];
    if (idMapAtCollection.length > 0) {
      for (const identifier of idMapAtCollection) {
        if (!userDefinedId) userDefinedId = item[identifier];
        else userDefinedId += item[identifier];
      }
    }
    const identifier = userDefinedId || item.id || item._id || 'uncacheable';
    return collection + '--' + identifier.toString();
  }

  /**
   * writeToCache writes a value to the cache unless the key indicates that the item is uncacheable. Note: writeToCache will JSON.stringify the input item
   * writeTochache will set expiration time for each item written to cache
   * @param {String} key - unique id under which the cached data will be stored
   * @param {Object} item - item to be cached
   */
  writeToCache(key, item) {
    if (!key.includes('uncacheable')) {
      this.redisCache.set(key, JSON.stringify(item));
      this.redisCache.EXPIRE(key, this.cacheExpiration);
    }
  }

  /**
   * replaceitemsWithReferences takes an array of objects and returns an array of references to those objects.
   * @param {String} queryName - name of the query or object type, to create type-governed references
   * @param {String} field - name of the field, used to find appropriate object type
   * @param {Array} array - array of objects to be converted into references
   */
  replaceItemsWithReferences(queryName, field, array) {
    const arrayOfReferences = [];
    const typeQueried = this.queryMap[queryName];
    const collectionName = this.fieldsMap[typeQueried][field];
    for (const item of array) {
      this.writeToCache(this.generateId(collectionName, item), item);
      arrayOfReferences.push(this.generateId(collectionName, item));
    }
    return arrayOfReferences;
  }

  /**
   * cache iterates through joined responses, writing each item and the array of responses to cache.
   *   - Normalization: items stored elsewhere in cache are replaced with a reference to that item.
   *   - Prevent data loss: Each item of the response is merged with what is in cache to ensure that no data
   *     present in the cache but not requested by the current query is lost.
   * @param {object} responseObject - the response merged from cache and graphql query resolution
   * @param {String} queryName - the name of the query, used for identifying response arrays in cache
   */

  // normalizeForCache Equivalent
  // pull down from cache
  // merge response & cache data
  // send updated data to cache

  // can recurse through responseObject and prototype at same time because same keys
  // currently doesn't recurse through cache, limits to bottom two levels
  // TO-DO replace cache with normalizeForCache and introduce it as a method on this object (so that it can have access to redisCache)
  async cache(responseObject, prototype) {
    const collection = JSON.parse(JSON.stringify(responseObject));

    for (const field in collection) {
      // check if current data chunk is collection
      const currentDataPiece = collection[field];
      let collectionName = this.queryMap[field];
      collectionName = Array.isArray(collectionName)
        ? collectionName[0]
        : collectionName;

      if (Array.isArray(currentDataPiece)) {
        const referencesToCache = [];
        for (const item of currentDataPiece) {
          const cacheId = this.generateId(collectionName, item);
          if (cacheId.includes('uncacheable')) return false;
          let itemFromCache = await this.getFromRedis(cacheId);

          itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
          const joinedWithCache = await this.recursiveJoin(item, itemFromCache);

          const itemKeys = Object.keys(joinedWithCache);
          for (const key of itemKeys) {
            if (Array.isArray(joinedWithCache[key])) {
              joinedWithCache[key] = this.replaceItemsWithReferences(
                field,
                key,
                joinedWithCache[key]
              );
            }
          }

          // Write individual objects to cache (e.g. separate object for each single city)
          this.writeToCache(cacheId, joinedWithCache);
          // Add reference to array if item it refers to is cacheable
          if (!cacheId.includes('uncacheable')) referencesToCache.push(cacheId);
        }

        // Write the non-empty array of references to cache (e.g. 'City': ['City-1', 'City-2', 'City-3'...])
        if (referencesToCache.length > 0) {
          let identifierInRedis = field;
          if (protoArgs != null && protoArgs.hasOwnProperty(field)) {
            for (const key in protoArgs[field]) {
              if (key.includes('id')) {
                identifierInRedis =
                  identifierInRedis + '-' + protoArgs[field][key];
              }
            }
          }
          this.writeToCache(identifierInRedis, referencesToCache);
        }
      } else {
        const cacheId = this.generateId(collectionName, currentDataPiece);
        if (cacheId.includes('uncacheable')) return false;

        let itemFromCache = await this.getFromRedis(cacheId);
        itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
        const joinedWithCache = await this.recursiveJoin(
          currentDataPiece,
          itemFromCache
        );
        const itemKeys = Object.keys(joinedWithCache);
        for (const key of itemKeys) {
          if (Array.isArray(joinedWithCache[key])) {
            joinedWithCache[key] = this.replaceItemsWithReferences(
              field,
              key,
              joinedWithCache[key]
            );
          }
        }
        // Write individual objects to cache (e.g. separate object for each single city)
        this.writeToCache(cacheId, joinedWithCache);
      }
    }
    return true;
  }

  async normalizeForCache(responseData, map = {}, protoField, fieldsMap = {}) {
    // iterate over keys in our response data object 
    for (const resultName in responseData) {
      // currentField we are iterating over & corresponding Prototype
      const currField = responseData[resultName];
      const currProto = protoField[resultName];
  
      // check if the value stored at that key is array 
      if (Array.isArray(currField)) {
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