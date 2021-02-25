const { visit } = require('graphql/language/visitor');
/**
 * parseAST traverses the abstract syntax tree and creates a prototype object
 * representing all the queried fields nested as they are in the query.
 */

function parseAST(AST, QuellStore) {
  // const queryRoot = AST.definitions[0];

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
      // // We commented this section out because we changed arguments to be Quellable
      // if (node.arguments) {
      //   if (node.arguments.length > 0) {
      //     isQuellable = false;
      //   }
      // }
      if (node.directives) {
        if (node.directives.length > 0) {
          isQuellable = false;
        }
      }
      // // We commented this section out because we changed alias to be Quellable
      // if (node.alias) {
      //   isQuellable = false;
      // }
    },

    // Alternatively to providing enter() and leave() functions, a visitor can instead provide functions named the same as the kinds of AST nodes, or enter/leave visitors at a named key, leading to four permutations of visitor API:
    // node – The current node being visiting.
    // key – The index or key to this node from the parent node or Array.
    // parent – the parent immediately above this node, which may be an Array.
    // path – The key path to get to this node from the root node.
    // ancestors – All nodes and Arrays visited before reaching parent of this node. These correspond to array indices in path. Note: ancestors includes arrays which contain the parent of visited node.
    SelectionSet(node, key, parent, path, ancestors) {
      // console.log('node ===> ', node);
      // console.log('key ===> ', key);
      // console.log('parent ===> ', parent);
      // console.log('path ===> ', path);
      // console.log('ancestors ===>', ancestors);
      /**
       * Exclude SelectionSet nodes whose parents' are not of the kind
       * 'Field' to exclude nodes that do not contain information about
       *  queried fields.
       */
      if (parent.kind === 'Field') {
        // Build the response prototype

        /** GraphQL ASTs are structured such that a field's parent field
         *  is found three three ancestors back. Hence, we subtract three.
         */
        let parentFieldDepth = ancestors.length - 3;
        // console.log('ancestors.length ===> ', ancestors.length);
        // console.log(
        //   ' parentFieldDepth = ancestors.length - 3 ===> ',
        //   parentFieldDepth
        // );

        let objPath = [parent.name.value];
        // console.log('objPath = [parent.name.value] ===> ', objPath);

        /** Loop through ancestors to gather all ancestor nodes. This array
         * of nodes will be necessary for properly nesting each field in the
         * prototype object.
         */
        while (parentFieldDepth >= 5) {
          let parentFieldNode = ancestors[parentFieldDepth - 1];
          // console.log('parentFieldNode ===> ', parentFieldNode);

          let { length } = parentFieldNode;
          // console.log('length', length);
          objPath.unshift(parentFieldNode[length - 1].name.value);
          // console.log(
          //   'objPath.unshift(parentFieldNode[length - 1].name.value) inside of while loop ===> ',
          //   objPath
          // );

          parentFieldDepth -= 3;
        }

        /** Loop over the array of fields at current node, adding each to
         *  an object that will be assigned to the prototype object at the
         *  position determined by the above array of ancestor fields.
         */
        const collectFields = {};

        for (let field of node.selections) {
          collectFields[field.name.value] = true;
        }
        // console.log(
        //   'collectFields ===> ',
        //   JSON.parse(JSON.stringify(collectFields))
        // );

        /** Helper function to convert array of ancestor fields into a
         *  path at which to assign the `collectFields` object.
         */
        function setProperty(path, obj, value) {
          // console.log('objPath/path ===> ', path);
          // console.log('prototype/obj ===> ', JSON.parse(JSON.stringify(obj)));
          // console.log('collectFields/value ===> ', value);
          return path.reduce((prev, curr, index) => {
            // console.log(
            //   'prototype accumulator/prev ===> ',
            //   JSON.parse(JSON.stringify(prev))
            // );
            // console.log('current path/curr ===> ', curr);
            return index + 1 === path.length // if last item in path
              ? (prev[curr] = value) // set value
              : (prev[curr] = prev[curr] || {});
            // otherwise, if index exists, keep value or set to empty object if index does not exist
          }, obj);
        }

        setProperty(objPath, prototype, collectFields);
        // console.log(
        //   'prototype in parseAST ===> ',
        //   JSON.parse(JSON.stringify(prototype))
        // );

        // Build the arguments object

        /** If the current node's parent has a property name arguments and the arguments' array
         *  lengh is greater than zero and current node's parent does not have a property name alias
         *  Loop over the parent's array of arguments, adding each
         *  name value pair to QuellStore.arguments
         *  QuellStore.arguments stucture: {country: { id: ‘2’ }, city: {id: 3}, author: {id: 3}}
         */
        if (parent.arguments && !parent.alias) {
          // console.log('parent ===> ', parent);
          if (parent.arguments.length > 0) {
            for (let i = 0; i < parent.arguments.length; i++) {
              const key = parent.arguments[i].name.value;
              const value = parent.arguments[i].value.value;
              // If isQuellable is already false prior to this loop or if we have any arguments that is not an id or _id, set it to be false and let the query pass without cache in client side
              isQuellable = isQuellable && key.includes('id');
              // console.log('isQuellable ===> ', isQuellable);
              // if QuellStore.arguments is null, assign an empty object here. So we can add property-value pairs after this line. We can't use bracket notation on an object's value that is null.
              if (!QuellStore.arguments) {
                QuellStore.arguments = { [parent.name.value]: [] };
              }
              QuellStore.arguments[parent.name.value].push({ [key]: value });
            }
          }
        }

        /** If the current node's parent has a property name alias
         *  then the parent must has a property name arguments and the arguments'
         *  array length must be greater than 0
         *  Loop over the parent's array of alias, adding each
         *  name value pair to QuellStore.alias
         *  QuellStore.alias stucture: {country: { id: ‘2’ }, city: {id: 3}, author: {id: 3}}
         */
        if (parent.alias) {
          // console.log('parent ===> ', parent);
          for (let i = 0; i < parent.arguments.length; i++) {
            const key = parent.arguments[i].name.value;
            const value = parent.arguments[i].value.value;
            // If isQuellable is already false prior to this loop or if we have any arguments that is not an id or _id, set it to be false and let the query pass without cache in client side
            isQuellable = isQuellable && key.includes('id');
            // if QuellStore.arguments is null, assign an empty object here. So we can add property-value pairs after this line. We can't use bracket notation on an object's value that is null.
            if (!QuellStore.alias) {
              QuellStore.alias = { [parent.name.value]: [] };
            }
            QuellStore.alias[parent.name.value].push(parent.alias.value);

            if (!QuellStore.arguments) {
              QuellStore.arguments = { [parent.name.value]: [] };
            }
            QuellStore.arguments[parent.name.value].push({ [key]: value });
          }
        }
      }
    },
  });
  // console.log('isQuellable before return out from parseAST ===> ', isQuellable);

  return isQuellable ? prototype : 'unQuellable';
}

module.exports = parseAST;
