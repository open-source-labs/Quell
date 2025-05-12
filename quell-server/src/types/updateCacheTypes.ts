import { RedisClientType } from 'redis';
import { ExecutionResult } from 'graphql';
import type {
    ProtoObjType,
    QueryMapType,
    MutationMapType,
    QueryFields,
    DatabaseResponseDataRaw,
    Type,
    ResponseDataType,
    FieldKeyValue,
  } from './types';
  import type { WriteToCacheFunction } from './writeCacheTypes';
  
  /**
   * Configuration interface for update cache operations
   */
  export interface UpdateCacheConfig {
    redisCache: RedisClientType;
    queryMap: QueryMapType;
    writeToCache: WriteToCacheFunction;
    deleteCacheById: (key: string) => Promise<void>;
  }
  
  /**
   * Function type for updating cache by mutation
   */
  export type UpdateCacheByMutationFunction = (
    dbRespDataRaw: DatabaseResponseDataRaw | ExecutionResult,
    mutationName: string,
    mutationType: string,
    mutationQueryObject: QueryFields | ProtoObjType
  ) => Promise<void>;
  
  /**
   * Helper function type for removing keys from field list
   */
  export type RemoveFromFieldKeysListFunction = (
    fieldKeysToRemove: Set<string> | Array<string>,
    fieldsListKey: string
  ) => Promise<void>;
  
  /**
   * Helper function type for deleting appropriate field keys
   */
  export type DeleteApprFieldKeysFunction = (
    fieldsListKey: string,
    mutationQueryObject: ProtoObjType
  ) => Promise<void>;
  
  /**
   * Helper function type for updating appropriate field keys
   */
  export type UpdateApprFieldKeysFunction = (
    fieldsListKey: string,
    mutationQueryObject: ProtoObjType
  ) => Promise<void>;
  
  /**
   * Result of extracting data from database response
   */
  export interface ExtractedResponseData {
    dbRespId: string;
    dbRespData: Type;
  }
  
  /**
   * Helper function signatures for update operations
   */
  export interface UpdateCacheHelpers {
    isDeleteMutation: (mutationName: string) => boolean;
    extractDataFromResponse: (
      dbRespDataRaw: DatabaseResponseDataRaw | ExecutionResult,
      mutationName: string
    ) => ExtractedResponseData;
    findFieldsListKey: (
      queryMap: QueryMapType,
      mutationType: string
    ) => string;
  }
  
  /**
   * Configuration for field key update operations
   */
  export interface FieldKeyUpdateConfig {
    redisCache: RedisClientType;
    writeToCache: WriteToCacheFunction;
    deleteCacheById: (key: string) => Promise<void>;
  }
  
  /**
   * Result of field comparison for update/delete decisions
   */
  export interface FieldComparisonResult {
    shouldRemove: boolean;
    fieldsToUpdateBy: string[];
    updatedFieldKeyValue: ResponseDataType;
  }