/**
 joinResponses combines two arrays containing results from the cached response and fetched (uncached) and outputs a single array response that will ultimately be formatted and delivered to the client.
 */

function joinResponses(responseArray, fetchedResponseArray) { 
  // main output array that will contain objects with combined fields
  const joinedArray = [];
  // iterate over response containing cached fields
  for (let i = 0; i < responseArray.length; i++) {
    // set corresponding objects in each array to combine
    const responseItem = responseArray[i];
    const fetchedItem = fetchedResponseArray[i];
    // recursive helper function to add fields of second argument to first argument
    function fieldRecurse(objStart, objAdd) {
      // traverse object properties to add
      for (let field in objAdd) {
        // if field non-scalar:
        if (typeof objAdd[field] === 'object') {
          // if objStart[field] already exists:
          if (objStart[field]) {
            // create temporary array to take in new objects
            const arrReplacement = []
            // declare variable equal to array of items to add from
            const objArr = objAdd[field];
            for (let j = 0; j < objArr.length; j++) {
              // input preexisting obj and new obj and push to new array 
              arrReplacement.push(fieldRecurse(objStart[field][j], objArr[j]));
            };
            // replace preexisting array with new array
            objStart[field] = arrReplacement;
          } else { // if objStart[field] does not already exist:
            // replace preexisting array with new empty array to take in new objects
            objStart[field] = [];
            // declare variable equal to array of items to add from
            const objArr = objAdd[field];
            for (let j = 0; j < objArr.length; j++) {
              // input empty obj and new obj and push to empty array 
              objStart[field].push(fieldRecurse({}, objArr[j]));
            };
          }
        } else {
          // if field is scalar, add to starting object
          objStart[field] = objAdd[field];
        }
      }
      // return combined object
      return objStart;
    }
    // push combined object into main output array
    joinedArray.push(fieldRecurse(responseItem, fetchedItem));
  }
  // return main output array
  return joinedArray;
};

module.exports = joinResponses;