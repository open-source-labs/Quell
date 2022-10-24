const { parse } = require('graphql/language/parser');
const mapGenerator = require('./helpers/mapGenerator');
const {
  lokiClientCache,
  normalizeForLokiCache,
} = require('./helpers/normalizeForLokiCache');
const parseAST = require('./helpers/parseAST');
const updateProtoWithFragment = require('./helpers/updateProtoWithFragments');

// NOTE:
// options feature is currently EXPERIMENTAL (and unused and has not been updated to work with LokiJS) and the intention is to give Quell users the ability to customize cache update policies or to define custom IDs to use as keys when caching data
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

// used to generate Cache IDs to differentiate data in cache
function generateCacheID(queryProto) {
  // if ID field exists, set cache ID to 'fieldType--ID', otherwise just use fieldType
  const cacheID = queryProto.__id
    ? `${queryProto.__type}--${queryProto.__id}`
    : queryProto.__type;

  return cacheID;
}

/**
 * Quellify replaces the need for front-end developers who are using GraphQL to communicate with their servers
 * to write fetch requests. Quell provides caching functionality that a normal fetch request would not provide.
 * Quell syntax is similar to fetch requests and it includes the following:
 *    - accepts a user's endpoint and query string as inputs,
 *    - checks LokiJS storage and constructs a response based on the requested information,
 *    - reformulates a query for any data not in the cache,
 *    - passes the reformulated query to the server to resolve,
 *    - joins the cached and server responses,
 *    - decomposes the server response and caches any additional data, and
 *    - returns the joined response to the user.
 *  @param {string} endPoint - The address to where requests are sent and processed. E.g. '/graphql'. This is also used to generate the maps (via mapGenerator) needed to process the query.
 *  @param {string} query - The graphQL query that is requested from the client
 *  @param {object} userOptions - JavaScript object with customizable properties (note: this feature is still in development, please see defaultOptions for an example)
 */

