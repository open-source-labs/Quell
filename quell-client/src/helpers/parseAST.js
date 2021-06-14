const { visit, BREAK } = require('graphql/language/visitor');
const { parse } = require('graphql/language/parser');


/** TO-DO: 
 * 1) add support for variables
 * 2) add support for fragments
 * 3) add support for directives
 * 4) add support for mutations
 * 5) add support for subscriptions???
 * 4) method for parsing only PARTS of queries as "unquellable" so we can get more cache hits
 * /

/**
 * parseAST traverses the abstract syntax tree and creates a prototype object
 * representing all the queried fields nested as they are in the query,
 * as well as auxillary data (arguments, aliases, etc.)
 */

const parseAST = (AST) => {
  // initialize prototype as empty object
  const prototype = {};

  // initialize stack to keep track of depth first parsing path,
  // need original names as reference to prevent doubling with uniqueIDs
  const stack = [];
  // initialize stack of uniqueIDs to reference any pathways of unique IDs made
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
        // if (node.alias && !node.arguments) {
        //   // TO-DO: handle edge case of alias without any arguments
        //     prototype.operationType = 'unQuellable';
        //     return BREAK;
        // }
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
  
          // create fieldName unique ID in format "fieldName - uniqueID"
          fieldID = `${node.name.value}${uniqueID ? '--' + uniqueID : ''}`

          if (uniqueID) {
            if (selectionSetDepth > 1) {
              // when depth is >= 1, we need to add it to parent object instead of prototype-base
              const finalIndex = stack.length - 1;
              const parentObj = stackIDs[finalIndex]
              // current value for fieldID is current Object
              const currentObj = fieldID;

              // add args to prototype object at correct key
              prototype[parentObj][currentObj] = { ...prototype[parentObj][currentObj], __args: argsObj }
    
              // // check for Alias and add if it exists, otherwise set to null
              if (node.alias) prototype[parentObj][currentObj] = { ...prototype[parentObj][currentObj], __alias: node.alias.value }
              else prototype[parentObj][currentObj] = { ...prototype[parentObj][currentObj], __alias: null }

            } else {
              // when depth is 0, we can add fieldID section to prototype argument straight away
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
        selectionSetDepth++;

      /* Exclude SelectionSet nodes whose parents' are not of the kind
       * 'Field' to exclude nodes that do not contain information about
       *  queried fields.
       */
        if (parent.kind === 'Field') {
          // loop through selections to collect fields
          const fieldsObject = {};
          for (let field of node.selections) {
            fieldsObject[field.name.value] = true;
          };
  
          // if selection set depth > 1, remove the field that exists at top of stack from the object
          // otherwise proto-object will have duplicate entries for nested queries with arguments
          // ie "city" and "city--3"

          // TO-DO to delete just the LAST in the loop, need to go through all inner parts
          // at the moment it just looks for the last 2 and doesn't work for deeply nested queries

          // if (selectionSetDepth > 2) {
          //   const finalIndex = stack.length - 1;
          //   const penultimateIndex = stack.length - 2;

          //   console.log('depth', selectionSetDepth, 'proto', prototype, 'stack', stack, 'IDs', stackIDs, 'fieldID', fieldID)
          //   console.log(prototype[stackIDs[0]])
          //   delete prototype[stackIDs[penultimateIndex]][stack[finalIndex]];
          // }
          
          // loop through stack to get correct path in proto for temp object;
          // mutates original prototype object WITH values from tempObject
          // "prev" is accumulator ie the prototype
          stackIDs.reduce((prev, curr, index) => {
            return index + 1 === stack.length // if last item in path
              ? (prev[curr] = {...prev[curr], ...fieldsObject}) //set value
              : (prev[curr] = prev[curr]); // otherwise, if index exists, keep value
          }, prototype);
        }
      },
      leave() {
        // tracking depth of selection set
        selectionSetDepth--;
      },
    },
  });
  return prototype;
};

// loop(keys){
//   if (!key.includes('__')) {
//     // building prototype stuff
//   }
// }

// TO-DO: remove testing
// query strings for testing
const queryPlain = `{countries { id name capitol } }`;
const queryNest = `{ countries { id name cities { id name attractions { id name price } } } }`;
const queryArg = `query { country(id: 1) { id name }}`;
const queryInnerArg = `query {country (id: 1) { id name city (id: 2) { id name }}}`
const queryAlias = `query { Canada: country (id: 1) { id name } }`;
const queryAliasNoArgs = `query { Canada: country { id name } }`;
const queryMultiple = `query { Canada: country (id: 1) { id name capitol } Mexico: country (id: 2) { id name climate }}`

const parsedQuery = parse(queryNest);
const prototype = parseAST(parsedQuery);

// console.log('query', query);
console.log('proto', prototype);

module.exports = parseAST;
