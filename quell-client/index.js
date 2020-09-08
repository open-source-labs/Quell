

const { parse } = require('graphql/language/parser');
const { visit } = require('graphql/language/visitor');
// const { buildASTSchema } = require('graphql/utilities/buildASTSchema');

const sampleQuery = `
{
  countries {
    id
    name
    capital
    cities {
      id
      country_id
      name
      population
    }
  }
}`


/**
 * ========== Create AST from Query ==========
 */

const AST = parse(sampleQuery);

/**
 * ========== Parse AST ==========
 */

const queryRoot = AST.definitions[0];

if (queryRoot.operation !== 'query') {
  console.log('Error: Quell currently only supports queries')
}

const prototype = {};
// `visit` is a utility included in the graphql-JS library.
visit(AST, {
  SelectionSet(node, key, parent, path, ancestors) {
      if(parent.kind === 'Field') {
      
        let depth = ancestors.length - 3;
        let objPath = [parent.name.value];
        
        while (depth >= 5) {
          let parentNodes = ancestors[depth - 1];
          let { length } = parentNodes;
          objPath.unshift(parentNodes[length - 1].name.value);
          depth -= 3;
        }

        const collectFields = {};
        for (let field of node.selections) {
          collectFields[field.name.value] = true;
        }
        
        function setProperty(path, obj, value) {
          return path.reduce((prev, curr, index) => {
            return (index + 1 === path.length) // if last item in path
              ? prev[curr] = value // set value
              : prev[curr] = prev[curr] || {}; 
              // otherwise, if index exists, keep value or set to empty object if index does not exist
          }, obj);
        };

        setProperty(objPath, prototype, collectFields);
    }
  }
});

console.log(prototype);

// // Alternate way of nesting objects
// let keys = Object.keys(prototype);
// for (let i = 1; i < keys.length; i += 1) {
//   prototype[keys[i - 1]][keys[i]] = prototype[keys[i]];
// }
// for (let i = 1; i < keys.length; i += 1) {
//   delete prototype[keys[i]];
// } 


/**
 * ========== Create and Populate Response From Cache ==========
 */

const dummyCache = {
  'Country': ['Country-1', 'Country-2', 'Country-3', 'Country-4', 'Country-5'],
  'City': ['City-1', 'City-2', 'City-3', 'City-4', 'City-5', 'City-6', 'City-7', 'City-8','City-9', 'City-10'],
  'Country-1': {'id': 1, 'name': 'Andorra', 'capital': 'Andorra la Vella', 'cities': ['City-1', 'City-2']},
  'Country-2': {'id': 2, 'name': 'Bolivia', 'capital': 'Sucre', 'cities': ['City-5', 'City-7']},
  'Country-3': {'id': 3, 'name': 'Armenia', 'capital': 'Yerevan', 'cities': ['City-3', 'City-6']},
  'Country-4': {'id': 4, 'name': 'American Samoa', 'capital': 'Pago Pago', 'cities': ['City-8', 'City-4']},
  'Country-5': {'id': 5, 'name': 'Aruba', 'capital': 'Oranjestad', 'cities': ['City-9', 'City-10']},
  'City-1': {"id": 1, "country_id": 1, "name": "El Tarter", "population": 1052},
  'City-2': {"id": 2,"country_id": 1, "name": "La Massana", "population": 7211},
  'City-3': {"id":3,"country_id":3,"name":"Canillo","population":3292},
  'City-4': {"id":4,"country_id":4,"name":"Andorra la Vella","population":20430},
  'City-5': {"id":5,"country_id":2,"name":"Jorochito","population":4013},
  'City-6': {"id":6,"country_id":3,"name":"Tupiza","population":22233},
  'City-7': {"id":7,"country_id":2,"name":"Puearto Pailas","population":0},
  'City-8': {"id":8,"country_id":4,"name":"Capinota","population":5157},
  'City-9': {"id":9,"country_id":5,"name":"Camargo","population":4715},
  'City-10': {"id":10,"country_id":5,"name":"Villa Serrano","population":0}
};

map = { 
  countries: 'Country',
  country: 'Country',
  citiesByCountryId: 'City',
  cities: 'City'
}




function handleTopLevel(prototype, map, collection) {
  let response = [];
  
  for (let query in prototype) {
    collection = collection || dummyCache[map[query]];
    for (let item of collection) {
      response.push(buildItem(prototype[query], dummyCache[item]))
    }
  }
  
  return response;
};


function buildItem(prototype, item) {
  
  let tempObj = {};
  
  for (let key in prototype) {
    if (typeof prototype[key] === 'object') {
      let prototypeAtKey = {[key]: prototype[key]}
      tempObj[key] = handleTopLevel(prototypeAtKey, map, item[key])
    } else if (prototype[key]) {
      if (item[key]) {
        tempObj[key] = item[key];
      } else {
        prototype[key] = false;
      }
    }
  }

  return tempObj;
}

// console.log(handleTopLevel(prototype, map));