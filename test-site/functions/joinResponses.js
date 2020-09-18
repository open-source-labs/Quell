/**
 joinResponses combines two arrays containing results from the cached response and fetched (uncached) and outputs a single array response that will ultimately be formatted and delivered to the client.
 */

function joinResponses(responseArray, fetchedResponseArray) { // Inputs array of objects containing cached fields & array of objects containing newly query fields
  // main output that will contain objects with combined fields
  const joinedArray = [];
  // iterate over each response array object (i.e. objects containing cached fields)
  for (let i = 0; i < responseArray.length; i++) {
    // set corresponding objects in each array to combine (NOTE: ASSUMED THAT FETCH ARRAY WILL BE SORTED THE SAME AS CACHED ARRAY)
    const responseItem = responseArray[i];
    const fetchedItem = fetchedResponseArray[i];
    // recursive helper function to add fields of second argument to first argument
    function fieldRecurse(objStart, objAdd) {
      // traverse object properties to add
      for (let field in objAdd) {
        // if field is an object (i.e. non-scalar), 1. set new field as empty array, 2. iterate over array, 3. create new objects , 4. push new objects to empty array
        if (typeof objAdd[field] === 'object') {
          // WOULD DATA TYPE BE AN {} ????
          // if type is []
          // set new field on new object equal empty array
          const newObj = {};
          newObj[field] = [];
          // declare variable eual to array of items to add from
          const objArr = objAdd[field];
          // iterate over array
          for (let j = 0; j < objArr.length; j++) {
            // push to new array the return value of invoking this same fieldRecurse() function.  fieldRecurse() will combine the nested array elements with the new obj field.
            newObj[field].push(fieldRecurse({}, objArr[j]));
          };
          objStart[field] = newObj[field];
        } else {
          // if field is scalar, simplay add key/value pair add to starting object
          objStart[field] = objAdd[field];
        }
      }
      // return combined object
      return objStart;
    }
    // outputs an object based on adding second argument to first argument
    fieldRecurse(responseItem, fetchedItem);
    // push combined object into main output array
    joinedArray.push(responseItem);
  }
  // return main output array
  return joinedArray;
};

export default joinResponses