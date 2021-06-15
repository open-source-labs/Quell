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
      },
      {
        "id": "3",
        "name": "Armenia"
      },
      {
        "id": "4",
        "name": "American Samoa"
      },
      {
        "id": "5",
        "name": "Aruba"
      }
    ]
  }
}

{
  data: {},
  error: {}
}

1) is it an array?
  recurse(store objects in cache)
  replace objects with references to cache ie country--1
  store array w/ refs in cache ie countries: [country--1, country--2]

2) is it an object? 
  if sub-property is object? recurse(store object in cache)
    replace sub-property with ref
  if sub-property is array? recurse(store array in cache)
    replace sub-property with ref
  create uniqueID, store object in cache


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

function normalizeForCache(responseData, map, fieldsMap) {

  // iterate over keys in our response data object 
  for (const resultName in responseData) {
    const currField = responseData[resultName];
    // check if the value stored at that key is array 
    
    // check if the value stored at that key is an object
    if (typeof currField === 'object') {
      
      // if object has id, generate fieldID 
      let uniqueID = resultName;
      // iterate over keys in object
      for (const key in currField) {
        // if ID, create fieldID
        if (key === 'id') uniqueID += `--${currField[key]}`
        // if object, recurse normalizeForChache passign in that object
        if (typeof key === 'object') {
        // city--3
        }
      }
    }

    // should return referenceName to object ie "country--1"
  }
  // if object, recurse normalizeForChache passign in that object
  // if fieldID was generated, 
  //send the object to the cache 

    // {
    // "country": {
    //   "id": "2",
    //    "name": "Bolivia"
  // city: {
  //   id
  //   name
  //         }
    // },
    // "book": {
    //   id: 1,
    //     name: Harry Potter
    // }
    // }


}

function testCache(object) {
  console.log(object);
}
  // WARNING: HERE THERE BE DRAGONS ---------------
  // If query has arguments they are not the response data
  // if current target is Object
  // if (protoArgs) {
  //   // 
  //   // Name of query for ID generation (e.g. "countries")
  //   // replace with iteration
  //   const queryName = Object.keys(response)[0];

  //   // Object type for ID generation ===> "City"
  //   const collectionName = map[queryName];

  //   // Array of objects on the response (cloned version)
  //   const collection = JSON.parse(JSON.stringify(response[queryName]));

  //   if (Array.isArray(collection)) {
  //     // if collection from response is an array / etc: query all cities with argument country_id
  //     let userDefinedIdArg;
  //     for (let fieldName in QuellStore.arguments) {
  //       for (let arg of QuellStore.arguments[fieldName]) {
  //         if (Object.keys(arg)[0].includes('id')) {
  //           userDefinedIdArg = arg;
  //         }
  //       }
  //     }
  //     const referencesToCache = [];
  //     for (const item of collection) {
  //       const itemKeys = Object.keys(item);

  //       for (const key of itemKeys) {
  //         if (Array.isArray(item[key])) {
  //           item[key] = replaceItemsWithReferences(key, item[key], fieldsMap);
  //         }
  //       }
  //       // Write individual objects to cache (e.g. separate object for each single city)
  //       writeToCache(generateId(collectionName, item), item);
  //       referencesToCache.push(generateId(collectionName, item));
  //     }
  //     // Write the array of references to cache (e.g. 'citiesByCountry-1': ['City-1', 'City-2', 'City-3'...])
  //     writeToCache(generateId(queryName, userDefinedIdArg), referencesToCache);
  //   } else {
  //     // if collection from response is an object / etc: query a country with argument id
  //     const itemKeys = Object.keys(collection);

  //     for (const key of itemKeys) {
  //       if (Array.isArray(collection[key])) {
  //         collection[key] = replaceItemsWithReferences(
  //           key,
  //           collection[key],
  //           fieldsMap
  //         );
  //       }
  //     }
  //     // Write individual objects to cache (e.g. separate object for each single city)
  //     writeToCache(generateId(collectionName, collection), collection);
  //   }
  // } else if (args && alias) {
// if (proto.__alias) 
    // also pass in currentField name so we can map alias -> country--1
