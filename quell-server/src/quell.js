/**
 * CONNECTING TO REDIS SERVER:
 * I need to research this more. For now, I'm going to create a cache object to 
 * serve as a dummy cache. I'll need to replace those parts with the actual commands 
 * to read from and write to the redis cache.
 * The trunQ approach: they require in redis library and create a client.
 */

const createCache = function() {
  this.cache = {}
};


createCache.prototype.get = function (key) {
  return this.cache[key] || null;
};

createCache.prototype.set = function (key, value) {
  this.cache[key] = value;
};

const dummyCache = new createCache();

const mockSchema = require('./mockSchema');
const mockQuery = require('./mockQuery');
const { parse } = require('graphql/language/parser');
const { visit } = require('graphql/language/visitor');
const { graphql } = require('graphql');
const { stringify } = require('querystring');

class QuellCache {
  constructor (schema, redisPort, cacheExpiration = 1000) {
    this.schema = schema;
    this.queryMap = this.getQueryMap(schema);
    this.fieldsMap = this.getFieldsMap(schema);
    this.redisPort = redisPort;
    this.cacheExpiration = cacheExpiration

  }

  
  query(req, res, next) {
    // handle request without query
    if (!req.body.query) {
      return next('Error: no GraphQL query found on request body');
    };

    // retrieve GraphQL query string from request object; 
    const queryString = req.body.query;
    
    // create abstract syntax tree with graphql-js parser
    const AST = parse(queryString);

    // create response prototype
    const proto = this.parseAST(AST);
    // handle error
    if (proto === 'error') {
      return next('Error: Quell currently only supports GraphQL queries');
    }
    
    const queryName = Object.keys(proto)[0];
    const queriedCollection = this.queryMap[queryName];
    
    
    // build response from cache
    const responseFromCache = this.buildFromCache(proto, this.queryMap, queriedCollection);
       
    
    let fullResponse;

    if (responseFromCache.length === 0) {
      fullResponse = this.graphQLHandoff(queryString);
      this.cache(fullResponse, queriedCollection, queryName);
    } else {
      const queryObject = this.createQueryObj(proto);
      
      if (Object.keys(queryObject).length > 0) {
        const newQueryString = this.createQueryStr(queryObject);
        const uncachedResponse = this.graphQLHandoff(newQueryString);
        fullResponse = this.joinResponses(responseFromCache, uncachedResponse);
        this.cache(fullResponse, queriedCollection, queryName);
      } else {
        fullResponse = responseFromCache;
      }
    }


    // res.locals.queryResponse = { data: { [queryName]: fullResponse }};
    // return next();
    
    const freshProto = this.parseAST(AST);

    const refetchedFromCache = this.buildFromCache(freshProto, this.queryMap, queriedCollection);

    // return fullResponse;
    return refetchedFromCache;
  };

  graphQLHandoff(query) {
    // graphql(this.schema, query)
    //   .then((results) => {
    //     return results;
    //   })
    //   .catch((error) => {
    //     return `Error in graphQLHandoff: ${error}`
    //   });

    return ([
      { 'capital': 'Andorra la Vella', 'cities': [{ 'population': 1052 }, { 'population': 7211 }] },
      { 'capital': 'Sucre', 'cities': [{ 'population': 4013 }, { 'population': 5157 }] },
      { 'capital': 'Yerevan', 'cities': [{ 'population': 3292 }, { 'population': 22233 }] },
      { 'capital': 'Pago Pago', 'cities': [{ 'population': 5157 }, { 'population': 20430 }] },
      { 'capital': 'Oranjestad', 'cities': [{ 'population': 4715 }, { 'population': 0 }] }
    ])
  };

  /**
   *  getQueryMap generates a map of queries to GraphQL object types. This mapping is used
   *  to identify and create references to cached data.
   */
  getQueryMap(schema) {
    const queryMap = {};
    
    // get object containing all root queries defined in the schema
    const queryTypeFields = schema._queryType._fields;
    // if queryTypeFields is a function, invoke it to get object with queries
    const queriesObj = (typeof queryTypeFields === 'function') ? queryTypeFields() : queryTypeFields;
    
    for (const query in queriesObj) {
      // get name of GraphQL type returned by query
      const returnedType = queriesObj[query].type.name || queriesObj[query].type.ofType.name
      queryMap[query] = returnedType;
    }

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

    const customTypes = Object.keys(typesList)
      .filter((type) => !builtInTypes.includes(type) && type !== schema._queryType.name);

    for (const type of customTypes) {
      const fieldsObj = {};
      const fields = typesList[type]._fields;
      if (typeof fields === 'function') fields = fields();
      
      for (const field in fields) {
        const key = fields[field].name;
        const value = (fields[field].type.ofType) ? fields[field].type.ofType.name : fields[field].type.name;
        fieldsObj[key] = value;
      }
      
      fieldsMap[type] = fieldsObj;
    }

    return fieldsMap;
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

    // limit operations: Quell currently only supports GraphQL queries
    if (queryRoot.operation !== 'query') {
      return 'error';
    }

    // initialize prototype as empty object
    const prototype = {};

    /**
     * visit is a utility provided in the graphql-JS library. It performs a
     * depth-first traversal of the abstract syntax tree, invoking a callback
     * when each SelectionSet node is entered. That function builds the prototype.
     * 
     * Find documentation at:
     * https://graphql.org/graphql-js/language/#visit
     */
    visit (AST, {
      SelectionSet(node, key, parent, path, ancestors) {
        /** Helper function to convert array of ancestor fields into a
         *  path at which to assign the `collectFields` object.
         */
        function setProperty(path, obj, value) {
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
          for (let field of node.selections) {
            collectFields[field.name.value] = true;
          }
          
          // use helper function to update prototype
          setProperty(objPath, prototype, collectFields);
        }
      }
    });

    return prototype;
  };
  
