/**
 joinResponses combines two arrays containing results from the cached response and fetched (uncached) and outputs a single array response 
 that will ultimately be formatted and delivered to the client. 
 the copied Proto parameter sets a reference to combine the fields in the same order as the original query.
 */

//  joinedResponse = { ...cacheResponse, ...serverResponse }

// const cacheResponse = {
//   data: {
//     artists: [
//       { id: '1', name: 'John Coltrane' },
//       { id: '2', name: 'Miles Davis' },
//       { id: '3', name: 'Thelonious Monk' },
//     ]
//   }
// };

// const serverResponse =   {
//   data: {
//     artists: [
//       { instrument: 'saxophone' },
//       { instrument: 'trumpet' },
//       { instrument: 'piano' },
//     ]
//   }
// };

// queryProto
// {
//   albums: { 
//     album_id: false,
//     id: false,
//     name: false,
//     release_year: false 
//   }
// }

// cache {
//   albums: [
//     {
//       album_id: '1',
//       id: '101',
//       name: 'Blue Train',
//       release_year: 1957
//     },
//     {
//       album_id: '2',
//       id: '201',
//       name: 'Giant Steps',
//       release_year: 1965
//     }
//   ]
// }


// TO-DO: how is the cache set up?
function joinResponses(cacheResponse, serverResponse, queryProto) {
  // we have serverResponse & cache response in format of
  // { data: { country { id name } } } w/ different fields on cache & server

  console.log('loop on queryProto', queryProto);
  console.log('cache', cacheResponse);
  console.log('server', serverResponse);
  // initialize a merged Object
  let mergedObject = {};

  // loop through fields object keys as "source of truth"
  // store combined responses in mergedObject
  // first loop for different queries on string
  for (const key in queryProto) {

    if (Array.isArray(cacheResponse[key])) {
      // start figuring out how to merge these arrays
      console.log('found array', cacheResponse[key], serverResponse[key]);
      console.log('key', key);

      // figure out if objects are same or different

      // queryProto has ALL fields
      // cacheResponse may or may not have ALL fields
      // serverResponse may or may not have ALL fields

      if (Object.keys(queryProto[key]).length !== Object.keys(cacheResponse[key]).length) {
        console.log('length not same');
        // 2) if objects are "same" w/ different fields, we cannot concat
        // iterate over an array
        const mergedArray = [];
        for (let i = 0; i < cacheResponse[key].length; i++) {
          // for each index of array, combine cache and server response
          // recurse to combine objects
          mergedArray.push(
            joinResponses(
              { [key]: cacheResponse[key][i] },
              { [key]: serverResponse[key][i] },
              { [key]: queryProto[key][i] }
            )
          );
        }
        // set merged array to mergedObject at key
        mergedObject[key] = mergedArray;
      } else {
        console.log('length same');
        // 1) if objects are different, we can concat
        // concat the arrays 
        mergedObject[key] = [...cacheResponse[key], ...serverResponse[key]];
      }
    }
    else {
      // ELSE IF REGULAR OBJECT, NOT ARRAY

      // object spread
      mergedObject[key] = { ...cacheResponse[key], ...serverResponse[key] };
  
      // go one level deeper
      // loop through fields on queryProto
      for (const fieldName in queryProto[key]) {
        // have access to fields
  
        // check for object
        if (typeof queryProto[key][fieldName] === 'object') {
          // if current field is a nested object, recurse joinResponses on that object
          // to create a deep copy of our merged responses on mergedObject
  
          const mergedRecursion = joinResponses(
            { [fieldName]: cacheResponse[key][fieldName] },
            { [fieldName]: serverResponse[key][fieldName] }, 
            { [fieldName]: queryProto[key][fieldName] }
          );
  
          // place on merged response
          mergedObject[key] = { ...mergedObject[key], ...mergedRecursion };
        }
      }
    }
  }
  // return result should be { data: { country { cacheValues serverValues } }
  return mergedObject;
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