import { RedisClientType } from 'redis';
import type {ExecutionResult} from 'graphql'
import type {
  ProtoObjType,
  QueryMapType,
  ResponseDataType,
  Type,
  IdCacheType,
} from '../types/types';
import type {
  WriteCacheConfig,
  WriteToCacheFunction,
  NormalizeForCacheFunction,
  UpdateIdCacheFunction,
  NormalizeConfig,
} from '../types/writeCacheTypes';

/**
 * Creates a writeToCache function with the provided configuration
 * @param config - Configuration object containing Redis cache and expiration settings
 * @returns Bound writeToCache function
 */

export function createWriteToCache(config: WriteCacheConfig): WriteToCacheFunction {
    const { redisCache, cacheExpiration } = config;
  /**
   * Stringifies and writes an item to the cache unless the key indicates that the item is uncacheable.
   * Sets the expiration time for each item written to cache to the expiration time set on server connection.
   * @param {string} key - Unique id under which the cached data will be stored.
   * @param {Object} item - Item to be cached.
   */
   return function writeToCache(key: string, item: Type | string[] | ExecutionResult): void {
    const lowerKey: string = key.toLowerCase();
    if (!key.includes("uncacheable")) {
      redisCache.set(lowerKey, JSON.stringify(item));
      redisCache.EXPIRE(lowerKey, cacheExpiration);
    }
  }
}

/**
 * Creates a normalizeForCache function with the provided configuration
 * MIGRATED FROM: QuellCache.normalizeForCache
 * @param config - Configuration object
 * @returns Bound normalizeForCache function
 */
export function createNormalizeForCache(
    config: WriteCacheConfig & {
      writeToCache: WriteToCacheFunction;
      updateIdCache: UpdateIdCacheFunction;
    }
  ): NormalizeForCacheFunction {
    const { writeToCache, updateIdCache } = config;
  
  /**
   * Traverses over response data and formats it appropriately so that it can be stored in the cache.
   * @param {Object} responseData - Data we received from an external source of data such as a database or API.
   * @param {Object} map - Map of queries to their desired data types, used to ensure accurate and consistent caching.
   * @param {Object} protoField - Slice of the prototype currently being used as a template and reference for the responseData to send information to the cache.
   * @param {string} currName - Parent object name, used to pass into updateIDCache.
   */
  async function normalizeForCache(
    responseData: ResponseDataType,
    map: QueryMapType = {},
    protoField: ProtoObjType,
    currName: string
  ) {
    for (const resultName in responseData) {
      const currField = responseData[resultName];
      const currProto: ProtoObjType = protoField[resultName] as ProtoObjType;
      if (Array.isArray(currField)) {
        for (let i = 0; i < currField.length; i++) {
          const el: ResponseDataType = currField[i];

          const dataType: string | undefined | string[] = map[resultName];

          if (typeof el === "object" && typeof dataType === "string") {
            await normalizeForCache(
              { [dataType]: el },
              map,
              {
                [dataType]: currProto,
              },
              currName
            );
          }
        }
      } else if (typeof currField === "object") {
        // Need to get non-Alias ID for cache

        // Temporary store for field properties
        const fieldStore: ResponseDataType = {};

        // Create a cacheID based on __type and __id from the prototype.
        let cacheID: string = Object.prototype.hasOwnProperty.call(
          map,
          currProto.__type as string
        )
          ? (map[currProto.__type as string] as string)
          : (currProto.__type as string);

        cacheID += currProto.__id ? `--${currProto.__id}` : "";

        // Iterate over keys in nested object
        for (const key in currField) {
          // If prototype has no ID, check field keys for ID (mostly for arrays)
          if (
            !currProto.__id &&
            (key === "id" || key === "_id" || key === "ID" || key === "Id")
          ) {
            // If currname is undefined, assign to responseData at cacheid to lower case at name
            if (responseData[cacheID.toLowerCase()]) {
              const responseDataAtCacheID = responseData[cacheID.toLowerCase()];
              if (
                typeof responseDataAtCacheID !== "string" &&
                !Array.isArray(responseDataAtCacheID)
              ) {
                if (typeof responseDataAtCacheID.name === "string") {
                  currName = responseDataAtCacheID.name;
                }
              }
            }
            // If the responseData at lower-cased cacheID at name is not undefined, store under name variable
            // and copy the logic of writing to cache to update the cache with same things, all stored under name.
            // Store objKey as cacheID without ID added
            const cacheIDForIDCache: string = cacheID;

            cacheID += `--${currField[key]}`;
            // call IdCache here idCache(cacheIDForIDCache, cacheID)

            updateIdCache(cacheIDForIDCache, cacheID, currName);
          }

          fieldStore[key] = currField[key];

          // If object, recurse normalizeForCache assign in that object
          if (typeof currField[key] === "object") {
            if (protoField[resultName] !== null) {
              const test = await normalizeForCache(
                { [key]: currField[key] },
                map,
                {
                  [key]: (protoField[resultName] as ProtoObjType)[key],
                },
                currName
              );
            }
          }
        }
        // Store "current object" on cache in JSON format
        writeToCache(cacheID, fieldStore);
      }
    }
  }
  return normalizeForCache;
}

