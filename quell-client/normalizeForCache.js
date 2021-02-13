/**
 normalizeForCache traverses server response data and creates objects out of responses for cache. Furthermore, it identifies fields that are 'object types' then replaces those array elements with references (helper), creates separate normalized objectes out of replaced elements, and saves all to cache (helper) with unique identifiers (helper)
 */

function normalizeForCache(response, map, fieldsMap) {
  console.log('response ===> ', response);
  console.log('map ===> ', map);
  console.log('fieldsMap ===> ', fieldsMap);
  // Name of query for ID generation (e.g. "countries")
  const queryName = Object.keys(response)[0];
  // Object type for ID generation ===> "City"
  const collectionName = map[queryName];
  // Array of objects on the response (cloned version)
  const collection = JSON.parse(JSON.stringify(response[queryName]));
  console.log('response[queryName] ===> ', response[queryName]);

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
  // Write the array of references to cache (e.g. 'City': ['City-1', 'City-2', 'City-3'...])
  writeToCache(collectionName, referencesToCache);
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
    // mockCache[key] = JSON.stringify(item);
  }
}

module.exports = normalizeForCache;
