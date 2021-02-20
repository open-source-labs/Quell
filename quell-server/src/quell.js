const redis = require("redis");
const { parse } = require("graphql/language/parser");
const { visit } = require("graphql/language/visitor");
const { graphql } = require("graphql");
const getQueryMap = require("./helper/getQueryMap");
const getFieldsMap = require("./helper/getFieldsMap");
const getIdMap = require("./helper/getIdMap");
const buildItem = require("./helper/buildItem");
const parseAST = require("./helper/parseAST");
const createQueryStr = require("./helper/createQuery");
class QuellCache {
  constructor(schema, redisPort, cacheExpiration = 1000) {
    this.schema = schema;
    this.queryMap = getQueryMap(schema);
    this.fieldsMap = getFieldsMap(schema);
    this.idMap = getIdMap();
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
   */ x;
  async query(req, res, next, isQuellable = true) {
    console.log("we are in server side");
    // handle request without query
    if (!req.body.query) {
      return next("Error: no GraphQL query found on request body");
    }
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

    console.log("proto in query func===>>", proto);
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

      console.log("proto for cache", protoForCache);

      // build response from cache
      const responseFromCache = await this.buildFromCache(
        protoForCache,
        this.queryMap,
        queriedCollection,
        collectionForCache
      );
      console.log("resp from cache inside query", responseFromCache);

      // query for additional information, if necessary
      let fullResponse, uncachedResponse;

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

  async buildFromCache(proto, map, queriedCollection, protoArgs) {
    // we don't pass collection first time
    // if first time, response will be an object
    map = this.queryMap;

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

  /**
   * createQueryObj traverses the prototype, removing fields that were retrieved from cache. The resulting object
   * will be passed to createQueryStr to construct a query requesting only the data not found in cache.
   * @param {Object} proto - the prototype with fields that still need to be queried toggled to false
   */

  //-----------------------------how should we pass the proto into these two functions?-------
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
    console.log(
      "we are in joinResponses",
      Array.isArray(cachedArray),
      Array.isArray(uncachedArray)
    );
    const joinedArray = [];
    // if we have an array run initial logic for array
    if (Array.isArray(uncachedArray)) {
      for (let i = 0; i < uncachedArray.length; i += 1) {
        const joinedItem = await this.recursiveJoin(
          cachedArray[i],
          uncachedArray[i]
        );
        joinedArray.push(joinedItem);
      }
      // if we have an obj skip array iteration and call recursiveJoin
    } else {
      const joinedItem = await this.recursiveJoin(
        cachedArray[0],
        uncachedArray
      );
      joinedArray.push(joinedItem);
    }
    return joinedArray;
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
