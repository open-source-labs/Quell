/* 
buildFromCache - iterates through the output of parseAST (which is an object) and checks the cache for each field in a query. If a field is NOT found in cache then that field will be toggled to false so that the next function knows to create a query string for that field so that it can be fetched from the server. If a field is found in the cache, then that data is saved in a __object and 

Inputs
  @prototype - object representation of a user's query after passing through parseAST
  e.g. samplePrototype = {
      country: {
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

//wrap all of buildFromCache in outer function
// all this outer function would do is create an object of prototype keys
//defines an innerFunc
//at the end of buildFromCache, we come out to the end of 
// TO-DO: update all getItems
function buildFromCache(prototype, prototypeKeys, itemFromCache = {}, firstRun = true) {
  
  // can we build prototypeKeys within the application?
  // const prototypeKeys = Object.keys(prototype)

  // update function to include responseFromCache
  // const buildProtoFunc = buildPrototypeKeys(prototype);
  // const prototypeKeys = buildProtoFunc();

  // 
  for (let typeKey in prototype) {
    // check if typeKey is a rootQuery (i.e. if it includes '--') or if its a field nested in a query
    // end goal: delete typeKey.includes('--') and check if protoObj.includes(typeKey)
    if (prototypeKeys.includes(typeKey)) {
      const cacheID = generateCacheID(prototype[typeKey]);
      //To do - won't always cache, bring map back or persist -- in parsedAST function?
      // if typeKey is a rootQuery, then clear the cache and set firstRun to true 
      // cached data must persist 
      // create a property on itemFromCache and set the value to the fetched response from cache
      itemFromCache[typeKey] = JSON.parse(sessionStorage.getItem(cacheID));
    }
    // if itemFromCache is an array (Array.isArray()) 
    if (Array.isArray(itemFromCache[typeKey])) {
      // iterate over countries
      itemFromCache[typeKey].forEach((currTypeKey, i) => {
        const cacheID = generateCacheID(prototype);
        const interimCache = JSON.parse(sessionStorage.getItem(currTypeKey));

        // console.log('currTypeKey', currTypeKey);
        // console.log('prototype in forEach: ', prototype)
        // console.log('[typeKey]: ', typeKey)
        // console.log('interimCache: ', interimCache);

        // loop through prototype at typeKey
        for (const property in prototype[typeKey]) {
          let tempObj = {};

          // if interimCache has the property
          if (
            interimCache.hasOwnProperty(property)
            && !property.includes('__')
          ) {
            // place on tempObj, set into array
            tempObj[property] = interimCache[property]
            itemFromCache[typeKey][i] = tempObj;
          } else if (!property.includes('__')) {
            // if interimCache does not have property, set to false on prototype so it is fetched
            prototype[typeKey][property] = false;
          }

        }
      })
      // reasign itemFromCache[typeKey] to false
      // itemFromCache[typeKey] = false;
    }
      // recurse through buildFromCache using typeKey, prototype
    // if itemFromCache is empty, then check the cache for data, else, persist itemFromCache
    // if this iteration is a nested query (i.e. if typeKey is a field in the query)
    else if (firstRun === false) {
      // console.log('iFC', itemFromCache);

      // if this field is NOT in the cache, then set this field's value to false
      if (
        (itemFromCache === null || !itemFromCache.hasOwnProperty(typeKey)) && 
        typeof prototype[typeKey] !== 'object' && !typeKey.includes('__')) {
          prototype[typeKey] = false; 
      } 
      // if this field is a nested query, then recurse the buildFromCache function and iterate through the nested query
      if (
        (itemFromCache === null || itemFromCache.hasOwnProperty(typeKey)) && 
        !typeKey.includes('__') && // do not iterate through __args or __alias
        typeof prototype[typeKey] === 'object') {
          const cacheID = generateCacheID(prototype);
          // console.log('cacheID not first Run', cacheID, 'typeKey', typeKey);
          itemFromCache[typeKey] = JSON.parse(sessionStorage.getItem(cacheID));
          // repeat function inside of the nested query
        buildFromCache(prototype[typeKey], prototypeKeys, itemFromCache[typeKey], false);
      } 
    }
    // if the current element is not a nested query, then iterate through every field on the typeKey
    else {
      for (let field in prototype[typeKey]) {
        // console.log('typeKey', typeKey, 'field: ', field);
        // console.log('itemFromCache: ', itemFromCache)
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

  // if ID field exists, set cache ID to 'fieldType--ID', otherwise just use fieldType
  const cacheID = queryProto.__id ? `${queryProto.__type}--${queryProto.__id}` : queryProto.__type;

  return cacheID;
}

/*
function toggleProto(proto) {
  for (const key in proto) {
    if (Object.keys(proto[key]).length > 0) {
      toggleProto(proto[key]);
    } else {
      proto[key] = false;
    }
  }
}
*/
/*
for (const key in fields) {
      // is fields[key] string? concat with inner string & empty space
      if (typeof fields[key] === "boolean") {
        innerStr += key + ' ';
      }
      // is key object? recurse && !key.includes('__')
      if (typeof fields[key] === 'object' && !key.includes('__')) {
        // do not grab __args 
        innerStr += `${key} ${getArgs(
          fields[key])} ${openCurly} ${stringify(
            fields[key])}${closeCurly}`;
        }
      }
*/

