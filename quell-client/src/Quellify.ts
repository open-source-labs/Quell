import { DocumentNode } from 'graphql';
import { parse } from 'graphql/language/parser';
import determineType from './helpers/determineType';
import { LRUCache } from 'lru-cache';

import {
  CostParamsType,
  MapCacheType,
  FetchObjType,
  JSONObject,
  JSONValue,
  ClientErrorType,
  QueryResponse
} from './types';

// Custom Error class for client errors
class ClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientError';
  }
}

/**
 * Factory function to create custom client error objects
 * @param message - Error message string
 * @returns - a custom error object
 */
function createClientError(message: string): ClientErrorType {
  return {
    log: message,
    status: 400,
    message: { err: 'Error in performFetch. Check server log for more details.' }
  };
}

// Cache configurations
const MAX_CACHE_SIZE = 2;
const mapCache: Map<string, MapCacheType> = new Map();
const lruCache = new LRUCache<string, MapCacheType>({ max: MAX_CACHE_SIZE });

///////////////////////////////////////////////////////

// Define an interface for the mutation type handlers
interface MutationTypeHandlers {
  delete: string[];
  update: string[];
  create: string[];
} 

// Identifiers for different types of mutations and their name variations
const mutationTypeHandlers: MutationTypeHandlers = {
  delete: ['delete', 'remove'],
  update: ['update', 'edit'],
  create: ['create', 'add', 'new', 'make']
};

/**
 * Normalize the results object by recursively normalizing each value.
 * @param results - the results object to be normalized.
 * @returns - the normalized results object.
 */
const normalizeResults = (results: JSONObject): JSONObject => {
  const normalizedResults: JSONObject = {};
  // Iterate over the entries of the results object
  const entries = Object.entries(results);
  for (const [key, value] of entries) {
    // Normalize the value
    const normalizedValue = normalizeValue(value);
    // Assign the normalized value to the corresponding key in the normalized results object
    normalizedResults[key] = normalizedValue;
  }
  return normalizedResults;
};

/**
 * Normalize a JSON value by checking its type and applying the corresponding normalization logic.
 * @param value - the JSON value to be normalized.
 * @returns - the normalized JSON value.
 */
const normalizeValue = (value: JSONValue): JSONValue => {
  // If the value is null, return null
  if (value === null) return null;
  // If the value is an array, recursively normalize each element
  else if (Array.isArray(value)) return normalizeArray(value);
  // If the value is an object, recursively normalize each property
  else if (typeof value === 'object' && value !== null) return normalizeObject(value);
  // If the value is neither an array nor an object, return the value as is
  else return value;
};

/**
 * Normalize a JSON object by recursively normalizing each value.
 * @param obj - the JSON object to be normalized.
 * @returns - the normalized JSON object.
 */
const normalizeObject = (obj: JSONObject): JSONObject => {
  const normalizedObj: JSONObject = {};
  // Iterate over the entries of the object
  const entries = Object.entries(obj);
  // Normalize the value
  for (const [key, value] of entries) {
    const normalizedValue = normalizeValue(value);
    // Assign the normalized value to the corresponding key in the normalized object
    normalizedObj[key] = normalizedValue;
  }
  return normalizedObj;
};

/**
 * Normalize a JSON array by recursively normalizing each element.
 * @param arr - the JSON array to be normalized.
 * @returns - the normalized JSON array.
 */
const normalizeArray = (arr: JSONValue[]): JSONValue[] => {
  return arr.map((value) => {
    // Normalize each element in the array
    return normalizeValue(value);
  });
};

///////////////////////////////////////////////////////

/**
 * Update LRU and Map caches with new results after normalizing them.
 * @param query - the query associated with the results.
 * @param results - the results object to be cached.
 * @param fieldNames - the field names associated with the query.
 */
const updateCaches = (query: string, results: JSONObject, fieldNames: string[]): void => {
  const normalizedResults = normalizeResults(results);
  const cacheEntry = { data: normalizedResults, fieldNames };
  const invalidResponse = fieldNames.length > 0 && normalizedResults[fieldNames[0]] === null;
  
  // Update the LRU cache
  if (!invalidResponse) {
    lruCache.set(query, cacheEntry);
  
  // Check if the query already exists in the map cache
  const mapCacheEntry = mapCache.get(query);
  if (mapCacheEntry) {
    // Update the existing map cache entry
    mapCacheEntry.data = normalizedResults;
    mapCacheEntry.fieldNames = fieldNames;
  } else {
    // Add a new entry to the map cache
    mapCache.set(query, cacheEntry);
  }
  }
};

// Function to clear both the LRU and Map caches
const clearCache = (): void => {
  mapCache.clear();
  lruCache.clear();
};

/**
 * Perform an HTTP fetch to a specified endpoint.
 * @param endPoint - The URL endpoint to fetch data from.
 * @param fetchConfig - Configuration options for the fetch request.
 * @returns A promise that resolves with the fetched data.
 */
