function normalizeForCache(responseData, map, protoField, fieldsMap) {
  // iterate over keys in our response data object 
  for (const resultName in responseData) {
    // currentField we are iterating over
    const currField = responseData[resultName];
    // check if the value stored at that key is array 
    if (Array.isArray(currField)) {
      // RIGHT NOW: countries: [{}, {}]
      // GOAL: countries: ["Country--1", "Country--2"]

      // create empty array to store refs
      // ie countries: ["country--1", "country--2"]
      const refList = [];

      // iterate over countries array
      currField.forEach(el => {
        // el1 = {id: 1, name: Andorra}, el2 =  {id: 2, name: Bolivia}
        // for each object
        // "resultName" is key on "map" for our Data Type
        const dataType = map[resultName];

        // grab ID from object we are iterating over
        let fieldID = dataType;
        for (const key in el) {
          // if key is an ID, append to fieldID for caching
          if (key === 'id' || key === '_id' || key === 'ID' || key === 'Id') {
            fieldID += `--${el[key]}`;
            // push fieldID onto refList
            refList.push(fieldID);
          }
        }

        // if object, recurse to add all nested values of el to cache as individual entries
        if (typeof el === 'object') {
          normalizeForCache({ [dataType]: el }, map,  { [dataType]: protoField[resultName][fieldID]});
        }
      })

      sessionStorage.setItem(resultName, JSON.stringify(refList));
    }
    else if (typeof currField === 'object') {
      // temporary store for field properties
      const fieldStore = {};
      
      // if object has id, generate fieldID 
      let fieldID = resultName;

      // iterate over keys in object
      // "id, name, cities"
      for (const key in currField) {
        // if ID, create fieldID
        if (key === 'id' || key === '_id' || key === 'ID' || key === 'Id') {
          fieldID += `--${currField[key]}`;
        }
        fieldStore[key] = currField[key];

        // if object, recurse normalizeForCache assign in that object
        // must also pass in protoFields object to pair arguments, aliases with response
        if (typeof currField[key] === 'object') {
          normalizeForCache({ [key]: currField[key] }, map, { [key]: protoField[resultName][key]});
        }
      }
      // store "current object" on cache in JSON format
      sessionStorage.setItem(fieldID, JSON.stringify(fieldStore));
    }
  }
}