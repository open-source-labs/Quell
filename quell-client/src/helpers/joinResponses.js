///////////////////////////////////////////////////////////////////////////////////
////////THIS CODE IS DEPRICATED SINCE THE INTRODUCTION OF LOKIJS///////////////////
//////////////////////////////////////////////////////////////////////////////////
// ### DELETE ###


/**
 joinResponses combines two objects containing results from the cached response and fetched (uncached) and outputs a single array response that will ultimately be formatted and delivered to the client.
 the copied Proto parameter sets a reference to combine the fields in the same order as the original query.
 @param {object} cacheResponse - JavaScript object containing the result from the cached response
 @param {object} serverResponse - JavaScript object containing the fetched (uncached) result
 @param {object} queryProto - Prototype object from query
 */

function joinResponses(
  cacheResponse,
  serverResponse,
  queryProto,
  fromArray = false
) {
  // initialize a "merged response" to be returned
  let mergedResponse = {};
  // loop through fields object keys, the "source of truth" for structure
  // store combined responses in mergedResponse
  // first loop for different queries on response
  for (const key in queryProto) {
    // for each key, check whether data stored at that key is an array or an object
    const checkResponse = cacheResponse.hasOwnProperty(key)
      ? cacheResponse
      : serverResponse;

    if (Array.isArray(checkResponse[key])) {
      // merging data stored as array

      if (
        cacheResponse.hasOwnProperty(key) &&
        serverResponse.hasOwnProperty(key)
      ) {
        // if # of keys is not the same, cache was missing data for each object, need to merge cache objects with server objects

        // iterate over an array
        const mergedArray = [];
        for (let i = 0; i < checkResponse[key].length; i++) {
          // for each index of array, combine cache and server response objects
          const joinedResponse = joinResponses(
            { [key]: cacheResponse[key][i] },
            { [key]: serverResponse[key][i] },
            { [key]: queryProto[key] },
            true
          );

          // place joinedResponse on our array of all merged objects
          mergedArray.push(joinedResponse);
        }
        // set merged array to mergedResponse at key
        mergedResponse[key] = mergedArray;
      } else if (cacheResponse.hasOwnProperty(key)) {
        mergedResponse[key] = cacheResponse[key];
      } else {
        mergedResponse[key] = serverResponse[key];
      }
    } else {
      // if not an array, it is a regular object data structure

      // object spread
      if (!fromArray) {
        // if object doesn't come from an array, we must assign on the object at the given key
        // results in { key: values }
        mergedResponse[key] = { ...cacheResponse[key], ...serverResponse[key] };
      } else {
        // if the object comes from an array, we do not want to assign to a key as per GQL spec
        // results in [{fields}, {fields}, {fields}]
        mergedResponse = { ...cacheResponse[key], ...serverResponse[key] };
      }

      // loop through fields on queryProto
      for (const fieldName in queryProto[key]) {
        // check for nested objects
        if (
          typeof queryProto[key][fieldName] === 'object' &&
          !fieldName.includes('__')
        ) {
          // recurse joinResponses on that object to create deep copy on mergedResponse

          const mergedRecursion = joinResponses(
            { [fieldName]: cacheResponse[key][fieldName] },
            { [fieldName]: serverResponse[key][fieldName] },
            { [fieldName]: queryProto[key][fieldName] }
          );

          // place on merged response
          mergedResponse[key] = { ...mergedResponse[key], ...mergedRecursion };
        }
      }
    }
  }
  return mergedResponse;
}

module.exports = joinResponses;
