//### DELETE ###
//whole file? Can't find where this is used or why.

const { lokiClientCache } = require("./normalizeForLokiCache");

/* 
buildFromCache - iterates through the output of parseAST (which is an object) and 
checks the cache for each field in a query. If a field is NOT found in cache 
then that field will be toggled to false so that the next function knows to create a query string 
for that field so that it can be fetched from the server. If a field is found in the cache, 
then that data is saved in a __object and 

Inputs
  @prototype - object representation of a user's query after passing through parseAST
  e.g. samplePrototype = {
      country: {
        id: true,
        name: true,
        __alias: null,
        __args: { id: '1' },
        }
      };
  @itemFromCache - object that defaults to an empty object and is used to hold values from the cache that are found for each field
  @firstRun - boolean that defaults to true when iterating through a typeKey (i.e. country--1) and toggles to false when iterating through a nested query
----
Outputs
  @responseFromCache - object representation of the relevant data extract from cache  
----
Side effects
  @prototype - object representation of the input query with each field updated, whether it was found in cache (true) or not (false)
----
*/
function buildFromCache(prototype, prototypeKeys, itemFromCache = {}, firstRun = true, subID) {

  for (let typeKey in prototype) {

    // check if typeKey is a rootQuery (i.e. if it is a type on the prototype object) or if its a field nested in a query
    if (prototypeKeys.includes(typeKey)) {
      const cacheID = subID ? subID : generateCacheID(prototype[typeKey]);
      

      // check if cacheID exists in the lokiJS - meaning the data was already cached - and set it to cacheResponse
      // create a property on itemFromCache and set the value to the fetched response from cache
      // const cacheResponse = lokiClientCache.find(cacheID);
      const cacheResponse = Object.assign({}, lokiClientCache.find(cacheID));

      //### DELETE ### ? This appears to be unused, perhaps from session storage?
      // documentation for sesisonStorage: if data for the current typeKey is not found in sessionStorage 
      //then we receive null. Need to replace null with empty object
      // itemFromCache[typeKey] = cacheResponse ? JSON.parse(cacheResponse) : {};

      // create a property on itemFromCache and set the value to the fetched response from cache
      // documentation for lokiClientCache: if data for the current typeKey is not found in sessionStorage 
      //then we receive null. Need to replace null with empty object
      itemFromCache[typeKey] = cacheResponse ? cacheResponse : {};
      // need to check cacheResponse to see if each field was requested in proto
    }

    if (Array.isArray(itemFromCache[typeKey])) {
      for (let i = 0; i < itemFromCache[typeKey].length; i++) {
        const currTypeKey = itemFromCache[typeKey][i];
        const cacheResponse = lokiClientCache.find(currTypeKey.queryType);
        // old code for sessionStorage
        // const cacheResponse = sessionStorage.getItem(currTypeKey); (code for sessionStorage)
        let tempObj = {};
        if (cacheResponse) {
          const interimCache = cacheResponse;
          // const interimCache = JSON.parse(cacheResponse); (code for sessionStorage)
          for (const property in prototype[typeKey]) {
            if (
              interimCache.hasOwnProperty(property) &&
              !property.includes('__')
            ) {
              tempObj[property] = interimCache[property];
            } else if (
              !property.includes('__') &&
              typeof prototype[typeKey][property] == 'object'
            ) {
              // if the property in prototpye is a nested object and is not a property with __, then recurse
              const tempData = buildFromCache(
                prototype[typeKey][property],
                prototypeKeys,
                {},
                false,
                `${currTypeKey}--${property}`
              );
              tempObj[property] = tempData.data;
            } else if (
              !property.includes('__') &&
              typeof prototype[typeKey][property] !== 'object'
            ) {
              // if interimCache does not have property, set to false on prototype so it is fetched
              prototype[typeKey][property] = false;
            }
          }
          itemFromCache[typeKey][i] = tempObj;
        } else {
          for (const property in prototype[typeKey]) {
            // if interimCache has the property
            if (
              !property.includes('__') &&
              typeof prototype[typeKey][property] !== 'object'
            ) {
              // if interimCache does not have property, set to false on prototype so it is fetched
              prototype[typeKey][property] = false;
            }
          }
        }
      }
    }
    // if itemFromCache is empty, then check the cache for data, else, persist itemFromCache
    // if this iteration is a nested query (i.e. if typeKey is a field in the query)
    else if (firstRun === false) {
      // if this field is NOT in the cache, then set this field's value to false
      if (
        (itemFromCache === null || !itemFromCache.hasOwnProperty(typeKey)) &&
        typeof prototype[typeKey] !== 'object' &&
        !typeKey.includes('__')
      ) {
        prototype[typeKey] = false;
      }
      // if this field is a nested query, then recurse the buildFromCache function and iterate through the nested query
      if (
        // change: removed the first 2 rules of logic
        // (itemFromCache === null || itemFromCache.hasOwnProperty(typeKey)) &&
        !typeKey.includes('__') && // do not iterate through __args or __alias
        typeof prototype[typeKey] === 'object'
      ) {
        // change: making another call to the cache? WHy?
        const cacheID = generateCacheID(prototype);
        // const cacheResponse = sessionStorage.getItem(cacheID); // code for sessionstorage
        const cacheResponse = lokiClientCache.find(cacheID);
        // if (cacheResponse) itemFromCache[typeKey] = JSON.parse(cacheResponse); (code for sessionstorage)
        if (cacheResponse) itemFromCache[typeKey] = cacheResponse; //code for lokiClientCache
        // repeat function inside of the nested query
        buildFromCache(
          prototype[typeKey],
          prototypeKeys,
          itemFromCache[typeKey] || {},
          false
        );
      }
    }
    // if the current element is not a nested query, then iterate through every field on the typeKey
    else {
      for (let field in prototype[typeKey]) {
        // if itemFromCache[typeKey] === false then break

        if (
          // if field is not found in cache then toggle to false
          itemFromCache[typeKey] &&
          !itemFromCache[typeKey].hasOwnProperty(field) &&
          !field.includes('__') && // ignore __alias and __args
          typeof prototype[typeKey][field] !== 'object'
        ) {
          prototype[typeKey][field] = false;
        }

        if (
          // if field contains a nested query, then recurse the function and iterate through the nested query
          // change remove requirement that itemFromCache has own property tpyekey
          !field.includes('__') &&
          typeof prototype[typeKey][field] === 'object'
        ) {
          // change: pass and empty object instead of itemFromCache
          buildFromCache(
            prototype[typeKey][field],
            prototypeKeys,
            itemFromCache[typeKey][field] || {},
            false
          );
        } else if (
          !itemFromCache[typeKey] &&
          !field.includes('__') &&
          typeof prototype[typeKey][field] !== 'object'
        ) {
          // then toggle to false
          prototype[typeKey][field] = false;
        }
      }
    }
  }
  // assign the value of an object with a key of data and a value of itemFromCache and return
  return { data: itemFromCache };
}

// helper function to take in queryProto and generate a cacheID from it
function generateCacheID(queryProto) {
  // if ID field exists, set cache ID to 'fieldType--ID', otherwise just use fieldType
  const cacheID = queryProto.__id
    ? `${queryProto.__type}--${queryProto.__id}`
    : queryProto.__type;

  return cacheID;
}

module.exports = { buildFromCache, generateCacheID };
