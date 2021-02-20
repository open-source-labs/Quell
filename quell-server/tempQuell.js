const redis = require("redis");
const { parse } = require("graphql/language/parser");
const { visit } = require("graphql/language/visitor");
const { graphql } = require("graphql");
class QuellCache {
  constructor(schema, redisPort, cacheExpiration = 1000) {
    this.schema = schema;
    this.queryMap = this.getQueryMap(schema);
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
    console.log("CALL QUERY");
    // handle request without query
    if (!req.body.query) {
      return next("Error: no GraphQL query found on request body");
    }
    // retrieve GraphQL query string from request object;
    const queryString = req.body.query;

    // create abstract syntax tree with graphql-js parser
    const AST = parse(queryString);

    // create response prototype
    const proto = this.parseAST(AST);
    console.log("PROTO OBJECT ===>", proto);

    // create object for arguments from query
    let protoArgs = null;

    // pass-through for queries and operations that QuellCache cannot handle
    if (proto === "unQuellable" || !isQuellable) {
      graphql(this.schema, queryString)
        .then((queryResult) => {
          res.locals.queryResponse = queryResult;
          next();
        })
        .catch((error) => {
          return next("graphql library error: ", error);
        });
    } else {
      const queriedCollection = null;

      let protoForCache = { ...proto };

      // check if proto has arguments and cut them from obj
      // cause we don't need argument in our response obj
      for (const queryName in protoForCache) {
        if (protoForCache[queryName].hasOwnProperty("arguments")) {
          //console.log('proto kid has arguments');

          const responseProto = { ...protoForCache[queryName] };
          protoArgs = protoArgs || {};
          protoArgs[queryName] = { ...responseProto.arguments };
          delete responseProto.arguments;
          protoForCache[queryName] = { ...responseProto };

          console.log("proto args object --->", protoArgs);
        }
      }

      console.log("proto for cache --->", protoForCache);

      // build response from cache
      const responseFromCache = await this.buildFromCache(
        protoForCache,
        this.queryMap,
        queriedCollection,
        protoArgs
      );
      console.log("resp from CACHE ----->", responseFromCache);

      // query for additional information, if necessary
      let fullResponse, uncachedResponse;

      // responseFromCache always should be an array !! --> should change for obj??
      // responseFromCache return [{}] if we don't have any cached data for item with unique identifier, e.g. country(id: 1)
      // need to refactor this logic later cause instead of just handoff original query it runs comparison logic

      const queryObject = this.createQueryObj(protoForCache);

      console.log("query obj from create Query obj", queryObject);

      // if cached response is incomplete, reformulate query, handoff query, join responses, and cache joined responses
      if (Object.keys(queryObject).length > 0) {
        const newQueryString = this.createQueryStr(queryObject, protoArgs); // add protoArgs to build query if it has args
        console.log("new query string to complete request", newQueryString);
        graphql(this.schema, newQueryString)
          .then(async (queryResponse) => {
            console.log("RESPONSE ===>", queryResponse);
            uncachedResponse = queryResponse.data;
            // join uncached and cached responses
            fullResponse = await this.joinResponses(
              responseFromCache,
              uncachedResponse
            );
            // cache joined responses
            console.log("WE GOT JOIN RESPONSES ==>", fullResponse);

            //await this.cache(fullResponse, queriedCollection, queryName);
            const successfullyCached = await this.cache(fullResponse);
            console.log("if succesfullyCached ??", successfullyCached);
            if (!successfullyCached) return this.query(req, res, next, false);
            // rebuild response from cache
            const toReturn = await this.constructResponse(
              fullResponse,
              AST,
              queriedCollection
            );
            console.log("rebuilt response", toReturn);
            // append rebuilt response (if it contains data) or fullResponse to Express's response object
            res.locals.queryResponse = { data: { ...toReturn } };
            return next();
          })
          .catch((error) => {
            return next("graphql library error: ", error);
          });
      } else {
        // if nothing left to query, response from cache is full response
        res.locals.queryResponse = { data: { ...responseFromCache } };
        return next();
        //}
      }
    }
  }

