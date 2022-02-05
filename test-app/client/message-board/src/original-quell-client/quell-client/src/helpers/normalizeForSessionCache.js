/** 
 normalizeForSessionCache traverses server response data and creates objects out of responses for cache. 
 * Iterates & recurses over response object & preps data to be sent to cache
 * and sends data to cache
 * necessary for cache consistency
 @param {object} responseData - the data from the graphQL response object
 @param {object} map - a map of graphQL fields to their corresponding graphQL Types
 @param {object} protoField - the prototype object, or a section of the prototype object, for accessing arguments, aliases, etc.
 * fieldsMap: potentially deprecated?
 */

function normalizeForCache(
  responseData,
  map = {},
  protoField,
  subID,
  fieldsMap = {}
) {
  // if we are recursing, we want to add a subid before caching
  // iterate over keys in our response data object
  for (const resultName in responseData) {
    // currentField we are iterating over & corresponding Prototype
    const currField = responseData[resultName];
    const currProto = protoField[resultName];

    for(const property in map){
      if(currProto.__type.includes(map[property])) currProto.__type = map[property];
    }

    // check if the value stored at that key is array
    if (Array.isArray(currField)) {
      const cacheKey = subID ? subID + '--' + resultName : resultName;
      // create empty array to store refs
      const refList = [];

      // iterate over countries array
      for (let i = 0; i < currField.length; i++) {
        const el = currField[i];
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
          normalizeForCache({ [dataType]: el }, map, { [dataType]: currProto });
        }
      }
      sessionStorage.setItem(cacheKey, JSON.stringify(refList));

    } else if (typeof currField === 'object') {
      // need to get non-Alias ID for cache
      // temporary store for field properties
      const fieldStore = {};

      // if object has id, generate fieldID
      let cacheID = map.hasOwnProperty(currProto.__type)
        ? map[currProto.__type]
        : currProto.__type;
      // if prototype has ID, append it to cacheID
      cacheID += currProto.__id ? `--${currProto.__id}` : '';
      
      // iterate over keys in object
      for (const key in currField) {
        // if prototype has no ID, check field keys for ID (mostly for arrays)
        if (
          !currProto.__id &&
          (key === 'id' || key === '_id' || key === 'ID' || key === 'Id')
        ) {
          cacheID += `--${currField[key]}`;
        }
        fieldStore[key] = currField[key];

        // if object, recurse normalizeForCache assign in that object
        // must also pass in protoFields object to pair arguments, aliases with response
        if (typeof currField[key] === 'object') {
          normalizeForCache(
            { [key]: currField[key] },
            map,
            { [key]: protoField[resultName][key] },
            cacheID
          );
        }
      }
      // store "current object" on cache in JSON format
      sessionStorage.setItem(cacheID, JSON.stringify(fieldStore));
    }
  }
}

// Saves item/s to cache and omits any 'uncacheable' items
async function writeToCache(key, item) {
  if (!key.includes('uncacheable')) {
    const cacheItem = await sessionStorage.getItem(key);
    const parsedItem = JSON.parse(cacheItem);
    // if item is an array, set to just stash the item, otherwise merge objects
    const fullItem = Array.isArray(item) ? item : { ...parsedItem, ...item };

    // Store the data entry
    sessionStorage.setItem(key, JSON.stringify(fullItem));

    // Start the time out to remove this data entry for cache expiration after saved in session storage for 10 minutes (600 seconds)
    let seconds = 600;
    setTimeout(() => {
      sessionStorage.removeItem(key);
    }, seconds * 1000);
  }
}

module.exports = normalizeForCache;
