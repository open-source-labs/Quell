const { parse } = require('graphql/language/parser');
const parseAST = require('./helpers/parseAST');
const normalizeForCache = require('./helpers/normalizeForCache');
const buildFromCache = require('./helpers/buildFromCache');
const createQueryObj = require('./helpers/createQueryObj');
const createQueryStr = require('./helpers/createQueryStr');
const joinResponses = require('./helpers/joinResponses');

// NOTE:
// Map: Query to Object Types map - Get from server or user provided (check introspection)
// https://graphql.org/learn/introspection/
// Fields Map:  Fields to Object Type map (possibly combine with this.map from server-side)

// TO-DO: error handling from graphQL? currently gets lost in formatting
// TO-DO: expand defaultOptions feature

// NOTE: 
// options feature is currently EXPERIMENTAL
// keys beginning with __ are set aside for future development
// defaultOptions provides default configurations so users only have to supply options they want control over
const defaultOptions = {
  // default time that data stays in cache before expires
  __defaultCacheTime: 600,
  // configures type of cache storage used (client-side only)
  __cacheType: 'session',
  // custom field that defines the uniqueID used for caching
  __userDefinedID: null,
  // default fetchHeaders, user can overwrite
  __fetchHeaders: {
    'Content-Type': 'application/json',
  },
};

// MAIN CONTROLLER
async function Quellify(endPoint, query, map, fieldsMap, userOptions) {
  // merge defaultOptions with userOptions
  // defaultOptions will supply any necessary options that the user hasn't specified
  const options = { ...defaultOptions, ...userOptions };

  // Create AST of query
  const AST = parse(query);

  // Create object of "true" values from AST tree (w/ some eventually updated to "false" via buildItem())
  const { prototype, operationType } = parseAST(AST, options);

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
    // const responseFromFetch = await fetch(endPoint, fetchOptions);
    const parsedData = await responseFromFetch.json();
    // Return response as a promise
    return new Promise((resolve, reject) => resolve(parsedData));
  } else {
    // if it is "quellable"
    // Check cache for data and build array from that cached data

    // TO-DO: check output of buildFromCache
    // may need to store as const response = { data: buildFromCache(prototype, prototypeKeys) }
    // TO-DO: refactor buildFromCache to no longer require prototypeKeys as input
    const prototypeKeys = Object.keys(prototype);
    const responseFromCache = buildFromCache(prototype, prototypeKeys);
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
      normalizeForCache(parsedData.data, map, fieldsMap);

      // Return response as a promise
      return new Promise((resolve, reject) => resolve(parsedData));
    };

    // If found data in cache:
    // Create query object from only false prototype fields
    let mergedResponse;
    const queryObject = createQueryObj(prototype);

    // Partial data in cache:  (i.e. keys in queryObject will exist)
    if (Object.keys(queryObject).length > 0) {
      // Create formal GQL query string from query object
      const newQuery = createQueryStr(queryObject); 
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


      // NOTE: trying this commented out, 
      // // TO-DO: queryName restricts our cache to just the first query
      // const queryName = Object.keys(prototype)[0];

      // // TO-DO: why put it into an array?
      // const parsedResponseFromFetch = Array.isArray(parsedData.data[queryName])
      //   ? parsedData.data[queryName]
      //   : [parsedData.data[queryName]];

      // TO-DO: look at joinResponses
      // Stitch together cached response and the newly fetched data and assign to variable
      mergedResponse = {
        data: joinResponses(
          responseFromCache,
          parsedResponseFromFetch,
          prototype
        )
      }
    } else {
      // If everything needed was already in cache, only assign cached response to variable
      mergedResponse = responseFromCache;
    }

    // TO-DO: legacy code, commented out for now, I believe it is deprecated but don't want to get rid of it until we have done further testing
    // commented out because I don't think it matters at all
    // prep mergedResponse to store in the cache
    // merged response should already factor in joinResponses
    // if (QuellStore.arguments && !QuellStore.alias) {
    //   // if response is just one, set it to merged response?
    //   if (mergedResponse.length === 1) {
    //     mergedResponse = mergedResponse[0];
    //   }
    // } else if (QuellStore.arguments && QuellStore.alias) {
    //   // ???
    //   newMergedReponse = {};
    //   mergedResponse.forEach(
    //     (e) => (newMergedReponse[Object.keys(e)[0]] = e[Object.keys(e)[0]])
    //   );
    //   mergedResponse = newMergedReponse;
    // } else {
    //   mergedResponse = mergedResponse;
    // }

    // // TO-DO: this step should be unnecessary with current system
    // const formattedMergedResponse = QuellStore.alias
    //   ? { data: mergedResponse }
    //   : { data: { [queryName]: mergedResponse } };

    // cache the response
    normalizeForCache(mergedResponse.data, map, fieldsMap);

    // Return formattedMergedResponse as a promise
    return new Promise((resolve, reject) => resolve(mergedResponse));
  }
};

module.exports = Quellify;
