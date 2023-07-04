import { visit, BREAK } from "graphql/language/visitor";
import type {
  GraphQLSchema,
  ASTNode,
  DocumentNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  FieldNode,
  SelectionSetNode,
  ArgumentNode,
  FragmentSpreadNode,
} from "graphql";
import type {
  ProtoObjType,
  FragsType,
  MutationMapType,
  QueryMapType,
  FieldsMapType,
  ParseASTOptions,
  ArgsObjType,
  FieldArgsType,
  AuxObjType,
  ValidArgumentNodeType,
  FieldsObjectType,
  FieldsValuesType,
  GQLNodeWithDirectivesType,
  QueryObject,
  QueryFields,
  MergedResponse,
  DataResponse,
  Data,
  ReturnType,
  MutationTypeFieldsType,
  FieldType,
} from "../types";

/**
 * Traverses over a supplied query Object and uses the fields on there to create a query string reflecting the data.
 * This query string is a modified version of the query string received by Quell that has references to data found within the cache removed
 * so that the final query is faster and reduced in scope.
 * @param {Object} queryObject - A modified version of the prototype with only values we want to pass onto the queryString.
 * @param {string} operationType - A string indicating the GraphQL operation type- 'query', 'mutation', etc.
 */
export function createQueryStr(
  queryObject: QueryObject | ProtoObjType,
  operationType?: string
): string {
  if (Object.keys(queryObject).length === 0) return "";
  const openCurly = "{";
  const closeCurly = "}";
  const openParen = "(";
  const closeParen = ")";

  let mainStr = "";

  // iterate over every key in queryObject
  // place key into query object
  for (const key in queryObject) {
    mainStr += ` ${key}${getAliasType(
      queryObject[key] as QueryFields
    )}${getArgs(queryObject[key] as QueryFields)} ${openCurly} ${stringify(
      queryObject[key] as QueryFields
    )}${closeCurly}`;
  }

  /**
   * Helper function that is used to recursively build a GraphQL query string from a nested object,
   * ignoring any __values (ie __alias and __args).
   * @param {QueryFields} fields - An object whose properties need to be converted to a string to be used for a GraphQL query.
   * @returns {string} innerStr - A graphQL query string.
   */
  function stringify(fields: QueryFields): string {
    // initialize inner string
    let innerStr = "";
    // iterate over KEYS in OBJECT
    for (const key in fields) {
      // is fields[key] string? concat with inner string & empty space
      if (typeof fields[key] === "boolean") {
        innerStr += key + " ";
      }
      // is key object? && !key.includes('__'), recurse stringify
      if (typeof fields[key] === "object" && !key.includes("__")) {
        const fieldsObj: QueryFields = fields[key] as QueryFields;
        // TODO try to fix this error
        const type: string = getAliasType(fieldsObj);
        const args: string = getArgs(fieldsObj);
        innerStr += `${key}${type}${args} ${openCurly} ${stringify(
          fieldsObj
        )}${closeCurly} `;
      }
    }

    return innerStr;
  }

  /**
   * Helper function that iterates through arguments object for current field and creates
   * an argument string to attach to the query string.
   * @param {QueryFields} fields - Object whose arguments will be attached to the query string.
   * @returns {string} Argument string to be attached to the query string.
   */
  function getArgs(fields: QueryFields): string {
    let argString = "";
    if (!fields.__args) return "";

    Object.keys(fields.__args).forEach((key) => {
      argString
        ? (argString += `, ${key}: "${(fields.__args as QueryFields)[key]}"`)
        : (argString += `${key}: "${(fields.__args as QueryFields)[key]}"`);
    });

    // return arg string in parentheses, or if no arguments, return an empty string
    return argString ? `${openParen}${argString}${closeParen}` : "";
  }

  /**
   * Helper function that formats the field's alias, if it exists, for the query string.
   * @param {QueryFields} fields - Object whose alias will be attached to the query string.
   * @returns {string} Alias string to be attached to the query string.
   */
  function getAliasType(fields: QueryFields): string {
    return fields.__alias ? `: ${fields.__type}` : "";
  }

  // Create the final query string.
  const queryStr: string = openCurly + mainStr + " " + closeCurly;
  return operationType ? operationType + " " + queryStr : queryStr;
}

