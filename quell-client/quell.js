import { parse } from 'graphql/language/parser';
import { visit } from 'graphql/language/visitor';

export default class Quell {
  constructor(query, map) {
    this.query = query;
    this.map = map;
    this.AST = parse(this.query);
    this.proto = this.parseAST(this.AST);
    this.fieldsMap = {};
  }

  
  async fetch() {
    const responseFromCache = this.buildFromCache()

    if (responseFromCache.length === 0) {
      const fetchOptions = {
        method: 'POST',
        headers:{
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.query)
      };
      
      const responseFromFetch = await fetch('/graphql', fetchOptions)
      this.normalizeForCache(responseFromFetch);

      return responseFromFetch
    }

    let mergedResponse;
    const queryObject = this.createQueryObj(this.proto);

    if (Object.keys(queryObject).length > 0) {
      const newQuery = this.createQueryStr(queryObject);
      const fetchOptions = {
        method: 'POST',
        headers:{
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newQuery)
      };
  
      const responseFromFetch = await fetch('/graphql', fetchOptions);
      mergedResponse = this.joinResponses(responseFromCache, responseFromFetch);
    } else {
      mergedResponse = responseFromCache;
    }

    this.normalizeForCache(mergedResponse);
    return mergedResponse
    // return new Promise((resolve, reject) => resolve(mergedResponse));
  }
  
  
  /**
   * parseAST traverses the abstract syntax tree and creates a prototype object
   * representing all the queried fields nested as they are in the query.
   */
  parseAST() {
    const queryRoot = this.AST.definitions[0];
    
    if (queryRoot.operation !== 'query') {
      console.log(`Error: Quell does not currently support ${queryRoot.operation} operations.`);
    }

  /**
   * visit() -- a utility provided in the graphql-JS library-- will walk 
   * through an AST using a depth first traversal, invoking a callback
   * when each SelectionSet node is entered. 
   * 
   * More detailed documentation can be found at:
   * https://graphql.org/graphql-js/language/#visit
   */
  
  // visit() will build the prototype, declared here and returned from the function
    const prototype = {};
    
    visit(this.AST, {
      SelectionSet(node, key, parent, path, ancestors) {
        /**
         * Exclude SelectionSet nodes whose parents' are not of the kind 
         * 'Field' to exclude nodes that do not contain information about
         *  queried fields.
         */
        if(parent.kind === 'Field') {
          
          /** GraphQL ASTs are structured such that a field's parent field
           *  is found three three ancestors back. Hence, we subtract three. 
          */
          let depth = ancestors.length - 3;
          let objPath = [parent.name.value];
          
          /** Loop through ancestors to gather all ancestor nodes. This array
           * of nodes will be necessary for properly nesting each field in the
           * prototype object.
           */
          while (depth >= 5) {
            let parentNodes = ancestors[depth - 1];
            let { length } = parentNodes;
            objPath.unshift(parentNodes[length - 1].name.value);
            depth -= 3;
          }

          /** Loop over the array of fields at current node, adding each to
           *  an object that will be assigned to the prototype object at the
           *  position determined by the above array of ancestor fields.
           */
          const collectFields = {};
          for (let field of node.selections) {
            collectFields[field.name.value] = true;
          }
          

          /** Helper function to convert array of ancestor fields into a
           *  path at which to assign the `collectFields` object.
           */
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

  return prototype;
  };

  /** Helper function that loops over a collection of references,
     *  calling another helper function -- buildItem() -- on each. Returns an
     *  array of those collected items.
     */
  buildArray(prototype, map, collection) {
    let response = [];
    
    for (let query in prototype) {
      collection = collection || sessionStorage.get(map[query]) || [];
      for (let item of collection) {
        // response.push(this.buildItem(prototype[query], dummyCache[item]));
        response.push(this.buildItem(prototype[query], sessionStorage.get(item)));
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
  buildItem(prototype, item) {
    let tempObj = {};
    
    for (let key in prototype) {
      if (typeof prototype[key] === 'object') {
        let prototypeAtKey = {[key]: prototype[key]}
        tempObj[key] = this.buildArray(prototypeAtKey, this.map, item[key])

        /** The fieldsMap property stores a mapping of field names to collection
         *  names, used when normalizes responses for caching. For example: a 'cities'
         *  field might contain an array of City objects. When caching, this array should
         *  contain unique references to the corresponding object stored in the cached City
         *  array.
         * 
         *  Slicing the reference at the first hyphen removes the object's unique identifier,
         *  leaving only the collection name.
        */
        this.fieldsMap[key] = item[key][0].slice(0, item[key][0].indexOf('-'));
      } else if (prototype[key]) {
        if (item[key] !== undefined) {
          tempObj[key] = item[key];
        } else {
          prototype[key] = false;
        }
      }
    }
    return tempObj;
  }

  createQueryObj(map) {
    const output = {};
    // !! assumes there is only ONE main query, and not multiples !!
    for (let key in map) {
      const reduced = reducer(map[key]);
      if (reduced.length > 0) {
        output[key] = reduced;
      }
    }
  
    function reducer(obj) {
      const fields = [];
  
      for (let key in obj) {
        // For each property, determine if the property is a false value...
        if (obj[key] === false) fields.push(key);
        // ...or another object type
        if (typeof obj[key] === 'object') {
          let newObjType = {};
          let reduced = reducer(obj[key]);
          if (reduced.length > 0) { 
            newObjType[key] = reduced;
            fields.push(newObjType);
          }
        }
      }
    
      return fields;
    }
    return output;
  };
 
  createQueryStr(queryObject) {
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

  joinResponses(responseArray, fetchedResponseArray) { // Inputs array of objects containing cached fields & array of objects containing newly query fields
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
            // set new field on new object equal empty array
            const newObj = {};
            newObj[field] = [];
            // declare variable eual to array of items to add from
            const objArr = objAdd[field];
            // iterate over array
            for (let j = 0; j < objArr.length; j++) {
              // push to new array the return value of invoking this same fieldRecurse() function.  fieldRecurse() will combine the nested array elements with the new obj field.
              newObj[field].push(fieldRecurse(objStart[field][j], objArr[j]));
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
  };

  buildFromCache() {
    return this.buildArray(this.proto, this.map);
  };

  generateId(collection, item) {
    const identifier = item.id || item._id || 'uncacheable';
    return collection + '-' + identifier.toString();
  };

  writeToCache(key, item) {
    if (!key.includes('uncacheable')) {
      sessionStorage.set(key, JSON.stringify(item));
      // mockCache[key] = JSON.stringify(item);
    } 
  };

  replaceItemsWithReferences(field, array) {
    const arrayOfReferences = [];
    const collectionName = this.fieldsMap[field];

    for (const item of array) {
      this.writeToCache(this.generateId(collectionName, item), item);
      arrayOfReferences.push(this.generateId(collectionName, item));
    }

    return arrayOfReferences;
  };
  
  normalizeForCache(response) {
    const queryName = Object.keys(response)[0];
    const collectionName = this.map[queryName]
    const collection = response[queryName];
    
    const referencesToCache = [];

    for (const item of collection) {
      const itemKeys = Object.keys(item);
      for (const key of itemKeys) {
        if (Array.isArray(item[key])) {
          item[key] = this.replaceItemsWithReferences(key, item[key]);
        }
      }
      this.writeToCache(this.generateId(collectionName, item), item);
      referencesToCache.push(this.generateId(collectionName, item));
    }
    
    this.writeToCache(collectionName, referencesToCache);
  };

};

// ORIGINAL TEST QUERY
const query = `
{
  countries{
    id
    name
    capital
    cities{
      country_id
      id
      name
      population
    }
  }
}
`

// RETURN FROM INTROSPECTION QUERY?
const dummyMap = {
  countries: 'Country',
  country: 'Country',
  citiesByCountryId: 'City',
  cities: 'City'
}

// const dummyCache = {}
const dummyCache = {
  'Country': ['Country-1', 'Country-2', 'Country-3', 'Country-4', 'Country-5'],
  'City': ['City-1', 'City-2', 'City-3', 'City-4', 'City-5', 'City-6', 'City-7', 'City-8','City-9', 'City-10'],
  'Country-1': {'id': 1, 'name': 'Andorra', 'capital': 'Andorra la Vella', 'cities': ['City-1', 'City-2']},
  'Country-2': {'id': 2, 'name': 'Bolivia', 'capital': 'Sucre', 'cities': ['City-5', 'City-7']},
  'Country-3': {'id': 3, 'name': 'Armenia', 'capital': 'Yerevan', 'cities': ['City-3', 'City-6']},
  'Country-4': {'id': 4, 'name': 'American Samoa', 'capital': 'Pago Pago', 'cities': ['City-8', 'City-4']},
  'Country-5': {'id': 5, 'name': 'Aruba', 'capital': 'Oranjestad', 'cities': ['City-9', 'City-10']},
  'City-1': {"id": 1, "country_id": 1, "name": "El Tarter", "population": 1052},
  'City-2': {"id": 2,"country_id": 1, "name": "SomeCity", "population": 7211},
  'City-3': {"id":3,"country_id":3,"name":"Canillo","population":3292},
  'City-4': {"id":4,"country_id":4,"name":"Andorra la Vella","population":20430},
  'City-5': {"id":5,"country_id":2,"name":"Jorochito","population":4013},
  'City-6': {"id":6,"country_id":3,"name":"Tupiza","population":22233},
  'City-7': {"id":7,"country_id":2,"name":"Puearto Pailas","population":0},
  'City-8': {"id":8,"country_id":4,"name":"Capinota","population":5157},
  'City-9': {"id":9,"country_id":5,"name":"Camargo","population":4715},
  'City-10': {"id":10,"country_id":5,"name":"Villa Serrano","population":0}
};

// CREATE INSTANCE

// const quellTest = new Quell(query, dummyMap)

// console.log(quellTest.buildFromCache())

// console.log(quellTest.proto)

// console.log(quellTest.createQueryObj(quellTest.proto))
// console.log(quellTest.createQueryStr(quellTest.createQueryObj(quellTest.proto)))
