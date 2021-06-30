const { parse } = require('graphql/language/parser');
const parseAST = require('./helpers/parseAST');
const normalizeForCache = require('./helpers/normalizeForCache');
const buildFromCache = require('./helpers/buildFromCache');
const createQueryObj = require('./helpers/createQueryObj');
const createQueryStr = require('./helpers/createQueryStr');
const joinResponses = require('./helpers/joinResponses');
const updateProtoWithFragment = require('./helpers/updateProtoWithFragments');

// NOTE:
// Map: Query to Object Types map - Get from server or user provided (check introspection)
// https://graphql.org/learn/introspection/
// Fields Map:  Fields to Object Type map (possibly combine with this.map from server-side)

// NOTE: 
// options feature is currently EXPERIMENTAL and the intention is to give Quell users the ability to customize cache update policies or to define custom IDs to use as keys when caching data
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
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Quellify replaces the need for front-end developers who are using GraphQL to communicate with their servers to write fetch requests. Quell provides caching functionality that a normal fetch request would not provide. Quell syntax is similar to fetch requests and it includes the following:
 *    - accepts a user's endpoint and query string as inputs,
 *    - checks sessionStorage and constructs a response based on the requested information,
 *    - reformulates a query for any data not in the cache,
 *    - passes the reformulated query to the server to resolve,
 *    - joins the cached and server responses,
 *    - decomposes the server response and caches any additional data, and
 *    - returns the joined response to the user.
 *  @param {string} endPoint - The address to where requests are sent and processed. E.g. '/graphql'  
 *  @param {string} query - The graphQL query that is requested from the client
 *  @param {object} map - JavaScript object with a key-value pair for every valid root query - type defined in the user's GraphQL schema  
 *  @param {object} userOptions - JavaScript object with customizable properties (note: this feature is still in development, please see defaultOptions for an example)
 *  @param {object} fieldsMap - JavaScript object with ..... (nothing?)
 */

