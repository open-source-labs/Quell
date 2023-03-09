const { visit, BREAK } = require('graphql/language/visitor');

const determineType = (AST) => {
  console.log('Parsing Abstract Syntax Tree to determine type of operation');

  // initialize prototype as empty object
  // information from AST is distilled into the prototype for easy access during caching, rebuilding query strings, etc.
  const proto = {};
  const frags = {};
  // argsObj will contain the values/fields
  const argsObj = {};
  // target Object will be updated to point to prototype when iterating through Field and it will point to frags when iterating through Fragment Definition
  let targetObj;

  let operationType = '';

  // initialize stack to keep track of depth first parsing path
  const stack = [];

  // tracks depth of selection Set
  let selectionSetDepth = 0;

  // tracks arguments, aliases, etc. for specific fields
  // eventually merged with prototype object
  const fieldArgs = {};

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
      targetObj = proto;
      operationType = node.operation;
      if (node.operation === 'subscription') {
        operationType = 'unQuellable';
        return BREAK;
      }
    },
    FragmentDefinition: {
      enter(node) {
        // update stack
        stack.push(node.name.value);
        // point the targetObj that we update to the frags object while inside the loop
        targetObj = frags;
        // extract all fields in the fragment
        const fragName = node.name.value;
        targetObj[fragName] = {};
        // iterate through selections in selectionSet
        for (let i = 0; i < node.selectionSet.selections.length; i++) {
          // create a property for this selection on the frags obj (aka target obj)
          targetObj[fragName][
            node.selectionSet.selections[i].name.value
          ] = true;
        }
      },
      leave() {
        stack.pop();
      }
    },
    Field: {
      // enter the node to construct a unique fieldType for critical fields
      enter(node) {
        // populates argsObj from current node's arguments
        // generates uniqueID from arguments

        // Introspection queries will not be cached
        if (node.name.value.includes('__')) {
          operationType = 'unQuellable';
          return BREAK;
        }

        node.arguments.forEach((arg) => {
          const key = arg.name.value;
          if (arg.value.kind === 'Variable' && operationType === 'query') {
            operationType = 'unQuellable';
            return BREAK;
          }
          // assign args to argsObj, skipping type-specific options ('__')
          if (!key.includes('__')) {
            argsObj[key] = arg.value.value;
          }
          // // handle custom options passed in as arguments (ie customCache)
          // if (key.includes('__')) {
          //   auxObj[key] = arg.value.value;
          // }
        });

        // specifies whether field is stored as fieldType or Alias Name
        const fieldType = node.alias ? node.alias.value : node.name.value;

        // add value to stacks to keep track of depth-first parsing path
        stack.push(fieldType);
      },
      leave() {
        // pop stacks to keep track of depth-first parsing path
        stack.pop();
      }
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
          for (const field of node.selections) {
            // sets any fields values to true
            // UNLESS they are a nested object
            if (!field.selectionSet) fieldsValues[field.name.value] = true;
          }

          // if ID was not included on the request then the query will not be included in the cache, but the request will be processed
          if (
            !Object.prototype.hasOwnProperty.call(fieldsValues, 'id') &&
            !Object.prototype.hasOwnProperty.call(fieldsValues, '_id') &&
            !Object.prototype.hasOwnProperty.call(fieldsValues, 'ID') &&
            !Object.prototype.hasOwnProperty.call(fieldsValues, 'Id')
          ) {
            operationType = 'unQuellable';
            return BREAK;
          }
          // place fieldArgs object onto fieldsObject so it gets passed along to prototype
          // fieldArgs contains arguments, aliases, etc.
          const fieldsObject = {
            ...fieldsValues,
            ...fieldArgs[stack[stack.length - 1]]
          };

          // loop through stack to get correct path in proto for temp object;
          // mutates original prototype object WITH values from tempObject
          // "prev" is accumulator ie the prototype
          stack.reduce((prev, curr, index) => {
            // if last item in path, set value
            if (index + 1 === stack.length) prev[curr] = { ...fieldsObject };
            return prev[curr];
          }, targetObj);
        }
      },
      leave() {
        // tracking depth of selection set
        selectionSetDepth--;
      }
    }
  });
  return { operationType, proto };
};

module.exports = determineType;