/**
 * Takes in a map of fields and true/false values (the prototype) and creates a query object containing any values missing from the cache.
 * The resulting queryObj is then used as a template to create GraphQL query strings.
 * @param {ProtoObjType} map - Map of fields and true/false values from initial request, should be the prototype.
 * @returns {Object} queryObject that includes only the values to be requested from GraphQL endpoint.
 */
export function createQueryObj(map: ProtoObjType): ProtoObjType {
  const output: ProtoObjType = {};
  // iterate over every key in map
  // true values are filtered out, false values are placed on output
  for (const key in map) {
    const reduced: ProtoObjType = reducer(map[key] as ProtoObjType);
    if (Object.keys(reduced).length > 0) {
      output[key] = reduced;
    }
  }

  /**
   * Takes in a fields object and returns only the values needed from the server.
   * @param {Object} fields - Object containing true or false values that determines what should be
   * retrieved from the server.
   * @returns {Object} Filtered object of only queries without a value or an empty object.
   */
  function reducer(fields: ProtoObjType): ProtoObjType {
    // Create a filter object to store values needed from server.
    const filter: ProtoObjType = {};
    // Create a propsFilter object for properties such as args, aliases, etc.
    const propsFilter: ProtoObjType = {};

    for (const key in fields) {
      // If value is false, place directly on filter
      if (fields[key] === false) {
        filter[key] = false;
      }
      // Force the id onto the query object
      if (key === "id" || key === "_id" || key === "ID" || key === "Id") {
        filter[key] = false;
      }

      // If value is an object, recurse to determine nested values
      if (typeof fields[key] === "object" && !key.includes("__")) {
        const reduced: ProtoObjType = reducer(fields[key] as ProtoObjType);
        // if reduced object has any values to pass, place on filter
        if (Object.keys(reduced).length > 1) {
          filter[key] = reduced;
        }
      }

      // If reserved property such as args or alias, place on propsFilter
      if (key.includes("__")) {
        propsFilter[key] = fields[key];
      }
    }

    const numFields: number = Object.keys(fields).length;

    // If the filter has any values to pass, return filter & propsFilter; otherwise return empty object
    return Object.keys(filter).length > 1 && numFields > 5
      ? { ...filter, ...propsFilter }
      : {};
  }
  return output;
}

/**
 * Combines two objects containing results from separate sources and outputs a single object with information from both sources combined,
 * formatted to be delivered to the client, using the queryProto as a template for how to structure the final response object.
 * @param {Object} cacheResponse - Response data from the cache.
 * @param {Object} serverResponse - Response data from the server or external API.
 * @param {Object} queryProto - Current slice of the prototype being used as a template for final response object structure.
 * @param {boolean} fromArray - Whether or not the current recursive loop came from within an array (should NOT be supplied to function call).
 */