/** Helper function that loops over a collection of references,
 *  calling another helper function -- buildItem() -- on each. Returns an
 *  array of those collected items.
 */

// create a function called getItem that accepts key as an input 
// function getItem(key) {
//   let result = sessionStorage[key]
//   return result;
// }
  // if the object has a property 
  // if sessionStorage is true, then we can loop through (for in) the sessionStorage object 
  // iterate through the key, and anything to the right of the - character, needs to be stored


//add usable comments to code


//refactor and look at old code to see any potential for improvements?







//when we are done recursing and we are done with first query, 
//reset for new query 

//after run is complete, clear itemFromCache, and flip back to true
/*
    // if no arguments are passed in 
    // loop through properties in 
      // let itemFromCache = JSON.parse(sessionStorage.getItem(prop))
    if (prototype[typeKey]["__args"] !== {}) {
      for (let fieldKey in prototype[typeKey]["__args"]) {
        //if this argument isn't in the cache (sessionStorage)
          
        //   //return prototype
        // return prototype;
        }
        else (itemFromCache === {}) {
          // toggle this field to false
          // and let Thomas/Angela know that it needs to be fetched from the DB
        }
        // store user defined ids such as authorid or bookId
        // catches differences between id, ID, Id
        let userDefinedId;
        if ((fieldKey.includes('id') || fieldKey.includes('ID') || fieldKey.includes('Id')) && (fieldKey !== 'id' && fieldKey !== '_id')) {
          userDefinedId = prototype[typeKey]["__args"][fieldKey];
        }
        // for (let arg of protoArgs[fieldName]) {
        //   for (let key in arg) {
        let identifier;
        if (fieldKey === 'id' || fieldKey === '_id') {
          identifier = prototype[typeKey]["__args"][fieldKey];
          // if (itemFromCache) {
          //     collection.push(itemFromCache);
          // }
          
          // for (let item of collection) {
          //   response.push(buildItem(prototype[typeKey], item, map));
          // }
          console.log('itemFromCache', itemFromCache);
        }
      }
    }
    else {
      
    }
  }

    }
  }


        // collection = 1.Object typ e field passed into buildArray() when called from buildItem() or 2.Obtained item from cache or 3.Empty array
        // query = 'Country-2'
        // itemFromCache = {id: "2"}

        //{id: "2"};
        // to do: nested queries -- how to recurse 
            // [{ id: '2', capital: 'Sucre', cities: ['City-5', 'City-6', 'City-7', 'City-8', 'City-9', 'City-10']] or null
        

              //             
//           }

//           if (userDefinedId) {
//             // collection = 1.Object typ e field passed into buildArray() when called from buildItem() or 2.Obtained item from cache or 3.Empty array
//             const itemFromCache = JSON.parse(
//               sessionStorage.getItem(`${query}-${userDefinedId}`)
//             );
//             console.log('itemFromCache', `${query}-${userDefinedId}`);

//             // [{ id: '2', capital: 'Sucre', cities: ['City-5', 'City-6', 'City-7', 'City-8', 'City-9', 'City-10']] or null

//             collection = collection || [];

//             if (itemFromCache) {
//               collection = Array.isArray(itemFromCache)
//                 ? itemFromCache
//                 : [itemFromCache];
//             }

//             for (let item of collection) {
//               response.push(
//                 buildItem(
//                   prototype[query],
//                   JSON.parse(sessionStorage.getItem(item)),
//                   map
//                 )
//               ); // 1st pass: builItem = prototype all true; sessionStorage = obj for each country
//             }
//           }
//         }
//       }
//     } 
//     // else if (QuellStore && QuellStore.arguments && QuellStore.alias) {
//       /**
//        * Can fully cache aliaes by different id,
//        * and can build response from cache with previous query with exact aliases
//        * (comment out aliaes functionality now)
//        */
//       // for (let fieldName in QuellStore.arguments) {
//       //   collection = collection || [];
//       //   for (let i = 0; i < QuellStore.arguments[fieldName].length; i++) {
//       //     const arg = QuellStore.arguments[fieldName][i];
//       //     let identifier;
//       //     if (arg.hasOwnProperty('id') || arg.hasOwnProperty('_id')) {
//       //       identifier = arg.id || arg._id;
//       //     }
//       //     // collection = 1.Object typ e field passed into buildArray() when called from buildItem() or 2.Obtained item from cache or 3.Empty array
//       //     const itemFromCache = JSON.parse(
//       //       sessionStorage.getItem(`${map[query]}-${identifier}`)
//       //     );
//       //     // [{ id: '2', capital: 'Sucre', cities: ['City-5', 'City-6', 'City-7', 'City-8', 'City-9', 'City-10']] or null
//       //     if (itemFromCache) {
//       //       collection = [itemFromCache];
//       //     }
//       //     for (let item of collection) {
//       //       response.push({
//       //         [QuellStore.alias[fieldName][i]]: buildItem(
//       //           prototype[query],
//       //           item,
//       //           map
//       //         ),
//       //       });
//       //     }
//       //   }
//       // }
//     // } 
//     // else {
//       // if the query has no arguments

