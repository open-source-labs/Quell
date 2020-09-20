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

const ResultsHelper = (newList, sub, query, id, currentResults) => {
  
  for (let arr in currentResults) {

    //===========================//
    //===Alters the main array===//
    //===========================//

    if (newList) {
      const currentList = currentResults[arr]
      
      // determine whether we already have cities
      let alreadyHaveCities = false
      currentList.forEach(el => {
        if (typeof el === 'object') alreadyHaveCities = true
      })

      // determine whether newList has it
      let newListHasCities = false
      newList.forEach(el => {
        if (el === 'cities') newListHasCities = true
      })

      // if we already have it but new list doesn't, we're deleting it
      if (alreadyHaveCities === true && newListHasCities === false) {
        currentList.forEach((el, i) => {
          if (typeof el === 'object') currentList.splice(i, 1)
        })
      }

      // if new list has it but we don't, we're adding it with the default initial values
      if (alreadyHaveCities === false && newListHasCities === true) {
        currentList.push({'cities': ['name']})
      }

      currentResults[arr] = currentList; // if no cities, this doesn't get altered

      // if we are NOT DEALING WITH CITIES AT ALL
      if (alreadyHaveCities === false && newListHasCities === false) {
        currentResults[arr] = newList
      }

      // if we need to simply preserve cities as it is
      if (alreadyHaveCities === true && newListHasCities === true) {
        let storeCityObject;
        currentList.forEach(el => {
          if (typeof el === 'object') storeCityObject = el
        })

        // loop through newList and 
        const finalList = newList.map(el => {
          if (el === 'cities') {
            return storeCityObject
          }
          return el
        })
        currentResults[arr] = finalList
      }
    } 

    //===============================//
    //===Alters the city sub-array===//
    //===============================//

    if (sub) {
      const currentList = currentResults[arr]
      currentList.forEach((el, i) => {
        if (typeof el === 'object') {
          for (let x in el) {
            currentResults[arr][i][x] = sub
          }
        }
      })
    }

    //======================//
    //===Alters the query===//
    //======================//

    if (query) {
      if (query === 'country by id') {
        query = 'country (id:1)'
      };
      if (query === 'cities by country id') {
        query = 'citiesByCountry (country_id:1)'
      };
      currentResults[query] = currentResults[arr]
      delete currentResults[arr]
    }

    //===================//
    //===Alters the id===//
    //===================//
    
    if (id) {
      let query = arr
      if (query.includes(':')) {
        let index = query.indexOf(':')
        query = query.slice(0, index+1)
      }
      query += id + ')'
      currentResults[query] = currentResults[arr]
      delete currentResults[arr]
    }
  }
  
  // RETURN STATEMENT FOR ALL
  return currentResults
};

//======================================//
//========== RESULTS PARSER ============//
//======================================//

const ResultsParser = (results) => {
  const newString = [];
  results = JSON.stringify(results);
  console.log(results);
  let deleteClosingBracket = 0
  for (let i = 0; i < results.length; i++) {
    const char = results[i]

    if (char === '[') newString.push('{')
    else if (char === ']') newString.push('}')
    else if (char === '{' && results[i-1] === ',') {
      deleteClosingBracket+=1
    }
    else if (char === '}') {
      if (deleteClosingBracket > 0) {
        deleteClosingBracket-=1
      } else {
        newString.push(char)
      }
    }
    else if (char === ':' && results[i-1] === '"') {}
    else if (char === '"') {}
    else if (char === ',') newString.push(' ')
    else newString.push(char)
  }

  return newString.join('')
};

// console.log(ResultsParser(currentResults))




//======================================//
//========== CreateQueryStr ============//
//======================================//

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
};

//===== TESTS ======//
//======= ERROR LOG =======//

// note: In all of these, the parsed result (query) looks right, so I'm not sure if this is a back-end problem

/*
  Cannot read property 'population' of null
*/
const currentResults1 = { 'countries': ['id', {'cities': ['population']}] }
const currentResults2 = { 'country (id:4)': ['id', 'name', {'cities': ['id', 'name']}] } 
const currentResults3 = { 'citiesByCountry (country_id:4)': ['id', 'name', {'cities': ['id', 'name']}] }
const currentResults4 = { 'cities': ['country_id', 'name'] }

/*
  Cannot read property 'population' of null
*/
// const currentResults = { 'country (id:1)': ['id', 'name'] }


// console.log(CreateQueryStr(currentResults1))
// console.log(CreateQueryStr(currentResults2))
// console.log(CreateQueryStr(currentResults3))
// console.log(CreateQueryStr(currentResults4))


//===============EXPORT=================//
export { ResultsHelper, CreateQueryStr, ResultsParser };