export function joinResponses(
  cacheResponse: DataResponse,
  serverResponse: DataResponse,
  queryProto: QueryObject | ProtoObjType,
  fromArray = false
): MergedResponse {
  let mergedResponse: MergedResponse = {};

  // loop through fields object keys, the "source of truth" for structure
  // store combined responses in mergedResponse
  for (const key in queryProto) {
    // for each key, check whether data stored at that key is an array or an object
    const checkResponse: DataResponse = Object.prototype.hasOwnProperty.call(
      serverResponse,
      key
    )
      ? serverResponse
      : cacheResponse;
    if (Array.isArray(checkResponse[key])) {
      // merging logic depends on whether the data is on the cacheResponse, serverResponse, or both
      // if both of the caches contain the same keys...
      if (cacheResponse[key] && serverResponse[key]) {
        // we first check to see if the responses have identical keys to both avoid
        // only returning 1/2 of the data (ex: there are 2 objects in the cache and
        // you query for 4 objects (which includes the 2 cached objects) only returning
        // the 2 new objects from the server)
        // if the keys are identical, we can return a "simple" merge of both
        const cacheKeys: string[] = Object.keys(
          (cacheResponse[key] as Data)[0]
        );
        const serverKeys: string[] = Object.keys(
          (serverResponse[key] as Data)[0]
        );
        let keysSame = true;
        for (let n = 0; n < cacheKeys.length; n++) {
          if (cacheKeys[n] !== serverKeys[n]) keysSame = false;
        }
        if (keysSame) {
          mergedResponse[key] = [
            ...(cacheResponse[key] as Data[]),
            ...(serverResponse[key] as Data[]),
          ];
        }
        // otherwise, we need to combine the responses at the object level
        else {
          const mergedArray = [];
          for (let i = 0; i < (cacheResponse[key] as Data[]).length; i++) {
            // for each index of array, combine cache and server response objects
            const joinedResponse: MergedResponse = joinResponses(
              { [key]: (cacheResponse[key] as Data[])[i] },
              { [key]: (serverResponse[key] as Data[])[i] },
              { [key]: queryProto[key] },
              true
            );
            mergedArray.push(joinedResponse);
          }
          mergedResponse[key] = mergedArray;
        }
      } else if (cacheResponse[key]) {
        mergedResponse[key] = cacheResponse[key];
      } else {
        mergedResponse[key] = serverResponse[key];
      }
    } else {
      if (!fromArray) {
        // if object doesn't come from an array, we must assign on the object at the given key
        mergedResponse[key] = {
          ...cacheResponse[key],
          ...serverResponse[key],
        };
      } else {
        // if the object comes from an array, we do not want to assign to a key as per GQL spec
        (mergedResponse as object) = {
          ...cacheResponse[key],
          ...serverResponse[key],
        };
      }

      for (const fieldName in queryProto[key] as ProtoObjType) {
        // check for nested objects
        if (
          typeof (queryProto[key] as ProtoObjType)[fieldName] === "object" &&
          !fieldName.includes("__")
        ) {
          // recurse joinResponses on that object to create deeply nested copy on mergedResponse
          let mergedRecursion: MergedResponse = {};
          if (cacheResponse[key] && serverResponse[key]) {
            if (
              (cacheResponse[key] as Data)[fieldName] &&
              (serverResponse[key] as Data)[fieldName]
            ) {
              mergedRecursion = joinResponses(
                {
                  [fieldName]: (cacheResponse[key] as DataResponse)[fieldName],
                },
                {
                  [fieldName]: (serverResponse[key] as DataResponse)[fieldName],
                },
                { [fieldName]: (queryProto[key] as QueryObject)[fieldName] }
              );
            } else if ((cacheResponse[key] as Data)[fieldName]) {
              mergedRecursion[fieldName] = (
                cacheResponse[key] as MergedResponse
              )[fieldName];
            } else {
              mergedRecursion[fieldName] = (
                serverResponse[key] as MergedResponse
              )[fieldName];
            }
          }
          // place on merged response, spreading the mergedResponse[key] if it
          // is an object or an array, or just adding it as a value at key otherwise
          if (
            typeof mergedResponse[key] === "object" ||
            Array.isArray(mergedResponse[key])
          ) {
            mergedResponse[key] = {
              ...(mergedResponse[key] as MergedResponse | MergedResponse[]),
              ...mergedRecursion,
            };
          } else {
            // case for when mergedResponse[key] is not an object or array and possibly
            // boolean or a string
            mergedResponse[key] = {
              key: mergedResponse[key] as Data | boolean,
              ...mergedRecursion,
            };
          }
        }
      }
    }
  }
  return mergedResponse;
}

/**
 * Traverses the abstract syntax tree depth-first to create a template for future operations, such as
 * request data from the cache, creating a modified query string for additional information needed, and joining cache and database responses.
 * @param {Object} AST - An abstract syntax tree generated by GraphQL library that we will traverse to build our prototype.
 * @param {Object} options - (not fully integrated) A field for user-supplied options.
 * @returns {Object} prototype object
 * @returns {string} operationType
 * @returns {Object} frags object
 */