// {
//   "data": {
//     "USA": {
//       "id": "1",
//       "name": "USA"
//     },
//     "country": {
//       "id": "2",
//       "name": "Bolivia"
//     }
//   }
// }

    /**
     * Can fully cache aliaes by different id,
     * and can build response from cache with previous query with exact aliases
     * (comment out aliaes functionality now)
     */
    // // if collection from response is an object && QuellStore.alias is not null
    // // Name of alias from response object (e.g. "country1" & "country1")
    // for (let alias of Object.keys(response)) {
    //   // Name of query for ID generation (e.g. "country")
    //   const queryName = Object.keys(QuellStore.alias)[0];
    //   // Object type for ID generation ===> "Country"
    //   const collectionName = map[queryName];
    //   // Array of objects on the response (cloned version)
    //   const collection = JSON.parse(JSON.stringify(response[alias]));
    //   if (Array.isArray(collection)) {
    //     // if collection from response is an array / etc: query all cities with argument country_id
    //     for (const item of collection) {
    //       const itemKeys = Object.keys(item);
    //       for (const key of itemKeys) {
    //         if (Array.isArray(item[key])) {
    //           item[key] = replaceItemsWithReferences(key, item[key], fieldsMap);
    //         }
    //       }
    //       // Write individual objects to cache (e.g. separate object for each single city)
    //       writeToCache(generateId(collectionName, item), item);
    //     }
    //   } else {
    //     // if collection from response is an object / etc: query a country with argument id
    //     const itemKeys = Object.keys(collection);
    //     for (const key of itemKeys) {
    //       if (Array.isArray(collection[key])) {
    //         collection[key] = replaceItemsWithReferences(
    //           key,
    //           collection[key],
    //           fieldsMap
    //         );
    //       }
    //     }
    //     // Write individual objects to cache (e.g. separate object for each single city)
    //     writeToCache(generateId(collectionName, collection), collection);
    //   }
    // }
  // } else  {
    // if collection is query to get all / etc: query all countries

    // countries: [{ id, name }, { id, name }, { id, name }, { id, name }, { id, name }]


    // countries: [country--1, country--2, country--3];

    // country--1: {
    //   id
    //   name
    //   cities: [{}, {}, {}]
    //  }

    // Name of query for ID generation (e.g. "countries")
    // always grabs just first response??? hard-coded for only one query
    // "countries"
//     const queryName = Object.keys(response)[0];

//     // Object type for ID generation ===> "Country"
//     const collectionName = map[queryName];
//     // countries: [ Country: { id, name }, { id, name }, { id, name }, { id, name }, { id, name }]

//     // Array of objects on the response (cloned version)
//     // TO-DO: do we mutate response or continue to need it after normalize ForCache?
//     // countries : [{id, name}, {id, name}, {id, name}]
//     const collection = JSON.parse(JSON.stringify(response[queryName]));

//     // countries: [country--1, country--2, country--3, { id, name }, { id, name }]
//     const referencesToCache = [];
//     // Check for nested array (to replace objects with another array of references)
//     for (const item of collection) {

//       // [{id, name, cities: []}, country--2, country--3, { id, name }, { id, name }]
//       // TO-DO: when will this be ANOTHER array right after the first?
//       // better to handle with RECURSION? (so we can grab nested objects as well)
//       // countries : [{ id: 1, name: USA, cities: [] }]
//       const itemKeys = Object.keys(item);

//       // city--1: { id name }

//       // [id, name]
//       for (const key of itemKeys) {
//         if (Array.isArray(item[key])) {
//           (cities, {[]}, map)
//           item[key] = replaceItemsWithReferences(key, item[key], fieldsMap);
//         }
//       }

//       // Write individual objects to cache (e.g. separate object for each single city)
//       // TO-DO: only call generateId once here, it potentially loops through multiple values, so this would be an easy point to save time
//       // item we write to cache is { id, name }
//       // TO-DO: if nested query, it will write the entire nested object in one go, won't go further to get more granular data out
//       // instead we should recurse, replace item with REF (ie city--1, city--2, city--3)
//       writeToCache(generateId(collectionName, item), item);

//       referencesToCache.push(generateId(collectionName, item));
//     }

//     // Write the array of references to cache (e.g. 'Country': ['Country--1', 'Country--2', 'Country--3'...])
//     writeToCache(collectionName, referencesToCache);
//   }
// }

// ============= HELPER FUNCTIONS ============= //

// countries: [{ id, name }, {id, name}, ...] becomes countries: [country--1, country--2, ...]
// Replaces object field types with an array of references to normalized items (elements)
function replaceItemsWithReferences(field, array, fieldsMap) {
  (cities, {[]}, map)
  const arrayOfReferences = [];
  const collectionName = fieldsMap[field];

  for (const item of array) {
    writeToCache(generateId(collectionName, item), item);
    arrayOfReferences.push(generateId(collectionName, item));
  }

  return arrayOfReferences;
}

// Creates unique ID (key) for cached item
function generateId(collection, item) {
  let userDefinedId;
  for (let key in item) {
    if (key.includes('id') && key !== 'id' && key !== '_id') {
      userDefinedId = item[key];
    }
  }

  const identifier = item.id || item._id || item.ID || userDefinedId || 'uncacheable';
  return collection + '--' + identifier.toString();
}

// Saves item/s to cache and omits any 'uncacheable' items
function writeToCache(key, item) {
  if (!key.includes('uncacheable')) {
    // Store the data entry
    // TO-DO: instead of overwriting item with new setItem call,
    // get item first, merge cache objects, and set new cache object
    sessionStorage.setItem(key, JSON.stringify(item));

    // Start the time out to remove this data entry for cache expiration after saved in session storage for 10 minutes (600 seconds)
    let seconds = 600;
    setTimeout(() => {
      sessionStorage.removeItem(key);
    }, seconds * 1000);
  }
}

module.exports = normalizeForCache;
