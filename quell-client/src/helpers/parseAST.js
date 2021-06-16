const { visit, BREAK } = require('graphql/language/visitor');
const { parse } = require('graphql/language/parser');


/** TO-DO: 
 * 1) add support for variables
 * 2) add support for fragments
 * 3) add support for directives
 * 4) add support for mutations
 * 5) add support for subscriptions???
 * 6) method for parsing only PARTS of queries as "unquellable" so we can get more cache hits
 * 7) add support for type-specific options (ie cache time) & document those options
 * /

/**
 * parseAST traverses the abstract syntax tree and creates a prototype object
 * representing all the queried fields nested as they are in the query,
 * as well as auxillary data (arguments, aliases, etc.)
 */

const parseAST = (AST, options = { userDefinedID: null }) => {
  // initialize prototype as empty object
  // information from AST is distilled into the prototype for easy access during caching, rebuilding query strings, etc.
  const prototype = {};

  let operationType = '';

  // initialize stack to keep track of depth first parsing path,
  // need original names as reference to prevent doubling with uniqueIDs
  const stack = [];
  // initialize stack of uniqueIDs to reference any pathways of unique IDs made
  const stackIDs = [];

  // tracks depth of selection Set
  let selectionSetDepth = 0;

  // tracks arguments, aliases, etc. for specific fields
  // eventually merged with prototype object
  const fieldArgs = {};

  // extract options
  const userDefinedID = options.__userDefinedID;

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
          operationType = 'unQuellable';
          return BREAK;
        }
      }
    },
    FragmentDefinition(node) {
      // storing fragment info
    },
    OperationDefinition(node) {
      //TO-DO: cannot cache subscriptions or mutations, return as unquellable
      operationType = node.operation;
      if (node.operation === 'subscription' || node.operation === 'mutation') {
        operationType = 'unQuellable';
        return BREAK;
      }
    },
    Field: {
      // enter the node to construct a unique fieldID for critical fields
      enter(node) {
        // populates argsObj from current node's arguments
        // generates uniqueID from arguments
        const argsObj = {};

        // TO-DO: document viable options
        // populates optionsObj from current node's arguments for TYPE-SPECIFIC options only
        // query-wide options should be handled on Quell's options object
        const optionsObj = {};

        let uniqueID = '';
        node.arguments.forEach(arg => {
          const key = arg.name.value;
          // TO-DO: cannot currently handle variables in query
          if (arg.value.kind === 'Variable' && operationType === 'query') {
            operationType = 'unQuellable';
            return BREAK;
          }
          // assign args to argsObj, skipping type-specific options ('__')
          if (!key.includes('__')) {
            argsObj[key] = arg.value.value;
          };

          // identify uniqueID from args
          // TO-DO: make this more general instead of hard-coded? 
          // string.includes('id') is too general and would catch non-uniqueID fields such as "ideology"
          if (key === 'id' || key === '_id' || key === 'ID' || key === 'Id' || key === userDefinedID) {
            uniqueID = arg.value.value;
          }

          // handle custom options passed in as arguments (ie customCache)
          if (key.includes('__')) {
            optionsObj[key] = arg.value.value;
          }
        });

        // create fieldID in format "fieldName - uniqueID"
        // otherwise returns the original field name
        const fieldID = `${node.name.value}${uniqueID ? '--' + uniqueID : ''}`;

        // stores alias for Field
        const alias = node.alias ? node.alias.value : null;

        // if argsObj has no values, set as null on prototype
        const args = Object.keys(argsObj).length > 0 ? argsObj : null;

        // if 

        // add alias, args values to appropriate fields
        fieldArgs[fieldID] = {
          ...fieldArgs[fieldID],
          ...optionsObj,
          __alias: alias,
          __args: args,
        };

        // add value to stacks to keep track of depth-first parsing path
        stack.push(node.name.value);
        stackIDs.push(fieldID);
      },
      leave() {
        // pop stacks to keep track of depth-first parsing path
        stack.pop();
        stackIDs.pop();
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
          const fieldsValues = {};
          for (let field of node.selections) {
            fieldsValues[field.name.value] = true;
          };

          // place fieldArgs object onto fieldsObject so it gets passed along to prototype
          // fieldArgs contains arguments, aliases, etc.
          const fieldsObject = { ...fieldsValues, ...fieldArgs[stackIDs[stackIDs.length - 1]] };

          /* For nested objects, we must prevent duplicate entries for nested queries with arguments (ie "city" and "city--3")
          * We go into the prototype and delete the duplicate entry
          */
          if (selectionSetDepth > 2) {
            let miniProto = prototype;
            // loop through stack to access layers of prototype object
            for (let i = 0; i < stack.length; i++) {
              // access layers of prototype object
              miniProto = miniProto[stackIDs[i]]
              if (i === stack.length - 2) {
                // when final index, delete
                delete miniProto[stack[i + 1]];
              }
            }
          }
          
          // loop through stack to get correct path in proto for temp object;
          // mutates original prototype object WITH values from tempObject
          // "prev" is accumulator ie the prototype
          stackIDs.reduce((prev, curr, index) => {
            return index + 1 === stack.length // if last item in path
              ? (prev[curr] = {...fieldsObject}) //set value
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
  return { prototype, operationType };
};

// loop(keys){
//   if (!key.includes('__')) {
//     // building prototype stuff
//   }
// }

// TO-DO: remove testing before final commits
// // query strings for testing
// const queryFragment = `query { Canada: country { id name ...fragment } }`;

// TESTING FUNCTIONS
// const parsedQuery = parse(normalizeTest2);
// const { prototype } = parseAST(parsedQuery);
// console.log('proto', prototype);

module.exports = parseAST;