  /**
   * getFromRedis reads from Redis cache and returns a promise.
   * @param {String} key - the key for Redis lookup
   */
  getFromRedis(key) {
    console.log("get from redis");
    return new Promise((resolve, reject) => {
      this.redisCache.get(key, (error, result) =>
        error ? reject(error) : resolve(result)
      );
    });
  }

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
    console.log("queryMap ----->>>>>>>", queryMap);
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
    console.log("FIELDS MAP", fieldsMap);
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
    const queryRoot = AST.definitions[0];
    // initialize prototype as empty object
    const prototype = {};
    let isQuellable = true;
    console.log("we are inside parse AST");

    /**
     * visit is a utility provided in the graphql-JS library. It performs a
     * depth-first traversal of the abstract syntax tree, invoking a callback
     * when each SelectionSet node is entered. That function builds the prototype.
     *
     * Find documentation at:
     * https://graphql.org/graphql-js/language/#visit
     */
    visit(AST, {
      enter(node) {
        if (node.operation) {
          if (node.operation !== "query") {
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
        if (node.alias) {
          isQuellable = false;
        }
      },
      SelectionSet(node, key, parent, path, ancestors) {
        /** Helper function to convert array of ancestor fields into a
         *  path at which to assign the `collectFields` object.
         */
        function setProperty(path, obj, value) {
          console.log("path in setproperty", path);
          return path.reduce((prev, curr, index) => {
            return index + 1 === path.length // if last item in path
              ? (prev[curr] = value) // set value
              : (prev[curr] = prev[curr] || {});
            // otherwise, if index exists, keep value or set to empty object if index does not exist
          }, obj);
        }
        /**
         * Exclude SelectionSet nodes whose parents' are not of the kind
         * 'Field' to exclude nodes that do not contain information about
         *  queried fields.
         */
        if (parent.kind === "Field") {
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
            console.log("parent Nodes", parentNodes);
            let { length } = parentNodes;
            objPath.unshift(parentNodes[length - 1].name.value);
            depth -= 3;
            console.log("objectPath -->", JSON.parse(JSON.stringify(objPath)));
          }
          /** Loop over the array of fields at current node, adding each to
           *  an object that will be assigned to the prototype object at the
           *  position determined by the above array of ancestor fields.
           */
          const collectFields = {};
          console.log("parent !!!!!!!!", parent);
          if (parent.arguments) {
            console.log("parent arg", parent.arguments);
            if (parent.arguments.length > 0) {
              // loop through arguments
              collectFields.arguments = {};
              for (let i = 0; i < parent.arguments.length; i++) {
                const key = parent.arguments[i].name.value;
                const value = parent.arguments[i].value.value;
                collectFields.arguments[key] = value;
              }
            }
          }
          for (let field of node.selections) {
            collectFields[field.name.value] = true;
          }
          console.log("collectFields ===> ", { ...collectFields });
          // use helper function to update prototype
          setProperty(objPath, prototype, collectFields);
          console.log("prototype after collect fields", prototype);
        }
      },
    });

    // { country: { arguments: { id: '1' }, id: true, capital: true } } -- current proto after everything
    // { Country-1: { id: true, capital: true } } -- should look like this ??

    return isQuellable ? prototype : "unQuellable";
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

  async buildFromCache(proto, map, queriedCollection, protoArgs) {
    // we don't pass collection first time
    // if first time, response will be an object
    map = this.queryMap;
    //console.log('map =======>>>>>', map);
    const response = {};
    for (const superField in proto) {
      console.log(
        "SUPERFIELD in proto",
        superField,
        "QUERIeD collection -->",
        queriedCollection
      );
      // check if current chunck of data is collection or single item based on what we have in map
      const mapValue = map[superField];
      const isCollection = Array.isArray(mapValue);
      console.log("is", superField, "collection?", isCollection);
      // if we have current chunck as a collection we have to treat it as an array
      if (isCollection) {
        let collection;
        const currentCollection = [];
        // check if collection has been passed as argument
        // if collection not passed as argument, try to retrieve array of references from cache
        // if (!collection) {
        //   console.log('collection is', collection);
        const collectionFromCache = await this.getFromRedis(superField);
        console.log("collection from CACHE --->", collectionFromCache);
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
          console.log("buidt item ==> ", builtItem);
          currentCollection.push(builtItem);
        }
        response[superField] = currentCollection;
      } else {
        // we have an object
        const idKey =
          protoArgs[superField]["id"] || protoArgs[superField]["_id"] || null;
        const item = `${map[superField]}-${idKey}`;
        let itemFromCache = await this.getFromRedis(item);
        console.log("item from REDDIS -->", itemFromCache);
        itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
        const builtItem = await this.buildItem(
          proto[superField],
          itemFromCache
        );
        console.log("build item ==> ", builtItem);
        response[superField] = builtItem;

        if (Object.keys(builtItem).length === 0) {
          const toggledProto = this.toggleProto(proto[superField]);
          proto[superField] = { ...toggledProto };
        }
      }
    }
    console.log("response from build from cache", response);
    return response;
  }

