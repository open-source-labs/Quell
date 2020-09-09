const response = [
  {
    "id": "1",
    "name": "Andorra"
  },
  {
    "id": "2",
    "name": "Bolivia"
  },
  {
    "id": "3",
    "name": "Armenia"
  },
  {
    "id": "4",
    "name": "American Samoa"
  },
  {
    "id": "5",
    "name": "Aruba"
  }
];

const countriesAll =
{
  "countries": [
    {
      "id": "1",
      "name": "Andorra",
      "capital": "Andorra la Vella",
      "cities": [
        {
          "country_id": "1",
          "id": "1",
          "name": "El Tarter",
          "population": 1052
        },
        {
          "country_id": "1",
          "id": "2",
          "name": "La Massana",
          "population": 7211
        },
        {
          "country_id": "1",
          "id": "3",
          "name": "Canillo",
          "population": 3292
        },
        {
          "country_id": "1",
          "id": "4",
          "name": "Andorra la Vella",
          "population": 20430
        }
      ]
    },
    {
      "id": "2",
      "name": "Bolivia",
      "capital": "Sucre",
      "cities": [
        {
          "country_id": "2",
          "id": "5",
          "name": "Jorochito",
          "population": 4013
        },
        {
          "country_id": "2",
          "id": "6",
          "name": "Tupiza",
          "population": 22233
        },
        {
          "country_id": "2",
          "id": "7",
          "name": "Puearto Pailas",
          "population": 0
        },
        {
          "country_id": "2",
          "id": "8",
          "name": "Capinota",
          "population": 5157
        },
        {
          "country_id": "2",
          "id": "9",
          "name": "Camargo",
          "population": 4715
        },
        {
          "country_id": "2",
          "id": "10",
          "name": "Villa Serrano",
          "population": 0
        }
      ]
    },
    {
      "id": "3",
      "name": "Armenia",
      "capital": "Yerevan",
      "cities": [
        {
          "country_id": "3",
          "id": "11",
          "name": "Voskevaz",
          "population": 3789
        },
        {
          "country_id": "3",
          "id": "12",
          "name": "Gavarr",
          "population": 21680
        },
        {
          "country_id": "3",
          "id": "13",
          "name": "Nizami",
          "population": 1060
        },
        {
          "country_id": "3",
          "id": "14",
          "name": "Metsavan",
          "population": 4767
        },
        {
          "country_id": "3",
          "id": "15",
          "name": "Hnaberd",
          "population": 1817
        }
      ]
    },
    {
      "id": "4",
      "name": "American Samoa",
      "capital": "Pago Pago",
      "cities": [
        {
          "country_id": "4",
          "id": "16",
          "name": "Tāfuna",
          "population": 11017
        },
        {
          "country_id": "4",
          "id": "17",
          "name": "Aūa",
          "population": 2124
        },
        {
          "country_id": "4",
          "id": "18",
          "name": "Malaeimi",
          "population": 1261
        },
        {
          "country_id": "4",
          "id": "19",
          "name": "Taulaga",
          "population": 37
        },
        {
          "country_id": "4",
          "id": "20",
          "name": "Fagatogo",
          "population": 1868
        }
      ]
    },
    {
      "id": "5",
      "name": "Aruba",
      "capital": "Oranjestad",
      "cities": [
        {
          "country_id": "5",
          "id": "21",
          "name": "Oranjestad",
          "population": 29998
        }
      ]
    }
  ]
}

// already JSON parsed
// const fetchResponse = // capital
// {
//   "countries": [
//     {
//       "capital": "Andorra la Vella"
//     },
//     {
//       "capital": "Sucre"
//     },
//     {
//       "capital": "Yerevan"
//     },
//     {
//       "capital": "Pago Pago"
//     },
//     {
//       "capital": "Oranjestad"
//     }
//   ]
// }

