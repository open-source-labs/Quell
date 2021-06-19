/**
 joinResponses combines two objects containing results from the cached response and fetched (uncached) and outputs a single array response 
 that will ultimately be formatted and delivered to the client. 
 the copied Proto parameter sets a reference to combine the fields in the same order as the original query.
 */

// TO-DO: this could maybe be optimized by separating out some of the logic into a helper function we recurse upon
function joinResponses(cacheResponse, serverResponse, queryProto, fromArray = false) {
  // initialize a "merged response" to be returned
  let mergedResponse = {};

  // loop through fields object keys, the "source of truth" for structure
  // store combined responses in mergedResponse

  // first loop for different queries on response
  for (const key in queryProto) {

    // TO-DO: caching for arrays is likely imperfect, needs more edge-case testing
    // for each key, check whether data stored at that key is an array or an object
    if (Array.isArray(cacheResponse[key])) {
      // merging data stored as array

      // remove reserved properties from queryProto so we can compare # of properties on prototype to # of properties on responses
      const filterKeys = Object.keys(queryProto[key]).filter(propKey => !propKey.includes('__'));

      // if # of keys is the same between prototype & cached response, then the objects on the array represent different things
      if (filterKeys.length === Object.keys(cacheResponse[key][0]).length) {
        //if the objects are "different", each object represents unique instance, we can concat
        mergedResponse[key] = [...cacheResponse[key], ...serverResponse[key]];
      } else {
        // if # of keys is not the same, cache was missing data for each object, need to merge cache objects with server objects
        
        // iterate over an array
        const mergedArray = [];
        for (let i = 0; i < cacheResponse[key].length; i++) {

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
      }
    }
    else {
      // if not an array, it is a regular object data structure

      // object spread
      if (!fromArray) {
        // if object doesn't come from an array, we must assign on the object at the given key
        // results in { key: values }
        mergedResponse[key] = { ...cacheResponse[key], ...serverResponse[key] };
      } else {
        // if the object comes from an array, we do not want to assign to a key as per GQL spec
        // results in [{fields}, {fields}, {fields}]
        mergedResponse = { ...cacheResponse[key], ...serverResponse[key] }
      }
      
      // loop through fields on queryProto
      for (const fieldName in queryProto[key]) {

        // check for nested objects
        if (typeof queryProto[key][fieldName] === 'object' && !fieldName.includes('__')) {
          // recurse joinResponses on that object to create deep copy on mergedResponse

          const mergedRecursion = joinResponses(
            { [fieldName]: cacheResponse[key][fieldName] },
            { [fieldName]: serverResponse[key][fieldName] }, 
            { [fieldName]: queryProto[key][fieldName] }
          );
  
          // place on merged response
          mergedResponse[key] = { ...mergedResponse[key], ...mergedRecursion };

          // // delete shallow copy of cacheResponse's nested object from mergedResponse
          // if (fieldName !== fieldStrip.key) delete mergedResponse[stripped.key][fieldName]
        }
      }
    }
  }
  // return result should be { data: { country { ...cacheValues, ...serverValues } }
  return mergedResponse;
}

module.exports = joinResponses;