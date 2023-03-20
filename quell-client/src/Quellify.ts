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
  JSONValue
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
 * clearCache clears existing cache and ID cache and resets to a new cache
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
 *  @param {string} endPoint - The address to where requests are sent and processed. E.g. '/graphql'.
 *  @param {string} query - The graphQL query that is requested from the client
 *  @param {object} costOptions - Any optional changes to the default Quell variables
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
  // const performFetch = async (): Promise<JSONValue> => {
  //   const fetchOptions: FetchObjType = {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json'
  //     },
  //     body: JSON.stringify({ query, costOptions })
  //   };
  //   const serverResponse: Response = await fetch(endPoint, fetchOptions);
  //   const parsedData: JSONObject = await serverResponse.json();
  //   const result: JSONValue = parsedData.queryResponse;
  //   return result;
  // };

  const postFetch: FetchObjType = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, costOptions })
  };
  const deleteFetch: FetchObjType = {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, costOptions })
  };

  const performFetch = async <T>(fetchConfig?: FetchObjType): Promise<T> => {
    return fetch(endPoint, fetchConfig).then<T>((response) => {
      return response.json();
    });
  };

  // Create AST based on the input query using the parse method available in the graphQL library (further reading: https://en.wikipedia.org/wiki/Abstract_syntax_tree)
  const AST: DocumentNode = parse(query);

  // find operationType, proto using determineType
  const { operationType, proto } = determineType(AST);

  // pass-through for queries and operations that QuellCache cannot handle
  if (operationType === 'unQuellable') {
    // All returns in an async function return promises by default, therefore we are returning a promise that will resolve from perFormFetch
    const parsedData: JSONValue = await performFetch(postFetch);
    return parsedData;
  } else if (operationType === 'mutation') {
    // assign mutationType
    const mutationType: string = Object.keys(proto)[0];
    // check for key words in the type
    if (
      // add mutation
      mutationType.includes('add') ||
      mutationType.includes('new') ||
      mutationType.includes('create') ||
      mutationType.includes('make')
    ) {
      // execute initial query
      const parsedData: JSONValue = await performFetch(postFetch);
      // clear cache so the next query will include mutation
      clearCache();
      // return data
      return parsedData;
    } else if (
      // if query is update or delete mutation
      mutationType.includes('delete') ||
      mutationType.includes('remove')
    ) {
      // assign delete request method
      // const fetchOptions: FetchObjType = {
      //   method: 'DELETE',
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({ query, costOptions })
      // };
      // execute initial query
      // const serverResponse: Response = await fetch(endPoint, fetchOptions);
      // const parsedData: JSONObject = await serverResponse.json();
      // const result: JSONValue = parsedData.queryResponse;
      // clear caches
      const parsedData: JSONObject = await performFetch(deleteFetch);
      const result: JSONValue = parsedData.queryResponse;
      clearCache();
      // return data
      return result;
    } else if (
      // if query is update mutation
      mutationType.includes('update')
    ) {
      // execute initial query
      const parsedData: JSONValue = await performFetch();
      // clear caches
      clearCache();
      // return data
      return parsedData;
    }
  } else {
    // if the request is a query
    // check IDCache with query, if query returns the $loki ID, find the results for searching the LokiDBCache
    // lokiCache to see if this call has a $loki associated with it. if so, retrieve and return it
    if (IDCache[query]) {
      // grab the $loki ID from the IDCache

      const queryID: number = IDCache[query];

      // grab results from lokiCache by $loki ID
      const results: LokiGetType = lokiCache.get(queryID);

      // second element is boolean for whether data can be found in lokiCache
      return results;
    } else {
      // if this query has not been made already, execute fetch request with query
      const parsedData: JSONObject = await performFetch(postFetch);
      // add new data to lokiCache
      if (parsedData && parsedData.data) {
        const addedEntry = lokiCache.insert(parsedData.data);
        // add query $loki ID to IDcache at query key
        IDCache[query] = addedEntry.$loki;
        // return data
        return addedEntry;
      }
    }
  }
}

module.exports = { Quellify, clearLokiCache: clearCache };
