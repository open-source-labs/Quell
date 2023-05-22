import { DocumentNode } from 'graphql';
import { Collection } from 'lokijs';
import { parse } from 'graphql/language/parser';
import determineType from './helpers/determineType';
import { LRUCache } from 'lru-cache';
import Loki from 'lokijs';
import {
  CostParamsType,
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

/**
 * Function to manually removes item from cache
 */
const invalidateCache = (query: string): void => {
  const cachedEntry = lokiCache.findOne({ query });
  if (cachedEntry) {
    lruCache.delete(query);
    lokiCache.remove(cachedEntry);
  }
}

/**
 * Implement LRU caching strategy
 */

// Set the maximum cache size on LRU cache
const MAX_CACHE_SIZE: number = 2;
const lruCache = new LRUCache<string, LokiGetType>({
  max: MAX_CACHE_SIZE,
});

// Track the order of accessed queries
const lruCacheOrder: string[] = []; 

// Function to update LRU Cache on each query
const updateLRUCache = (query: string, results: JSONObject): void => {
  const cacheSize = lruCacheOrder.length;
  if (cacheSize >= MAX_CACHE_SIZE) {
    const leastRecentlyUsedQuery = lruCacheOrder.shift();
    if (leastRecentlyUsedQuery) {
      invalidateCache(leastRecentlyUsedQuery);
    }
  }
  lruCacheOrder.push(query);
  lruCache.set(query, results as LokiGetType);
};
/**
 * Clears entire existing cache and ID cache and resets to a new cache.
 */
const clearCache = (): void => {
  lokidb.removeCollection('loki-client-cache');
  lokiCache = lokidb.addCollection('loki-client-cache', {
    disableMeta: true
  });
  lruCache.clear();
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

 * }
 *
 */
async function Quellify(
  endPoint: string,
  query: string,
  costOptions: CostParamsType,
  variables?: Record<string, any>
) {

  // Check the LRU cache before performing fetch request
  const cachedResults = lruCache.get(query);
  if (cachedResults) {
    return [cachedResults, true];
  }
  
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
      updateLRUCache(query, response.queryResponse.data);
      return response.queryResponse.data;
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
  // Refetch LRU cache
  const refetchLRUCache = async (): Promise<void> => {
    try {
      const cacheSize = lruCacheOrder.length;
      // i < cacheSize - 1 because the last query in the order array is the current query
      for (let i = 0; i < cacheSize - 1; i++) {
        const query = lruCacheOrder[i];
        // Get operation type for query
        const oldAST: DocumentNode = parse(query);
        const { operationType } = determineType(oldAST);
        // If the operation type is not a query, leave it out of the refetch
        if (operationType !== 'query') {
          continue;
        }
        // If the operation type is a query, refetch the query from the LRU cache
        const cachedResults = lruCache.get(query);
        if (cachedResults) {
          // Fetch configuration for post requests that is passed to the performFetch function.
          const fetchConfig: FetchObjType = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, costOptions })
          };
          const data = await fetch(endPoint, fetchConfig);
          const response = await data.json();
          updateLRUCache(query, response.queryResponse.data);
        }
      }
    } catch (error) {
      const err: ClientErrorType = {
        log: `Error when trying to refetch LRU cache: ${error}.`,
        status: 400,
        message: {
          err: 'Error in refetchLRUCache. Check server log for more details.'
        }
      };
      console.log('Error when refetching LRU cache: ', err);
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
    // Assign mutationType
    const mutationType: string = Object.keys(proto)[0];

       // Check if mutation is an add mutation
       if (
        mutationType.includes('add') ||
        mutationType.includes('new') ||
        mutationType.includes('create') ||
        mutationType.includes('make')
      ) {
        // Execute a fetch request with the query
        const parsedData: JSONObject = await performFetch(postFetch);
        if (parsedData) {
          const addedEntry = lokiCache.insert(parsedData);
          // Refetch each query in the LRU cache to update the cache
          refetchLRUCache();
          return [addedEntry, false];
        }
      }

      // Check if mutation is an edit mutation
      else if(
        mutationType.includes('edit') || 
        mutationType.includes('update')
        ){
        // Execute a fetch request with the query
        const parsedData: JSONObject = await performFetch(postFetch);
        if (parsedData) {
          // Find the existing entry by its ID
          const cachedEntry = lokiCache.findOne({ id: parsedData.id }); 
          if (cachedEntry) {
            // Update the existing entry with the new data
            Object.assign(cachedEntry, parsedData); 
             // Update the entry in the Loki cache
            lokiCache.update(cachedEntry);
            // Update LRU Cache
            updateLRUCache(query, cachedEntry);
            refetchLRUCache();
            return [cachedEntry, false];
        }
      }
    }
    // Check if mutation is a delete mutation
      else if (
        mutationType.includes('delete') ||
        mutationType.includes('remove')
      )  {
        // Execute a fetch request with the query
        const parsedData: JSONObject = await performFetch(deleteFetch);
        if (parsedData) {
          // Find the existing entry by its ID
          const cachedEntry = lokiCache.findOne({ id: parsedData.id });
          if (cachedEntry) {
          // Remove the item from cache
          lokiCache.remove(cachedEntry);
          invalidateCache(query);
          // Refetch each query in the LRU cache to update the cache
          refetchLRUCache();
          return [cachedEntry, false];
        } else {
          return [null, false];
        }
      }
    }
    // Operation type does not meet mutation or unquellable types. 
    // In other words, it is a Query
  } else {
        // If the query has not been made already, execute a fetch request with the query.
        const parsedData: JSONObject = await performFetch(postFetch);
        // Add the new data to the lokiCache.
        if (parsedData) {
          const addedEntry = lokiCache.insert(parsedData);
          // Add query and results to lruCache
          lruCache.set(query, addedEntry);
          // The second element in the return array is a boolean that the data was not found in the lokiCache.
          return [addedEntry, false];
      }
    }
  }

export { Quellify, clearCache as clearLokiCache, lruCache };