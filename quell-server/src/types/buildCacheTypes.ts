import type {ExecutionResult} from 'graphql'
import type {
    ProtoObjType,
    QueryMapType,
    ResponseDataType,
    DataResponse,
    MergedResponse,
  } from './types';
  import type {
    WriteToCacheFunction,
    NormalizeForCacheFunction,
  } from './writeCacheTypes';
  
  /**
   * Configuration interface for build cache operations
   */
  export interface BuildCacheConfig {
    queryMap: QueryMapType;
    cacheExpiration: number;
    writeToCache: WriteToCacheFunction;
    normalizeForCache: NormalizeForCacheFunction;
  }
  
  /**
   * Function type for building cache from query response
   */
  export type BuildCacheFromResponseFunction = (
    queryResponse: DataResponse | ExecutionResult,
    prototype: ProtoObjType,
    operationType: string
  ) => Promise<void>;
  
  /**
   * Function type for building cache from merged response
   */
  export type BuildCacheFromMergedResponseFunction = (
    mergedResponse: MergedResponse,
    prototype: ProtoObjType,
    queryMap: QueryMapType
  ) => Promise<void>;
  
  /**
   * Function type for handling query caching logic
   */
  export type HandleQueryCachingFunction = (
    scenario: CacheScenario,
    response: DataResponse | MergedResponse,
    prototype: ProtoObjType,
    operationType: string
  ) => Promise<void>;
  
  /**
   * Cache scenario types
   */
  export type CacheScenario = 'full' | 'partial' | 'none';
  
  /**
   * Extended configuration for handle query caching
   */
  export interface HandleQueryCachingConfig extends BuildCacheConfig {
    buildCacheFromResponse: BuildCacheFromResponseFunction;
    buildCacheFromMergedResponse: BuildCacheFromMergedResponseFunction;
  }
  
  /**
   * Result of cache key extraction
   */
  export interface CacheKeyInfo {
    key: string;
    type: string;
    id: string;
    depth: number;
  }
  
  /**
   * Options for cache building
   */
  export interface BuildCacheOptions {
    skipNormalization?: boolean;
    includeNullValues?: boolean;
    maxDepth?: number;
  }
  
  /**
   * Result of cache building operation
   */
  export interface BuildCacheResult {
    success: boolean;
    keysWritten: number;
    errors?: string[];
  }
  
  /**
   * Helper function signatures
   */
  export interface BuildCacheHelpers {
    shouldCacheResponse: (
      operationType: string,
      responseData: any
    ) => boolean;
    
    extractCacheKeys: (
      prototype: ProtoObjType
    ) => string[];
    
    validateCacheData: (
      data: any
    ) => boolean;
  }