//       // collection = 1.Object type field passed into buildArray() when called from buildItem() or
//       //2.Obtained item from cache or 3.Empty array
//       collection =
//         collection || JSON.parse(sessionStorage.getItem(map[query])) || [];
//       //  ["Country-1", "Country-2", "Country-3", "Country-4", "Country-5"] or [];
//       // each of these items in the array is the item below

//       for (let item of collection) {
//         response.push(
//           buildItem(
//             prototype[query],
//             JSON.parse(sessionStorage.getItem(item)),
//             map
//           )
//         ); // 1st pass: builItem = prototype all true; sessionStorage = obj for each country
//       }
//     // }
//   }
//   return response;
// }

/** Helper function that iterates through keys -- defined on passed-in
 *  prototype object, which is always a fragment of this.proto, assigning
 *  to tempObj the data at matching keys in passed-in item. If a key on
 *  the prototype has an object as its value, buildArray is
 *   recursively called.
 *
 *  If item does not have a key corresponding to prototype, that field
 *  is toggled to false on prototype object. Data for that field will
 *  need to be queried.
 *
 */

// function buildItem(prototype, item, map) {

//   let tempObj = {}; // gets all the in-cache data
//   // Traverse fields in prototype (or nested field object type)
//   for (let key in prototype) {
//     // if key points to an object (an object type field, e.g. "cities" in a "country")
//     if (typeof prototype[key] === 'object') {
//       let prototypeAtKey = { [key]: prototype[key] };

//       if (item[key] !== undefined) {
//         // if in cache
//         tempObj[key] = buildFromCache(prototypeAtKey, map, item[key]);
//       } else {
//         // if not in cache
//         toggleProto(prototypeAtKey);
//       }
//     } else {
//       // if field is scalar
//       if (item[key] !== undefined) {
//         // if in cache
//         tempObj[key] = item[key];
//       } else {
//         // if not in cache
//         prototype[key] = false;
//       }
//     }
//   }
//   return tempObj;
// }

module.exports = buildFromCache;