export function parseAST(
  AST: DocumentNode,
  options: ParseASTOptions = { userDefinedID: null }
): { proto: ProtoObjType; operationType: string; frags: FragsType } {
  // Initialize prototype and frags as empty objects.
  // Information from the AST is distilled into the prototype for easy
  // access during caching, rebuilding query strings, etc.
  const proto: ProtoObjType = {};

  // The frags object will contain the fragments defined in the query in a format
  // similar to the proto.
  const frags: FragsType = {};

  // Create operation type variable. This will be 'query', 'mutation', 'subscription', 'noID', or 'unQuellable'.
  let operationType = "";

  // Initialize a stack to keep track of depth first parsing path.
  const stack: string[] = [];

  // Create field arguments object, which will track the id, type, alias, and args for the fields.
  // The field arguments object will eventually be merged with the prototype object.
  const fieldArgs: FieldArgsType = {};

  // Extract the userDefinedID from the options object, if provided.
  const userDefinedID: string | null | undefined = options.userDefinedID;

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
    // The enter function will be triggered upon entering each node in the traversal.
    enter(node: ASTNode) {
      // Quell cannot cache directives, so we need to return as unQuellable if the node has directives.
      if ((node as GQLNodeWithDirectivesType)?.directives) {
        if ((node as GQLNodeWithDirectivesType)?.directives?.length ?? 0 > 0) {
          operationType = "unQuellable";
          // Return BREAK to break out of the current traversal branch.
          return BREAK;
        }
      }
    },

    // If the current node is of type OperationDefinition, this function will be triggered upon entering it.
    // It checks the type of operation being performed.
    OperationDefinition(node: OperationDefinitionNode) {
      // Quell cannot cache subscriptions, so we need to return as unQuellable if the type is subscription.
      operationType = node.operation;
      if (operationType === "subscription") {
        operationType = "unQuellable";
        // Return BREAK to break out of the current traversal branch.
        return BREAK;
      }
    },

    // If the current node is of type FragmentDefinition, this function will be triggered upon entering it.
    FragmentDefinition(node: FragmentDefinitionNode) {
      // Get the name of the fragment.
      const fragName = node.name.value;

      // Add the fragment name to the stack.
      stack.push(fragName);

      // Add the fragment name as a key in the frags object, initialized to an empty object.
      frags[fragName] = {};

      // Loop through the selections in the selection set for the current FragmentDefinition node
      // in order to extract the fields in the fragment.
      for (let i = 0; i < node.selectionSet.selections.length; i++) {
        // Below, we get the 'name' property from the SelectionNode.
        // However, InlineFragmentNode (one of the possible types for SelectionNode) does
        // not have a 'name' property, so we will want to skip nodes with that type.
        if (node.selectionSet.selections[i].kind !== "InlineFragment") {
          // Add base-level field names in the fragment to the frags object.
          frags[fragName][
            (
              node.selectionSet.selections[i] as FieldNode | FragmentSpreadNode
            ).name.value
          ] = true;
        }
      }
    },

    Field: {
      // If the current node is of type Field, this function will be triggered upon entering it.
      enter(node: FieldNode) {
        // Return introspection queries as unQuellable so that we do not cache them.
        // "__keyname" syntax is later used for Quell's field-specific options, though this does not create collision with introspection.
        if (node.name.value.includes("__")) {
          operationType = "unQuellable";
          // Return BREAK to break out of the current traversal branch.
          return BREAK;
        }

        // Create an args object that will be populated with the current node's arguments.
        const argsObj: ArgsObjType = {};

        // Auxiliary object for storing arguments, aliases, field-specific options, and more.
        // Query-wide options should be handled on Quell's options object.
        const auxObj: AuxObjType = {
          __id: null,
        };

        // Loop through the field's arguments.
        if (node.arguments) {
          node.arguments.forEach((arg: ArgumentNode) => {
            const key: string = arg.name.value;

            // Quell cannot cache queries with variables, so we need to return unQuellable if the query has variables.
            if (arg.value.kind === "Variable" && operationType === "query") {
              operationType = "unQuellable";
              // Return BREAK to break out of the current traversal branch.
              return BREAK;
            }

            /*
             * In the next step, we get the value from the argument node's value node.
             * This assumes that the value node has a 'value' property.
             * If the 'kind' of the value node is ObjectValue, ListValue, NullValue, or ListValue
             * then the value node will not have a 'value' property, so we must first check that
             * the 'kind' does not match any of those types.
             */
            if (
              arg.value.kind === "NullValue" ||
              arg.value.kind === "ObjectValue" ||
              arg.value.kind === "ListValue"
            ) {
              operationType = "unQuellable";
              // Return BREAK to break out of the current traversal branch.
              return BREAK;
            }

            // Assign argument values to argsObj (key will be argument name, value will be argument value),
            // skipping field-specific options ('__') provided as arguments.
            if (!key.includes("__")) {
              // Get the value from the argument node's value node.
              argsObj[key] = (arg.value as ValidArgumentNodeType).value;
            }

            // If a userDefinedID was included in the options object and the current argument name matches
            // that ID, update the auxiliary object's id.
            if (userDefinedID ? key === userDefinedID : false) {
              auxObj.__id = (arg.value as ValidArgumentNodeType).value;
            } else if (
              // If a userDefinedID was not provided, determine the uniqueID from the args.
              // Note: do not use key.includes('id') to avoid assigning fields such as "idea" or "idiom" as uniqueID.
              key === "id" ||
              key === "_id" ||
              key === "ID" ||
              key === "Id"
            ) {
              // If the name of the argument is 'id', '_id', 'ID', or 'Id',
              // set the '__id' field on the auxObj equal to value of that argument.
              auxObj.__id = (arg.value as ValidArgumentNodeType).value;
            }
          });
        }

        // Gather other auxiliary data such as aliases, arguments, query type, and more to append to the prototype for future reference.

        // Set the fieldType (which will be the key in the fieldArgs object) equal to either the field's alias or the field's name.
        const fieldType: string = node.alias
          ? node.alias.value
          : node.name.value;

        // Set the '__type' property of the auxiliary object equal to the field's name, converted to lower case.
        auxObj.__type = node.name.value.toLowerCase();

        // Set the '__alias' property of the auxiliary object equal to the field's alias if it has one.
        auxObj.__alias = node.alias ? node.alias.value : null;

        // Set the '__args' property of the auxiliary object equal to the args
        auxObj.__args = Object.keys(argsObj).length > 0 ? argsObj : null;

        // Add auxObj fields to prototype, allowing future access to type, alias, args, etc.
        fieldArgs[fieldType] = {
          ...auxObj,
        };
        // Add the field type to stacks to keep track of depth-first parsing path.
        stack.push(fieldType);
      },

      // If the current node is of type Field, this function will be triggered after visiting it and all of its children.
      leave() {
        // Pop stacks to keep track of depth-first parsing path.
        stack.pop();
      },
    },

    SelectionSet: {
      // If the current node is of type SelectionSet, this function will be triggered upon entering it.
      // The selection sets contain all of the sub-fields.
      // Iterate through the sub-fields to construct fieldsObject
      enter(
        node: SelectionSetNode,
        key: string | number | undefined,
        parent: ASTNode | readonly ASTNode[] | undefined,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        path: readonly (string | number)[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ancestors: readonly (ASTNode | readonly ASTNode[])[]
      ) {
        /*
         * Exclude SelectionSet nodes whose parents are not of the kind
         * 'Field' to exclude nodes that do not contain information about
         *  queried fields.
         */
        // FIXME: It is possible for the parent to be an array. This happens when the selection set
        // is a fragment spread. In that case, the parent will not have a 'kind' property. For now,
        // add a check that parent is not an array.
        if (
          parent && // parent is not undefined
          !Array.isArray(parent) && // parent is not readonly ASTNode[]
          (parent as ASTNode).kind === "Field" // can now safely cast parent to ASTNode
        ) {
          // Create fieldsValues object that will be used to collect fields as
          // we loop through the selections.
          const fieldsValues: FieldsValuesType = {};

          /*
           * Create a variable called fragment, initialized to false, to indicate whether the selection set includes a fragment spread.
           * Loop through the current selection set's selections array.
           * If the array contains a FragmentSpread node, set the fragment variable to true.
           * This is reset to false upon entering each new selection set.
           */
          let fragment = false;
          for (const field of node.selections) {
            if (field.kind === "FragmentSpread") fragment = true;
            /*
             * If the current selection in the selections array is not a nested object
             * (i.e. does not have a SelectionSet), set its value in fieldsValues to true.
             * Below, we get the 'name' property from the SelectionNode.
             * However, InlineFragmentNode (one of the possible types for SelectionNode) does
             * not have a 'name' property, so we will want to skip nodes with that type.
             * Furthermore, FragmentSpreadNodes never have a selection set property.
             */
            if (
              field.kind !== "InlineFragment" &&
              (field.kind === "FragmentSpread" || !field.selectionSet)
            )
              fieldsValues[field.name.value] = true;
          }
          // If ID was not included on the request and the current node is not a fragment, then the query
          // will not be included in the cache, but the request will be processed.
          if (
            !Object.prototype.hasOwnProperty.call(fieldsValues, "id") &&
            !Object.prototype.hasOwnProperty.call(fieldsValues, "_id") &&
            !Object.prototype.hasOwnProperty.call(fieldsValues, "ID") &&
            !Object.prototype.hasOwnProperty.call(fieldsValues, "Id") &&
            !fragment
          ) {
            operationType = "noID";
            // Return BREAK to break out of the current traversal branch.
            return BREAK;
          }

          // Place current fieldArgs object onto fieldsObject so it gets passed along to prototype.
          // The fieldArgs contains arguments, aliases, etc.
          const fieldsObject: FieldsObjectType = {
            ...fieldsValues,
            ...fieldArgs[stack[stack.length - 1]],
          };
          // Loop through stack to get correct path in proto for temp object
          stack.reduce(
            (prev: ProtoObjType, curr: string, index: number): ProtoObjType => {
              // if last item in path, set value
              if (index + 1 === stack.length) prev[curr] = { ...fieldsObject };
              return prev[curr] as ProtoObjType;
            },
            proto
          );
        }
      },

      // If the current node is of type SelectionSet, this function will be triggered upon entering it.
      leave() {
        // Pop stacks to keep track of depth-first parsing path
        stack.pop();
      },
    },
  });
  return { proto, operationType, frags };
}

