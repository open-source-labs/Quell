import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
import type { IdCacheType } from './types';

/**
 * Configuration interface for invalidate cache operations
 */
export interface InvalidateCacheConfig {
  redisCache: RedisClientType;
  idCache: IdCacheType;
}

/**
 * Function type for clearing cache middleware
 */
export type ClearCacheFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

/**
 * Function type for deleting cache by ID
 */
export type DeleteCacheByIdFunction = (key: string) => Promise<void>;

/**
 * Function type for clearing all caches
 */
export type ClearAllCachesFunction = () => Promise<void>;

/**
 * Function type for clearing cache by pattern
 */
export type ClearCacheByPatternFunction = (pattern: string) => Promise<void>;

/**
 * Function type for getting cache statistics
 */
export type GetCacheStatsFunction = () => Promise<CacheStats>;

/**
 * Interface for cache statistics
 */
export interface CacheStats {
  redisKeysCount: number;
  idCacheKeysCount: number;
  idCacheEntriesCount: number;
  memoryUsedBytes: number;
  memoryUsedMB: number;
}

/**
 * Configuration for operations that only need Redis
 */
export type RedisOnlyConfig = Pick<InvalidateCacheConfig, 'redisCache'>;

/**
 * Result of cache clearing operations
 */
export interface ClearCacheResult {
  success: boolean;
  keysCleared?: number;
  error?: string;
}

/**
 * Options for selective cache clearing
 */
export interface ClearCacheOptions {
  pattern?: string;
  type?: 'redis' | 'id' | 'all';
  preservePatterns?: string[];
}