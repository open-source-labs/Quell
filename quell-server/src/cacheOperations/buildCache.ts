
import type {ExecutionResult} from 'graphql'

import type {
    ProtoObjType,
    QueryMapType,
    ResponseDataType,
    ServerErrorType,
    ItemFromCacheType,
    DataResponse,
    MergedResponse,
  } from '../types/types';

  import type {
    WriteToCacheFunction,
    NormalizeForCacheFunction,
  } from '../types//writeCacheTypes';
  
  import type {
    BuildCacheConfig,
    BuildCacheFromResponseFunction,
    BuildCacheFromMergedResponseFunction,
    HandleQueryCachingFunction,
    CacheScenario,
    HandleQueryCachingConfig,
  } from '../types/buildCacheTypes';

  /**
 * Creates a function to build cache from GraphQL query response
 * This function takes the response from a GraphQL query and stores it in cache
 * @param config - Configuration object
 * @returns Bound buildCacheFromResponse function
 */

export function createBuildCacheFromResponse(
  config: BuildCacheConfig
): BuildCacheFromResponseFunction {
  const { queryMap, writeToCache, normalizeForCache } = config;
  /**
   * Builds cache entries from a GraphQL query response
   * @param queryResponse - The response from GraphQL query execution
   * @param prototype - The prototype object describing the query structure
   * @param operationType - The type of operation (query, mutation, etc.)
   */
  return async function buildCacheFromResponse(
    queryResponse: DataResponse | ExecutionResult,
    prototype: ProtoObjType,
    operationType: string
  ): Promise<void> {
    try {
      // Skip caching for mutations as they're handled separately
      if (operationType === 'mutation') {
        return;
      }

      // Extract data from the response
      const responseData = queryResponse.data;
      if (!responseData) {
        console.warn('No data in query response to cache');
        return;
      }

      // Normalize and cache the response data
      await normalizeForCache(
        responseData as ResponseDataType,
        queryMap,
        prototype,
        'root' // Default parent name for root queries
      );

      console.log('Successfully built cache from query response');
    } catch (error) {
      const err: ServerErrorType = {
        log: `Error building cache from response: ${error}`,
        status: 500,
        message: {
          err: 'Error building cache from response. Check server log for details.',
        },
      };
      console.error(err);
      throw error;
    }
  };
}

/**
 * Creates a function to build cache from merged response
 * This handles the case where responses are merged from cache and database
 * @param config - Configuration object
 * @returns Bound buildCacheFromMergedResponse function
 */
export function createBuildCacheFromMergedResponse(
    config: BuildCacheConfig
  ): BuildCacheFromMergedResponseFunction {
    const { queryMap, normalizeForCache } = config;
  
    /**
     * Builds cache entries from a merged response (cache + database)
     * @param mergedResponse - The merged response containing both cached and fresh data
     * @param prototype - The prototype object describing the query structure
     * @param queryMap - Map of queries to their types
     */
    return async function buildCacheFromMergedResponse(
      mergedResponse: MergedResponse,
      prototype: ProtoObjType,
      queryMap: QueryMapType
    ): Promise<void> {
      try {
        // Extract data from the merged response
        const responseData = mergedResponse.data;
        if (!responseData) {
          console.warn('No data in merged response to cache');
          return;
        }
  
        // Normalize and cache the merged response data
        await normalizeForCache(
          responseData as ResponseDataType,
          queryMap,
          prototype,
          'root' // Default parent name for root queries
        );
  
        console.log('Successfully built cache from merged response');
      } catch (error) {
        const err: ServerErrorType = {
          log: `Error building cache from merged response: ${error}`,
          status: 500,
          message: {
            err: 'Error building cache from merged response. Check server log for details.',
          },
        };
        console.error(err);
        throw error;
      }
    };
  }

  /**
 * Creates a function to handle caching logic in the query method
 * This is the main integration point for caching query responses
 * @param config - Configuration object
 * @returns Function that handles the caching logic
 */
export function createHandleQueryCaching(
    config: HandleQueryCachingConfig
  ): HandleQueryCachingFunction {
    const { buildCacheFromResponse, buildCacheFromMergedResponse, queryMap } = config;
  
    /**
     * Handles caching for different query scenarios
     * @param scenario - The caching scenario (full, partial, none)
     * @param response - The response to cache
     * @param prototype - The query prototype
     * @param operationType - The operation type
     */
    return async function handleQueryCaching(
      scenario: CacheScenario,
      response: DataResponse | MergedResponse,
      prototype: ProtoObjType,
      operationType: string
    ): Promise<void> {
      try {
        switch (scenario) {
          case 'full':
            // Full response from database, cache everything
            await buildCacheFromResponse(
              response as DataResponse,
              prototype,
              operationType
            );
            break;
            
          case 'partial':
            // Merged response from cache and database
            await buildCacheFromMergedResponse(
              response as MergedResponse,
              prototype,
              queryMap
            );
            break;
            
          case 'none':
            // Everything was in cache, no need to cache
            console.log('Response fully served from cache, no caching needed');
            break;
            
          default:
            console.warn(`Unknown caching scenario: ${scenario}`);
        }
      } catch (error) {
        console.error('Error in handleQueryCaching:', error);
        // Don't throw - caching errors shouldn't break the response
      }
    };
  }

/**
 * Helper function to determine if a response should be cached
 * @param operationType - The type of GraphQL operation
 * @param responseData - The response data
 * @returns Whether the response should be cached
 */
export function shouldCacheResponse(
    operationType: string,
    responseData: any
  ): boolean {
    // Don't cache mutations (handled separately)
    if (operationType === 'mutation') {
      return false;
    }
  
    // Don't cache if no data
    if (!responseData || !responseData.data) {
      return false;
    }
  
    // Don't cache error responses
    if (responseData.errors && responseData.errors.length > 0) {
      return false;
    }
  
    // Don't cache unquellable operations
    if (operationType === 'unQuellable') {
      return false;
    }
  
    // Don't cache operations without ID
    if (operationType === 'noID') {
      return false;
    }
  
    return true;
  }

/**
 * Helper function to extract cache keys from a prototype
 * @param prototype - The query prototype
 * @returns Array of cache keys that should be built
 */
export function extractCacheKeys(prototype: ProtoObjType): string[] {
    const cacheKeys: string[] = [];
  
    function traverse(obj: ProtoObjType, parentKey = ''): void {
      for (const key in obj) {
        if (key.startsWith('__')) continue; // Skip meta fields
  
        const value = obj[key];
        const fullKey = parentKey ? `${parentKey}.${key}` : key;
  
        if (typeof value === 'object' && value !== null) {
          // If it has __type and __id, it's a cacheable entity
          if (value.__type && value.__id) {
            const cacheKey = `${value.__type}--${value.__id}`;
            cacheKeys.push(cacheKey);
          }
          // Recursively traverse nested objects
          traverse(value as ProtoObjType, fullKey);
        }
      }
    }
  
    traverse(prototype);
    return cacheKeys;
  }