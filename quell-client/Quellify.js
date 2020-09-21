const { parse } = require('graphql/language/parser');
const { visit } = require('graphql/language/visitor');
const parseAST = require('./parseAST');
const normalizeForCache = require('./normalizeForCache');
const buildArray = require('./buildArray');
const createQueryObj = require('./createQueryObj');
const createQueryStr = require('./createQueryStr');
const joinResponses = require('./joinResponses');

// NOTE:
// Map: Query to Object Types map - Get from server or user provided (check introspection)
// Fields Map:  Fields to Object Type map (possibly combine with this.map from server-side)

// MAIN CONTROLLER
async function Quellify(endPoint, query, map, fieldsMap) {
  // Create AST of query
  const AST = parse(query);
  // Create object of "true" values from AST tree (w/ some eventually updated to "false" via buildItem())
  const proto = parseAST(AST);
  // Copy of proto object to pass into joinResponses():
  let joinProto;
  for (let query in proto) {
    joinProto = { ...proto[query] };
  }

  // Check cache for data and build array from that cached data
  const responseFromCache = buildArray(proto, map) // returns e.g. [{name: 'Bobby'}, {id: '2'}]

  // If no data in cache, the response array will be empty:
  if (responseFromCache.length === 0) {

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: query })
    };

    // Execute fetch request with original query
    const responseFromFetch = await fetch(endPoint, fetchOptions);
    const parsedData = await responseFromFetch.json();
    // Normalize returned data into cache
    normalizeForCache(parsedData.data, map, fieldsMap);

    // Return response as a promise
    return new Promise((resolve, reject) => resolve(parsedData));
  }

  // If all data in cache:
  let mergedResponse;
  const queryObject = createQueryObj(proto); // Create query object from only false proto fields
  const queryName = Object.keys(proto)[0];

  // Partial data in cache:  (i.e. keys in queryObject will exist)
  if (Object.keys(queryObject).length > 0) {

    const newQuery = createQueryStr(queryObject); // Create formal GQL query string from query object
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: newQuery })
    };

    // Execute fetch request with new query
    const responseFromFetch = await fetch(endPoint, fetchOptions);
    const parsedData = await responseFromFetch.json();


    // Stitch together cached response and the newly fetched data and assign to variable
    mergedResponse = joinResponses(responseFromCache, parsedData.data[queryName], joinProto);

  } else {
    mergedResponse = responseFromCache; // If everything needed was already in cache, only assign cached response to variable
  }

  const formattedMergedResponse = { data: { [queryName]: mergedResponse } };
  // Cache newly stitched response
  normalizeForCache(formattedMergedResponse.data, map, fieldsMap);

  // Return formattedMergedResponse as a promise
  return new Promise((resolve, reject) => resolve(formattedMergedResponse));
}

module.exports = Quellify;