const performFetch = async (endPoint: string, fetchConfig?: FetchObjType): Promise<JSONObject> => {
  try {
    // Sending a request to the GraphQL endpoint with the given configurations
    const response = await fetch(endPoint, fetchConfig);
    // Parsing the response as JSON and destructure queryResponse from the response
    const { queryResponse }: QueryResponse = await response.json();
    return queryResponse.data;
  } catch (error) {
    throw createClientError(`Error when trying to perform fetch to graphQL endpoint: ${error}.`);
  }
};

/**
 * Main function that executes GraphQL queries, maintaining a cache for optimization.
 * @param endPoint - the URL endpoint of the GraphQL server.
 * @param query - the GraphQL query string to be executed.
 * @param costOptions - cost parameters to optimize query execution.
 * @param variables - optional variables for the GraphQL query.
 * @returns - a promise that resolves with the response data and a boolean indicating if the data was from the cache.
 * @throws {ClientError} - when an error occurs during the execution process.
 */
const Quellify = async (
  endPoint: string,
  query: string,
  costOptions: CostParamsType,
  mutationMap: Record<string, string[]> = {},
  variables?: Record<string, any>,
): Promise<[JSONValue, boolean]> => {

  // Configuration object for the fetch requests
  const fetchConfig: FetchObjType = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, costOptions })
  };

  try {
    // Parsing the query into an AST (Abstract Syntax Tree)
    const AST: DocumentNode = parse(query);

    // Determine the operation type (query, mutation, etc.) of the GraphQL query
    const { operationType, proto, fieldNames } = determineType(AST);

    // Handle query operation type
    if (operationType === 'query') {  
      // Check if results are in LRU, returns results if available
      const lruCachedResults = lruCache.get(query);
      if (lruCachedResults) {
        return [lruCachedResults.data, true];
      }
      // If not in LRU cache, checks if results are in Map Cache, adds to LRU Cache and returns results
      const mapCachedResults = mapCache.get(query);
      if (mapCachedResults) {
        lruCache.set(query, mapCachedResults as MapCacheType);
        return [mapCachedResults.data, true];
      } 
      // If not in either cache, perform fetch, update cache, and return results
      else {
        const data = await performFetch(endPoint, fetchConfig);
        updateCaches(query, data, fieldNames);
        return [data, false];
      }
    }
    
    // Handle mutation operation type
    if (operationType === 'mutation') {
      // Extract the name of the mutation (e.g. "addCity") from the 'proto' object by getting the first key
      const mutationType: string = Object.keys(proto)[0];

      // Determine the type of mutation (e.g. "add") by finding a match in mutationTypeHandlers
      const mutationAction = Object.keys(mutationTypeHandlers).find((action) =>
        mutationTypeHandlers[action as keyof MutationTypeHandlers].some((type: string) => mutationType.includes(type))
      ) as keyof MutationTypeHandlers;

      // Check if mutation type is valid (defined in MutationTypeHandlers), perform the mutation and update cache accordingly
      if (mutationAction) {
        const fetchResult: JSONObject = await performFetch(endPoint, fetchConfig);
        

        // Get the list of fields that could be affected by this mutation from the mutationMap
        const affectedFields = mutationMap[mutationType];
        
        // Loop through mapCache to check if the mutation affects any cached queries
        for (const [cachedQuery, cachedInfo] of mapCache.entries()) {
          // Get the field names that are present in the current cached query
          const cachedFieldNames: string[] = cachedInfo.fieldNames;
          
          // Determine if any of the fields affected by the mutation are present in the cached query
          const shouldRefetch = cachedFieldNames.some(fieldName => affectedFields.includes(fieldName));
      
          // If affected fields, refetch the data and update the cache
          if (shouldRefetch) {
            const refetchConfig = {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: cachedQuery, costOptions })
            };
            try {
              const refetchedData = await performFetch(endPoint, refetchConfig);
              // Update the cache with the refetched data
              updateCaches(cachedQuery, refetchedData, cachedFieldNames);
            } catch (error) {
              console.error('Error refetching data:', error);
            }
          }
        }

        // Return the result of the mutation and a boolean indicating that the data was not from the cache
        return [fetchResult, false];
      }
      // Throw error if mutation type is not supported
      throw createClientError('The operation type is not supported.');
    }

    // Handle cases where the query is not optimizable (unQuellable) and directly fetch data
    else if (operationType === 'unQuellable') {
      const data = await performFetch(endPoint, fetchConfig);
      return [data, false];
    }
    // Throw error if operation type is not supported
    else throw createClientError('The operation type is not supported.');
  } catch (error) {
    throw error instanceof ClientError ? error : createClientError(`Error occurred during Quellify process: ${error}.`);
  }
};

// Export the Quellify function and the clearCache function
export { Quellify, clearCache, lruCache, updateCaches };