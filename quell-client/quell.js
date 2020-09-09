import { parse } from 'graphql/language/parser';
import { visit } from 'graphql/language/visitor';

export default class Quell {
  constructor(query, map) {
    this.query = query;
    this.map = map;
    this.AST = parse(this.query);
    this.proto = this.parseAST(this.AST);
  }

  /**
   * 
   * @param {*} AST
   */
  parseAST(AST) {
    const queryRoot = AST.definitions[0];
    
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
    
    visit(AST, {
      SelectionSet(node, key, parent, path, ancestors) {
        /**
         * Exclude SelectionSet nodes whose parents' are not of the kind 
         * 'Field' to exclude nodes that do not contain information about
         * queried fields.
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
  }

  buildFromCache() {
    /** Helper function that loops over a collection of references,
     *  calling another helper function -- buildItem() -- on each. Returns an
     *  array of those collected items.
     */
    function buildArray(prototype, map, collection) {
      let response = [];
      
      for (let query in prototype) {
        collection = collection || dummyCache[map[query]] || [];
        for (let item of collection) {
          response.push(buildItem(prototype[query], dummyCache[item]))
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

    function buildItem(prototype, item) {
      
      let tempObj = {};
      
      for (let key in prototype) {
        if (typeof prototype[key] === 'object') {
          let prototypeAtKey = {[key]: prototype[key]}
          tempObj[key] = buildArray(prototypeAtKey, map, item[key])
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

    return buildArray(this.proto, map);
  };

  createQueryObj(map) {
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

};
