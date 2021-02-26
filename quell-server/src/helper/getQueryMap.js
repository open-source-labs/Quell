/**
 *  getQueryMap generates a map of queries to GraphQL object types. This mapping is used
 *  to identify and create references to cached data.
 */
function getQueryMap(schema) {
  const queryMap = {};
  // get object containing all root queries defined in the schema
  const queryTypeFields = schema._queryType._fields;
  //console.log('queryTypeFields', queryTypeFields);
  // if queryTypeFields is a function, invoke it to get object with queries
  const queriesObj =
    typeof queryTypeFields === "function" ? queryTypeFields() : queryTypeFields;
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

module.exports = getQueryMap;
