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
  const protype = {};
  
  visit(AST, {
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
}

parseAST() {
  /** Helper function that loops over a collection of references,
   *  calling another helper function -- buildItem() -- on each. Returns an
   *  array of those collected items.
   */
  function buildArray(prototype = this.proto, collection) {
    let response = [];
    
    for (let query in prototype) {
      collection = collection || dummyCache[this.map[query]];
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
        tempObj[key] = buildArray(prototypeAtKey, item[key])
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

  return buildArray();
  }
}