/**
 * Takes collected fragments and integrates them onto the prototype where referenced.
 * @param {Object} protoObj - Prototype before it has been updated with fragments.
 * @param {Object} frags - Fragments object to update prototype with.
 * @returns {Object} Updated prototype object.
 */
export function updateProtoWithFragment(
  protoObj: ProtoObjType,
  frags: FragsType
): ProtoObjType {
  // If the proto or frags objects are null/undefined, return the protoObj.
  if (!protoObj || !frags) return protoObj;

  // Loop through the fields in the proto object.
  for (const key in protoObj) {
    // If the field is a nested object and not an introspection field (fields starting with '__'
    // that provide information about the underlying schema)
    if (typeof protoObj[key] === "object" && !key.includes("__")) {
      // Update the field to the result of recursively calling updateProtoWithFragment,
      // passing the field and fragments.
      protoObj[key] = updateProtoWithFragment(
        protoObj[key] as ProtoObjType,
        frags
      );
    }

    // If the field is a reference to a fragment, replace the reference to the fragment with
    // the actual fragment.
    if (Object.prototype.hasOwnProperty.call(frags, key)) {
      protoObj = { ...protoObj, ...frags[key] };
      delete protoObj[key];
    }
  }

  // Return the updated proto
  return protoObj;
}

