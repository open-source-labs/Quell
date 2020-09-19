/**
 * CONNECTING TO REDIS SERVER:
 * I need to research this more. For now, I'm going to create a cache object to 
 * serve as a dummy cache. I'll need to replace those parts with the actual commands 
 * to read from and write to the redis cache.
 * The trunQ approach: they require in redis library and create a client.
 */

function dummyCache() {
  this.cache = {};
};

dummyCache.prototype.get = (key) => {
  return this.cache[key];
};

dummyCache.prototype.set = (key, value) => {
  this.cache[key] = value;
};

const mockSchema = require('./mockSchema');
const mockQuery = require('./mockQuery');
const { parse } = require('graphql/language/parser');
const { visit } = require('graphql/language/visitor');

class QuellCache {
  constructor (schema, redisPort, cacheExpiration = 1000) {
    this.schema = schema;
    this.queryMap = this.getQueryMap(schema);
    this.fieldsMap = this.getFieldsMap(schema);
    this.redisPort = redisPort;
    this.cacheExpiration = cacheExpiration

  }

  
  async query(req, res, next) {
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
    const queriedCollection = this.map[queryName];

    // build response from cache
    const responseFromCache = this.buildFromCache(proto, this.queryMap, queriedCollection);

    return proto;
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
  
  toggleFields(proto) {
    for (const key in proto) {
      if (Object.keys(proto[key]) > 0) this.toggleFields(proto[key]);
      proto[key] = false;
    }
  };
  
  buildFromCache(proto, map, queriedCollection, collection) {
    const response = [];

    for (const superField in prototype) {
      if (!collection) collection = JSON.parse(dummyCache.get(map[superField])) || [];
      if (collection.length === 0) this.toggleFields(proto);
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
        const protoAtKey = { [key]: prototype[key] };
        nodeObject[key] = buildArray(protoAtKey, fieldsMap, item[key])
      } else if (proto[key]) {
        if (item[key] !== undefined) nodeObject[key] = item[key];
        else proto[key] = false;
      }
    };

    return nodeObject;
  };
};

const quell = new QuellCache(mockSchema, 1000, 1000);
// console.log('query map:  ', quell.queryMap);
// console.log('fields map:  ', quell.fieldsMap);
// console.log('proto:   ', quell.parseAST(parse(mockQuery)));
console.log(quell.query({body: { query: "query { countries: { name id cities { name }}" }}));


module.exports = QuellCache;