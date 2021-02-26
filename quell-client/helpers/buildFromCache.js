function toggleProto(proto) {
  for (const key in proto) {
    if (Object.keys(proto[key]).length > 0) {
      toggleProto(proto[key]);
    } else {
      proto[key] = false;
    }
  }
}

/** Helper function that loops over a collection of references,
 *  calling another helper function -- buildItem() -- on each. Returns an
 *  array of those collected items.
 */
function buildFromCache(prototype, map, collection, QuellStore) {
  console.log(
    "prototype in buildFromCache ===> ",
    JSON.parse(JSON.stringify(prototype))
  );
  console.log("map in buildFromCache ===> ", map);
  console.log("collection in buildFromCache ===> ", collection);
  console.log("QuellStore in buildFromCache ===> ", QuellStore);

  let response = [];
  for (let query in prototype) {
    // if QuellStore.arguments is not null
    if (QuellStore && QuellStore.arguments && !QuellStore.alias) {
      for (let fieldName in QuellStore.arguments) {
        for (let arg of QuellStore.arguments[fieldName]) {
          // console.log('arg ===> ', arg);
          let identifier;

          if (arg.hasOwnProperty("id") || arg.hasOwnProperty("_id")) {
            identifier = arg.id || arg._id;
          }

          // collection = 1.Object typ e field passed into buildArray() when called from buildItem() or 2.Obtained item from cache or 3.Empty array

          const itemFromCache = JSON.parse(
            sessionStorage.getItem(`${map[query]}-${identifier}`)
          );

          console.log("itemFromCache", itemFromCache);
          // [{ id: '2', capital: 'Sucre', cities: ['City-5', 'City-6', 'City-7', 'City-8', 'City-9', 'City-10']] or null

          collection = collection || [];

          if (itemFromCache) {
            collection = [itemFromCache];
          }

          console.log("collection ===> ", collection);

          for (let item of collection) {
            response.push(buildItem(prototype[query], item, map));
          }
        }
      }
    } else if (QuellStore && QuellStore.arguments && QuellStore.alias) {
      /**
       * Can fully cache aliaes by different id,
       * and can build response from cache with previous query with exact aliases
       * (comment out buildFromCache if alias exist now)
       */
      // for (let fieldName in QuellStore.arguments) {
      //   collection = collection || [];
      //   for (let i = 0; i < QuellStore.arguments[fieldName].length; i++) {
      //     const arg = QuellStore.arguments[fieldName][i];
      //     console.log('arg ===> ', arg);
      //     let identifier;
      //     if (arg.hasOwnProperty('id') || arg.hasOwnProperty('_id')) {
      //       identifier = arg.id || arg._id;
      //     }
      //     // collection = 1.Object typ e field passed into buildArray() when called from buildItem() or 2.Obtained item from cache or 3.Empty array
      //     const itemFromCache = JSON.parse(
      //       sessionStorage.getItem(`${map[query]}-${identifier}`)
      //     );
      //     console.log('itemFromCache', itemFromCache);
      //     // [{ id: '2', capital: 'Sucre', cities: ['City-5', 'City-6', 'City-7', 'City-8', 'City-9', 'City-10']] or null
      //     if (itemFromCache) {
      //       collection = [itemFromCache];
      //     }
      //     console.log(
      //       'collection ===> ',
      //       JSON.parse(JSON.stringify(collection))
      //     );
      //     for (let item of collection) {
      //       response.push({
      //         [QuellStore.alias[fieldName][i]]: buildItem(
      //           prototype[query],
      //           item,
      //           map
      //         ),
      //       });
      //     }
      //   }
      // }
    } else {
      // if the query has no arguments

      // collection = 1.Object type field passed into buildArray() when called from buildItem() or
      //2.Obtained item from cache or 3.Empty array
      collection =
        collection || JSON.parse(sessionStorage.getItem(map[query])) || [];
      console.log("collection if the query has no argument ===> ", collection);
      //  ["Country-1", "Country-2", "Country-3", "Country-4", "Country-5"] or [];
      // each of these items in the array is the item below

      for (let item of collection) {
        response.push(
          buildItem(
            prototype[query],
            JSON.parse(sessionStorage.getItem(item)),
            map
          )
        ); // 1st pass: builItem = prototype all true; sessionStorage = obj for each country
      }
    }
  }
  console.log("response ===> !!!!!!!!!!!", response);
  return response;
}

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

function buildItem(prototype, item, map) {
  console.log(
    "prototype in buildItem ===> ",
    JSON.parse(JSON.stringify(prototype))
  );
  console.log("item in buildItem ===> ", item);
  console.log("map in buildItem ===> ", map);
  let tempObj = {}; // gets all the in-cache data
  // Traverse fields in prototype (or nested field object type)
  for (let key in prototype) {
    // if key points to an object (an object type field, e.g. "cities" in a "country")
    if (typeof prototype[key] === "object") {
      let prototypeAtKey = { [key]: prototype[key] };
      console.log(
        "prototypeAtKey = { [key]: prototype[key] } !!!!!! ===> ",
        prototypeAtKey
      );
      if (item[key] !== undefined) {
        // if in cache
        tempObj[key] = buildFromCache(prototypeAtKey, map, item[key]);
        console.log("tempObj[key] ===> ", tempObj[key]);
      } else {
        // if not in cache
        toggleProto(prototypeAtKey);
      }
    } else {
      // if field is scalar
      if (item[key] !== undefined) {
        // if in cache
        tempObj[key] = item[key];
      } else {
        // if not in cache
        prototype[key] = false;
      }
    }
  }
  return tempObj;
}

module.exports = buildFromCache;