/**
 *  Generates a map of mutation to GraphQL object types. This mapping is used
 *  to identify references to cached data when mutation occurs.
 *  @param {Object} schema - GraphQL defined schema that is used to facilitate caching by providing valid queries,
 *  mutations, and fields.
 *  @returns {Object} mutationMap - Map of mutations to GraphQL types.
 */
export function getMutationMap(schema: GraphQLSchema): MutationMapType {
  const mutationMap: MutationMapType = {};
  // get object containing all root mutations defined in the schema
  const mutationTypeFields: GraphQLSchema["_mutationType"] = schema
    ?.getMutationType()
    ?.getFields();
  // if queryTypeFields is a function, invoke it to get object with queries
  const mutationsObj: { [field: string]: FieldType } =
    typeof mutationTypeFields === "function"
      ? mutationTypeFields()
      : mutationTypeFields;
  for (const mutation in mutationsObj) {
    // get name of GraphQL type returned by query
    // if ofType --> this is collection, else not collection

    let returnedType: ReturnType;
    if (mutationsObj[mutation].type.ofType) {
      returnedType = [];
      returnedType.push(mutationsObj[mutation].type.ofType.name);
    }
    if (mutationsObj[mutation].type.name) {
      returnedType = mutationsObj[mutation].type.name;
    }
    mutationMap[mutation] = returnedType;
  }
  return mutationMap;
}

