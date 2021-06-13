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

const parseAST = (AST) =>{
  // initialize prototype as empty object
  const prototype = {};

  // initialize operation Type, will store "query", "mutation", etc.
  // TO-DO: is there space to merge this with prototype?
  let operationType;


  // initialize stack to keep track of depth first parsing
  const stack = [];
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
        console.log('enter field');
        if (node.alias && !node.arguments) {
        // TO-DO: handle edge case of alias without any arguments
          operationType = 'unQuellable';
          return BREAK;
        }
        if (node.arguments && node.arguments.length > 0) {
          // populates argsObj from node
          const argsObj = {};
          node.arguments.forEach(arg => {
            // TO-DO: cannot currently handle variables in query
            if (arg.value.kind === 'Variable' && operationType === 'query') {
              operationType = 'unQuellable';
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
          if (!uniqueID) {
            operationType = 'unQuellable';
            return BREAK;
          }

          // create fieldName unique ID in format "fieldName - uniqueID"
          const fieldNameID = `${node.name.value}${uniqueID ? '-' + uniqueID : null}`
      
          // add args to prototype object
          prototype[fieldNameID] = { ...prototype[fieldNameID], __args: argsObj }

          // check for Alias and add if it exists, otherwise set to null
          if (node.alias) prototype[fieldNameID] = { ...prototype[fieldNameID], __alias: node.alias.value }
          else prototype[fieldNameID] = {...prototype[fieldNameID], __alias: null }

          // TO-DO refactor to be one variable
          // store in outer field name
          fieldID = fieldNameID;
        }
        // add value to stack
        stack.push(node.name.value);
      },
      leave(node) {
        console.log('leave node');
        // remove value from stack
        stack.pop();
      },
    },
    SelectionSet(node, key, parent, path, ancestors) {
      console.log('enter selectionset');
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

        // loop through stack to get correct path in proto for temp object;
        // mutates original prototype object WITH values from tempObject
        // "prev" is accumulator ie the prototype
        const protoObj = stack.reduce((prev, curr, index) => {
          console.log(stack);
          console.log(curr);
          console.log(prev);
          return index + 1 === stack.length // if last item in path
            ? (stack.length > 1 ? prev[curr] = fieldsObject : prev[fieldID] = { ...prev[fieldID], ...fieldsObject }) //set value
            : (prev[fieldID] = prev[fieldID]); // otherwise, if index exists, keep value
        }, prototype);
      }
    },
  });
  return { prototype, operationType };
}

const query = `query {
  Canada: country (id: 1) {
    id
    name
    food (id: 3) {
      name
    }
  }
  Mexico: country (id: 2) {
    id
    name
    capitol
    cities {
      id
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

const parsedQuery = parse(query2);
const { prototype, operationType } = parseAST(parsedQuery);

// console.log('query', query);
console.log('proto', prototype);
// console.log('country-1', prototype['country-1']);
// console.log('country-2', prototype['country-2']);
// console.log('opType', operationType);

// for (let query2 in prototype) {
//   console.log('for query in proto', query2);
// }

module.exports = parseAST;
