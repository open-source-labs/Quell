import { DocumentNode } from 'graphql';
import { Collection } from 'lokijs';
import { parse } from 'graphql/language/parser';
import determineType from './helpers/determineType';
import Loki from 'lokijs';
import type {
  CostParamsType,
  IDLokiCacheType,
  LokiGetType,
  FetchObjType,
  JSONObject,
  JSONValue,
  ClientErrorType
} from './types';
const lokidb: Loki = new Loki('client-cache');
let lokiCache: Collection = lokidb.addCollection('loki-client-cache', {
  disableMeta: true
});

/* The IDCache is a psuedo-join table that is a JSON object in memory,
that uses cached queries to return their location ($loki (lokiID)) from LokiCache.
i.e. {{JSONStringifiedQuery: $lokiID}}
  const IDCache = {
  query1: $loki1,
  query2: $loki2,
  query3: $loki3
 };
 */
let IDCache: IDLokiCacheType = {};

/**
 * Clears existing cache and ID cache and resets to a new cache.
 */
const clearCache = (): void => {
  lokidb.removeCollection('loki-client-cache');
  lokiCache = lokidb.addCollection('loki-client-cache', {
    disableMeta: true
  });
  IDCache = {};
  console.log('Client cache has been cleared.');
};

/**
 * Quellify replaces the need for front-end developers who are using GraphQL to communicate with their servers
 * to write fetch requests. Quell provides caching functionality that a normal fetch request would not provide.
 *  @param {string} endPoint - The endpoint to send the GraphQL query or mutation to, e.g. '/graphql'.
 *  @param {string} query - The GraphQL query or mutation to execute.
 *  @param {object} costOptions - Any changes to the default cost options for the query or mutation.
 *
 *  default costOptions = {
 *   maxCost: 5000, // maximum cost allowed before a request is rejected
 *   mutationCost: 5, // cost of a mutation
 *   objectCost: 2, // cost of retrieving an object
 *   scalarCost: 1, // cost of retrieving a scalar
 *   depthCostFactor: 1.5, // multiplicative cost of each depth level
 *   depthMax: 10, //depth limit parameter
 *   ipRate: 3 // requests allowed per second
 * }
 *
 */

async function Quellify(
  endPoint: string,
  query: string,
  costOptions: CostParamsType
) {
  /**
   * Fetch configuration for post requests that is passed to the performFetch function.
   */
  const postFetch: FetchObjType = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, costOptions })
  };

  /**
   * Fetch configuration for delete requests that is passed to the performFetch function.
   */
  const deleteFetch: FetchObjType = {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, costOptions })
  };

  /**
   * Makes requests to the GraphQL endpoint.
   * @param {FetchObjType} [fetchConfig] - (optional) Configuration options for the fetch call.
   * @returns {Promise} A Promise that resolves to the parsed JSON response.
   */
  const performFetch = async (
    fetchConfig?: FetchObjType
  ): Promise<JSONObject> => {
    try {
      const data = await fetch(endPoint, fetchConfig);
      const response = await data.json();
      return response.queryResponse;
    } catch (error) {
      const err: ClientErrorType = {
        log: `Error when trying to perform fetch to graphQL endpoint: ${error}.`,
        status: 400,
        message: {
          err: 'Error in performFetch. Check server log for more details.'
        }
      };
      console.log('Error when performing Fetch: ', err);
      throw error;
    }
  };

  // Create AST based on the input query using the parse method available in the GraphQL library
  // (further reading: https://en.wikipedia.org/wiki/Abstract_syntax_tree).
  const AST: DocumentNode = parse(query);

  // Find operationType, proto using determineType
  const { operationType, proto } = determineType(AST);

  if (operationType === 'unQuellable') {
    /*
     * If the operation is unQuellable (cannot be cached), fetch the data
     * from the GraphQL endpoint.
     */
    // All returns in an async function return promises by default;
    // therefore we are returning a promise that will resolve from perFormFetch.
    const parsedData: JSONValue = await performFetch(postFetch);
    // The second element in the return array is a boolean that the data was not found in the lokiCache.
    return [parsedData, false];
  } else if (operationType === 'mutation') {
    // TODO: If the operation is a mutation, we are currently clearing the cache because it is stale.
    // The goal would be to instead have a normalized cache and update the cache following a mutation.
    clearCache();

    // Assign mutationType
    const mutationType: string = Object.keys(proto)[0];

    // Determine whether the mutation is a add, delete, or update mutation.
    if (
      mutationType.includes('add') ||
      mutationType.includes('new') ||
      mutationType.includes('create') ||
      mutationType.includes('make')
    ) {
      // If the mutation is a create mutation, execute the mutation and return the result.
      // Assume create mutations will start with 'add', 'new', 'create', or 'make'.
      const parsedData: JSONValue = await performFetch(postFetch);
      // The second element in the return array is a boolean that the data was not found in the lokiCache.
      return [parsedData, false];
    } else if (
      mutationType.includes('delete') ||
      mutationType.includes('remove')
    ) {
      // If the mutation is a delete mutation, execute the mutation and return the result.
      // Assume delete mutations will start with 'delete' or 'remove'.
      const parsedData: JSONObject = await performFetch(deleteFetch);
      // The second element in the return array is a boolean that the data was not found in the lokiCache.
      return [parsedData, false];
    } else if (mutationType.includes('update')) {
      // If the mutation is an update mutation, execute the mutation and return the result.
      // Assume update mutations will start with 'update'.
      const parsedData: JSONValue = await performFetch(postFetch);
      // The second element in the return array is a boolean that the data was not found in the lokiCache.
      return [parsedData, false];
    }
  } else {
    // Otherwise, the operation is a query.
    // Check to see if this query has been made already by checking the IDCache for the query.
    if (IDCache[query]) {
      // If the query has a $loki ID in the IDCache, retrieve and return the results from the lokiCache.

      // Grab the $loki ID from the IDCache.
      const queryID: number = IDCache[query];

      // Grab the results from lokiCache for the $loki ID.
      const results: LokiGetType = lokiCache.get(queryID);

      // The second element in the return array is a boolean that the data was found in the lokiCache.
      return [results, true];
    } else {
      // If the query has not been made already, execute a fetch request with the query.
      const parsedData: JSONObject = await performFetch(postFetch);
      // Add the new data to the lokiCache.
      if (parsedData && parsedData.data) {
        const addedEntry = lokiCache.insert(parsedData.data);
        // Add query $loki ID to IDcache at query key
        IDCache[query] = addedEntry.$loki;
        // The second element in the return array is a boolean that the data was not found in the lokiCache.
        return [addedEntry, false];
      }
    }
  }
}

export { Quellify, clearCache as clearLokiCache };
