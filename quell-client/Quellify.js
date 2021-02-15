const { parse } = require('graphql/language/parser');
const parseAST = require('./helpers/parseAST');
const normalizeForCache = require('./helpers/normalizeForCache');
const buildArray = require('./helpers/buildArray');
const createQueryObj = require('./helpers/createQueryObj');
const createQueryStr = require('./helpers/createQueryStr');
const joinResponses = require('./helpers/joinResponses');

// NOTE:
// Map: Query to Object Types map - Get from server or user provided (check introspection)
// Fields Map:  Fields to Object Type map (possibly combine with this.map from server-side)

// MAIN CONTROLLER
async function Quellify(endPoint, query, map, fieldsMap) {
  // Create AST of query
  const AST = parse(query);
  console.log('AST ===> ', AST);
  // Create object of "true" values from AST tree (w/ some eventually updated to "false" via buildItem())
  const proto = parseAST(AST);

  // pass-through for queries and operations that QuellCache cannot handle
  if (proto === 'unQuellable') {
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: query }),
    };

    // Execute fetch request with original query
    const responseFromFetch = await fetch(endPoint, fetchOptions);
    const parsedData = await responseFromFetch.json();

    // Return response as a promise
    return new Promise((resolve, reject) => resolve(parsedData));
  } else {
    let protoArgs = null;
    for (let query in proto) {
      if (proto[query].arguments) {
        protoArgs = proto[query].arguments;
      }
    }
    // Check cache for data and build array from that cached data
    const responseFromCache = buildArray(proto, map);
    console.log('responseFromCache ===> ', responseFromCache);
    // If no data in cache, the response array will be empty:
    if (responseFromCache.length === 0) {
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query }),
      };

      // Execute fetch request with original query
      const responseFromFetch = await fetch(endPoint, fetchOptions);
      console.log('responseFromFetch !!!!!', responseFromFetch);
      const parsedData = await responseFromFetch.json();
      console.log('parsedData !!!!!', parsedData);
      // Normalize returned data into cache
      normalizeForCache(parsedData.data, map, fieldsMap);

      // Return response as a promise
      return new Promise((resolve, reject) => resolve(parsedData));
    }

    // If found data in cache:
    let mergedResponse;
    console.log(
      'proto after buildArray ===> ',
      JSON.parse(JSON.stringify(proto))
    );
    const queryObject = createQueryObj(proto); // Create query object from only false proto fields
    console.log('queryObject in Quellify ===> ', queryObject);
    const queryName = Object.keys(proto)[0];

    // Partial data in cache:  (i.e. keys in queryObject will exist)
    if (Object.keys(queryObject).length > 0) {
      const newQuery = createQueryStr(queryObject, protoArgs); // Create formal GQL query string from query object
      console.log('newQuery ===> ', newQuery);
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: newQuery }),
      };

      // Execute fetch request with new query
      const responseFromFetch = await fetch(endPoint, fetchOptions);
      const parsedData = await responseFromFetch.json();
      console.log('parsedData ===> ', parsedData);
      const parsedResponseFromFetch = Array.isArray(parsedData.data[queryName])
        ? parsedData.data[queryName]
        : [parsedData.data[queryName]];

      // Stitch together cached response and the newly fetched data and assign to variable
      mergedResponse = joinResponses(
        responseFromCache,
        parsedResponseFromFetch,
        proto
      );
    } else {
      mergedResponse = responseFromCache; // If everything needed was already in cache, only assign cached response to variable
    }

    console.log('mergedResponse ===> ', mergedResponse);

    const formattedMergedResponse = { data: { [queryName]: mergedResponse } };
    console.log('formattedMergedResponse ===> ', formattedMergedResponse);
    // Cache newly stitched response
    normalizeForCache(formattedMergedResponse.data, map, fieldsMap);

    // Return formattedMergedResponse as a promise
    return new Promise((resolve, reject) => resolve(formattedMergedResponse));
  }
}

module.exports = Quellify;
