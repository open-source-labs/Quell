/**
 joinResponses combines two arrays containing results from the cached response and fetched (uncached) and outputs a single array response that will ultimately be formatted and delivered to the client. the copied Proto parameter sets a reference to combine the fields in the same order as the original query.
 */

function joinResponses(responseArray, fetchedResponseArray, copiedProto) {
  // main output array that will contain objects with joined fields
  const joinedArray = [];
  // iterate over response containing cached fields
  for (let i = 0; i < responseArray.length; i++) {
    // set corresponding objects in each array to join
    const responseItem = responseArray[i];
    const fetchedItem = fetchedResponseArray[i];
    
    // recursive helper function to create new joined object
    function fieldRecurse(objStart, objAdd) {
      const newObj = {};

      // traverse proto to reference fields
      for (let field in copiedProto) {
        // if scalar:
        if (typeof copiedProto[field] !== 'object') {
          // add applicable field from either object to the newObj
          objStart[field]
          ? newObj[field] = objStart[field]
          : newObj[field] = objAdd[field]
        // if non-scalar:
        } else if (typeof copiedProto[field] === 'object') {
          // if both objects contain non-scalar fields, join by passing back into joinResponses() or else, add the value from the applicable object that contains it 
          objStart[field] && objAdd[field]
          ? newObj[field] = joinResponses(objStart[field], objAdd[field], copiedProto[field])
          : newObj[field] = objStart[field] || objAdd[field]
        }
      }

      return newObj;
    }
    joinedArray.push(fieldRecurse(responseItem, fetchedItem));
  }
  // return main output array
  return joinedArray;
};

module.exports = joinResponses;
