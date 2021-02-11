const { visit } = require('graphql/language/visitor');
/**
 * parseAST traverses the abstract syntax tree and creates a prototype object
 * representing all the queried fields nested as they are in the query.
 */

function parseAST(AST) {
  const queryRoot = AST.definitions[0];

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
  let isQuellable = true;

  visit(AST, {
    enter(node) {
      // console.log('we are entering node ===> ', node);
      if (node.operation) {
        if (node.operation !== 'query') {
          isQuellable = false;
        }
      }
      if (node.arguments) {
        if (node.arguments.length > 0) {
          isQuellable = false;
        }
      }
      if (node.directives) {
        if (node.directives.length > 0) {
          isQuellable = false;
        }
      }
      if (node.alias) {
        isQuellable = false;
      }
    },
    // OperationDefinition(node) {
    //   console.log('test OperationDefinition !!!!!!!!');
    // },

    // Alternatively to providing enter() and leave() functions, a visitor can instead provide functions named the same as the kinds of AST nodes, or enter/leave visitors at a named key, leading to four permutations of visitor API:
    SelectionSet(node, key, parent, path, ancestors) {
      // console.log('test SelectionSet !!!!!!!');
      console.log('node ===> ', node);
      console.log('key ===> ', key);
      console.log('parent ===> ', parent);
      console.log('path ===> ', path);
      console.log('ancestors ===>', ancestors);
      /**
       * Exclude SelectionSet nodes whose parents' are not of the kind
       * 'Field' to exclude nodes that do not contain information about
       *  queried fields.
       */
      if (parent.kind === 'Field') {
        /** GraphQL ASTs are structured such that a field's parent field
         *  is found three three ancestors back. Hence, we subtract three.
         */
        let depth = ancestors.length - 3;
        console.log('ancestors.length ===> ', ancestors.length);
        console.log(' depth = ancestors.length - 3 ===> ', depth);
        let objPath = [parent.name.value];
        console.log('objPath = [parent.name.value] ===> ', objPath);

        /** Loop through ancestors to gather all ancestor nodes. This array
         * of nodes will be necessary for properly nesting each field in the
         * prototype object.
         */
        while (depth >= 5) {
          let parentNodes = ancestors[depth - 1];
          console.log('parentNodes = ancestors[depth - 1] ===> ', parentNodes);
          let { length } = parentNodes;
          console.log('length', length);
          objPath.unshift(parentNodes[length - 1].name.value);
          console.log(
            'objPath.unshift(parentNodes[length - 1].name.value) inside of while loop ===> ',
            objPath
          );
          depth -= 3;
          console.log('depth -= 3 inside of while loop ===> ', depth);
        }

        /** Loop over the array of fields at current node, adding each to
         *  an object that will be assigned to the prototype object at the
         *  position determined by the above array of ancestor fields.
         */
        const collectFields = {};
        for (let field of node.selections) {
          collectFields[field.name.value] = true;
        }
        console.log('collectFields ===> ', { ...collectFields });

        /** Helper function to convert array of ancestor fields into a
         *  path at which to assign the `collectFields` object.
         */
        function setProperty(path, obj, value) {
          console.log('objPath/path !!!!! ===> ', path);
          console.log(
            'prototype/obj !!!!! ===> ',
            JSON.parse(JSON.stringify(obj))
          );
          console.log('collectFields/value !!!!! ===> ', value);
          return path.reduce((prev, curr, index) => {
            console.log(
              'prototype accumulator/prev !!!!! ===> ',
              JSON.parse(JSON.stringify(prev))
            );
            console.log('current path/curr !!!!! ===> ', curr);
            console.log('index !!!!! ===> ', index);
            return index + 1 === path.length // if last item in path
              ? (prev[curr] = value) // set value
              : (prev[curr] = prev[curr] || {});
            // otherwise, if index exists, keep value or set to empty object if index does not exist
          }, obj);
        }

        setProperty(objPath, prototype, collectFields);
        console.log('prototype ===> ', JSON.parse(JSON.stringify(prototype)));
      }
    },
  });

  return isQuellable ? prototype : 'unQuellable';
}

module.exports = parseAST;