/**
 * Creates an updateIdCache function with the provided configuration
 * @param config - Configuration object containing ID cache
 * @returns Bound updateIdCache function
 */
export function createUpdateIdCache(config: WriteCacheConfig): UpdateIdCacheFunction {
    const { idCache } = config;
  

  /**
   * Stores keys in a nested object under parent name.
   * If the key is a duplication, it is stored in an array.
   *  @param {string} objKey - Object key; key to be cached without ID string.
   *  @param {string} keyWithID - Key to be cached with ID string attached; Redis data is stored under this key.
   *  @param {string} currName - The parent object name.
   */

  return function updateIdCache(objKey: string, keyWithID: string, currName: string): void {
    if (!idCache[currName]) {
      idCache[currName] = {};
      idCache[currName][objKey] = keyWithID;
      return undefined; // Explicitly return undefined
    } else if (
      !Array.isArray(idCache[currName][objKey]) ||
      !idCache[currName][objKey]
    ) {
      idCache[currName][objKey] = [];
    } else {
      (idCache[currName][objKey] as string[]).push(keyWithID);
    }
  }
}

/**
 * Helper function to process array data during normalization
 */
async function processArrayData(
    currField: ResponseDataType[],
    map: QueryMapType,
    currProto: ProtoObjType,
    resultName: string,
    currName: string,
    normalizeForCache: NormalizeForCacheFunction
  ): Promise<void> {
    for (let i = 0; i < currField.length; i++) {
      const el: ResponseDataType = currField[i];
      const dataType: string | undefined | string[] = map[resultName];
  
      if (typeof el === 'object' && typeof dataType === 'string') {
        await normalizeForCache(
          { [dataType]: el },
          map,
          {
            [dataType]: currProto,
          },
          currName
        );
      }
    }
  }
  
  /**
   * Helper function to process object data during normalization
   */
  async function processObjectData(
    currField: ResponseDataType,
    currProto: ProtoObjType,
    map: QueryMapType,
    currName: string,
    resultName: string,
    protoField: ProtoObjType,
    writeToCache: WriteToCacheFunction,
    updateIdCache: UpdateIdCacheFunction,
    normalizeForCache: NormalizeForCacheFunction,
    responseData: ResponseDataType
  ): Promise<void> {
    const fieldStore: ResponseDataType = {};
  
    // Create a cacheID based on __type and __id from the prototype
    let cacheID: string = Object.prototype.hasOwnProperty.call(
      map,
      currProto.__type as string
    )
      ? (map[currProto.__type as string] as string)
      : (currProto.__type as string);
  
    cacheID += currProto.__id ? `--${currProto.__id}` : '';
  
    // Process each key in the object
    for (const key in currField) {
      // Check for ID fields and update cache accordingly
      if (
        !currProto.__id &&
        (key === 'id' || key === '_id' || key === 'ID' || key === 'Id')
      ) {
        const updatedCurrName = updateCurrentName(
          responseData,
          cacheID,
          currName
        );
        
        const cacheIDForIDCache: string = cacheID;
        cacheID += `--${currField[key]}`;
        
        updateIdCache(cacheIDForIDCache, cacheID, updatedCurrName);
      }
  
      fieldStore[key] = currField[key];
  
      // Recursively process nested objects
      if (typeof currField[key] === 'object' && protoField[resultName] !== null) {
        await normalizeForCache(
          { [key]: currField[key] },
          map,
          {
            [key]: (protoField[resultName] as ProtoObjType)[key],
          },
          currName
        );
      }
    }
    
    // Store the object in cache
    writeToCache(cacheID, fieldStore);
  }
  
  /**
   * Helper function to update the current name based on response data
   */
  function updateCurrentName(
    responseData: ResponseDataType,
    cacheID: string,
    currName: string
  ): string {
    if (responseData[cacheID.toLowerCase()]) {
      const responseDataAtCacheID = responseData[cacheID.toLowerCase()];
      if (
        typeof responseDataAtCacheID !== 'string' &&
        !Array.isArray(responseDataAtCacheID)
      ) {
        if (typeof responseDataAtCacheID.name === 'string') {
          return responseDataAtCacheID.name;
        }
      }
    }
    return currName;
  }