  toggleProto(proto) {
    for (const key in proto) {
      if (Object.keys(proto[key]).length > 0) this.toggleProto(proto[key]);
      else proto[key] = false;
    }
  };
  
  buildFromCache(proto, map, queriedCollection, collection) {
    const response = [];
    
    for (const superField in proto) {
      if (!collection) collection = JSON.parse(dummyCache.get(superField)) || [];
      if (collection.length === 0) this.toggleProto(proto);
      for (const item of collection) {
        response.push(this.buildItem(proto[superField], this.fieldsMap[queriedCollection], JSON.parse(dummyCache.get(item))));
      }
    }

    return response;
  };

  buildItem(proto, fieldsMap, item) {
    const nodeObject = {};

    for (const key in proto) {
      if (typeof proto[key] === 'object') {
        const protoAtKey = { [key]: proto[key] };
        nodeObject[key] = this.buildFromCache(protoAtKey, fieldsMap, fieldsMap[key], item[key]);
      } else if (proto[key]) {
        if (item[key] !== undefined) nodeObject[key] = item[key];
        else proto[key] = false;
      }
    };

    return nodeObject;
  };

  createQueryObj(proto) {
    const queryObj = {};
    for (const key in proto) {
      const reduced = this.protoReducer(proto[key]);
      if (reduced.length > 0) queryObj[key] = reduced;
    }
    return queryObj;
  };

