  function toggleProto(proto) {
    for (const key in proto) {
      if (Object.keys(proto[key]).length > 0) toggleProto(proto[key]);
      else proto[key] = false;
    }
  };
  
/** Helper function that loops over a collection of references,
   *  calling another helper function -- buildItem() -- on each. Returns an
   *  array of those collected items.
   */
  function buildArray(prototype, map, collection) {
    let response = [];
  
    for (let query in prototype) {
      // collection = 1.Object type field passed into buildArray() when called from buildItem() or 2.Obtained item from cache or 3.Empty array
      collection = collection || JSON.parse(sessionStorage.getItem(map[query])) || [];
      for (let item of collection) {
        response.push(buildItem(prototype[query], JSON.parse(sessionStorage.getItem(item)), map)); // 1st pass: builItem = prototype all true; sessionStorage = obj for each country
      }
    }
  
    return response;
  };
  
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
    let tempObj = {}; // gets all the in-cache data
    // Traverse fields in prototype (or nested field object type)
    for (let key in prototype) { // if key points to an object (an object type field, e.g. "cities" in a "country")
      if (typeof prototype[key] === 'object') {
        let prototypeAtKey = { [key]: prototype[key] }
        if (item[key] !== undefined) { // if in cache
          tempObj[key] = buildArray(prototypeAtKey, map, item[key])
        } else { // if not in cache
          toggleProto(prototypeAtKey)
        }
      } else if (prototype[key]) { // if field is scalar
        if (item[key] !== undefined) { // if in cache
          tempObj[key] = item[key];
        } else { // if not in cache
          prototype[key] = false;
        }
      }
    }
    return tempObj;
  }

  module.exports = buildArray;