/**
 *  Generates a map of queries to GraphQL object types. This mapping is used
 *  to identify and create references to cached data.
 *  @param {Object} schema - GraphQL defined schema that is used to facilitate caching by providing valid queries,
 *  mutations, and fields.
 *  @returns {Object} queryMap - Map of queries to GraphQL types.
 */
export function getQueryMap(schema: GraphQLSchema): QueryMapType {
  const queryMap: QueryMapType = {};
  // get object containing all root queries defined in the schema
  const queryTypeFields: GraphQLSchema["_queryType"] = schema
    ?.getQueryType()
    ?.getFields();
  // if queryTypeFields is a function, invoke it to get object with queries
  const queriesObj: { [field: string]: FieldType } =
    typeof queryTypeFields === "function" ? queryTypeFields() : queryTypeFields;
  for (const query in queriesObj) {
    // get name of GraphQL type returned by query
    // if ofType --> this is collection, else not collection
    let returnedType: ReturnType;
    if (queriesObj[query].type.ofType) {
      returnedType = [];
      returnedType.push(queriesObj[query].type.ofType.name);
    }
    if (queriesObj[query].type.name) {
      returnedType = queriesObj[query].type.name;
    }
    queryMap[query] = returnedType;
  }
  return queryMap;
}

/**
 *  Generates of map of fields to GraphQL types. This mapping is used to identify
 *  and create references to cached data.
 *  @param {Object} schema - GraphQL defined schema that is used to facilitate caching by providing valid queries,
 *  mutations, and fields.
 *  @returns {Object} fieldsMap - Map of fields to GraphQL types.
 */
export function getFieldsMap(schema: any): FieldsMapType {
  const fieldsMap: FieldsMapType = {};
  const typesList: GraphQLSchema["_typeMap"] = schema?.default?._typeMap || {};
  const builtInTypes: string[] = [
    "String",
    "Int",
    "Float",
    "Boolean",
    "ID",
    "Query",
    "__Type",
    "__Field",
    "__EnumValue",
    "__DirectiveLocation",
    "__Schema",
    "__TypeKind",
    "__InputValue",
    "__Directive",
  ];
  // exclude built-in types
  const customTypes = Object.keys(typesList).filter(
    (type) =>
      !builtInTypes.includes(type) && type !== schema.default?._queryType?.name
  );

  // loop through types
  for (const type of customTypes) {
    const fieldsObj: FieldsObjectType = {};
    // let fields: { [field: string]: FieldType }  = typesList[type]._fields;
    let fields = typesList[type]._fields;

    if (typeof fields === "function") fields = fields();
    for (const field in fields) {
      const key: string = fields[field].name;
      const value: string = fields[field].type.ofType
        ? fields[field].type.ofType.name
        : fields[field].type.name;
      fieldsObj[key] = value;
    }
    // place assembled types on fieldsMap
    fieldsMap[type] = fieldsObj;
  }
  return fieldsMap;
}

