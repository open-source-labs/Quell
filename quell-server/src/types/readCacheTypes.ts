import type {
    ProtoObjType,
    ItemFromCacheType,
  } from './types';
  
  /**
   * Function signature for buildFromCache
   */
  export type BuildFromCacheFunction = (
    prototype: ProtoObjType,
    prototypeKeys: string[],
    itemFromCache?: ItemFromCacheType,
    firstRun?: boolean,
    subID?: boolean | string
  ) => Promise<{ data: ItemFromCacheType }>;
  
  /**
   * Function signature for generateCacheID
   */
  export type GenerateCacheIDFunction = (queryProto: ProtoObjType) => string;
  
  /**
   * Cache response structure
   */
  export interface CacheResponse {
    data: ItemFromCacheType;
    cached?: boolean;
  }
  
  /**
   * Redis command callback function type
   */
  export type RedisCommandCallback = (cacheResponse: string) => void;
  
  /**
   * Helper function signatures
   */
  export interface ReadCacheHelpers {
    getCacheIDWithFallback: (
      prototype: ProtoObjType,
      subID?: boolean | string
    ) => string;
    
    processArrayCache: (
      array: string[],
      prototype: ProtoObjType,
      typeKey: string,
      prototypeKeys: string[],
      itemFromCache: ItemFromCacheType
    ) => Promise<void>;
    
    processNestedCache: (
      prototype: ProtoObjType,
      typeKey: string,
      itemFromCache: ItemFromCacheType,
      prototypeKeys: string[],
      firstRun: boolean
    ) => Promise<void>;
  }
  
  /**
   * Redis multi queue type (simplified for our use case)
   */
  export interface RedisMultiQueue {
    get(key: string): void;
    exec(): Promise<Array<unknown>>;
  }