// const fetchResponse = // cities
// {
//   "countries": [
//     {
//       "cities": [
//         {
//           "country_id": "1",
//           "id": "1",
//           "name": "El Tarter",
//           "population": 1052
//         },
//         {
//           "country_id": "1",
//           "id": "2",
//           "name": "La Massana",
//           "population": 7211
//         },
//         {
//           "country_id": "1",
//           "id": "3",
//           "name": "Canillo",
//           "population": 3292
//         },
//         {
//           "country_id": "1",
//           "id": "4",
//           "name": "Andorra la Vella",
//           "population": 20430
//         }
//       ]
//     },
//     {
//       "cities": [
//         {
//           "country_id": "2",
//           "id": "5",
//           "name": "Jorochito",
//           "population": 4013
//         },
//         {
//           "country_id": "2",
//           "id": "6",
//           "name": "Tupiza",
//           "population": 22233
//         },
//         {
//           "country_id": "2",
//           "id": "7",
//           "name": "Puearto Pailas",
//           "population": 0
//         },
//         {
//           "country_id": "2",
//           "id": "8",
//           "name": "Capinota",
//           "population": 5157
//         },
//         {
//           "country_id": "2",
//           "id": "9",
//           "name": "Camargo",
//           "population": 4715
//         },
//         {
//           "country_id": "2",
//           "id": "10",
//           "name": "Villa Serrano",
//           "population": 0
//         }
//       ]
//     },
//     {
//       "cities": [
//         {
//           "country_id": "3",
//           "id": "11",
//           "name": "Voskevaz",
//           "population": 3789
//         },
//         {
//           "country_id": "3",
//           "id": "12",
//           "name": "Gavarr",
//           "population": 21680
//         },
//         {
//           "country_id": "3",
//           "id": "13",
//           "name": "Nizami",
//           "population": 1060
//         },
//         {
//           "country_id": "3",
//           "id": "14",
//           "name": "Metsavan",
//           "population": 4767
//         },
//         {
//           "country_id": "3",
//           "id": "15",
//           "name": "Hnaberd",
//           "population": 1817
//         }
//       ]
//     },
//     {
//       "cities": [
//         {
//           "country_id": "4",
//           "id": "16",
//           "name": "Tāfuna",
//           "population": 11017
//         },
//         {
//           "country_id": "4",
//           "id": "17",
//           "name": "Aūa",
//           "population": 2124
//         },
//         {
//           "country_id": "4",
//           "id": "18",
//           "name": "Malaeimi",
//           "population": 1261
//         },
//         {
//           "country_id": "4",
//           "id": "19",
//           "name": "Taulaga",
//           "population": 37
//         },
//         {
//           "country_id": "4",
//           "id": "20",
//           "name": "Fagatogo",
//           "population": 1868
//         }
//       ]
//     },
//     {
//       "cities": [
//         {
//           "country_id": "5",
//           "id": "21",
//           "name": "Oranjestad",
//           "population": 29998
//         }
//       ]
//     }
//   ]
// }

const fetchResponse = // capital & cities
{
  "countries": [
    {
      "capital": "Andorra la Vella",
      "cities": [
        {
          "country_id": "1",
          "id": "1",
          "name": "El Tarter",
          "population": 1052,
          "newArr": [{
            "prop1": true,
            "prop1Array": [{"prop1ArrObj": [{
              "end": "Hello"
            }]}],
          }, {
            "prop2": true,
          }]
        },
        {
          "country_id": "1",
          "id": "2",
          "name": "La Massana",
          "population": 7211
        },
        {
          "country_id": "1",
          "id": "3",
          "name": "Canillo",
          "population": 3292
        },
        {
          "country_id": "1",
          "id": "4",
          "name": "Andorra la Vella",
          "population": 20430
        }
      ]
    },
    {
      "capital": "Sucre",
      "cities": [
        {
          "country_id": "2",
          "id": "5",
          "name": "Jorochito",
          "population": 4013
        },
        {
          "country_id": "2",
          "id": "6",
          "name": "Tupiza",
          "population": 22233
        },
        {
          "country_id": "2",
          "id": "7",
          "name": "Puearto Pailas",
          "population": 0
        },
        {
          "country_id": "2",
          "id": "8",
          "name": "Capinota",
          "population": 5157
        },
        {
          "country_id": "2",
          "id": "9",
          "name": "Camargo",
          "population": 4715
        },
        {
          "country_id": "2",
          "id": "10",
          "name": "Villa Serrano",
          "population": 0
        }
      ]
    },
    {
      "capital": "Yerevan",
      "cities": [
        {
          "country_id": "3",
          "id": "11",
          "name": "Voskevaz",
          "population": 3789
        },
        {
          "country_id": "3",
          "id": "12",
          "name": "Gavarr",
          "population": 21680
        },
        {
          "country_id": "3",
          "id": "13",
          "name": "Nizami",
          "population": 1060
        },
        {
          "country_id": "3",
          "id": "14",
          "name": "Metsavan",
          "population": 4767
        },
        {
          "country_id": "3",
          "id": "15",
          "name": "Hnaberd",
          "population": 1817
        }
      ]
    },
    {
      "capital": "Pago Pago",
      "cities": [
        {
          "country_id": "4",
          "id": "16",
          "name": "Tāfuna",
          "population": 11017
        },
        {
          "country_id": "4",
          "id": "17",
          "name": "Aūa",
          "population": 2124
        },
        {
          "country_id": "4",
          "id": "18",
          "name": "Malaeimi",
          "population": 1261
        },
        {
          "country_id": "4",
          "id": "19",
          "name": "Taulaga",
          "population": 37
        },
        {
          "country_id": "4",
          "id": "20",
          "name": "Fagatogo",
          "population": 1868
        }
      ]
    },
    {
      "capital": "Oranjestad",
      "cities": [
        {
          "country_id": "5",
          "id": "21",
          "name": "Oranjestad",
          "population": 29998
        }
      ]
    }
  ]
}


