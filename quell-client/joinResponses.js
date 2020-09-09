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
          // "newArr": [{
          //   "prop1": true,
          //   "prop1Array": [{"prop1ArrObj": 'Hello'}],
          // }, {
          //   "prop2": true,
          // }]
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


console.log(fetchResponse.countries);


// Assumed that fetched data comes back in similar ordered list; trverse response array to join each item with fetched data array items
// Make sure that fetched response is converted into array, e.g. fetchResponse.countries, before passing into function

const fetchedArray = fetchResponse.countries;

// function joinResponses(responseArray, fetchedResponseArray) {
//   // // create new array and create new object items by joining original response items with fetched response items
//   // return responseArray.map((response, index) => {
//   //   return Object.assign(response, fetchedResponseArray[index]);
//   // })

//   const joinedArray = [];
//   for (let i = 0; i < responseArray.length; i++) {
//     joinedArray.push(Object.assign(responseArray[i], fetchedResponseArray[i]));
//   }
//   return joinedArray;
// }

// console.log(joinResponses(response, fetchedArray)[0].cities[0].newArr[0].prop1Array[0].prop1ArrObj)

function joinResponses(responseArray, fetchedResponseArray) {
const joinedArray = [];
  
  for (let i = 0; i < responseArray.length; i++) {
    const responseItem = responseArray[i];
    const fetchedItem = fetchedResponseArray[i];

    function fieldRecurse(objStart, objAdd) {
      // traverse object properties to add
      for (let field in objAdd) {
        // if field is object, traverse value (array) and recurse for each item
        if (typeof objAdd[field] === 'object') {
          // if type is {}
          
          // if type is []
          // set field on objStart
          objStart[field] = [];
          // console.log(objStart)

          const objArr = objAdd[field];
          for (let j = 0; j < objArr.length; j++) {
            objStart[field].push(fieldRecurse({}, objArr[j]));
          }
        } else {
          // if field is scalar add to obj
          objStart[field] = objAdd[field]; 
        }
      }
      return objStart;
    }
    fieldRecurse(responseItem, fetchedItem); // outputs an object based on adding second arg to first arg
    joinedArray.push(responseItem);
  }
  return joinedArray;
}

console.log(joinResponses(response, fetchedArray))
// console.log(joinResponses(response, fetchedArray)[0].cities[0].newArr[0].prop1Array[0].prop1ArrObj)





// function joinResponses(responseArray, fetchedResponseArray) {
//   // // create new array and create new object items by joining original response items with fetched response items
//   // return responseArray.map((response, index) => {
//   //   return Object.assign(response, fetchedResponseArray[index]);
//   // })

//   // const joinedArray = [];
//   // for (let i = 0; i < responseArray.length; i++) {
//   //   joinedArray.push(Object.assign(responseArray[i], fetchedResponseArray[i]));
//   // }
//   // return joinedArray;

//   const joinedArray = [];
  
//   for (let i = 0; i < responseArray.length; i++) {
//     const responseItem = responseArray[i];
//     const fetchedItem = fetchedResponseArray[i];

//     function fieldRecurse(objStart, objAdd) {
//       // traverse object properties to add
//       for (let field in objAdd) {
//         // if field is object, traverse value (array) and recurse for each item
//         if (typeof objAdd[field] === 'object') {
//           // ------> add field to objStart with empty array
//           objStart[field] = [];

//           const objType = objAdd[field];
//           for (let j = 0; j < objType.length; j++) {
//             const innerObj = {};
//             // ------> Update this call to include first argument as new empy array that is set for new field
//             fieldRecurse(objStart, objAdd[field]);
//           }
//         } else {
//           // if field is scalar add to obj
//           objStart[field] = objAdd[field]; 
//         }
//       }
//     }
//     fieldRecurse(responseItem, fetchedItem);
//     // console.log(responseItem)
//     joinedArray.push(responseItem);
//   }
//   return joinedArray;
// }

// console.log(joinResponses(response, fetchedArray))