const { parse } = require('graphql/language/parser');
const parseAST = require('./helpers/parseAST');
const normalizeForCache = require('./helpers/normalizeForCache');
const buildFromCache = require('./helpers/buildFromCache');
const createQueryObj = require('./helpers/createQueryObj');
const createQueryStr = require('./helpers/createQueryStr');
const joinResponses = require('./helpers/joinResponses');

// NOTE:
// Map: Query to Object Types map - Get from server or user provided (check introspection)
// Fields Map:  Fields to Object Type map (possibly combine with this.map from server-side)

// MAIN CONTROLLER
async function Quellify(endPoint, query, map, fieldsMap) {
  // Create QuellStore object to keep track of arguments, aliases, fragments, variables, or directives
  const QuellStore = { arguments: null, alias: null };

  // Create AST of query
  const AST = parse(query);

  // Create object of "true" values from AST tree (w/ some eventually updated to "false" via buildItem())
  let {prototype, protoArgs, operationType} = parseAST(AST, QuellStore);

  // pass-through for queries and operations that QuellCache cannot handle
  if (operationType === 'unQuellable') {
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
    // Check cache for data and build array from that cached data
    const responseFromCache = buildFromCache(prototype, map, null, QuellStore);
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
      const parsedData = await responseFromFetch.json();
      // Normalize returned data into cache
      normalizeForCache(parsedData.data, map, fieldsMap, QuellStore);

      // Return response as a promise
      return new Promise((resolve, reject) => resolve(parsedData));
    }

    // If found data in cache:
    let mergedResponse;
    const queryObject = createQueryObj(prototype); // Create query object from only false prototype fields
    const queryName = Object.keys(prototype)[0];

    // Partial data in cache:  (i.e. keys in queryObject will exist)
    if (Object.keys(queryObject).length > 0) {
      const newQuery = createQueryStr(queryObject, QuellStore); // Create formal GQL query string from query object
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
      const parsedResponseFromFetch = Array.isArray(parsedData.data[queryName])
        ? parsedData.data[queryName]
        : [parsedData.data[queryName]];

      // Stitch together cached response and the newly fetched data and assign to variable
      mergedResponse = joinResponses(
        responseFromCache,
        parsedResponseFromFetch,
        prototype
      );
    } else {
      mergedResponse = responseFromCache; // If everything needed was already in cache, only assign cached response to variable
    }

    // If everything needed was already in cache, only assign cached response to variable
    if (QuellStore.arguments && !QuellStore.alias) {
      if (mergedResponse.length === 1) {
        mergedResponse = mergedResponse[0];
      }
    } else if (QuellStore.arguments && QuellStore.alias) {
      newMergedReponse = {};
      mergedResponse.forEach(
        (e) => (newMergedReponse[Object.keys(e)[0]] = e[Object.keys(e)[0]])
      );
      mergedResponse = newMergedReponse;
    } else {
      mergedResponse = mergedResponse;
    }

    const formattedMergedResponse = QuellStore.alias
      ? { data: mergedResponse }
      : { data: { [queryName]: mergedResponse } };

    // Cache newly stitched response
    normalizeForCache(formattedMergedResponse.data, map, fieldsMap, QuellStore);

    // Return formattedMergedResponse as a promise
    return new Promise((resolve, reject) => resolve(formattedMergedResponse));
  }
}

module.exports = Quellify;
