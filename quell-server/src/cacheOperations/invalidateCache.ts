import { Request, Response, NextFunction } from "express";
import { RedisClientType } from "redis";
import type { ServerErrorType, IdCacheType } from "../types/types";
import type {
  InvalidateCacheConfig,
  ClearCacheFunction,
  DeleteCacheByIdFunction,
  ClearAllCachesFunction,
  ClearCacheByPatternFunction,
  GetCacheStatsFunction,
  CacheStats,
  RedisOnlyConfig,
} from '../types/invalidateCacheTypes';

/**
 * Creates a clearCache middleware function that flushes the Redis cache
 * @param {InvalidateCacheConfig} config - Configuration containing the Redis client
 * @returns {Function} Express middleware function
 */
export function createClearCache(config: InvalidateCacheConfig): ClearCacheFunction {
  const { redisCache, idCache } = config;
  
  /**
   * Flushes the Redis cache. To clear the cache from the client, establish an endpoint that
   * passes the request and response objects to an instance of QuellCache.clearCache.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express next middleware function.
   */
  return function clearCache(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    console.log("Clearing Redis Cache");
    
    // Clear Redis cache
    redisCache.flushAll();
    
    // Clear ID cache - reset it to empty object
    Object.keys(idCache).forEach(key => delete idCache[key]);
    
    return next();
  };
}


/**
 * Creates a function to remove a specific key-value from the cache
 * @param {InvalidateCacheConfig} config - Configuration containing the Redis client
 * @returns {Function} Function that deletes cache by ID
 */
export function createDeleteCacheById(
  config: Pick<InvalidateCacheConfig, 'redisCache'>
): DeleteCacheByIdFunction {
  const { redisCache } = config;
  
  /**
   * Removes a specific key-value pair from the Redis cache
   * @param {string} key - The cache key to delete
   */
  return async function deleteCacheById(key: string): Promise<void> {
    try {
      await redisCache.del(key);
    } catch (error) {
      const err: ServerErrorType = {
        log: `Error inside deleteCacheById function, ${error}`,
        status: 400,
        message: {
          err: "Error in redis - deleteCacheById, Check server log for more details.",
        },
      };
      console.log(err);
    }
  };
}

/**
 * Creates a function to clear the entire cache and reset the idCache
 * This is a utility function that combines both Redis and ID cache clearing
 * @param {InvalidateCacheConfig} config - Configuration containing the Redis client and ID cache
 * @returns {Function} Function that clears all caches
 */

export function createClearAllCaches(
  config: InvalidateCacheConfig
): ClearAllCachesFunction {
  const { redisCache, idCache } = config;
  
  /**
   * Clears both Redis cache and ID cache
   */
  return async function clearAllCaches(): Promise<void> {
    console.log("Clearing all caches");
    
    try {
      // Clear Redis cache
      await redisCache.flushAll();
      
      // Clear ID cache - reset it to empty object
      Object.keys(idCache).forEach(key => delete idCache[key]);
      
      console.log("All caches cleared successfully");
    } catch (error) {
      const err: ServerErrorType = {
        log: `Error inside clearAllCaches function, ${error}`,
        status: 400,
        message: {
          err: "Error clearing caches, Check server log for more details.",
        },
      };
      console.log(err);
      throw error; // Re-throw to let caller handle
    }
  };
}

/**
 * FIX ME:
 * Flushes the Redis cache. To clear the cache from the client, establish an endpoint that
 * passes the request and response objects to an instance of QuellCache.clearCache.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
//   clearCache(req: Request, res: Response, next: NextFunction) {
//     console.log("Clearing Redis Cache");
//     this.redisCache.flushAll();
//     idCache = {};
//     return next();
//   }