async function Quellify(endPoint, query, userOptions = {}) {
  // merge defaultOptions with userOptions
  // defaultOptions will supply any necessary options that the user hasn't specified
  const options = { ...defaultOptions, ...userOptions };
  let typeOfOperation = {
    isMutation: false,
    typeOfMutation: '',
  };

  // mapGenerator is used to generate mutationMap, map and queryTypeMap
  const { map, queryTypeMap, mutationMap } = mapGenerator(endPoint);
  console.log('maps generated')

  // iterate over map to create all lowercase map for consistent caching
  for (const props in map) {
    const value = map[props].toLowerCase();
    const key = props.toLowerCase();
    delete map[props]; // avoid duplicate properties
    map[key] = value;
  }

  // Create AST based on the input query using the parse method available in the graphQL library (further reading: https://en.wikipedia.org/wiki/Abstract_syntax_tree)
  console.log('parsing query:', query)
  const AST = parse(query);

  //create proto, operationType, and frags using parseAST
  const { proto, operationType, frags } = parseAST(AST, options);

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
  } else if (operationType === 'mutation') {
    //if operationType is mutation


    // create mutation object using mutationMap and proto created from parseAST;
    typeOfOperation.isMutation = true;
    let mutationObject;

    //loops over the mutation map and checks if our proto ( an object key for every root query in the user's request) has a key that is found in mutation map. we then add that key, value pair into the mutationObject.
    for (let mutation in mutationMap) {
      if (proto.hasOwnProperty(mutation)) mutationObject = proto[mutation];
    }

    //determine the number of args
    let argsLen = Object.keys(mutationObject.__args).length;

    //if it is add mutation (CREATE), do below
    if (
      mutationObject.__type.includes('add') ||
      mutationObject.__type.includes('new') ||
      mutationObject.__type.includes('create') ||
      mutationObject.__type.includes('make')
    ) {
      // add mutation
      const fetchOptions = {
        method: 'POST',
        headers: options.headers,
        body: JSON.stringify({ query: query }),
      };

      // Execute fetch request with original query
      const serverResponse = await fetch(endPoint, fetchOptions);
      const parsedData = await serverResponse.json();

      // Normalize returned data into cache
      normalizeForLokiCache(
        parsedData.data,
        queryTypeMap,
        typeOfOperation,
        map,
        proto
      ); //using lokiJS

      // Return response as a promise
      return new Promise((resolve, reject) => resolve({ data: parsedData }));
    } else {
      // UPDATE or DELETE mutation
      let fetchOptions;
      //update mutation if the number of args is more than one
      typeOfOperation.typeOfMutation = (argsLen === 1) ? 'delete' : 'update';
      fetchOptions = {
        method: 'POST',
        headers: options.headers,
        body: JSON.stringify({ query: query }),
      };

      // Execute fetch request with original query
      const serverResponse = await fetch(endPoint, fetchOptions);
      const parsedData = await serverResponse.json();

      normalizeForLokiCache(
        parsedData.data,
        queryTypeMap,
        typeOfOperation,
        map,
        proto
      );

      // no nomarlizeForLokiCache as query will pull out updated cache from server cache;
      // Return response as a promise
      return new Promise((resolve, reject) => resolve({ data: parsedData }));
    }
  } else {
    // if the request is query
    const prototype =
      Object.keys(frags).length > 0
        ? updateProtoWithFragment(proto, frags)
        : proto;
    const prototypeKeys = Object.keys(prototype);
    let cacheID;
    let specificID;
    let actionQuery;
    for (const typeKey in proto) {
      if (prototypeKeys.includes(typeKey)) {
        cacheID = generateCacheID(prototype[typeKey]);
        specificID = prototype[typeKey].__id;
        actionQuery = typeKey;
      }
    }
 
    //if currField from Cache is an object , go through cache to find the matching value/info
    let dataInLoki = lokiClientCache.find({
      'cacheID.id': `${specificID}`,
    });



    //if currField from Cache is an array , do below logic to get CacheIDArr
    let lokiJS = lokiClientCache.data;
    const cacheIDArr = [],
      cacheArr = [],
      tempArr = [];
    let prevProperty;
    lokiJS.forEach((cachedData) => {
      for (const property in cachedData) {
        if (
          property === 'queryType' &&
          prevProperty === 'cacheKey' &&
          cachedData[property] === cacheID
        ) {
          cacheIDArr.push(cachedData[prevProperty]);
        } else if (
          property === 'queryType' &&
          prevProperty === 'cacheID' &&
          cachedData[property] &&
          cachedData[property] === cacheID
        ) {

          cacheArr.push(cachedData);
        } else {

          prevProperty = property;
        }
      }
    });

    // checking if cache has data before continuing, if the data is not cached, query the database
    if (!cacheIDArr.length > 0 || !dataInLoki.length > 0) {
      const fetchOptions = {
        method: 'POST',
        headers: options.headers,
        body: JSON.stringify({ query: query }),
      };
      // Execute fetch request with original query
      const serverResponse = await fetch(endPoint, fetchOptions);
      const parsedData = await serverResponse.json();
      normalizeForLokiCache(
        parsedData.data,
        queryTypeMap,
        typeOfOperation,
        map,
        proto
      );

      // Return response as a promise
      return new Promise((resolve, reject) => resolve({ data: parsedData }));
    }
    // SERVERSIDE: if cache has data, iterate through the data and create a cache object
    if (cacheIDArr.length > 0) {
      cacheIDArr.forEach((ID) => {
        let idx = 0;
        cacheArr.forEach((cached) => {
          for (const property in cached) {
            if (property === 'id' && cached[property] === ID[idx])
              tempArr.push(cached);
          }
          idx += 1;
        });
      });

      const cacheResponse = Object.assign({}, tempArr);

      return new Promise((resolve, reject) => resolve(cacheResponse));
    }
    // CLIENTSIDE: if cache has data, iterate through the data and create a cache object
    if (dataInLoki.length > 0) {
      let cacheInfo = dataInLoki[0]['cacheID'];
      let info = { [`${actionQuery}`]: cacheInfo };
      let obj = { data: { data: info } };

      return new Promise((resolve, reject) => resolve(obj));
    }
  }
}

module.exports = { Quellify, lokiClientCache, mapGenerator };