  protoReducer(proto) {
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

  createQueryStr(queryObject) {
    const openCurl = ' { ';
    const closedCurl = ' } ';

    let queryString = '';

    for (const key in queryObject) {
      queryString += key + openCurl + this.queryStringify(queryObject[key]) + closedCurl;
    }

    return openCurl + queryString + closedCurl;
  };

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

  joinResponses(cachedArray, uncachedArray) {
    const joinedArray = [];

    for (let i = 0; i < uncachedArray.length; i += 1) {
      joinedArray.push(this.recursiveJoin(cachedArray[i], uncachedArray[i]));
    }

    return joinedArray;
  };

  recursiveJoin(cachedItem, uncachedItem) {
    const joinedObject = cachedItem || {};
    
    for (const field in uncachedItem) {
      if (Array.isArray(uncachedItem[field])) {
        if (typeof uncachedItem[field][0] === 'string') {
          const temp = [];
          for (let reference of uncachedItem[field]) {
            temp.push(JSON.parse(dummyCache.get(reference)))
          }
          uncachedItem[field] = temp;
        }
        if (cachedItem[field]) {
          
          joinedObject[field] = this.joinResponses(cachedItem[field], uncachedItem[field]);
        } else {
          joinedObject[field] = uncachedItem[field];
        }
      } else {
        joinedObject[field] = uncachedItem[field];
      }
    }
    return joinedObject;
  };

  generateId(collection, item) {
    const identifier = item.id || item._id || 'uncacheable';    
    return collection + '-' + identifier.toString();
  };
  
  writeToCache(key, item) {
    if (!key.includes('uncacheable')) {
      dummyCache.set(key, JSON.stringify(item));
    }
  };
  
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

  cache(response, collectionName, queryName) {
    const collection = JSON.parse(JSON.stringify(response));
  
    const referencesToCache = [];
  
    // Check for nested array (to replace objects with another array of references)
    for (const item of collection) {
      
      const cacheId = this.generateId(collectionName, item);
      const joinedWithCache = this.recursiveJoin(item, JSON.parse(dummyCache.get(cacheId)));
      const itemKeys = Object.keys(joinedWithCache);
      
      for (const key of itemKeys) {
        if (Array.isArray(joinedWithCache[key])) {
          joinedWithCache[key] = this.replaceItemsWithReferences(queryName, key, joinedWithCache[key]);
        }
      }
      // Write individual objects to cache (e.g. separate object for each single city)
      this.writeToCache(cacheId, joinedWithCache);
      referencesToCache.push(cacheId);
    }
    // Write the array of references to cache (e.g. 'City': ['City-1', 'City-2', 'City-3'...])
    this.writeToCache(queryName, referencesToCache);
  };

};

const quell = new QuellCache(mockSchema, 1000, 1000);
// console.log('query map:  ', quell.queryMap);
// console.log('fields map:  ', quell.fieldsMap);
// console.log('proto:   ', quell.parseAST(parse(mockQuery)));

const fakeDataComplete = {
  'Country': ['Country-1', 'Country-2', 'Country-3', 'Country-4', 'Country-5'],
  'City': ['City-1', 'City-2', 'City-3', 'City-4', 'City-5', 'City-6', 'City-7', 'City-8','City-9', 'City-10'],
  'Country-1': {'id': 1, 'name': 'Andorra', 'capital': 'Andorra la Vella', 'cities': ['City-1', 'City-2']},
  'Country-2': {'id': 2, 'name': 'Bolivia', 'capital': 'Sucre', 'cities': ['City-5', 'City-7']},
  'Country-3': {'id': 3, 'name': 'Armenia', 'capital': 'Yerevan', 'cities': ['City-3', 'City-6']},
  'Country-4': {'id': 4, 'name': 'American Samoa', 'capital': 'Pago Pago', 'cities': ['City-8', 'City-4']},
  'Country-5': {'id': 5, 'name': 'Aruba', 'capital': 'Oranjestad', 'cities': ['City-9', 'City-10']},
  'City-1': {"id": 1, "country_id": 1, "name": "El Tarter", "population": 1052},
  'City-2': {"id": 2,"country_id": 1, "name": "La Massana", "population": 7211},
  'City-3': {"id":3,"country_id":3,"name":"Canillo","population":3292},
  'City-4': {"id":4,"country_id":4,"name":"Andorra la Vella","population":20430},
  'City-5': {"id":5,"country_id":2,"name":"Jorochito","population":4013},
  'City-6': {"id":6,"country_id":3,"name":"Tupiza","population":22233},
  'City-7': {"id":7,"country_id":2,"name":"Puearto Pailas","population":0},
  'City-8': {"id":8,"country_id":4,"name":"Capinota","population":5157},
  'City-9': {"id":9,"country_id":5,"name":"Camargo","population":4715},
  'City-10': {"id":10,"country_id":5,"name":"Villa Serrano","population":0}
};

const fakeDataPartial = {
  'countries': ['Country-1', 'Country-2', 'Country-3', 'Country-4', 'Country-5'],
  'cities': ['City-1', 'City-2', 'City-3', 'City-4', 'City-5', 'City-6', 'City-7', 'City-8','City-9', 'City-10'],
  'Country-1': {'id': 1, 'name': 'Andorra', 'cities': ['City-1', 'City-2']},
  'Country-2': {'id': 2, 'name': 'Bolivia', 'cities': ['City-5', 'City-7']},
  'Country-3': {'id': 3, 'name': 'Armenia', 'cities': ['City-3', 'City-6']},
  'Country-4': {'id': 4, 'name': 'American Samoa', 'cities': ['City-8', 'City-4']},
  'Country-5': {'id': 5, 'name': 'Aruba', 'cities': ['City-9', 'City-10']},
  'City-1': {"id": 1, "country_id": 1, "name": "El Tarter"},
  'City-2': {"id": 2,"country_id": 1, "name": "La Massana"},
  'City-3': {"id":3,"country_id":3,"name":"Canillo"},
  'City-4': {"id":4,"country_id":4,"name":"Andorra la Vella"},
  'City-5': {"id":5,"country_id":2,"name":"Jorochito"},
  'City-6': {"id":6,"country_id":3,"name":"Tupiza"},
  'City-7': {"id":7,"country_id":2,"name":"Puearto Pailas"},
  'City-8': {"id":8,"country_id":4,"name":"Capinota"},
  'City-9': {"id":9,"country_id":5,"name":"Camargo"},
  'City-10': {"id":10,"country_id":5,"name":"Villa Serrano"}
};

const dataFromResolvers = [
  { 'capital': 'Andorra la Vella', 'cities': [{ 'population': 1052 }, { 'population': 7211 }] },
  { 'capital': 'Sucre', 'cities': [{ 'population': 4013 }, { 'population': 5157 }] },
  { 'capital': 'Yerevan', 'cities': [{ 'population': 3292 }, { 'population': 22233 }] },
  { 'capital': 'Pago Pago', 'cities': [{ 'population': 5157 }, { 'population': 20430 }] },
  { 'capital': 'Oranjestad', 'cities': [{ 'population': 4715 }, { 'population': 0 }] }
];

for (const key in fakeDataPartial) {
  dummyCache.set(key, JSON.stringify(fakeDataPartial[key]));
};
console.log(quell.query({body: { query: "{countries{id name capital cities { id name population }}}" }}));
// console.log(quell.query({body: { query: "{countries{id capital cities { id name population }}}" }}));

// const cached = [
//   { name: 'George', id: 1, human: true, friends: [ { name: 'John', human: true }, { name: 'Wesley', human: true }] },
//   { name: 'Luke', id: 2, human: false, friends: [{ name: 'George', human: true }, { name: 'Jim', human: true }] },
// ];

// const uncached = [
//   { hometown: 'Newport', sports: ['hockey', 'lacrosse'], friends: [ { name: 'NoOne', human: true }, { name: 'YouKnow', human: false }, { name: 'NewFriend', human: true }] },
//   { hometown: 'Charleston', sports: ['baseball'] },
// ]

// console.log(quell.joinResponses(cached, uncached)[0].friends);

module.exports = QuellCache;