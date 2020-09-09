/* 
=======EXAMPLE=======
*/

const map = {
  countries: {
    id: true,
    name: true,
    capital: false,
    cities: {
      country_id: true,
      id: true,
      population: false,
      name: false,
    },
  },
};

/* Explaination: The purpose of createQueryObj is to take in the prototype object representing the query and its
 fields and reduce it down to only the fields to be fetched from the server */

function createQueryObj(map) {
  const output = {};
  // !! assumes there is only ONE main query, and not multiples !!
  for (let key in map) {
    output[key] = reducer(map[key]);
  }

  function reducer(obj) {
    const fields = [];

    for (let key in obj) {
      // For each property, determine if the property is a false value...
      if (obj[key] === false) fields.push(key);
      // ...or another object type
      if (typeof obj[key] === 'object') {
        let newObjType = {};
        newObjType[key] = reducer(obj[key]);
        fields.push(newObjType);
      }
    }
    return fields;
  }
  return output;
}

const queryObject = createQueryObj(map);
console.log(JSON.stringify(queryObject));

/* 
=======EXPECTED RESULT=======

const output = { countries: ['capital', { cities: ['population', 'name'] }] };

*/

/* Explaination: The purpose of createQueryStr is to take in the parsed query object generated above and
create the actual query string to be sent in a post request to the graphql server */

function createQueryStr(queryObject) {
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

console.log(createQueryStr(queryObject));

/* 
=======EXPECTED RESULT=======

const output = { countries {capital cities { population name}}}

*/
