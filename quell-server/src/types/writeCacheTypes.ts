import type {ExecutionResult} from 'graphql'
import { RedisClientType } from "redis";

import type {
    ProtoObjType,
    QueryMapType,
    ResponseDataType,
    Type,
    IdCacheType,
  } from './types';

  
  /**
   * Configuration interface for write cache operations
   */
  export interface WriteCacheConfig {
    redisCache: RedisClientType;
    cacheExpiration: number;
    idCache: IdCacheType;
  }
  
  /**
   * Function type for writing to cache
   */
  export type WriteToCacheFunction = (
    key: string,
    item: Type | string[] | ExecutionResult
  ) => void;
  
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
   * Function type for updating ID cache
   */
  export type UpdateIdCacheFunction = (
    objKey: string,
    keyWithID: string,
    currName: string
  ) => void;
  
  /**
   * Extended configuration for normalize operations
   */
  export interface NormalizeConfig extends WriteCacheConfig {
    writeToCache: WriteToCacheFunction;
    updateIdCache: UpdateIdCacheFunction;
  }
  
  /**
   * Helper function signatures
   */
  export interface WriteCacheHelpers {
    processArrayData: (
      currField: ResponseDataType[],
      map: QueryMapType,
      currProto: ProtoObjType,
      resultName: string,
      currName: string,
      normalizeForCache: NormalizeForCacheFunction
    ) => Promise<void>;
    
    processObjectData: (
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
    ) => Promise<void>;
    
    updateCurrentName: (
      responseData: ResponseDataType,
      cacheID: string,
      currName: string
    ) => string;
  }