  async buildCollection(proto, collection) {
    console.log(
      "inside buildCollection",
      "PROTO--> ",
      proto,
      "COLLECTION -->",
      collection
    );

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
    console.log("we are inside build item", proto, item);
    const nodeObject = {};
    for (const key in proto) {
      console.log("key -->", key);
      console.log("type of ", key, typeof proto[key]);
      if (typeof proto[key] === "object") {
        // if field is an object, recursively call buildFromCache
        console.log("we have object for ", key);
        const protoAtKey = { [key]: proto[key] };
        console.log("protoAtKey", protoAtKey);
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
    console.log("proto in create query obj", proto);
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
    console.log("proto in protoreducer", proto);
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
    console.log(queryArgsObject, "query args object in create query string");
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
    console.log("we are in joinResponses", uncachedData, cachedData);

    let joinedData = {};
    // iterate through keys
    for (const key in uncachedData) {
      console.log("KEY IS", key, Array.isArray(uncachedData[key]));
      // if we have an array run initial logic for array
      if (Array.isArray(uncachedData[key])) {
        console.log("key", key);
        joinedData[key] = [];
        for (let i = 0; i < uncachedData[key].length; i += 1) {
          const joinedItem = await this.recursiveJoin(
            cachedData[key][i],
            uncachedData[key][i]
          );
          console.log("joined item", joinedItem);
          joinedData[key].push(joinedItem);
        }
        // if we have an obj skip array iteration and call recursiveJoin
      } else {
        console.log("key is ", key);
        joinedData[key] = {};
        // for(const item in uncachedData[key]) {
        console.log("item", uncachedData[key]);

        const joinedItem = await this.recursiveJoin(
          cachedData[key],
          uncachedData[key]
        );
        console.log("joined item", joinedItem);
        joinedData[key] = { ...joinedItem };
        // }
      }
    }
    console.log("joined data", joinedData);
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
    console.log("we are in joinArrays", uncachedData, cachedData);

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
    console.log(
      "RECURSIVE JOINNNNNNN =========> =====>",
      cachedItem,
      uncachedItem
    );
    const joinedObject = cachedItem || {};

    console.log("joined obj", joinedObject);
    for (const field in uncachedItem) {
      console.log("field in uncached item", field);
      if (Array.isArray(uncachedItem[field])) {
        console.log(field, "--- is array");
        if (typeof uncachedItem[field][0] === "string") {
          console.log(field[0], "is string");
          const temp = [];
          for (let reference of uncachedItem[field]) {
            let itemFromCache = await this.getFromRedis(reference);
            console.log("item from Cache", itemFromCache);
            itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
            temp.push(itemFromCache);
          }
          uncachedItem[field] = temp;
        }
        if (cachedItem && cachedItem[field]) {
          console.log(
            "call joinArrays with -->",
            cachedItem[field],
            uncachedItem[field]
          );
          joinedObject[field] = await this.joinArrays(
            cachedItem[field],
            uncachedItem[field]
          );
        } else {
          if (uncachedItem[field]) {
            console.log("call joinArrays with -->", [], uncachedItem[field]);
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
      // console.log('joined object', joinedObject);
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
  async cache(responseObject) {
    // refactor this part cause in case of query with arg we have array of counry with one elements and we don't need it
    console.log("we are inside cache function", responseObject);
    const collection = JSON.parse(JSON.stringify(responseObject));
    console.log("we are inside cache function", collection);

    // iterate throgh
    for (const field in collection) {
      console.log("iteration", field);
      // check if current data chunck is collection
      const currentDataPiece = collection[field];
      console.log("curr data chunk", currentDataPiece);
      let collectionName = this.queryMap[field];
      console.log("collection name", collectionName);
      collectionName = Array.isArray(collectionName)
        ? collectionName[0]
        : collectionName;

      if (Array.isArray(currentDataPiece)) {
        const referencesToCache = [];
        console.log("current data ", field, "is array", currentDataPiece);
        for (const item of currentDataPiece) {
          const cacheId = this.generateId(collectionName, item);
          console.log("cached if from generateid", cacheId);
          if (cacheId.includes("uncacheable")) return false;
          let itemFromCache = await this.getFromRedis(cacheId);
          console.log("item from redis", itemFromCache);
          itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
          const joinedWithCache = await this.recursiveJoin(item, itemFromCache);
          console.log("joined with cache", joinedWithCache);
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
          console.log("write individual object to cache !!!");
          this.writeToCache(cacheId, joinedWithCache);
          // Add reference to array if item it refers to is cacheable
          if (!cacheId.includes("uncacheable")) referencesToCache.push(cacheId);
        }

        // Write the non-empty array of references to cache (e.g. 'City': ['City-1', 'City-2', 'City-3'...])
        console.log("references to cache", referencesToCache);
        if (referencesToCache.length > 0)
          this.writeToCache(field, referencesToCache);
      } else {
        console.log("current data ", field, "is object", currentDataPiece);
        const cacheId = this.generateId(collectionName, currentDataPiece);
        if (cacheId.includes("uncacheable")) return false;
        console.log("cacheid", cacheId, collectionName);
        let itemFromCache = await this.getFromRedis(cacheId);
        console.log("item from redis", itemFromCache);
        itemFromCache = itemFromCache ? JSON.parse(itemFromCache) : {};
        const joinedWithCache = await this.recursiveJoin(
          currentDataPiece,
          itemFromCache
        );
        console.log("joinded with cache", joinedWithCache);
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
        console.log("write cache -->");
        this.writeToCache(cacheId, joinedWithCache);
      }
    }
    console.log("finish looping object in cache function, going return true");
    return true;
  }
  /**
   * Rebuilds response from cache, using a reconstructed prototype to govern the order of fields.
   * @param {Array} fullResponse - array of objects returned from graphql library
   * @param {Object} AST - abstract syntax tree
   * @param {String} queriedCollection - name of object type returned in query
   */
  async constructResponse(fullResponse, AST, queriedCollection) {
    console.log("we are inside construct response");
    const rebuiltProto = this.parseAST(AST);

    let protoArgs = null; // will be an object with query arguments;

    let protoForCache = { ...rebuiltProto };
    console.log("rebuuld from ast", rebuiltProto);

    // buildFromCache function accepts collection argument, which is array
    // if we have arguments in proto and we have id as argument or _id, we go through arguments and create collection from field and id
    //let collectionForCache = null;
    // check if proto has arguments and cut them from obj
    // cause we don't need argument in our response obj
    for (const queryName in protoForCache) {
      if (protoForCache[queryName].hasOwnProperty("arguments")) {
        //console.log('proto kid has arguments');

        const responseProto = { ...protoForCache[queryName] };
        protoArgs = protoArgs || {};
        protoArgs[queryName] = { ...responseProto.arguments };
        delete responseProto.arguments;
        protoForCache[queryName] = { ...responseProto };

        console.log("proto args", protoArgs);
      }
    }

    const rebuiltFromCache = await this.buildFromCache(
      protoForCache,
      this.queryMap,
      queriedCollection,
      protoArgs
    );
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
