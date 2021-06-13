const { visit, BREAK } = require('graphql/language/visitor');
const { parse } = require('graphql/language/parser');


/** TO-DO: refactor prototype to include args & put alias first
 * CURR: messes up inner-args
 * `${fieldName}${ID ? '-' + ID : ''}`
 * Country-ID
{
  __alias: alias
  __arg: arg
  id: true
  name: true
}
 * 
 * /

/**
 * parseAST traverses the abstract syntax tree and creates a prototype object
 * representing all the queried fields nested as they are in the query.
 */

const parseAST = (AST) => {
  // initialize prototype as empty object
  const prototype = {};

  // initialize operation Type, will store "query", "mutation", etc.
  // TO-DO: is there space to merge this with prototype?


  // initialize stack to keep track of depth first parsing path
  const stack = [];
  const stackIDs = [];

  // tracks depth of selection Set
  let selectionSetDepth = 0;

  // keep track of current fieldID
  let fieldID = '';

  /**
   * visit is a utility provided in the graphql-JS library. It performs a
   * depth-first traversal of the abstract syntax tree, invoking a callback
   * when each SelectionSet node is entered. That function builds the prototype.
   * Invokes a callback when entering and leaving Field node to keep track of nodes with stack
   *
   * Find documentation at:
   * https://graphql.org/graphql-js/language/#visit
   */
  visit(AST, {
    enter(node) {
      //TO-DO: cannot cache directives, return as unquellable until support
      if (node.directives) {
        if (node.directives.length > 0) {
          prototype.operationType = 'unQuellable';
          return BREAK;
        }
      }
    },
    OperationDefinition(node) {
      //TO-DO: cannot cache subscriptions or mutations, return as unquellable
      prototype.operationType = node.operation;
      if (node.operation === 'subscription' || node.operation === 'mutation') {
        prototype.operationType = 'unQuellable';
        return BREAK;
      }
    },
    Field: {
      // enter the node to construct a unique field-ID for critical fields
      enter(node, key, parent, path, ancestors) {
        if (node.alias && !node.arguments) {
          // TO-DO: handle edge case of alias without any arguments
            prototype.operationType = 'unQuellable';
            return BREAK;
        }
        // TO-DO: re-implement "if argument" statement
        if (true) {
          // populates argsObj from node
          const argsObj = {};
          node.arguments.forEach(arg => {
            // TO-DO: cannot currently handle variables in query
            if (arg.value.kind === 'Variable' && prototype.operationType === 'query') {
              prototype.operationType = 'unQuellable';
              return BREAK;
            }
            argsObj[arg.name.value] = arg.value.value;
          });
  
          // identify unique ID from args
          // TO-DO: could expand to support user-defined IDs (ie key.includes('id') for "authorid")
          let uniqueID = '';
          for (const key in argsObj) {
            if (key === 'id' || key === '_id' || key === 'ID') {
              uniqueID = argsObj[key];
            }
          }
  
          // require uniqueID in order to be cached
          // 
          // if (!uniqueID) {
          //   operationType = 'unQuellable';
          //   return BREAK;
          // }
  
          // create fieldName unique ID in format "fieldName - uniqueID"
          fieldID = `${node.name.value}${uniqueID ? '--' + uniqueID : ''}`

          if (uniqueID) {
            if (selectionSetDepth >= 1) {
              console.log('deep uniqueID', fieldID, selectionSetDepth);
              // when depth is > 1, we need to add it to parent object instead of prototype-base
              const finalIndex = stack.length - 1;
              const penultimateIndex = stack.length - 2;
              console.log('deep', stackIDs)
              const parentObj = stackIDs[finalIndex]
              const currentObj = fieldID;

              console.log('deep parent', parentObj);
              console.log('deep current', currentObj);
              console.log('deep proto', prototype);

              // add args to prototype object
              prototype[parentObj][currentObj] = { ...prototype[parentObj][currentObj], __args: argsObj }
    
              // // check for Alias and add if it exists, otherwise set to null
              if (node.alias) prototype[parentObj][currentObj] = { ...prototype[parentObj][currentObj], __alias: node.alias.value }
              else prototype[parentObj][currentObj] = { ...prototype[parentObj][currentObj], __alias: null }

            } else {
              console.log('not deep uniqueID', fieldID, selectionSetDepth);
              // add args to prototype object
              prototype[fieldID] = { ...prototype[fieldID], __args: argsObj }
    
              // check for Alias and add if it exists, otherwise set to null
              if (node.alias) prototype[fieldID] = { ...prototype[fieldID], __alias: node.alias.value }
              else prototype[fieldID] = { ...prototype[fieldID], __alias: null }
            }
          }
        }

        // add value to stack to keep track of depth-first parsing path
        stack.push(node.name.value);
        stackIDs.push(fieldID);
        // console.log('stack', stack);
        // console.log('stackIDs', stackIDs);
      },
      leave(node, key, parent, path, ancestors) {
        stack.pop();
        stackIDs.pop();
        console.log('leaving stack', stack);
      },
    },
    SelectionSet: {
      // selection sets contain all of the sub-fields
      // iterate through the sub-fields to construct fieldsObject
      enter(node, key, parent, path, ancestors) {
        console.log('enter SS', node.kind, selectionSetDepth);

        if (parent.kind === 'Field') {
          selectionSetDepth++;
          // console.log('parent Field depth', selectionSetDepth);
          // console.log('stack', stack);
          // console.log('stackIDs', stackIDs);
          
          // TO-DO: this adds "city" to the object when I want "city--3"
          // loop through selections to collect fields
          const fieldsObject = {};
          for (let field of node.selections) {
            fieldsObject[field.name.value] = true;
          };
  

          // if selection set depth > 1, we can remove the duplicate ID that exists at top of stack from the object, replace it with fieldsObject
          // otherwise proto-object will have duplicate entries for nested queries with arguments
          if (selectionSetDepth > 1) {
            const finalIndex = stack.length - 1;
            const penultimateIndex = stack.length - 2;

            delete prototype[stackIDs[penultimateIndex]][stack[finalIndex]];

            stackIDs.reduce((prev, curr, index) => {
              return index + 1 === stack.length // if last item in path
                ? (prev[curr] = {...prev[curr], ...fieldsObject}) //set value
                : (prev[curr] = prev[curr]); // otherwise, if index exists, keep value
            }, prototype);
          } else {
            // loop through stack to get correct path in proto for temp object;
            // mutates original prototype object WITH values from tempObject
            // "prev" is accumulator ie the prototype
            stackIDs.reduce((prev, curr, index) => {
              return index + 1 === stack.length // if last item in path
                ? (prev[curr] = fieldsObject) //set value
                : (prev[curr] = prev[curr]); // otherwise, if index exists, keep value
            }, prototype);
          }

          console.log('proto before reduce', prototype);
        }
      },
      /* Exclude SelectionSet nodes whose parents' are not of the kind
       * 'Field' to exclude nodes that do not contain information about
       *  queried fields.
       */
      leave(node, key, parent, path, ancestors) {
        console.log('leaving SS', node.kind, selectionSetDepth);
        selectionSetDepth--;
      },
    },
  });
  return prototype;
};

const query = `query {
  Canada: country (id: 1) {
    id
    name
    food
    city (id: 3) {
      name
    }
  }
  Mexico: country (id: 2) {
    id
    name
    city {
      id
      name
    }
  }
}`;

const query1 = `query {
  Canada: country (id: 1) {
    id
    name
    food {
      flavor
    }
    city (id: 3) {
      name
    }
  }
}`;

// loop(keys){
//   if (!key.includes('__')) {
//     // building prototype stuff
//   }
// }

const query2 = `{countries { id name capitol } }`;

const query3 = `{countries { id name cities { id name } } }`

const parsedQuery = parse(query);
const prototype = parseAST(parsedQuery);

// console.log('query', query);
console.log('proto', prototype);
// console.log('depth proto', prototype['country--1']['city--3']);

module.exports = parseAST;
