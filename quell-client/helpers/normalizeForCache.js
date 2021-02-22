/**
 normalizeForCache traverses server response data and creates objects out of responses for cache. Furthermore, it identifies fields that are 'object types' then replaces those array elements with references (helper), creates separate normalized objectes out of replaced elements, and saves all to cache (helper) with unique identifiers (helper)
 */

function normalizeForCache(response, map, fieldsMap, QuellStore) {
  console.log('response in normalizeForCache ===> ', response);
  console.log('map in normalizeForCache ===> ', map);
  console.log('fieldsMap in normalizeForCache ===> ', fieldsMap);

  if (QuellStore.arguments && !QuellStore.alias) {
    // If query has arguments && QuellStore.alias is null

    // Name of query for ID generation (e.g. "countries")
    const queryName = Object.keys(response)[0];
    // Object type for ID generation ===> "City"
    const collectionName = map[queryName];
    console.log('collectionName ===>', collectionName);
    // Array of objects on the response (cloned version)
    const collection = JSON.parse(JSON.stringify(response[queryName]));
    console.log(
      'collection ===> ',
      JSON.parse(JSON.stringify(response[queryName]))
    );

    if (Array.isArray(collection)) {
      // if collection from response is an array / etc: query all cities with argument country_id
      for (const item of collection) {
        const itemKeys = Object.keys(item);

        for (const key of itemKeys) {
          if (Array.isArray(item[key])) {
            item[key] = replaceItemsWithReferences(key, item[key], fieldsMap);
          }
        }
        // Write individual objects to cache (e.g. separate object for each single city)
        writeToCache(generateId(collectionName, item), item);
      }
    } else {
      // if collection from response is an object / etc: query a country with argument id
      const itemKeys = Object.keys(collection);

      for (const key of itemKeys) {
        if (Array.isArray(collection[key])) {
          collection[key] = replaceItemsWithReferences(
            key,
            collection[key],
            fieldsMap
          );
        }
      }
      // Write individual objects to cache (e.g. separate object for each single city)
      writeToCache(generateId(collectionName, collection), collection);
    }
  } else if (QuellStore.arguments && QuellStore.alias) {
    // if collection from response is an object && QuellStore.alias is not null

    // Name of alias from response object (e.g. "country1" & "country1")
    for (let alias of Object.keys(response)) {
      // Name of query for ID generation (e.g. "country")
      const queryName = Object.keys(QuellStore.alias)[0];
      // Object type for ID generation ===> "Country"
      const collectionName = map[queryName];
      // console.log('collectionName ===>', collectionName);
      // Array of objects on the response (cloned version)
      const collection = JSON.parse(JSON.stringify(response[alias]));
      // console.log('collection ===> ', collection);

      if (Array.isArray(collection)) {
        // if collection from response is an array / etc: query all cities with argument country_id
        for (const item of collection) {
          const itemKeys = Object.keys(item);

          for (const key of itemKeys) {
            if (Array.isArray(item[key])) {
              item[key] = replaceItemsWithReferences(key, item[key], fieldsMap);
            }
          }
          // Write individual objects to cache (e.g. separate object for each single city)
          writeToCache(generateId(collectionName, item), item);
        }
      } else {
        // if collection from response is an object / etc: query a country with argument id
        const itemKeys = Object.keys(collection);

        for (const key of itemKeys) {
          if (Array.isArray(collection[key])) {
            collection[key] = replaceItemsWithReferences(
              key,
              collection[key],
              fieldsMap
            );
          }
        }
        // Write individual objects to cache (e.g. separate object for each single city)
        writeToCache(generateId(collectionName, collection), collection);
      }
    }
  } else {
    // if collection is query to get all / etc: query all countries

    // Name of query for ID generation (e.g. "countries")
    const queryName = Object.keys(response)[0];
    // Object type for ID generation ===> "City"
    const collectionName = map[queryName];
    // console.log('collectionName ===>', collectionName);
    // Array of objects on the response (cloned version)
    const collection = JSON.parse(JSON.stringify(response[queryName]));
    console.log(
      'collection ===> ',
      JSON.parse(JSON.stringify(response[queryName]))
    );

    const referencesToCache = [];
    // Check for nested array (to replace objects with another array of references)
    for (const item of collection) {
      const itemKeys = Object.keys(item);

      for (const key of itemKeys) {
        if (Array.isArray(item[key])) {
          item[key] = replaceItemsWithReferences(key, item[key], fieldsMap);
        }
      }
      // Write individual objects to cache (e.g. separate object for each single city)
      writeToCache(generateId(collectionName, item), item);
      referencesToCache.push(generateId(collectionName, item));
    }

    // Write the array of references to cache (e.g. 'Country': ['Country-1', 'Country-2', 'Country-3'...])
    writeToCache(collectionName, referencesToCache);
  }
}

// ============= HELPER FUNCTIONS ============= //

// Replaces object field types with an array of references to normalized items (elements)
function replaceItemsWithReferences(field, array, fieldsMap) {
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
  const identifier = item.id || item._id || 'uncacheable';
  return collection + '-' + identifier.toString();
}

// Saves item/s to cache and omits any 'uncacheable' items
function writeToCache(key, item) {
  if (!key.includes('uncacheable')) {
    sessionStorage.setItem(key, JSON.stringify(item));
  }
}

module.exports = normalizeForCache;
