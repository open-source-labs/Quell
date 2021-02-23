/**
 * @param {Array} newList - Array of query fields
 * @param {Array} sub - Array of query fields in the sub-query (aka "cities" in "countries")
 * @param {string} query - the query name for ex: "countries" or "cities"
 * @param {string} id - a number when querying by id
 * @param {Object} currentResults - the last output of the function - looks like { countries: ['id', 'name', {'cities': ['id', 'name']}] }
 */

/* 
  Used in Query and Demo
  
  newList 
    - whatever is passed in here are the main array fields
    - looks like: ['name', 'id', 'capital']
  sub 
    - whatever is passed in here are the sub-array (cities) fields
    - looks like: ['name', 'population', 'country_id']
  query
    - argument is passed here when changing query
  id
    - argument is passed here when changing query (only on "query by id")
  currentResults 
    - comes from the state
    - looks like: { QUERY: ['item1', 'item2', {'cities': ['item1', 'item2']}] }
*/

const ResultsHelper = (newList, sub, query, id, currentResults) => {
  // console.log('newList ===> ', newList);
  // console.log('sub ===> ', sub);
  // console.log('query ===> ', query);
  // console.log('id ===> ', id);
  // console.log('currentResults ===> ', currentResults);

  for (let arr in currentResults) {
    //===========================//
    //===Alters the main array===//
    //===========================//

    if (newList) {
      const currentList = currentResults[arr];

      // determine whether we already have cities
      let alreadyHaveCities = false;
      currentList.forEach((el) => {
        if (typeof el === 'object') alreadyHaveCities = true;
      });

      // determine whether newList has it
      let newListHasCities = false;
      newList.forEach((el) => {
        if (el === 'cities') newListHasCities = true;
      });

      // if we already have it but new list doesn't, we're deleting it
      if (alreadyHaveCities === true && newListHasCities === false) {
        currentList.forEach((el, i) => {
          if (typeof el === 'object') currentList.splice(i, 1);
        });
      }

      // if new list has it but we don't, we're adding it with the default initial values
      if (alreadyHaveCities === false && newListHasCities === true) {
        currentList.push({ cities: ['id'] });
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
          if (typeof el === 'object') storeCityObject = el;
        });

        // loop through newList and
        const finalList = newList.map((el) => {
          if (el === 'cities') {
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
        if (typeof el === 'object') {
          for (let x in el) {
            currentResults[arr][i][x] = sub;
          }
        }
      });
    }

    //======================//
    //===Alters the query===//
    //======================//

    if (query) {
      let fields;
      if (query === 'country by id') {
        query = 'country (id:1)';
        fields = currentResults[arr];
      }
      if (query === 'cities by country id') {
        query = 'citiesByCountry (country_id:1)';
        fields = currentResults[arr];
      }
      if (query === 'countries' || query === 'cities') {
        fields = ['id'];
      }
      currentResults[query] = fields;
      delete currentResults[arr];
    }

    //===================//
    //===Alters the id===//
    //===================//

    if (id) {
      let query = arr;
      if (query.includes(':')) {
        let index = query.indexOf(':');
        query = query.slice(0, index + 1);
      }
      query += id + ')';
      currentResults[query] = currentResults[arr];
      delete currentResults[arr];
    }
  }

  // RETURN STATEMENT FOR ALL
  return currentResults;
};

//======================================//
//========== CreateQueryStr ============//
//======================================//

/**
 * @param {Object} currentResults - looks like { countries: ['id', 'name', {'cities': ['id', 'name']}] }
 */

function CreateQueryStr(queryObject) {
  const openCurl = ' { ';
  const closedCurl = ' } ';

  let mainStr = '';

  for (let key in queryObject) {
    mainStr += key + openCurl + stringify(queryObject[key]) + closedCurl;
  }

  function stringify(fieldsArray) {
    let innerStr = '';
    for (let i = 0; i < fieldsArray.length; i++) {
      if (typeof fieldsArray[i] === 'string') {
        innerStr += fieldsArray[i] + ' ';
      }
      if (typeof fieldsArray[i] === 'object') {
        for (let key in fieldsArray[i]) {
          innerStr += key + openCurl + stringify(fieldsArray[i][key]);
          innerStr += closedCurl;
        }
      }
    }
    return innerStr;
  }
  return openCurl + mainStr + closedCurl;
}

//===============EXPORT=================//

export { ResultsHelper, CreateQueryStr };
