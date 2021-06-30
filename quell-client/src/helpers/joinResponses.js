/**
 joinResponses combines two objects containing results from the cached response and fetched (uncached) and outputs a single array response 
 that will ultimately be formatted and delivered to the client. 
 the copied Proto parameter sets a reference to combine the fields in the same order as the original query.
 */

// TO-DO: this could maybe be optimized by separating out some of the logic into a helper function we recurse upon
function joinResponses(cacheResponse, serverResponse, queryProto, fromArray = false) {
  console.log('inputs to join response, cache Response is ', cacheResponse);
  console.log('server response is ', serverResponse);
  console.log('prorotype is ', queryProto);
  // initialize a "merged response" to be returned
  let mergedResponse = {};

  // loop through fields object keys, the "source of truth" for structure
  // store combined responses in mergedResponse

  // first loop for different queries on response
  for (const key in queryProto) {
    // TO DO
    // if cacheResponse is empty, then short cut this loop and return serverResponse (also vice versa)
    // TO-DO: caching for arrays is likely imperfect, needs more edge-case testing
    // the keys are not present in the cacheResponse ro serverResponse, then do not take them into consideration when filling mergedResponse
    // if (!cacheResponse.hasOwnProperty(key)) {
    //   mergedResponse[key] = serverResponse[key];
    // }
    // else if (!serverResponse.hasOwnProperty(key)) {
    //   mergedResponse[key] = cacheResponse[key];
    // }
    // for each key, check whether data stored at that key is an array or an object
    const checkResponse = cacheResponse.hasOwnProperty(key) ? cacheResponse : serverResponse;

    if (Array.isArray(checkResponse[key])) {
      // merging data stored as array

      // remove reserved properties from queryProto so we can compare # of properties on prototype to # of properties on responses
      const filterKeys = Object.keys(queryProto[key]).filter(propKey => !propKey.includes('__'));

      // if # of keys is the same between prototype & cached response, then the objects on the array represent different things
      // if (filterKeys.length === Object.keys(checkResponse[key][0]).length) {
      //   //if the objects are "different", each object represents unique instance, we can concat
      //   mergedResponse[key] = [...cacheResponse[key], ...serverResponse[key]];
      // } 
      if (cacheResponse.hasOwnProperty(key) && serverResponse.hasOwnProperty(key)) {
        // if # of keys is not the same, cache was missing data for each object, need to merge cache objects with server objects
        
        // iterate over an array
        const mergedArray = [];
        for (let i = 0; i < checkResponse[key].length; i++) {

          // for each index of array, combine cache and server response objects
          console.log('key before joinresponses is', key);
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
      else if (cacheResponse.hasOwnProperty(key)) {
        mergedResponse[key] = cacheResponse[key];
      }
      else {
        mergedResponse[key] = serverResponse[key];
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

  // HERE THERE BE DRAGONS
//   // main output array that will contain objects with joined fields
//   const joinedArray = [];
//   // iterate over response containing cached fields
//   for (let i = 0; i < responseArray.length; i++) {
//     // set corresponding objects in each array to join
//     const responseItem = responseArray[i];
//     const fetchedItem = fetchedResponseArray[i];
//     // recursive helper function to create new joined object
//     function fieldRecurse(objStart, objAdd) {
//       const newObj = {};
//       // traverse proto obj to reference fields
//       const protoObj = proto[Object.keys(proto)[0]];
//       for (let field in protoObj) {
//         // if scalar:
//         if (typeof protoObj[field] !== 'object') {
//           // add applicable field from either object to the newObj
//           objStart[field]
//             ? (newObj[field] = objStart[field])
//             : (newObj[field] = objAdd[field]);
//           // if non-scalar:
//         } else if (typeof protoObj[field] === 'object') {
//           // if both objects contain non-scalar fields, join by passing back into joinResponses() or else, add the value from the applicable object that contains it
//           objStart[field] && objAdd[field]
//             ? (newObj[field] = joinResponses(objStart[field], objAdd[field], {
//                 [field]: protoObj[field],
//               }))
//             : (newObj[field] = objStart[field] || objAdd[field]);
//         }
//       }

//       return newObj;
//     }
//     joinedArray.push(fieldRecurse(responseItem, fetchedItem));
//   }
//   // return main output array
//   return joinedArray;