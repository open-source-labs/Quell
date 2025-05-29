import { RedisClientType } from 'redis';

import type {
  ProtoObjType,
  QueryMapType,
  ResponseDataType,
  Type,
  FieldsObjectType,
  ServerErrorType,
} from '../types/types';

import type {
  WriteToCacheFunction,
  UpdateIdCacheFunction,
} from '../types/writeCacheTypes';

/**
 * Configuration interface for normalize cache operations
 */
export interface NormalizeCacheConfig {
    writeToCache: WriteToCacheFunction;
    updateIdCache: UpdateIdCacheFunction;
  }
  
  /**
   * Function type for normalizing data for cache
   */
  export type NormalizeForCacheFunction = (
    responseData: ResponseDataType,
    map: QueryMapType,
    protoField: ProtoObjType,
    currName: string
  ) => Promise<void>;

/**
 * Creates a normalizeForCache function with the provided configuration
 * This is the main normalization logic that processes GraphQL responses
 * and prepares them for caching
 * @param config - Configuration object
 * @returns Bound normalizeForCache function
 */
export function createNormalizeForCache(
    config: NormalizeCacheConfig
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
        await processArrayData(currField, map, currProto, resultName, currName)      
      } else if (typeof currField === "object") {
        await processObjectData(
            currField,
            currProto,
            map,
            currName,
            resultName,
            protoField,
            responseData
          );
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
    responseData: ResponseDataType
  ): Promise<void> {
          // Need to get non-Alias ID for cache

        // Temporary store for field properties

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

  return normalizeForCache;
}