const redis = require('redis');
const { parse } = require('graphql/language/parser');
const { visit } = require('graphql/language/visitor');
const { graphql } = require('graphql');
class QuellCache {
  constructor (schema, redisPort, cacheExpiration = 1000) {
    this.schema = schema;
    this.queryMap = this.getQueryMap(schema);
    this.fieldsMap = this.getFieldsMap(schema);
    this.idMap = this.getIdMap();
    this.redisPort = redisPort;
    this.cacheExpiration = cacheExpiration;
    this.redisCache = redis.createClient(redisPort);
    this.query = this.query.bind(this);
    this.clearCache = this.clearCache.bind(this);
  };
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
   */x
  async query(req, res, next, isQuellable = true) {
    console.log('CALL QUERY');
    // handle request without query
    if (!req.body.query) {
      return next('Error: no GraphQL query found on request body');
    };
    // retrieve GraphQL query string from request object; 
    const queryString = req.body.query;

    // create abstract syntax tree with graphql-js parser
    const AST = parse(queryString);

    // create response prototype
    // if query has argument proto will return them as key value pair, as arguments: {id: 1}
    // should we refactor parseAST and return two objects?? 
    // one for proto and other for arguments
    const proto = this.parseAST(AST);

    let protoArgs = null; // will be an object with query arguments; // need it to create query string for furher request and to create key identifier to save it to redis, e.g. Country-1

    console.log('PROTO OBJECT', proto);
    // pass-through for queries and operations that QuellCache cannot handle
    if (proto === 'unQuellable' || !isQuellable) {
      graphql(this.schema, queryString)
      .then((queryResult) => {
          res.locals.queryResponse = queryResult;
          next();
        })
        .catch((error) => {
          return next('graphql library error: ', error);
        });
    } else {
      const queriedCollection = null;
      let collectionForCache = null;
      let protoForCache = {...proto};

      // check if proto has arguments and cut them from obj
      // cause we don't need argument in our response obj
      for(const queryName in protoForCache) {
        if(protoForCache[queryName].hasOwnProperty('arguments')) {
          //console.log('proto kid has arguments');
  
          const responseProto = {...protoForCache[queryName]};
          protoArgs = protoArgs || {};
          protoArgs[queryName] = {...responseProto.arguments};
          delete responseProto.arguments;
          protoForCache[queryName] = {...responseProto};

          console.log('proto args object --->', protoArgs);
        }
      }

      console.log('proto for cache --->', protoForCache);
     
      // build response from cache
      const responseFromCache = await this.buildFromCache(protoForCache, this.queryMap, queriedCollection, collectionForCache, protoArgs);
      console.log('resp from CACHE ----->', responseFromCache);

      // query for additional information, if necessary
      let fullResponse, uncachedResponse;

      // responseFromCache always should be an array !! --> should change for obj??
      // responseFromCache return [{}] if we don't have any cached data for item with unique identifier, e.g. country(id: 1)
      // need to refactor this logic later cause instead of just handoff original query it runs comparison logic

      if (responseFromCache.length === 0) { // if no cached data, handoff original query and cache results
        console.log('nothing in cache, run full query');
        graphql(this.schema, queryString)
        .then(async (queryResponse) => {
          // store the array of data
          fullResponse = queryResponse.data[queryName];
          // cache response
          const successfullyCached = await this.cache(fullResponse, queriedCollection, queryName);
          if (!successfullyCached) return this.query(req, res, next, false);
          // rebuild response from cache
          const toReturn = await this.constructResponse(fullResponse, AST, queriedCollection);
          // append rebuilt response (if it contains data) or fullResponse to Express's response object
          res.locals.queryResponse = { data: { [queryName]: toReturn }};
          return next();
          })
          .catch((error) => {
            return next('graphql library error: ', error);
          });
      } else {
        const queryObject = this.createQueryObj(protoForCache);

        console.log('query obj from create Query obj', queryObject);

        // if cached response is incomplete, reformulate query, handoff query, join responses, and cache joined responses
        if (Object.keys(queryObject).length > 0) {
          const newQueryString = this.createQueryStr(queryObject, protoArgs); // add protoArgs to build query if it has args
          console.log('new query string to complete request', newQueryString);
          graphql(this.schema, newQueryString)
            .then(async (queryResponse) => {
              console.log('RESPONSE ===>', queryResponse);
              uncachedResponse = queryResponse.data[queryName];
              // join uncached and cached responses
              fullResponse = await this.joinResponses(responseFromCache, uncachedResponse);
              // cache joined responses
              await this.cache(fullResponse, queriedCollection, queryName);
              const successfullyCached = await this.cache(fullResponse, queriedCollection, queryName);
              console.log('if succesfullyCached ??', successfullyCached);
              if (!successfullyCached) return this.query(req, res, next, false);
              // rebuild response from cache
              const toReturn = await this.constructResponse(fullResponse, AST, queriedCollection);
              console.log('rebuilt response', toReturn);
              // append rebuilt response (if it contains data) or fullResponse to Express's response object
              res.locals.queryResponse = { data: { [queryName]: toReturn }};
              return next();
            })
            .catch((error) => {
              return next('graphql library error: ', error);
            });
          } else {
          // if nothing left to query, response from cache is full response
          res.locals.queryResponse = { data: { [queryName]: responseFromCache }};
          return next();
        }
      }
    }
  };
  
