import type { ExecutionResult } from "graphql";
import type { Type } from "../types/types";
import type {
  WriteCacheConfig,
  WriteToCacheFunction,
  UpdateIdCacheFunction,
} from "../types/writeCacheTypes";

/**
 * Creates a writeToCache function with the provided configuration
 * @param config - Configuration object containing Redis cache and expiration settings
 * @returns Bound writeToCache function
 */

export function createWriteToCache(
  config: WriteCacheConfig
): WriteToCacheFunction {
  const { redisCache, cacheExpiration } = config;
  /**
   * Stringifies and writes an item to the cache unless the key indicates that the item is uncacheable.
   * Sets the expiration time for each item written to cache to the expiration time set on server connection.
   * @param {string} key - Unique id under which the cached data will be stored.
   * @param {Object} item - Item to be cached.
   */
  return function writeToCache(
    key: string,
    item: Type | string[] | ExecutionResult
  ): void {
    const lowerKey: string = key.toLowerCase();
    console.log("WRITING TO CACHE:", lowerKey, JSON.stringify(item));

    if (!key.includes("uncacheable")) {
      redisCache.set(lowerKey, JSON.stringify(item));
      redisCache.EXPIRE(lowerKey, cacheExpiration);
    }
  };
}

/**
 * Creates an updateIdCache function with the provided configuration
 * @param config - Configuration object containing ID cache
 * @returns Bound updateIdCache function
 */
export function createUpdateIdCache(
  config: WriteCacheConfig
): UpdateIdCacheFunction {
  const { idCache } = config;

  /**
   * Stores keys in a nested object under parent name.
   * If the key is a duplication, it is stored in an array.
   *  @param {string} objKey - Object key; key to be cached without ID string.
   *  @param {string} keyWithID - Key to be cached with ID string attached; Redis data is stored under this key.
   *  @param {string} currName - The parent object name.
   */

  return function updateIdCache(
    objKey: string,
    keyWithID: string,
    currName: string
  ): void {
    console.log(`=== UPDATE ID CACHE ===`);
    console.log(`objKey: ${objKey}`);
    console.log(`keyWithID: ${keyWithID}`);
    console.log(`currName: ${currName}`);
    console.log(`Current idCache state:`, JSON.stringify(idCache, null, 2));

    if (!idCache[currName]) {
      idCache[currName] = {};
    }

    // Check if this key already exists
    if (!idCache[currName][objKey]) {
      // First time seeing this key - store the string directly
      idCache[currName][objKey] = keyWithID;
      console.log(`Stored new key: ${objKey} = ${keyWithID}`);
    } else if (typeof idCache[currName][objKey] === "string") {
      // Key exists as string - only convert to array if it's actually different
      const existingValue = idCache[currName][objKey] as string;
      if (existingValue !== keyWithID) {
        idCache[currName][objKey] = [existingValue, keyWithID];
        console.log(
          `Converted to array: ${objKey} = [${existingValue}, ${keyWithID}]`
        );
      } else {
        console.log(
          `Key ${objKey} already exists with same value, skipping duplicate`
        );
      }
    } else if (Array.isArray(idCache[currName][objKey])) {
      // Key exists as array - only add if not already present
      const existingArray = idCache[currName][objKey] as string[];
      if (!existingArray.includes(keyWithID)) {
        existingArray.push(keyWithID);
        console.log(`Added to existing array: ${objKey} = [..., ${keyWithID}]`);
      } else {
        console.log(
          `Key ${objKey} already exists in array, skipping duplicate`
        );
      }
    }

    console.log(`Updated idCache state:`, JSON.stringify(idCache, null, 2));
  };
}
