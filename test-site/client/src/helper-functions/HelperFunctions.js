// node HelperFunctions.js
/* 
  newList 
    - whatever is passed in here are the main array fields
    - looks like: ['name', 'id', 'capital']
  sub 
    - whatever is passed in here are the sub-array (cities) fields
    - looks like: ['name', 'population', 'country_id']
  currentResults 
    - comes from the state
    - looks like: { QUERY: ['item1', 'item2', {'cities': ['item1', 'item2']}] }
*/

const currentResults = {
  "country by id-1": ["item1", "item2", { cities: ["item1", "item2"] }],
};

const ResultsHelper = (newList, sub, query, id, currentResults) => {
  for (let arr in currentResults) {
    //===========================//
    //===Alters the main array===//
    //===========================//

    if (newList) {
      const currentList = currentResults[arr];

      // determine whether we already have cities
      let alreadyHaveCities = false;
      currentList.forEach((el) => {
        if (typeof el === "object") alreadyHaveCities = true;
      });

      // determine whether newList has it
      let newListHasCities = false;
      newList.forEach((el) => {
        if (el === "cities") newListHasCities = true;
      });

      // if we already have it but new list doesn't, we're deleting it
      if (alreadyHaveCities === true && newListHasCities === false) {
        currentList.forEach((el, i) => {
          if (typeof el === "object") currentList.splice(i, 1);
        });
      }

      // if new list has it but we don't, we're adding it with the default initial values
      if (alreadyHaveCities === false && newListHasCities === true) {
        currentList.push({ cities: ["name"] });
      }

      currentResults[arr] = currentList; // if no cities, this doesn't get altered

      // if we are NOT DEALING WITH CITIES AT ALL
      if (alreadyHaveCities === false && newListHasCities === false) {
        currentResults[arr] = newList;
      }

      // if we need to simply preserve cities as it is
      if (alreadyHaveCities === true && newListHasCities === true) {
        let storeCityObject;
        currentList.forEach((el) => {
          if (typeof el === "object") storeCityObject = el;
        });

        // loop through newList and
        const finalList = newList.map((el) => {
          if (el === "cities") {
            return storeCityObject;
          }
          return el;
        });
        currentResults[arr] = finalList;
      }
    }

    //===============================//
    //===Alters the city sub-array===//
    //===============================//

    if (sub) {
      const currentList = currentResults[arr];
      currentList.forEach((el, i) => {
        if (typeof el === "object") {
          for (let y in el) {
            currentResults[arr][i][y] = sub;
          }
        }
      });
    }

    //======================//
    //===Alters the query===//
    //======================//

    if (query) {
      currentResults[query] = currentResults[arr];
      delete currentResults[arr];
    }

    if (id) {
      const idString = "-" + id.toString();
      let query = arr;
      if (query.includes("-")) {
        let index = query.indexOf("-");
        query = query.slice(0, index);
      }
      query += idString;
      currentResults[query] = currentResults[arr];
      delete currentResults[arr];
    }
  }

  // RETURN STATEMENT FOR ALL
  return currentResults;
};

// const currentResults = {
//   "country by id-1": ["item1", "item2", { cities: ["item1", "item2"] }],
// };

const ResultsParser = (results) => {
  const newString = [];
  results = JSON.stringify(results);
  console.log(results);
  for (let i = 0; i < results.length; i++) {
    const letter = results[i]
  }
};

//===============EXPORT=================//
export { ResultsHelper };

// Some tests below
console.log(ResultsParser(currentResults));

// console.log(ResultsHelper(0, 0, 0, 3, currentResults)) // QUERY TEST
// console.log(outputFunction(['name', 'id', 'capital'], 0, 0)) // Main Array Test
// console.log(outputFunction(['name', 'id', 'capital', 'cities'], 0, 0)) // Should just add capital without deleting
// console.log(outputFunction(['name', 'id', 'cities', 'capital'], 0, 0)) // Should come back with cities

// If it's from the cities sub-array, the incoming params will look like this;
// console.log(outputFunction(0, ['name'], 0)) // Should only alter the cities
// console.log(outputFunction(0, ['name'], 0)) // Should only alter the cities sub-array sub-array
