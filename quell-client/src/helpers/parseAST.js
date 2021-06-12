const { visit, BREAK } = require('graphql/language/visitor');
const { parse } = require('graphql/language/parser');
/**
 * parseAST traverses the abstract syntax tree and creates a prototype object
 * representing all the queried fields nested as they are in the query.
 */

const parseAST = (AST) =>{
  // initialize prototype as empty object
  const proto = {};
  //let isQuellable = true;

  let operationType;

  // initialiaze arguments as null
  let protoArgs = null; //{ country: { id: '2' } }

  // initialize stack to keep track of depth first parsing
  const stack = [];

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
      if (node.directives) {
        if (node.directives.length > 0) {
          operationType = 'unQuellable';
          return BREAK;
        }
      }
    },
    OperationDefinition(node) {
      operationType = node.operation;
      if (node.operation === 'subscription') {
        operationType = 'unQuellable';
        return BREAK;
      }
    },
    Field: {
      enter(node) {
        if (node.alias) {
          operationType = 'unQuellable';
          return BREAK;
        }
        if (node.arguments && node.arguments.length > 0) {
          protoArgs = protoArgs || {};
          protoArgs[node.name.value] = {};

          // collect arguments if arguments contain id, otherwise make query unquellable
          // hint: can check for graphQl type ID instead of string 'id'
          for (let i = 0; i < node.arguments.length; i++) {
            const key = node.arguments[i].name.value;
            const value = node.arguments[i].value.value;

            // for queries cache can handle only id as argument
            if (operationType === 'query') {
              if (!key.includes('id')) {
                operationType = 'unQuellable';
                return BREAK;
              }
            }
            protoArgs[node.name.value][key] = value;
          }
        }
        // add value to stack
        stack.push(node.name.value);
      },
      leave(node) {
        // remove value from stack
        stack.pop();
      },
    },
    SelectionSet(node, key, parent, path, ancestors) {
      /* Exclude SelectionSet nodes whose parents' are not of the kind
       * 'Field' to exclude nodes that do not contain information about
       *  queried fields.
       */
      if (parent.kind === 'Field') {
        // loop through selections to collect fields
        const tempObject = {};
        for (let field of node.selections) {
          tempObject[field.name.value] = true;
        }

        // loop through stack to get correct path in proto for temp object;
        // mutates original prototype object;
        const protoObj = stack.reduce((prev, curr, index) => {
          return index + 1 === stack.length // if last item in path
            ? (prev[curr] = tempObject) // set value
            : (prev[curr] = prev[curr]); // otherwise, if index exists, keep value
        }, proto);
      }
    },
  });
  return { proto, protoArgs, operationType };
}


// const query = `query {
//   countries {
//     id
//     name
//     city (id: 1) {
//       id
//       name
//     }
//   }
//   book (id: 3) {
//     id
//     name
//     author (id: 4) {
//       name
//     }
//   }
// }`;

// console.log('query', query);
// console.log('proto', proto);
// console.log('protoArgs', protoArgs);
// console.log('opType', operationType);

module.exports = parseAST;