// // TODO: Unused functions for QuellCache Class
// /**
//  * createRedisKey creates key based on field name and argument id and returns string or null if key creation is not possible
//  * @param {Object} mutationMap -
//  * @param {Object} proto -
//  * @param {Object} protoArgs -
//  * @returns {Object} redisKey if possible, e.g. 'Book-1' or 'Book-2', where 'Book' is name from mutationMap and '1' is id from protoArgs
//  * and isExist if we have this key in redis
//  *
//  */
// // BUG: createRedisKey is an unused function -- types should be assigned if function is used
// async function createRedisKey(mutationMap, proto, protoArgs) {
//   let isExist = false;
//   let redisKey;
//   let redisValue = null;
//   for (const mutationName in proto) {
//     const mutationArgs = protoArgs[mutationName];
//     redisKey = mutationMap[mutationName];
//     for (const key in mutationArgs) {
//       let identifier = null;
//       if (key === 'id' || key === '_id') {
//         identifier = mutationArgs[key];
//         redisKey = mutationMap[mutationName] + '-' + identifier;
//         isExist = await this.checkFromRedis(redisKey);
//         if (isExist) {
//           redisValue = await this.getFromRedis(redisKey);
//           redisValue = JSON.parse(redisValue);
//           // combine redis value and protoArgs
//           let argumentsValue;
//           for (const mutationName in protoArgs) {
//             // change later, now we assume that we have only one mutation
//             argumentsValue = protoArgs[mutationName];
//           }
//           // updateObject is not defined anywhere
//           redisValue = this.updateObject(redisValue, argumentsValue);
//         }
//       }
//     }
//   }
//   return { redisKey, isExist, redisValue };
// }

// // BUG: getIdMap is an unused function -- types should be assigned if function is used
// function getIdMap() {
//   const idMap = {};
//   for (const type in this.fieldsMap) {
//     const userDefinedIds = [];
//     const fieldsAtType = this.fieldsMap[type];
//     for (const key in fieldsAtType) {
//       if (fieldsAtType[key] === 'ID') userDefinedIds.push(key);
//     }
//     idMap[type] = userDefinedIds;
//   }
//   return idMap;
// }

// /**
//  * Toggles to false all values in a nested field not present in cache so that they will
//  * be included in the reformulated query.
//  * @param {Object} proto - The prototype or a nested field within the prototype
//  * @returns {Object} proto - updated proto with false values for fields not present in cache
//  */
// // BUG: toggleProto is an unused function -- types should be assigned if function is used
// function toggleProto(proto) {
//   if (proto === undefined) return proto;
//   for (const key in proto) {
//     if (Object.keys(proto[key]).length > 0) this.toggleProto(proto[key]);
//     else proto[key] = false;
//   }
//   return proto;
// }

// /**
//  * checkFromRedis reads from Redis cache and returns a promise.
//  * @param {String} key - the key for Redis lookup
//  * @returns {Promise} A promise that represents if the key was found in the redisCache
//  */
// // BUG: checkFromRedis is an unused function -- types should be assigned if function is used
// async function checkFromRedis(key: string): Promise<number> {
//   try {
//     // will return 0 if key does not exists
//     const existsInRedis: number = await this.redisCache.exists(key);
//     return existsInRedis;
//   } catch (err) {
//     console.log('err in checkFromRedis: ', err);
//     return 0;
//   }
// }

// /**
//  * execRedisRunQueue executes all previously queued transactions in Redis cache
//  * @param {String} redisRunQueue - Redis queue of transactions awaiting execution
//  */
// // BUG: execRedisRunQueue is an unused function -- types should be assigned if function is used
// async function execRedisRunQueue(
//   redisRunQueue: ReturnType<typeof this.redisCache.multi>
// ): Promise<void> {
//   try {
//     await redisRunQueue.exec();
//   } catch (err) {
//     console.log('err in execRedisRunQueue: ', err);
//   }
// }
