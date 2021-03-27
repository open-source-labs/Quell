const redis = require("redis");
const { parse } = require("graphql/language/parser");
const { visit, BREAK } = require("graphql/language/visitor");
const { graphql } = require("graphql");
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
  async query(req, res, next, isQuellable = true) {
    //console.log("CALL QUERY");
    // handle request without query
    if (!req.body.query) {
      return next("Error: no GraphQL query found on request body");
    }
    // retrieve GraphQL query string from request object;
    const queryString = req.body.query;

    console.log('query string --->', queryString);
    // create abstract syntax tree with graphql-js parser
    const AST = parse(queryString);
    console.log('AST --->', AST);

    // create response prototype, referenses for aliases and arguments
    const {proto, protoArgs, operationType} = this.parseAST(AST);
    console.log("PROTO OBJECT ===>", proto);
    console.log("ARGUMENTS OBJECT ===>", protoArgs);
    console.log("OPERATION TYPE ===>", operationType);

    // pass-through for queries and operations that QuellCache cannot handle
    if (operationType === "unQuellable" || !isQuellable) {
      graphql(this.schema, queryString)
        .then((queryResult) => {
          console.log('query result -->', queryResult);
          res.locals.queryResponse = queryResult;
          next();
        })
        .catch((error) => {
          return next("graphql library error: ", error);
        });

    /*
     * we can have two types of operation to take care of
     * MUTATION OR QUERY
    */
    } else if (operationType === "mutation"){
      // if MUTATION
      // configure possible redis key
      const redisKey = this.createRedisKey(this.mutationMap, proto, protoArgs);
      // check if we have same key in redis;  
      const needUpdates = redisKey ? await this.checkFromRedis(redisKey) : false;
      
      console.log('REDIS KEY --->', redisKey);
      console.log('NEEDS UPDATES --->', needUpdates);
      
      graphql(this.schema, queryString)
        .then((mutationResult) => {
          console.log('mutation result -->', mutationResult);
          // if redis needs to be updated, write to cache and send result back in sync
          if(redisKey && needUpdates) {
            this.writeToCache(redisKey, protoArgs);
          }
          res.locals.queryResponse = mutationResult;
          next();
         
        })
        .catch((error) => {
          return next("graphql library error: ", error);
      });
    } else {
      // if QUERY
      let protoForCache = { ...proto };

      // build response from cache
      const responseFromCache = await this.buildFromCache(
        protoForCache,
        this.queryMap,
        protoArgs
      );
      //console.log("RESPONSE FROM CACHE ----->", responseFromCache);

      // query for additional information, if necessary
      let fullResponse, uncachedResponse;

      // crate query object to check if we have to get something from database
      const queryObject = this.createQueryObj(protoForCache);
      //console.log("UPDATED QUERY OBJECT ===>", queryObject);

      // if cached response is incomplete, reformulate query, handoff query, join responses, and cache joined responses
      if (Object.keys(queryObject).length > 0) {
        // create new query sting
        const newQueryString = this.createQueryStr(queryObject, protoArgs);
        //console.log("UPDATED QUERY STRING ===>", newQueryString);
        graphql(this.schema, newQueryString)
          .then(async (queryResponse) => {
            //console.log("RESPONSE ===>", queryResponse);
            uncachedResponse = queryResponse.data;
            // join uncached and cached responses
            fullResponse = await this.joinResponses(
              responseFromCache,
              uncachedResponse
            );
            // cache joined responses
            //console.log("WE GOT JOIN RESPONSES ==>", fullResponse);

            const successfullyCached = await this.cache(
              fullResponse,
              protoArgs
            );
            //console.log("if succesfullyCached ??", successfullyCached);
            if (!successfullyCached) return this.query(req, res, next, false);
            // rebuild response from cache
            const toReturn = await this.constructResponse(fullResponse, AST);
            // append rebuilt response (if it contains data) or fullResponse to Express's response object
            console.log('final response, cache and sb -->', toReturn);
            res.locals.queryResponse = { data: { ...toReturn } };
            return next();
          })
          .catch((error) => {
            return next("graphql library error: ", error);
          });
      } else {
        // if nothing left to query, response from cache is full response
        console.log('final response, cache only -->', responseFromCache);
        res.locals.queryResponse = { data: { ...responseFromCache } };
        return next();
      }
    }
  }

  /**
   * createRedisKey creates key based on field name and argument id and returns string or null if key creation is not possible
   * @param {Object} mutationMap - 
   * @param {Object} proto - 
   * @param {Object} protoArgs - 
   * returns null or referenceToCache if possible, e.g. 'Book-1' or 'Book-2', where 'Book' is name from mutationMap and '1' is id from protoArgs
   */
  createRedisKey(mutationMap, proto, protoArgs) {
   console.log('CREATE REDIS KEY', mutationMap, proto, protoArgs);
   let referenceToCache = null;
   for(const mutationName in proto) {
    const mutationArgs = protoArgs[mutationName];
    for (const key in mutationArgs) {
      let identifier = null;
      if(key.includes('id')) {
        identifier = mutationArgs[key];
        referenceToCache = mutationMap[mutationName] + '-' + identifier;
        return referenceToCache;
      }
    }
   }
   return referenceToCache;
  }

  /**
   * checkFromRedis reads from Redis cache and returns a promise.
   * @param {String} key - the key for Redis lookup
   */
  checkFromRedis(key) {
    console.log('check from redis, key --->', key);
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
    //console.log("<=======is in redis here :) ======>");
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
      typeof mutationTypeFields === "function"
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
    console.log("mutationMap ----->>>>>>>", mutationMap);
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
      typeof queryTypeFields === "function"
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
      "String",
      "Int",
      "Float",
      "Boolean",
      "ID",
      "Query",
      "__Type",
      "__Field",
      "__EnumValue",
      "__DirectiveLocation",
      "__Schema",
      "__TypeKind",
      "__InputValue",
      "__Directive",
    ];
    // exclude built-in types
    const customTypes = Object.keys(typesList).filter(
      (type) => !builtInTypes.includes(type) && type !== schema._queryType.name
    );
    for (const type of customTypes) {
      const fieldsObj = {};
      let fields = typesList[type]._fields;
      if (typeof fields === "function") fields = fields();
      for (const field in fields) {
        const key = fields[field].name;
        const value = fields[field].type.ofType
          ? fields[field].type.ofType.name
          : fields[field].type.name;
        fieldsObj[key] = value;
      }
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
        if (fieldsAtType[key] === "ID") userDefinedIds.push(key);
      }
      idMap[type] = userDefinedIds;
    }
    return idMap;
  }

  /**
   * parseAST traverses the abstract syntax tree and creates a prototype object
   * representing all the queried fields nested as they are in the query. The
   * prototype object is used as
   *  (1) a model guiding the construction of responses from cache
   *  (2) a record of which fields were not present in cache and therefore need to be queried
   *  (3) a model guiding the construction of a new, partial GraphQL query
   */
  parseAST(AST) {
    // initialize prototype as empty object
    const proto = {};
    //let isQuellable = true;

    let operationType;

    // initialiaze arguments as null
    let protoArgs = null; //{ country: { id: '2' } }
   
    // initialize stack to keep track of depth first parsing
    const stack = [];

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
        if (node.directives) {
          if (node.directives.length > 0) {
            isQuellable = false;
            return BREAK;
          }
        }
      },
      OperationDefinition(node) {
        operationType = node.operation;
        if (node.operation === "subscription") {
          operationType = 'unQuellable';
          return BREAK;
        }
        if(node.operation === 'mutation') {
          console.log('we got mutation', node);
        }

      },
      Field: {
        enter(node) {
          if (node.alias) {
            operationType = 'unQuellable';
            return BREAK; 
          }
          if(node.arguments && node.arguments.length > 0) {
            
            protoArgs = protoArgs || {};
            protoArgs[node.name.value] = {};
            
            // collect arguments if arguments contain id, otherwise make query unquellable
            // hint: can check for graphQl type ID instead of string 'id'
            for (let i = 0; i < node.arguments.length; i++) {
              const key = node.arguments[i].name.value;
              const value = node.arguments[i].value.value;
              
              // for queries cache can handle only id as argument
              if(operationType === 'query') {
                if(!key.includes('id')) {
                  operationType = 'unQuellable';
                  return BREAK;
                }
              }
              protoArgs[node.name.value][key] = value;
            }
          }
          // add value to stack
          stack.push(node.name.value);
        },
        leave(node) {
          // remove value from stack
          stack.pop();
        },
      },
      SelectionSet(node, key, parent, path, ancestors) {
        /* Exclude SelectionSet nodes whose parents' are not of the kind
         * 'Field' to exclude nodes that do not contain information about
         *  queried fields.
         */
        if (parent.kind === "Field") {
          // loop through selections to collect fields
          const tempObject = {};
          for (let field of node.selections) {
            tempObject[field.name.value] = true;
          }

          // loop through stack to get correct path in proto for temp object;
          // mutates original prototype object;
          const protoObj = stack.reduce((prev, curr, index) => {
            return index + 1 === stack.length // if last item in path
              ? (prev[curr] = tempObject) // set value
              : (prev[curr] = prev[curr]); // otherwise, if index exists, keep value
          }, proto);
        }
      },
    });
    //const proto = isQuellable ? prototype : "unQuellable";
    //const proto = "unQuellable";
    return {proto, protoArgs, operationType};
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

  async buildFromCache(proto, map, protoArgs) {
    // we don't pass collection first time
    // if first time, response will be an object
    map = this.queryMap;
    ////console.log('map =======>>>>>', map);
    const response = {};
    for (const superField in proto) {
      let identifierForRedis = superField;
      //  //console.log("SUPERFIELD in proto", superField);
      // check if current chunck of data is collection or single item based on what we have in map
      const mapValue = map[superField];
      const isCollection = Array.isArray(mapValue);
      // //console.log("is", superField, "collection?", isCollection);
      // if we have current chunck as a collection we have to treat it as an array
      if (isCollection) {
        if (protoArgs != null && protoArgs.hasOwnProperty(superField)) {
          // //console.log("protosuperField", protoArgs[superField]);
          // //console.log("superField has arg===", protoArgs);
          for (const key in protoArgs[superField]) {
            if (key.includes("id")) {
              identifierForRedis =
                identifierForRedis + "-" + protoArgs[superField][key];
              //console.log("identifierForRedis here", identifierForRedis);
            }
          }
        }

        let collection;
        const currentCollection = [];
        // check if collection has been passed as argument
        // if collection not passed as argument, try to retrieve array of references from cache
        // if (!collection) {
        //   //console.log('collection is', collection);
        const collectionFromCache = await this.getFromRedis(identifierForRedis);
        // //console.log(
        //   "collection from CACHE ---> for key ",
        //   identifierForRedis,
        //   "is",
        //   collectionFromCache
        // );
        if (!collectionFromCache) collection = [];
        else collection = JSON.parse(collectionFromCache);
        // }
        if (collection.length === 0) {
          const toggledProto = this.toggleProto(proto[superField]);
          proto[superField] = { ...toggledProto };
        }
        for (const item of collection) {
          let itemFromCache = await this.getFromRedis(item);
          itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
          const builtItem = await this.buildItem(
            proto[superField],
            itemFromCache
          );
          //console.log("buidt item ==> ", builtItem);
          currentCollection.push(builtItem);
        }
        response[superField] = currentCollection;
      } else {
        // we have an object
        const idKey =
          protoArgs[superField]["id"] || protoArgs[superField]["_id"] || null;
        const item = `${map[superField]}-${idKey}`;
        let itemFromCache = await this.getFromRedis(item);
        //console.log("item from REDDIS -->", itemFromCache);
        itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
        const builtItem = await this.buildItem(
          proto[superField],
          itemFromCache
        );
        //console.log("build item ==> ", builtItem);
        response[superField] = builtItem;

        if (Object.keys(builtItem).length === 0) {
          const toggledProto = this.toggleProto(proto[superField]);
          proto[superField] = { ...toggledProto };
        }
      }
    }
    //console.log("response from build from cache", response);
    return response;
  }

  async buildCollection(proto, collection) {
    // //console.log(
    //   "inside buildCollection",
    //   "PROTO--> ",
    //   proto,
    //   "COLLECTION -->",
    //   collection
    // );

    const response = [];
    for (const superField in proto) {
      // if collection not passed as argument, try to retrieve array of references from cache
      if (!collection) {
        // const collectionFromCache = await this.getFromRedis(superField);
        // if (!collectionFromCache) collection = [];
        // else collection = JSON.parse(collectionFromCache);
        collection = [];
      }
      if (collection.length === 0) {
        const toggledProto = this.toggleProto(proto[superField]);
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
    //console.log("we are inside build item", proto, item);
    const nodeObject = {};
    for (const key in proto) {
      //console.log("key -->", key);
      //console.log("type of ", key, typeof proto[key]);
      if (typeof proto[key] === "object") {
        // if field is an object, recursively call buildFromCache
        //console.log("we have object for ", key);
        const protoAtKey = { [key]: proto[key] };
        //console.log("protoAtKey", protoAtKey);
        nodeObject[key] = await this.buildCollection(protoAtKey, item[key]);
      } else if (proto[key]) {
        // if current key has not been toggled to false because it needs to be queried
        if (item[key] !== undefined) nodeObject[key] = item[key];
        else proto[key] = false; // toggle proto key to false if cached item does not contain queried data
      }
    }
    return nodeObject;
  }
  /**
   * createQueryObj traverses the prototype, removing fields that were retrieved from cache. The resulting object
   * will be passed to createQueryStr to construct a query requesting only the data not found in cache.
   * @param {Object} proto - the prototype with fields that still need to be queried toggled to false
   */
  createQueryObj(proto) {
    //console.log("proto in create query obj", proto);
    const queryObj = {};
    for (const key in proto) {
      const reduced = this.protoReducer(proto[key]);
      if (reduced.length > 0) queryObj[key] = reduced;
    }
    return queryObj;
  }
  /**
   * protoReducer is a helper function (recusively) called from within createQueryObj, allowing introspection of
   * nested prototype fields.
   * @param {Object} proto - prototype
   */
  protoReducer(proto) {
    //console.log("proto in protoreducer", proto);
    const fields = [];
    for (const key in proto) {
      if (proto[key] === false) fields.push(key);
      if (typeof proto[key] === "object") {
        const nestedObj = {};
        const reduced = this.protoReducer(proto[key]);
        if (reduced.length > 0) {
          nestedObj[key] = reduced;
          fields.push(nestedObj);
        }
      }
    }
    return fields;
  }
  /**
   * createQueryStr converts the query object constructed in createQueryObj into a properly-formed GraphQL query,
   * requesting just those fields not found in cache.
   * @param {Object} queryObject - object representing queried fields not found in cache
   */
  createQueryStr(queryObject, queryArgsObject) {
    //console.log(queryArgsObject, "query args object in create query string");
    const openCurl = " { ";
    const closedCurl = " } ";
    let queryString = "";
    for (const key in queryObject) {
      if (queryArgsObject && queryArgsObject[key]) {
        let argString = "";

        const openBrackets = " (";
        const closeBrackets = " )";
        argString += openBrackets;
        for (const item in queryArgsObject[key]) {
          argString += item + ": " + queryArgsObject[key][item];
        }
        argString += closeBrackets;
        queryString +=
          key +
          argString +
          openCurl +
          this.queryStringify(queryObject[key]) +
          closedCurl;
      } else {
        queryString +=
          key + openCurl + this.queryStringify(queryObject[key]) + closedCurl;
      }
    }
    return openCurl + queryString + closedCurl;
  }
  /**
   * queryStringify is a helper function called from within createQueryStr. It iterates through an
   * array of field names, concatenating them into a fragment of the query string being constructed
   * in createQueryStr.
   * @param {Array} fieldsArray - array listing fields to be added to GraphQL query
   */
  queryStringify(fieldsArray) {
    const openCurl = " { ";
    const closedCurl = " } ";
    let innerStr = "";
    for (let i = 0; i < fieldsArray.length; i += 1) {
      if (typeof fieldsArray[i] === "string") {
        innerStr += fieldsArray[i] + " ";
      }
      if (typeof fieldsArray[i] === "object") {
        for (const key in fieldsArray[i]) {
          innerStr +=
            key +
            openCurl +
            this.queryStringify(fieldsArray[i][key]) +
            closedCurl;
        }
      }
    }
    return innerStr;
  }
  /**
   * joinResponses iterates through an array, merging each item with the same-index item in a second array.
   * joinResponses serves two purposes:
   *   - to merge together objects fetched out of cache with objects resolved by graphql-js library functions
   *   - to merge together objects in joined response with object in cache to ensure that no data is lost
   * @param {Array} cachedArray - base array
   * @param {Array} uncachedArray - array to be merged into base array
   */
  async joinResponses(cachedData, uncachedData) {
    // data is always is object
    //console.log("we are in joinResponses", uncachedData, cachedData);

    let joinedData = {};
    // iterate through keys
    for (const key in uncachedData) {
      //console.log("KEY IS", key, Array.isArray(uncachedData[key]));
      // if we have an array run initial logic for array
      if (Array.isArray(uncachedData[key])) {
        //console.log("key", key);
        joinedData[key] = [];
        for (let i = 0; i < uncachedData[key].length; i += 1) {
          const joinedItem = await this.recursiveJoin(
            cachedData[key][i],
            uncachedData[key][i]
          );
          //console.log("joined item", joinedItem);
          joinedData[key].push(joinedItem);
        }
        // if we have an obj skip array iteration and call recursiveJoin
      } else {
        //console.log("key is ", key);
        joinedData[key] = {};
        // for(const item in uncachedData[key]) {
        //console.log("item", uncachedData[key]);

        const joinedItem = await this.recursiveJoin(
          cachedData[key],
          uncachedData[key]
        );
        //console.log("joined item", joinedItem);
        joinedData[key] = { ...joinedItem };
        // }
      }
    }
    //console.log("joined data", joinedData);
    return joinedData;
  }
  /**
   * joinResponses iterates through an array, merging each item with the same-index item in a second array.
   * joinResponses serves two purposes:
   *   - to merge together objects fetched out of cache with objects resolved by graphql-js library functions
   *   - to merge together objects in joined response with object in cache to ensure that no data is lost
   * @param {Array} cachedArray - base array
   * @param {Array} uncachedArray - array to be merged into base array
   */
  async joinArrays(cachedData, uncachedData) {
    // uncachedArray can be array in case of general query e.g. counrties{ name id capital }
    // or object in case of query with args e.g. country (id : 1) { name id capital }
    //console.log("we are in joinArrays", uncachedData, cachedData);

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
   * recursiveJoin is a helper function called from within joinResponses, allowing nested fields to be merged before
   * returning the fully-merged item to joinResponses to be pushed onto results array. If same keys are present in
   * both cachedItem and uncached Item, uncachedItem -- which is the more up-to-date data -- will overwrite cachedItem.
   * @param {Object} cachedItem - base item
   * @param {Object} uncachedItem - item to be merged into base
   */
  async recursiveJoin(cachedItem, uncachedItem) {
    // //console.log(
    //   "RECURSIVE JOINNNNNNN =========> =====>",
    //   cachedItem,
    //   uncachedItem
    // );
    const joinedObject = cachedItem || {};

    //console.log("joined obj", joinedObject);
    for (const field in uncachedItem) {
      //console.log("field in uncached item", field);
      if (Array.isArray(uncachedItem[field])) {
        //console.log(field, "--- is array");
        if (typeof uncachedItem[field][0] === "string") {
          //console.log(field[0], "is string");
          const temp = [];
          for (let reference of uncachedItem[field]) {
            let itemFromCache = await this.getFromRedis(reference);
            //console.log("item from Cache", itemFromCache);
            itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
            temp.push(itemFromCache);
          }
          uncachedItem[field] = temp;
        }
        if (cachedItem && cachedItem[field]) {
          // //console.log(
          //   "call joinArrays with -->",
          //   cachedItem[field],
          //   uncachedItem[field]
          // );
          joinedObject[field] = await this.joinArrays(
            cachedItem[field],
            uncachedItem[field]
          );
        } else {
          if (uncachedItem[field]) {
            //console.log("call joinArrays with -->", [], uncachedItem[field]);
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
      // //console.log('joined object', joinedObject);
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
    const identifier = userDefinedId || item.id || item._id || "uncacheable";
    return collection + "-" + identifier.toString();
  }
  /**
   * writeToCache writes a value to the cache unless the key indicates that the item is uncacheable.
   * TO-DO: set expiration for each item written to cache
   * @param {String} key - unique id under which the cached data will be stored
   * @param {Object} item - item to be cached
   */
  writeToCache(key, item) {
    if (!key.includes("uncacheable")) {
      this.redisCache.set(key, JSON.stringify(item));
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
   * @param {Array} response - the response merged from cache and graphql query resolution
   * @param {String} collectionName - the object type name, used for identifying items in cache
   * @param {String} queryName - the name of the query, used for identifying response arrays in cache
   */
  async cache(responseObject, protoArgs) {
    // refactor this part cause in case of query with arg we have array of counry with one elements and we don't need it
    //console.log("we are inside cache function", responseObject);
    const collection = JSON.parse(JSON.stringify(responseObject));
    //console.log("we are inside cache function", collection);

    // iterate throgh
    for (const field in collection) {
      //console.log("iteration", field);
      // check if current data chunck is collection
      const currentDataPiece = collection[field];
      //console.log("curr data chunk", currentDataPiece);
      let collectionName = this.queryMap[field];
      //console.log("collection name", collectionName);
      collectionName = Array.isArray(collectionName)
        ? collectionName[0]
        : collectionName;

      if (Array.isArray(currentDataPiece)) {
        const referencesToCache = [];
        //console.log("current data ", field, "is array", currentDataPiece);
        for (const item of currentDataPiece) {
          const cacheId = this.generateId(collectionName, item);
          //console.log("cached if from generateid", cacheId);
          if (cacheId.includes("uncacheable")) return false;
          let itemFromCache = await this.getFromRedis(cacheId);
          //console.log("item from redis", itemFromCache);
          itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
          const joinedWithCache = await this.recursiveJoin(item, itemFromCache);
          //console.log("joined with cache", joinedWithCache);
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
          //console.log("write individual object to cache !!!");
          this.writeToCache(cacheId, joinedWithCache);
          // Add reference to array if item it refers to is cacheable
          if (!cacheId.includes("uncacheable")) referencesToCache.push(cacheId);
        }

        // Write the non-empty array of references to cache (e.g. 'City': ['City-1', 'City-2', 'City-3'...])
        //console.log("references to cache", referencesToCache);
        if (referencesToCache.length > 0) {
          let identifierInRedis = field;
          if (protoArgs != null && protoArgs.hasOwnProperty(field)) {
            for (const key in protoArgs[field]) {
              if (key.includes("id")) {
                identifierInRedis =
                  identifierInRedis + "-" + protoArgs[field][key];
                //console.log("identifierInRedis here", identifierInRedis);
                //this.writeToCache(identifierInRedis, referencesToCache);
              }
            }
          }
          this.writeToCache(identifierInRedis, referencesToCache);
        }
      } else {
        //console.log("current data ", field, "is object", currentDataPiece);
        const cacheId = this.generateId(collectionName, currentDataPiece);
        if (cacheId.includes("uncacheable")) return false;
        //console.log("cacheid", cacheId, collectionName);
        let itemFromCache = await this.getFromRedis(cacheId);
        //console.log("item from redis", itemFromCache);
        itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
        const joinedWithCache = await this.recursiveJoin(
          currentDataPiece,
          itemFromCache
        );
        //console.log("joinded with cache", joinedWithCache);
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
        //console.log("write cache -->");
        this.writeToCache(cacheId, joinedWithCache);
      }
    }
    //console.log("finish looping object in cache function, going return true");
    return true;
  }
  /**
   * Rebuilds response from cache, using a reconstructed prototype to govern the order of fields.
   * @param {Array} fullResponse - array of objects returned from graphql library
   * @param {Object} AST - abstract syntax tree
   * @param {String} queriedCollection - name of object type returned in query
   */
  async constructResponse(fullResponse, AST) {
    const {proto, protoArgs} = this.parseAST(AST);

    const rebuiltFromCache = await this.buildFromCache(
      proto,
      this.queryMap,
      protoArgs
    );
    console.log('Rebuild from Cache --->', rebuiltFromCache);
    if (Object.keys(rebuiltFromCache).length > 0) return rebuiltFromCache;
    return fullResponse;
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