async function Quellify(endPoint, query, map, userOptions, fieldsMap) {
  // merge defaultOptions with userOptions
  // defaultOptions will supply any necessary options that the user hasn't specified
  const options = { ...defaultOptions, ...userOptions };

  // iterate over map to create all lowercase map for consistent caching
  for (const props in map) {
    const value = map[props].toLowerCase();
    const key = props.toLowerCase();
    delete map[props]; // avoid duplicate properties
    map[key] = value;
  }

  // Create AST based on the input query using the parse method available in the graphQL library (further reading: https://en.wikipedia.org/wiki/Abstract_syntax_tree)
  const AST = parse(query);

  /**
   * parseAST creates a proto object that contains a key for every root query in the user's request and every root query key contains keys for every field requested on that root query and assigns it the value of "true". The proto object also carries the following details for every root query 
   *    __args - arguments the user passed into the query (null if no arguments were given)
   *    __alias - alias the user included in the query (null if no arguments were given)
   *    __type - the type of root query as defined in the GraphQL schema, which could also be found in the map object passed into Quellify
   *    __id - 
   * parAST also creates an operationType that will evaluate to 'unQuellable' if the request is out-of-scope for caching (please see usage notes in the Readme.md for more details) and 
   *  @param {object} AST - The address to where requests are sent and processed. E.g. '/graphql'  
   *  @param {object} options - The graphQL query that is requested from the client
   */

  const { proto, operationType, frags } = parseAST(AST, options);
  console.log('after parsing the AST, the proto is ', proto, ' and the frags are', frags, 'and the oepration type is ', operationType);

  // pass-through for queries and operations that QuellCache cannot handle
  if (operationType === 'unQuellable') {
    const fetchOptions = {
      method: 'POST',
      headers: options.headers,
      body: JSON.stringify({ query: query }),
    };

    // Execute fetch request with original query
    const serverResponse = await fetch(endPoint, fetchOptions);
    const parsedData = await serverResponse.json();
    // Return response as a promise
    return new Promise((resolve, reject) => resolve(parsedData));
  } else {
    // if the request is "quellable"
    const prototype = Object.keys(frags).length > 0 ? updateProtoWithFragment(proto, frags) : proto;
    // Check cache for data and build array from that cached data
    // TO-DO: check output of buildFromCache
    // may need to store as const response = { data: buildFromCache(prototype, prototypeKeys) }
    // TO-DO: refactor buildFromCache to no longer require prototypeKeys as input
    const prototypeKeys = Object.keys(prototype);
    const cacheResponse = buildFromCache(prototype, prototypeKeys);
    console.log('after building from cache, the cache response is ', cacheResponse);
    console.log("In Quellify, this is prototype after buildFromCache: ", prototype);
    // initialize a cacheHasData to false
    let cacheHasData = false;
    // If no data in cache, the response array will be empty:
    for (const key in cacheResponse.data) {
      // if the current element does have more than 1 key on it, then set cacheHas Datat tot true and break
      if (Object.keys(cacheResponse.data[key]).length > 0) {
        console.log(cacheHasData);
        cacheHasData = true;
        // break;
      }
    }
    if (!cacheHasData) {
      const fetchOptions = {
        method: 'POST',
        headers: options.headers,
        body: JSON.stringify({ query: query }),
      };
      console.log('query is ', query,  ' and the end point', endPoint);
      // Execute fetch request with original query
      const serverResponse = await fetch(endPoint, fetchOptions);
      const parsedData = await serverResponse.json();
      console.log('response from the server is ', parsedData);
      // Normalize returned data into cache
      // console.log('prototype before normalize for cache is ', prototype)
      normalizeForCache(parsedData.data, map, prototype);
      // console.log('after normizing for cache, the parsed data are ', parsedData);

      // Return response as a promise
      return new Promise((resolve, reject) => resolve({ data: parsedData }));
    };

    // If found data in cache:
    // Create query object from only false prototype fields
    console.log('DATA FOUND IN CACHE BLOCK');
    let mergedResponse;
    const queryObject = createQueryObj(prototype);

    console.log('query object is ', queryObject);

    // Partial data in cache:  (i.e. keys in queryObject will exist)
    if (Object.keys(queryObject).length > 0) {
      // Create formal GQL query string from query object
      const newQuery = createQueryStr(queryObject); 
      console.log('new Query is ', newQuery);
      const fetchOptions = {
        method: 'POST',
        headers: options.headers,
        body: JSON.stringify({ query: newQuery }),
      };
      // Execute fetch request with new query
      const serverResponse = await fetch(endPoint, fetchOptions);
      const parsedData = await serverResponse.json();
      // console.log('after generating a new query, the server response is ', serverResponse);

      if (parsedData.hasOwnProperty('error')) {
        return next('graphql library error', parsedData.error);
      }

      // NOTE: trying this commented out, 
      // // TO-DO: queryName restricts our cache to just the first query
      // const queryName = Object.keys(prototype)[0];

      // // TO-DO: why put it into an array?
      // const parsedserverResponse = Array.isArray(parsedData.data[queryName])
      //   ? parsedData.data[queryName]
      //   : [parsedData.data[queryName]];

      // TO-DO: look at joinResponses
      // Stitch together cached response and the newly fetched data and assign to variable
      mergedResponse = {
        data: joinResponses(
          cacheResponse,
          parsedData,
          prototype
        )
      }
      // cache the response
      normalizeForCache(mergedResponse.data, map, prototype);
      // console.log('after normalzizing for cache, the merged response is', mergedResponse);
    } else {
      // If everything needed was already in cache, only assign cached response to variable
      mergedResponse = cacheResponse;
    }
    // console.log('after merging the cache and server responses,the merged data are ', mergedResponse);

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
    // Return formattedMergedResponse as a promise
    return new Promise((resolve, reject) => resolve(mergedResponse));
  }
};

module.exports = Quellify;
