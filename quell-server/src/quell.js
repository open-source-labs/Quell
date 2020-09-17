const mockSchema = require('./mockSchema')

class QuellCache {
  constructor (schema, redisPort, cacheExpiration = 1000) {
    this.schema = schema;
    this.queryMap = this.getQueryMap(schema);
    this.fieldsMap = this.getFieldsMap(schema);
    this.redisPort = redisPort;
    this.cacheExpiration = cacheExpiration

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
  }
};