// console.log(fetchResponse.countries);


// Assumed that fetched data comes back in similar ordered list; trverse response array to join each item with fetched data array items
// Make sure that fetched response is converted into array, e.g. fetchResponse.countries, before passing into function

const fetchedArray = fetchResponse.countries;

// function joinResponses(responseArray, fetchedResponseArray) {
  // // create new array and create new object items by joining original response items with fetched response items
  // return responseArray.map((response, index) => {
  //   return Object.assign(response, fetchedResponseArray[index]);
  // })

  // const joinedArray = [];
  // for (let i = 0; i < responseArray.length; i++) {
  //   joinedArray.push(Object.assign(responseArray[i], fetchedResponseArray[i]));
  // }
  // return joinedArray;
// }

// console.log(joinResponses(response, fetchedArray)[0].cities[0].newArr[0].prop1Array[0].prop1ArrObj)


function joinResponses(responseArray, fetchedResponseArray) { // Inputs array of objects containing cached fields & array of objects containing newly query fields
  // main output that will contain objects with combined fields
  const joinedArray = [];
  
  // iterate over each response array object (i.e. objects containing cached fields)
  for (let i = 0; i < responseArray.length; i++) {
    // set corresponding objects in each array to combine (NOTE: ASSUMED THAT FETCH ARRAY WILL BE SORTED THE SAME AS CACHED ARRAY)
    const responseItem = responseArray[i];
    const fetchedItem = fetchedResponseArray[i];

    // recursive helper function to add fields of second argument to first argument
    function fieldRecurse(objStart, objAdd) {
      // traverse object properties to add
      for (let field in objAdd) {
        // if field is an object (i.e. non-scalar), 1. set new field as empty array, 2. iterate over array, 3. create new objects , 4. push new objects to empty array
        if (typeof objAdd[field] === 'object') {
          // WOULD DATA TYPE BE AN {} ????
          
          // if type is []
          // set new field on starting object equal empty array
          objStart[field] = [];
          // declare variable eual to array of items to add from
          const objArr = objAdd[field];
          // iterate over array
          for (let j = 0; j < objArr.length; j++) {
            // push to new array the return value of invoking this same fieldRecurse() function.  fieldRecurse() will combine the nested array elements with the new obj field.
            objStart[field].push(fieldRecurse({}, objArr[j]));
          }
        } else {
          // if field is scalar, simplay add key/value pair add to starting object
          objStart[field] = objAdd[field]; 
        }
      }
      // return combined object
      return objStart;
    }

    // outputs an object based on adding second argument to first argument
    fieldRecurse(responseItem, fetchedItem); 

    // push combined object into main output array
    joinedArray.push(responseItem);
  }
  // return main output array
  return joinedArray;
}

// console.log('function:', joinResponses(response, fetchedArray))
// console.log('hard coded:', countriesAll.countries)

// console.log(joinResponses(response, fetchedArray)[0].cities[0].name)
// console.log(countriesAll.countries[0].cities[0].name)
// console.log(joinResponses(response, fetchedArray)[0].cities[0].name === countriesAll.countries[0].cities[0].name)

// console.log(joinResponses(response, fetchedArray) === countriesAll.countries)


console.log(joinResponses(response, fetchedArray)[0].cities[0].newArr[0].prop1Array[0].prop1ArrObj[0].end)

