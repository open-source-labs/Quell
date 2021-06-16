function toggleProto(proto) {
  for (const key in proto) {
    if (Object.keys(proto[key]).length > 0) {
      toggleProto(proto[key]);
    } else {
      proto[key] = false;
    }
  }
}

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

function buildFromCache(prototype, itemFromCache = {}, firstRun = true) {
  for (let typeKey in prototype) {
    
    if(typeKey === '--') { //won't always cache, bring map back?
      itemFromCache = {};
      firstRun = true;
    }

    itemFromCache = (itemFromCache && Object.keys(itemFromCache).length === 0) ? JSON.parse(sessionStorage.getItem(typeKey)) : itemFromCache;

    if(firstRun === false) {
      if (
        (itemFromCache === null || !itemFromCache.hasOwnProperty(typeKey)) && 
        typeof prototype[typeKey] !== 'object') {
          prototype[typeKey] = false; 
      } 
      if (
        (itemFromCache === null || itemFromCache.hasOwnProperty(typeKey)) && 
        !typeKey.includes('__') && 
        typeof prototype[typeKey] === 'object') { 
          // recurse the call, buildFromCache, w/ args prototype = prototype[typeKey][field], itemFromCache = itemFromCache[field]
          buildFromCache(prototype[typeKey], itemFromCache[typeKey]);
      } 
    }

    // write for loop through each field on typeKey
    //if itemFromCache !'has own property' called field is true
    else {
      for (let field in prototype[typeKey]) {
        if (
          !itemFromCache.hasOwnProperty(field) && 
          !field.includes("__") && 
          typeof prototype[typeKey][field] !== 'object') {
            prototype[typeKey][field] = false; 
        } 
        if ( 
          !field.includes('__') && 
          typeof prototype[typeKey][field] === 'object') { 
            // recurse the call, buildFromCache, w/ args prototype = prototype[typeKey][field], itemFromCache = itemFromCache[field]
            buildFromCache(prototype[typeKey][field], itemFromCache[field], false);
          } 
      }  
    }
  }
  return prototype;
}

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
