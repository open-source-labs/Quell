const { parse } = require("graphql/language/parser");
const { visit } = require("graphql/language/visitor");
const { graphql } = require("graphql");

/**
 * parseAST traverses the abstract syntax tree and creates a prototype object
 * representing all the queried fields nested as they are in the query. The
 * prototype object is used as
 *  (1) a model guiding the construction of responses from cache
 *  (2) a record of which fields were not present in cache and therefore need to be queried
 *  (3) a model guiding the construction of a new, partial GraphQL query
 */
function parseAST(AST) {
  const queryRoot = AST.definitions[0];
  // initialize prototype as empty object
  const prototype = {};
  let isQuellable = true;
  console.log("we are inside parse AST");

  /**
   * visit is a utility provided in the graphql-JS library. It performs a
   * depth-first traversal of the abstract syntax tree, invoking a callback
   * when each SelectionSet node is entered. That function builds the prototype.
   *
   * Find documentation at:
   * https://graphql.org/graphql-js/language/#visit
   */
  visit(AST, {
    enter(node) {
      if (node.operation) {
        if (node.operation !== "query") {
          isQuellable = false;
        }
      }
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
      // if (node.alias) {
      //   isQuellable = false;
      // }
    },
    SelectionSet(node, key, parent, path, ancestors) {
      /** Helper function to convert array of ancestor fields into a
       *  path at which to assign the `collectFields` object.
       */
      function setProperty(path, obj, value) {
        console.log("path in setproperty", path);
        return path.reduce((prev, curr, index) => {
          return index + 1 === path.length // if last item in path
            ? (prev[curr] = value) // set value
            : (prev[curr] = prev[curr] || {});
          // otherwise, if index exists, keep value or set to empty object if index does not exist
        }, obj);
      }
      /**
       * Exclude SelectionSet nodes whose parents' are not of the kind
       * 'Field' to exclude nodes that do not contain information about
       *  queried fields.
       */
      if (parent.kind === "Field") {
        /** GraphQL ASTs are structured such that a field's parent field
         *  is found three three ancestors back. Hence, subtract three.
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
        console.log("parent !!!!!!!!", parent);
        if (parent.arguments) {
          console.log("parent arg", parent.arguments);
          if (parent.arguments.length > 0) {
            // loop through arguments
            collectFields.arguments = {};
            for (let i = 0; i < parent.arguments.length; i++) {
              const key = parent.arguments[i].name.value;
              const value = parent.arguments[i].value.value;
              collectFields.arguments[key] = value;
            }
          }
        }
        for (let field of node.selections) {
          collectFields[field.name.value] = true;
        }
        console.log("collectFields ===> ", { ...collectFields });
        // use helper function to update prototype
        setProperty(objPath, prototype, collectFields);
        console.log("prototype after collect fields", prototype);
      }
    },
  });

  // { country: { arguments: { id: '1' }, id: true, capital: true } } -- current proto after everything
  // { Country-1: { id: true, capital: true } } -- should look like this ??

  return isQuellable ? prototype : "unQuellable";
}

module.exports = parseAST;
