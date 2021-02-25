/**
 joinResponses combines two arrays containing results from the cached response and fetched (uncached) and outputs a single array response that will ultimately be formatted and delivered to the client. the copied Proto parameter sets a reference to combine the fields in the same order as the original query.
 */

function joinResponses(responseArray, fetchedResponseArray, proto) {
  console.log('responseArray ===> !!!!!!! ', responseArray);
  console.log('fetchedResponseArray ===> !!!!!!! ', fetchedResponseArray);
  console.log('proto ===> !!!!!!! ', proto);
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
      // traverse proto obj to reference fields
      const protoObj = proto[Object.keys(proto)[0]];
      for (let field in protoObj) {
        // if scalar:
        if (typeof protoObj[field] !== 'object') {
          // add applicable field from either object to the newObj
          objStart[field]
            ? (newObj[field] = objStart[field])
            : (newObj[field] = objAdd[field]);
          // if non-scalar:
        } else if (typeof protoObj[field] === 'object') {
          // if both objects contain non-scalar fields, join by passing back into joinResponses() or else, add the value from the applicable object that contains it
          console.log('field ===> ', field);
          objStart[field] && objAdd[field]
            ? (newObj[field] = joinResponses(objStart[field], objAdd[field], {
                [field]: protoObj[field],
              }))
            : (newObj[field] = objStart[field] || objAdd[field]);
        }
      }

      return newObj;
    }
    joinedArray.push(fieldRecurse(responseItem, fetchedItem));
  }
  // return main output array
  console.log('joinedArray ===> ', joinedArray);
  return joinedArray;
}

module.exports = joinResponses;
