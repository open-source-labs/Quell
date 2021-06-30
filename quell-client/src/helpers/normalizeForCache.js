/**
 normalizeForCache traverses server response data and creates objects out of responses for cache. Furthermore, it identifies fields that are 'object types' then replaces those array elements with references (helper), creates separate normalized objectes out of replaced elements, and saves all to cache (helper) with unique identifiers (helper)
 */

// TO-DO: update with new style of parseAST, buildFromCache, etc.
//  response data examples
/* 
{
  "data": {
    "USA": {
      "id": "1",
      "name": "Andorra"
    },
    "country": {
      "id": "2",
      "name": "Bolivia"
    }
  }
}

{
  "data": {
    "countries": [
      {
        "id": "1",
        "name": "Andorra"
      },
      {
        "id": "2",
        "name": "Bolivia"
      }
    ]
  }
}

{
  data: {},
  error: {}
}
*/

// const sampleMap = {
//   countries: 'Country',
//   country: 'Country',
//   citiesByCountryId: 'City',
//   cities: 'City',
// }

// const sampleFieldsMap = {
//   cities: 'City'
// }

// TO-DO: check cache format
// do we store nested values or do we store REFs to values
// { id: 1, name: Andorra, cities: [city--1, city--2] }

/** Iterates & recurses over response object & preps data to be sent to cache
 * and sends data to cache
 * responseData: the data from the graphQL response object
 * map: a map of graphQL fields to their corresponding graphQL Types, 
 *   necessary for cache consistency
 * fieldsMap: potentially deprecated?
 * protoField: the prototype object, or a section of the prototype object, 
 *   for accessing arguments, aliases, etc.
 */

// TO-DO: check if error object exists and then break out of function to avoid caching bad data?
// TO-DO: handle caching errors
// TO-DO: handle async/await
// TO-DO: have cache MERGE data before adding to cache to not overwrite data

function normalizeForCache(responseData, map = {}, protoField, subID, fieldsMap = {}) {
  // if we are recursing, we want to add a subid before caching

  // iterate over keys in our response data object 
  console.log('inputs to normalize for cache are responseData', responseData);
  console.log(' and prototype is', protoField);
  for (const resultName in responseData) {
    // currentField we are iterating over & corresponding Prototype
    const currField = responseData[resultName];
    const currProto = protoField[resultName];
    console.log('current field in response is ', currField); 
    console.log('current proto is ', currProto);
    // check if the value stored at that key is array 
    if (Array.isArray(currField)) {
      // RIGHT NOW: countries: [{}, {}]
      // GOAL: countries: ["Country--1", "Country--2"]
      const cacheKey = subID ? subID + '--' + resultName : resultName
      // create empty array to store refs
      // ie countries: ["country--1", "country--2"]
      const refList = [];

      // iterate over countries array
      for (let i = 0; i < currField.length; i++) {
        const el = currField[i];
        // el1 = {id: 1, name: Andorra}, el2 =  {id: 2, name: Bolivia}
        // for each object
        // "resultName" is key on "map" for our Data Type
        const dataType = map[resultName];

        // grab ID from object we are iterating over
        let fieldID = dataType;

        for (const key in el) {
          // if key is an ID, append to fieldID for caching
          if (key === 'id' || key === '_id' || key === 'ID' || key === 'Id') {
            fieldID += `--${el[key]}`;
            // push fieldID onto refList
          }
        }

        refList.push(fieldID);
        // if object, recurse to add all nested values of el to cache as individual entries
        if (typeof el === 'object') {
          normalizeForCache({ [dataType]: el }, map,  { [dataType]: currProto});
        }
      }
      console.log('result name is ', resultName, ' and ref list is ', refList);
      sessionStorage.setItem(cacheKey, JSON.stringify(refList));
    }
    else if (typeof currField === 'object') {
      // need to get non-Alias ID for cache
      // const cacheID = currProto.__id ? `${currProto.__type}--${currProto.__id}` : currProto.__type;
      // temporary store for field properties
      const fieldStore = {};
      
      // if object has id, generate fieldID 
      let cacheID = map.hasOwnProperty(currProto.__type)
        ? map[currProto.__type]
        : currProto.__type;
      
      // if prototype has ID, append it to cacheID
      cacheID += currProto.__id
        ? `--${currProto.__id}`
        : '';

      // iterate over keys in object
      // "id, name, cities"
      for (const key in currField) {
        // if prototype has no ID, check field keys for ID (mostly for arrays)
        if (!currProto.__id && (key === 'id' || key === '_id' || key === 'ID' || key === 'Id')) {
          cacheID += `--${currField[key]}`;
        }
        fieldStore[key] = currField[key];

        // if object, recurse normalizeForCache assign in that object
        // must also pass in protoFields object to pair arguments, aliases with response
        if (typeof currField[key] === 'object') {
          normalizeForCache({ [key]: currField[key] }, map, { [key]: protoField[resultName][key]}, cacheID);
        }
      }
      // store "current object" on cache in JSON format
      sessionStorage.setItem(cacheID, JSON.stringify(fieldStore));
    }
  }
}

// Saves item/s to cache and omits any 'uncacheable' items
// TO-DO: array merging
// TO-DO: deep merge
async function writeToCache(key, item) {
  if (!key.includes('uncacheable')) {
    const cacheItem = await sessionStorage.getItem(key);

    // if item is an array, set to just stash the item, otherwise merge objects
    const fullItem = Array.isArray(item)
      ? item
      : { ...cacheItem, ...item };

    // Store the data entry
    // TO-DO: instead of overwriting item with new setItem call,
    // get item first, merge cache objects, and set new cache object
    sessionStorage.setItem(key, JSON.stringify(fullItem));

    // Start the time out to remove this data entry for cache expiration after saved in session storage for 10 minutes (600 seconds)
    let seconds = 600;
    setTimeout(() => {
      sessionStorage.removeItem(key);
    }, seconds * 1000);
  }
}

module.exports = normalizeForCache;