  /**
   * getFromRedis reads from Redis cache and returns a promise.
   * @param {String} key - the key for Redis lookup 
   */
  getFromRedis(key) {
    console.log('get from redis');
    return new Promise((resolve, reject) => {
      this.redisCache.get(key, (error, result) => error ? reject(error) : resolve(result));
    });
  };

  /**
   *  getQueryMap generates a map of queries to GraphQL object types. This mapping is used
   *  to identify and create references to cached data.
   */
  getQueryMap(schema) {
    const queryMap = {};
    // get object containing all root queries defined in the schema
    const queryTypeFields = schema._queryType._fields;
    //console.log('queryTypeFields', queryTypeFields);
    // if queryTypeFields is a function, invoke it to get object with queries
    const queriesObj = (typeof queryTypeFields === 'function') ? queryTypeFields() : queryTypeFields;
    for (const query in queriesObj) {
      // get name of GraphQL type returned by query
      // if ofType --> this is collection, else not collection
      let returnedType;
      if(queriesObj[query].type.ofType) {
        returnedType = [];
        returnedType.push(queriesObj[query].type.ofType.name);
      } 
      if(queriesObj[query].type.name) {
        returnedType = queriesObj[query].type.name;
      }
      queryMap[query] = returnedType;
    }
    console.log('queryMap ----->>>>>>>', queryMap);
    return queryMap;
  };

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
    const customTypes = Object.keys(typesList)
    .filter((type) => !builtInTypes.includes(type) && type !== schema._queryType.name);
    for (const type of customTypes) {
      const fieldsObj = {};
      let fields = typesList[type]._fields;
      if (typeof fields === 'function') fields = fields();
      for (const field in fields) {
        const key = fields[field].name;
        const value = (fields[field].type.ofType) ? fields[field].type.ofType.name : fields[field].type.name;
        fieldsObj[key] = value;
      }
      fieldsMap[type] = fieldsObj;
    }
    console.log('FIELDS MAP', fieldsMap);
    return fieldsMap;
  };

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
    return idMap
  };

  /**
   * parseAST traverses the abstract syntax tree and creates a prototype object
   * representing all the queried fields nested as they are in the query. The
   * prototype object is used as
   *  (1) a model guiding the construction of responses from cache
   *  (2) a record of which fields were not present in cache and therefore need to be queried
   *  (3) a model guiding the construction of a new, partial GraphQL query 
   */
  parseAST(AST) {
    const queryRoot = AST.definitions[0];
    // initialize prototype as empty object
    const prototype = {};
    let isQuellable = true;
    console.log('we are inside parse AST');
  
    /**
     * visit is a utility provided in the graphql-JS library. It performs a
     * depth-first traversal of the abstract syntax tree, invoking a callback
     * when each SelectionSet node is entered. That function builds the prototype.
     * 
     * Find documentation at:
     * https://graphql.org/graphql-js/language/#visit
     */
    visit (AST, {
      enter(node) {
        if (node.operation) {
          if (node.operation !== 'query') {
            isQuellable = false;
          }
        }
        // if (node.arguments) {
        //   if (node.arguments.length > 0) {
        //     isQuellable = false;
        //   }
        // }
        if (node.directives) {
          if (node.directives.length > 0) {
            isQuellable = false;
          }
        }
        // if (node.alias) {
        //   isQuellable = false;
        // }
      },
      SelectionSet(node, key, parent, path, ancestors) {
        /** Helper function to convert array of ancestor fields into a
         *  path at which to assign the `collectFields` object.
         */
        function setProperty(path, obj, value) {
          console.log('path in setproperty', path);
          return path.reduce((prev, curr, index) => {
            return (index + 1 === path.length) // if last item in path
            ? prev[curr] = value // set value
              : prev[curr] = prev[curr] || {};
              // otherwise, if index exists, keep value or set to empty object if index does not exist
          }, obj);
        };
        /**
         * Exclude SelectionSet nodes whose parents' are not of the kind 
         * 'Field' to exclude nodes that do not contain information about
         *  queried fields.
         */
        if (parent.kind === 'Field') {
          /** GraphQL ASTs are structured such that a field's parent field
           *  is found three three ancestors back. Hence, subtract three. 
           */
          let depth = ancestors.length - 3;
          let objPath = [parent.name.value];
          /** Loop through ancestors to gather all ancestor nodes. This array
           * of nodes will be necessary for properly nesting each field in the
           * prototype object.
           */
          while (depth >= 5) {
            let parentNodes = ancestors[depth - 1];
            let { length } = parentNodes;
            objPath.unshift(parentNodes[length - 1].name.value);
            depth -= 3;
          }
          /** Loop over the array of fields at current node, adding each to
           *  an object that will be assigned to the prototype object at the
           *  position determined by the above array of ancestor fields.
           */
          const collectFields = {};
          console.log('parent !!!!!!!!', parent);
          if (parent.arguments) {
            console.log('parent arg', parent.arguments);
            if (parent.arguments.length > 0) {
              // loop through arguments
              collectFields.arguments = {};
              for(let i = 0; i < parent.arguments.length; i ++) {
                const key = parent.arguments[i].name.value;
                const value = parent.arguments[i].value.value;
                collectFields.arguments[key] = value;
              } 
            }
          }
          for (let field of node.selections) {
            collectFields[field.name.value] = true;
          }
          console.log('collectFields ===> ', { ...collectFields });
          // use helper function to update prototype
          setProperty(objPath, prototype, collectFields);
          console.log('prototype after collect fields', prototype);
        }
      }
    });
    
    // { country: { arguments: { id: '1' }, id: true, capital: true } } -- current proto after everything
    // { Country-1: { id: true, capital: true } } -- should look like this ??

    return isQuellable ? prototype : 'unQuellable';
  };
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
  };

  async buildFromCache(proto, map, queriedCollection, collection) {
    // we don't pass collection first time
    // if first time, response will be an o
    const response = {};
    for (const superField in proto) {
      console.log('superfield in proto', superField);
      console.log('collection', collection);
      // if collection not passed as argument, try to retrieve array of references from cache
      if (!collection) {
        const collectionFromCache = await this.getFromRedis(superField);
        if (!collectionFromCache) collection = [];
        else collection = JSON.parse(collectionFromCache);
      }
      if (collection.length === 0) this.toggleProto(proto);
      for (const item of collection) {
        let itemFromCache = await this.getFromRedis(item);
        itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
        const builtItem = await this.buildItem(proto[superField], this.fieldsMap[queriedCollection], itemFromCache);
        console.log('buidt item ==> ', builtItem);
        response.push(builtItem);
      }
    }
    console.log('response from build from cache', response);
    return response;
  };
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
  async buildItem(proto, fieldsMap, item) {
    const nodeObject = {};
    for (const key in proto) {
      if (typeof proto[key] === 'object') { // if field is an object, recursively call buildFromCache
        const protoAtKey = { [key]: proto[key] };
        nodeObject[key] = await this.buildFromCache(protoAtKey, fieldsMap, fieldsMap[key], item[key]);
      } else if (proto[key]) { // if current key has not been toggled to false because it needs to be queried
        if (item[key] !== undefined) nodeObject[key] = item[key];
        else proto[key] = false; // toggle proto key to false if cached item does not contain queried data
      }
    };
    return nodeObject;
  };
  /**
   * createQueryObj traverses the prototype, removing fields that were retrieved from cache. The resulting object
   * will be passed to createQueryStr to construct a query requesting only the data not found in cache.
   * @param {Object} proto - the prototype with fields that still need to be queried toggled to false 
   */
  createQueryObj(proto) {
    console.log('proto in create query obj', proto);
    const queryObj = {};
    for (const key in proto) {
      const reduced = this.protoReducer(proto[key]);
      if (reduced.length > 0) queryObj[key] = reduced;
    }
    return queryObj;
  };
  /**
   * protoReducer is a helper function (recusively) called from within createQueryObj, allowing introspection of
   * nested prototype fields.
   * @param {Object} proto - prototype 
   */
  protoReducer(proto) {
    console.log('proto in protoreducer', proto);
    const fields = [];
    for (const key in proto) {
      if (proto[key] === false) fields.push(key);
      if (typeof proto[key] === 'object') {
        const nestedObj = {};
        const reduced = this.protoReducer(proto[key]);
        if (reduced.length > 0) {
          nestedObj[key] = reduced;
          fields.push(nestedObj);
        }
      }
    }
    return fields;
  };
  /** 
   * createQueryStr converts the query object constructed in createQueryObj into a properly-formed GraphQL query,
   * requesting just those fields not found in cache.
   * @param {Object} queryObject - object representing queried fields not found in cache
   */
  createQueryStr(queryObject, queryArgsObject) {
    console.log(queryArgsObject, 'query args object in create query string');
    let argString = '';
    if(queryArgsObject !== null) {
      const openBrackets = ' (';
      const closeBrackets = ' )';
      argString += openBrackets;
      for (const key in queryArgsObject) {
        argString += key + ': ' + queryArgsObject[key];
      }
      argString += closeBrackets;
    }
    const openCurl = ' { ';
    const closedCurl = ' } ';
    let queryString = '';
    for (const key in queryObject) {
      queryString += key + argString + openCurl + this.queryStringify(queryObject[key]) + closedCurl;
    }
    return openCurl + queryString + closedCurl;
  };
  /**
   * queryStringify is a helper function called from within createQueryStr. It iterates through an
   * array of field names, concatenating them into a fragment of the query string being constructed 
   * in createQueryStr.
   * @param {Array} fieldsArray - array listing fields to be added to GraphQL query
   */
  queryStringify(fieldsArray) {
    const openCurl = ' { ';
    const closedCurl = ' } ';
    let innerStr = '';
    for (let i = 0; i < fieldsArray.length; i += 1) {
      if (typeof fieldsArray[i] === 'string') {
        innerStr += fieldsArray[i] + ' ';
      }
      if (typeof fieldsArray[i] === 'object') {
        for (const key in fieldsArray[i]) {
          innerStr += key + openCurl + this.queryStringify(fieldsArray[i][key]) + closedCurl;
        }
      }
    }
    return innerStr;
  };
  /**
   * joinResponses iterates through an array, merging each item with the same-index item in a second array.
   * joinResponses serves two purposes:
   *   - to merge together objects fetched out of cache with objects resolved by graphql-js library functions
   *   - to merge together objects in joined response with object in cache to ensure that no data is lost
   * @param {Array} cachedArray - base array
   * @param {Array} uncachedArray - array to be merged into base array
   */
  async joinResponses(cachedArray, uncachedArray) {
    // uncachedArray can be array in case of general query e.g. counrties{ name id capital }
    // or object in case of query with args e.g. country (id : 1) { name id capital }
    console.log('we are in joinResponses', Array.isArray(cachedArray), Array.isArray(uncachedArray));
    const joinedArray = [];
    // if we have an array run initial logic for array
    if (Array.isArray(uncachedArray)) {
      for (let i = 0; i < uncachedArray.length; i += 1) {
        const joinedItem = await this.recursiveJoin(cachedArray[i], uncachedArray[i]);
        joinedArray.push(joinedItem);
      }
    // if we have an obj skip array iteration and call recursiveJoin
    } else {
      const joinedItem = await this.recursiveJoin(cachedArray[0], uncachedArray);
      joinedArray.push(joinedItem);
    }
    return joinedArray;
  };
  /**
   * recursiveJoin is a helper function called from within joinResponses, allowing nested fields to be merged before
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
            temp.push(itemFromCache)
          }
          uncachedItem[field] = temp;
        }
        if (cachedItem[field]) {
          joinedObject[field] = await this.joinResponses(cachedItem[field], uncachedItem[field]);
        } else {
          joinedObject[field] = uncachedItem[field];
        }
      } else {
        joinedObject[field] = uncachedItem[field];
      }
    }
    return joinedObject;
  };
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
    return collection + '-' + identifier.toString();
  };
  /**
   * writeToCache writes a value to the cache unless the key indicates that the item is uncacheable.
   * TO-DO: set expiration for each item written to cache
   * @param {String} key - unique id under which the cached data will be stored 
   * @param {Object} item - item to be cached
   */
  writeToCache(key, item) {
    if (!key.includes('uncacheable')) {
      this.redisCache.set(key, JSON.stringify(item));
    }
  };
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
  };
  /**
   * cache iterates through joined responses, writing each item and the array of responses to cache.
   *   - Normalization: items stored elsewhere in cache are replaced with a reference to that item.
   *   - Prevent data loss: Each item of the response is merged with what is in cache to ensure that no data
   *     present in the cache but not requested by the current query is lost.
   * @param {Array} response - the response merged from cache and graphql query resolution 
   * @param {String} collectionName - the object type name, used for identifying items in cache
   * @param {String} queryName - the name of the query, used for identifying response arrays in cache
   */
  async cache(response, collectionName, queryName) {
    // refactor this part cause in case of query with arg we have array of counry with one elements and we don't need it
    console.log('we are inside cache function', response, collectionName, queryName);
    const collection = JSON.parse(JSON.stringify(response));
    const referencesToCache = [];
    // Check for nested array (to replace objects with another array of references)
    for (const item of collection) {
      const cacheId = this.generateId(collectionName, item);
      if (cacheId.includes('uncacheable')) return false;
      let itemFromCache = await this.getFromRedis(cacheId);
      itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
      const joinedWithCache = await this.recursiveJoin(item, itemFromCache);
      const itemKeys = Object.keys(joinedWithCache);
      for (const key of itemKeys) {
        if (Array.isArray(joinedWithCache[key])) {
          joinedWithCache[key] = this.replaceItemsWithReferences(queryName, key, joinedWithCache[key]);
        }
      }
      // Write individual objects to cache (e.g. separate object for each single city)
      this.writeToCache(cacheId, joinedWithCache);
      // Add reference to array if item it refers to is cacheable
      if (!cacheId.includes('uncacheable')) referencesToCache.push(cacheId);
    }
    // Write the non-empty array of references to cache (e.g. 'City': ['City-1', 'City-2', 'City-3'...])
    if (referencesToCache.length > 0) this.writeToCache(queryName, referencesToCache);
    return true;
  };
  /**
   * Rebuilds response from cache, using a reconstructed prototype to govern the order of fields.
   * @param {Array} fullResponse - array of objects returned from graphql library
   * @param {Object} AST - abstract syntax tree
   * @param {String} queriedCollection - name of object type returned in query
   */
  async constructResponse(fullResponse, AST, queriedCollection) {
    console.log('we are inside construct response');
    const rebuiltProto = this.parseAST(AST);

    let protoArgs = null; // will be an object with query arguments;

    let protoForCache = {...rebuiltProto};
    console.log('rebuuld from ast', rebuiltProto);
    const queryName = Object.keys(rebuiltProto)[0];
    // buildFromCache function accepts collection argument, which is array
    // if we have arguments in proto and we have id as argument or _id, we go through arguments and create collection from field and id
    let collectionForCache = null;
    // check if proto has arguments and cut them from obj
    // cause we don't need argument in our response obj
    if(protoForCache[queryName].hasOwnProperty('arguments')) {
      console.log('proto has arguments');
      const responseProto = {...protoForCache[queryName]};
      protoArgs = {...responseProto.arguments};
      delete responseProto.arguments;
      protoForCache[queryName] = {...responseProto};
      // create collection from proto arguments, for now proto has only one id
      if(protoArgs.hasOwnProperty("id") || protoArgs.hasOwnProperty("_id")) {
        const idKey = protoArgs["id"] || protoArgs["_id"];
        const collectionElement = `${queriedCollection}-${idKey}`;
        console.log('collectionElement', collectionElement);
        collectionForCache = [collectionElement];
      }
      console.log('proto args', protoArgs);
      }

    const rebuiltFromCache = await this.buildFromCache(protoForCache, this.queryMap, queriedCollection, collectionForCache);
    if (rebuiltFromCache.length > 0) return rebuiltFromCache;
    return fullResponse;
  };
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
  };
};

module.exports = QuellCache;
