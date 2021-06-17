/**
 joinResponses combines two arrays containing results from the cached response and fetched (uncached) and outputs a single array response 
 that will ultimately be formatted and delivered to the client. 
 the copied Proto parameter sets a reference to combine the fields in the same order as the original query.
 */

// Prototype: "country--1"
// Cache: "country--1" 
// server: "country"
function joinResponses(cacheResponse, serverResponse, queryProto, fromArray = false) {
  // we have serverResponse & cache response in format of
  // { data: { country { id name } } } w/ different fields on cache & server

  console.log('loop on queryProto', queryProto);
  console.log('cache', cacheResponse);
  console.log('server', serverResponse);

  // initialize a "merged response" to be returned
  let mergedResponse = {};

  // loop through fields object keys, the "source of truth" for structure
  // store combined responses in mergedResponse
  // first loop for different queries on string

  // loop on queryProto { 'artist--1': { id: true, name: true, instrument: true } }
  // cache { 'artist--1': { id: '1', name: 'John Coltrane' } }
  // server { artist: { instrument: 'saxophone' } }
  for (const key in queryProto) {
    // key = artist--1

    if (Array.isArray(cacheResponse[key])) {
      // start figuring out how to merge these arrays
      console.log('found array', cacheResponse[key], serverResponse[key]);
      console.log('key', key);

      // if # of keys is the same, then Objects are 
      // FIXED: cacheResponse[key] is an ARRAY, not an OBJECT
      // needed to access an element on cacheResponse in order to properly handle
      if (Object.keys(queryProto[key]).length === Object.keys(cacheResponse[key][0]).length) {
        console.log('length same');
        // 1) if objects are different, we can concat
        // concat the arrays 
        mergedResponse[key] = [...cacheResponse[key], ...serverResponse[key]];
      } else {
        // if # of keys is not the same, objects represent similar objects & are missing data
        console.log('length not same');
        // 2) if objects are "same" w/ different fields, we cannot concat
        // iterate over an array
        const mergedArray = [];
        for (let i = 0; i < cacheResponse[key].length; i++) {
          // for each index of array, combine cache and server response
          // recurse to combine objects
          const joinedResponse = joinResponses(
            { [key]: cacheResponse[key][i] },
            { [key]: serverResponse[key][i] },
            { [key]: queryProto[key] },
            true
          );

          mergedArray.push(joinedResponse);
        }
        // set merged array to mergedResponse at key
        mergedResponse[albums] = [{}, {}, {}]
        mergedResponse[key] = mergedArray;
      }
    }
    else {
      // ELSE IF NOT ARRAY, must be regular object!

      // loop on queryProto { 'artist--1': { id: true, name: true, instrument: true } }
      // cache { 'artist--1': { id: '1', name: 'John Coltrane' } }
      // server { artist: { instrument: 'saxophone' } }
      // result { artist: { fields }}

      const stripped = stripKey(key);
      console.log('stripKey', stripped);
      // object spread
      if (!fromArray) {
        mergedResponse[stripped.key] = { ...cacheResponse[key], ...serverResponse[stripped.key] };
      } else {
        mergedResponse = { ...cacheResponse[key], ...serverResponse[stripped.key] }
      }
      
      // go one level deeper
      // loop through fields on queryProto
      for (const fieldName in queryProto[key]) {
        // have access to fields

        const fieldStrip = stripKey(fieldName);
        // check for nested objects
        if (typeof queryProto[key][fieldName] === 'object') {
          // recurse joinResponses on that object to create deep copy on mergedResponse

          const mergedRecursion = joinResponses(
            { [fieldName]: cacheResponse[key][fieldName] },
            { [fieldStrip.key]: serverResponse[stripped.key][fieldStrip.key] }, 
            { [fieldName]: queryProto[key][fieldName] }
          );
  
          // place on merged response
          mergedResponse[stripped.key] = { ...mergedResponse[stripped.key], ...mergedRecursion };

          // delete shallow copy of cacheResponse's nested object from mergedResponse
          delete mergedResponse[stripped.key][fieldName]
        }
      }
    }
  }

  // return result should be { data: { country { cacheValues serverValues } }
  return mergedResponse;
}

module.exports = joinResponses;

// takes keys of format "queryName -- uniqueID" and unformats them
// merged Resposne needs unformatted keys
// allows comparison of Prototype, Cache, Response keys
// grab back alias

/*
{
  ['country--1']: {
    id: true,
    name: true,
    capitol: true,
    __args: { id: "1" },
    __alias: 'Canada',
  }
}
*/

const stripKey = (uniqueStr, prototype = {}) => {
  const index = uniqueStr.indexOf('--');

  let key;
  let uniqueID;
  let alias = null;
  
  if (index === -1) {
    key = uniqueStr;
    uniqueID = null;
  } else {
    // 'country -- 102985asklfjjdlfksadfl'
    key = uniqueStr.slice(0, index);
    uniqueID = uniqueStr.slice(index + 2);
  }

  const obj = { key, uniqueID, alias }

  return obj;
};

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