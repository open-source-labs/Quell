const RootQuery = require('./getTypeMap')

class QuellCache {
  constructor (schema, redisPort, cacheExpiration = 1000) {
    this.schema = schema;
    this.queryMap = {};
    this.redisPort = redisPort;
    this.cacheExpiration = cacheExpiration

  }

  getQueryMap() {
    // get object containing all root queries defined in the schema
    const queryTypeFields = this.schema._queryType._fields;
    // if queryTypeFields is a function, invoke it to get object with queries
    const queriesObj = (typeof queryTypeFields === 'function') ? queryTypeFields() : queryTypeFields;
    
    for (const query in queriesObj) {
      // get name of GraphQL type returned by query
      const returnedType = queriesObj[query].type.name || queriesObj[query].type.ofType.name
      this.queryMap[query] = returnedType;
    }
  };
};

const quell = new QuellCache(RootQuery, 5479);
quell.getQueryMap();
console.log(quell.queryMap);
// console.log(RootQuery._queryType._fields)
