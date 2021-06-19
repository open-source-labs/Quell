/* 
buildFromCache - iterates through the output of parseAST (which is an object) and checks the cache for each field in a query. If a field is NOT found in cache then that field will be toggled to false so that the next function knows to create a query string for that field so that it can be fetched from the server. If a field is found in the cache, then that data is saved in a __object and 

Inputs
  @prototype - object representation of a user's query after passing through parseAST
  e.g. samplePrototype = {
      'country--1': {
        id: true,
        name: true,
        __alias: null,
        __args: { id: '1' },
        }
      };
  @itemFromCache - object that defaults to an empty object and is used to hold values from the cache that are found for each field
  @firstRun - boolean that defaults to true when iterating through a typeKey (i.e. country--1) and toggles to false when iterating through a nested query
----
Outputs
  @responseFromCache - object representation of the relevant data extract from cache  
----
Side effects
  @prototype - object representation of the input query with each field updated, whether it was found in cache (true) or not (false)
----
*/

//create callback function
// function buildPrototypeKeys(prototype, prohasRun = false) { 

//   // declaring a variable called obj with empty object as value
//   const obj = {}; 

//   // declare a function called innerFunc with 1 parameter, hasRun = false
//   function innerFunc() {
//     // if hasRun == true then we are going to return obj
//     if (hasRun) { return obj; }
//     // else iterate over prototpe and toggle hasRun to true and return obj
//     else {
//       for (let keys in prototype) {
//         // store every key inside of an obj
//         obj[keys] = true;
//       }
//       hasRun = true;
//       return obj;
//     } 
//   }
//   return innerFunc;
// }

//wrap all of buildFromCache in outer function
// all this outer function would do is create an object of prototype keys
//defines an innerFunc
//at the end of buildFromCache, we come out to the end of 
function buildFromCache(cache, prototype, prototypeKeys, itemFromCache = {}, firstRun = true) {
  
  // update function to include responseFromCache
  // const buildProtoFunc = buildPrototypeKeys(prototype);
  // const prototypeKeys = buildProtoFunc();

  for (let typeKey in prototype) {
    // check if typeKey is a rootQuery (i.e. if it includes '--') or if its a field nested in a query
    // end goal: delete typeKey.includes('--') and check if protoObj.includes(typeKey)
    if (prototypeKeys.includes(typeKey)) { //To do - won't always cache, bring map back or persist -- in parsedAST function?
      // if typeKey is a rootQuery, then clear the cache and set firstRun to true 
      // cached data must persist 
      // create a property on itemFromCache and set the value to the fetched response from cache
      itemFromCache[typeKey] = JSON.parse(sessionStorage.getItem(typeKey));
    }
    // if itemFromCache is an array (Array.isArray()) 
    if (Array.isArray(itemFromCache[typeKey])) {
      // iterate over countries
      itemFromCache[typeKey].forEach((currTypeKey, i) => {
        const interimCache = JSON.parse(sessionStorage.getItem(currTypeKey));
        // console.log('prototype in forEach: ', prototype)
        // console.log('prototype[typeKey] in forEach: ', prototype[typeKey])
        // console.log('interimCache: ', interimCache);

        //iterate through iterimCache (for ... in loop)
        for (let property in interimCache) {
          let tempObj = {};
          //if current interimCache property I'm looking for is in prototype
          if(prototype[typeKey].hasOwnProperty(property)){
            //then create item in itemFromCache from proto at index i
            tempObj[property] = interimCache[property]
            itemFromCache[typeKey][i] = tempObj;
          }
        }
      })
      // reasign itemFromCache[typeKey] to false
      // itemFromCache[typeKey] = false;
    }
      // recurse through buildFromCache using typeKey, prototype
    // if itemFromCache is empty, then check the cache for data, else, persist itemFromCache
    // if this iteration is a nested query (i.e. if typeKey is a field in the query)
    if (firstRun === false) {
      // if this field is NOT in the cache, then set this field's value to false
      if (
        (itemFromCache === null || !itemFromCache.hasOwnProperty(typeKey)) && 
        typeof prototype[typeKey] !== 'object') {
          prototype[typeKey] = false; 
      } 
      // if this field is a nested query, then recurse the buildFromCache function and iterate through the nested query
      if (
        (itemFromCache === null || itemFromCache.hasOwnProperty(typeKey)) && 
        !typeKey.includes('__') && // do not iterate through __args or __alias
        typeof prototype[typeKey] === 'object') { 
          // repeat function inside of the nested query
          buildFromCache(prototype[typeKey], prototypeKeys, itemFromCache[typeKey], false);
      } 
    }
    // if the current element is not a nested query, then iterate through every field on the typeKey
    else {
      for (let field in prototype[typeKey]) {
        // console.log('field: ', field);
        // console.log('itemFromCache[typeKey]: ', itemFromCache[typeKey])
        // if itemFromCache[typeKey] === false then break
        if (
          // if field is not found in cache then toggle to false
          !itemFromCache[typeKey].hasOwnProperty(field) && 
          !field.includes("__") && // ignore __alias and __args
          typeof prototype[typeKey][field] !== 'object') {
            prototype[typeKey][field] = false; 
        } 
        if ( 
          // if field contains a nested query, then recurse the function and iterate through the nested query
          !field.includes('__') && 
          typeof prototype[typeKey][field] === 'object') {
            // console.log("PRE-RECURSE prototype[typeKey][field]: ", prototype[typeKey][field]);
            // console.log("PRE-RECURSE itemFromCache: ", itemFromCache);
            buildFromCache(prototype[typeKey][field], prototypeKeys, itemFromCache[typeKey][field], false);
          } 
      }  
    }
  }
  // assign the value of an object with a key of data and a value of itemFromCache and return
  return { data: itemFromCache }


}

// helper function to take in queryProto and generate a cacheID from it
function generateCacheID(queryProto) {
  let cacheID = '';

  // identify ID fields
  // should be part of parseAST if we want to support custom ID fields
  cacheID += `${queryProto.__type}--${queryProto.__id}`;

  return cacheID;
}


module.exports = buildFromCache;