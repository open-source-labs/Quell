import { RedisClientType } from "redis";
import { getFromRedis } from "../helpers/redisHelpers";
import type {
  ProtoObjType,
  ItemFromCacheType,
  IdCacheType,
  ServerErrorType,
} from "../types/types";

/**
 * Configuration interface for read cache operations
 */
export interface ReadCacheConfig {
  redisCache: RedisClientType;
  redisReadBatchSize: number;
  idCache: IdCacheType;
  generateCacheID: (queryProto: ProtoObjType) => string;
}

/**
 * Creates a buildFromCache function with the provided configuration
 * @param config - Configuration object containing Redis cache, batch size, and ID cache
 * @returns Bound buildFromCache function
 */
export function createBuildFromCache(config: ReadCacheConfig) {
  const { redisCache, redisReadBatchSize, idCache, generateCacheID } = config;

  /**
   * Helper function to generate cache ID with fallback logic
   */
  const getCacheIDWithFallback = (
    prototype: ProtoObjType,
    subID: boolean | string = false
  ): string => {
    let cacheID: string;

    if (typeof subID === "string") {
      cacheID = subID;
    } else {
      cacheID = generateCacheID(prototype);
    }

    // Get key name from args if available
    let keyName: string | undefined;
    if (prototype.__args === null) {
      keyName = undefined;
    } else {
      keyName = Object.values(prototype.__args as object)[0];
    }

    // Check ID cache for mapping
    if (keyName && idCache[keyName]) {
      if (idCache[keyName][cacheID]) {
        cacheID = idCache[keyName][cacheID] as string;
      }

      // Try capitalized version
      const capitalized = cacheID.charAt(0).toUpperCase() + cacheID.slice(1);
      if (idCache[keyName][capitalized]) {
        cacheID = idCache[keyName][capitalized] as string;
      }
    }

    return cacheID;
  };

  /**
   * Process array items from cache
   */
  const processArrayCache = async (
    array: string[],
    prototype: ProtoObjType,
    typeKey: string,
    prototypeKeys: string[],
    itemFromCache: ItemFromCacheType
  ): Promise<void> => {
    let redisRunQueue = redisCache.multi();

    for (let i = 0; i < array.length; i++) {
      if (typeof itemFromCache[typeKey] === "string") {
        const getCommandCallback = (cacheResponse: string): void => {
          const tempObj: ItemFromCacheType = {};

          if (cacheResponse) {
            const interimCache: ItemFromCacheType = JSON.parse(cacheResponse);

            for (const property in prototype[typeKey] as ProtoObjType) {
              // If property exists, set on tempObj
              if (
                Object.prototype.hasOwnProperty.call(interimCache, property) &&
                !property.includes("__")
              ) {
                tempObj[property] = interimCache[property];
              }
              // If prototype is nested at this field, recurse
              else if (
                !property.includes("__") &&
                typeof (prototype[typeKey] as ProtoObjType)[property] ===
                  "object"
              ) {
                buildFromCache(
                  (prototype[typeKey] as ProtoObjType)[
                    property
                  ] as ProtoObjType,
                  prototypeKeys,
                  {},
                  false,
                  `${currTypeKey}--${property}`
                ).then((tempData) => (tempObj[property] = tempData.data));
              }
              // If cache does not have property, set to false on prototype so that it is sent to GraphQL
              else if (
                !property.includes("__") &&
                typeof (prototype[typeKey] as ProtoObjType)[property] !==
                  "object"
              ) {
                (prototype[typeKey] as ProtoObjType)[property] = false;
              }
            }
            itemFromCache[typeKey][i] = tempObj;
          }
          // If there is nothing in the cache for this key, toggle all fields to false
          else {
            for (const property in prototype[typeKey] as ProtoObjType) {
              if (
                !property.includes("__") &&
                typeof (prototype[typeKey] as ProtoObjType)[property] !==
                  "object"
              ) {
                (prototype[typeKey] as ProtoObjType)[property] = false;
              }
            }
          }
        };

        const currTypeKey: string = itemFromCache[typeKey][i];

        // Execute batch when reaching batch size
        if (i !== 0 && i % redisReadBatchSize === 0) {
          try {
            const cacheResponseRaw = await redisRunQueue.exec();
            cacheResponseRaw.forEach((cacheResponse) =>
              getCommandCallback(JSON.stringify(cacheResponse))
            );
          } catch (error) {
            const err: ServerErrorType = {
              log: `Error inside batch execution of buildFromCache, ${error}`,
              status: 400,
              message: {
                err: "Error in buildFromCache. Check server log for more details.",
              },
            };
            console.log(err);
          }
          redisRunQueue = redisCache.multi();
        }

        // Add get command to queue
        redisRunQueue.get(currTypeKey.toLowerCase());

        // Execute remaining items in queue
        if (i === array.length - 1) {
          try {
            const cacheResponseRaw = await redisRunQueue.exec();
            cacheResponseRaw.forEach((cacheResponse) =>
              getCommandCallback(JSON.stringify(cacheResponse))
            );
          } catch (error) {
            const err: ServerErrorType = {
              log: `Error inside final batch execution of buildFromCache, ${error}`,
              status: 400,
              message: {
                err: "Error in buildFromCache. Check server log for more details.",
              },
            };
            console.log(err);
          }
        }
      }
    }
  };

  /**
   * Process nested cache queries
   */
  const processNestedCache = async (
    prototype: ProtoObjType,
    typeKey: string,
    itemFromCache: ItemFromCacheType,
    prototypeKeys: string[],
    firstRun: boolean
  ): Promise<void> => {
    if (!firstRun) {
      // If this field is not in the cache, set to false
      if (
        (itemFromCache === null ||
          !Object.prototype.hasOwnProperty.call(itemFromCache, typeKey)) &&
        typeof prototype[typeKey] !== "object" &&
        !typeKey.includes("__") &&
        !itemFromCache[0]
      ) {
        prototype[typeKey] = false;
      }
      // If this field is a nested query, recurse
      if (
        !(Object.keys(itemFromCache).length > 0) &&
        typeof itemFromCache === "object" &&
        !typeKey.includes("__") &&
        typeof prototype[typeKey] === "object"
      ) {
        const cacheID = generateCacheID(prototype);
        const cacheResponse = await getFromRedis(cacheID, redisCache);
        if (cacheResponse) itemFromCache[typeKey] = JSON.parse(cacheResponse);
        await buildFromCache(
          prototype[typeKey] as ProtoObjType,
          prototypeKeys,
          itemFromCache[typeKey],
          false
        );
      }
    } else {
      // Handle normal (non-recursive) case
      for (const field in prototype[typeKey] as ProtoObjType) {
        // If field is not found in cache then toggle to false
        if (
          itemFromCache[typeKey] &&
          !Object.prototype.hasOwnProperty.call(
            itemFromCache[typeKey],
            field
          ) &&
          !field.includes("__") &&
          typeof (prototype[typeKey] as ProtoObjType)[field] !== "object"
        ) {
          (prototype[typeKey] as ProtoObjType)[field] = false;
        }

        // If field contains a nested query, recurse
        if (
          !field.includes("__") &&
          typeof (prototype[typeKey] as ProtoObjType)[field] === "object"
        ) {
          await buildFromCache(
            (prototype[typeKey] as ProtoObjType)[field] as ProtoObjType,
            prototypeKeys,
            itemFromCache[typeKey][field] || {},
            false
          );
        }
        // If there are no data in itemFromCache, toggle to false
        else if (
          !itemFromCache[typeKey] &&
          !field.includes("__") &&
          typeof (prototype[typeKey] as ProtoObjType)[field] !== "object"
        ) {
          (prototype[typeKey] as ProtoObjType)[field] = false;
        }
      }
    }
  };

  /**
   * Main buildFromCache function
   * Finds any requested information in the cache and assembles it on the cacheResponse.
   * Uses the prototype as a template for cacheResponse and marks any data not found in the cache
   * on the prototype for future retrieval from database.
   */
  async function buildFromCache(
    prototype: ProtoObjType,
    prototypeKeys: string[],
    itemFromCache: ItemFromCacheType = {},
    firstRun = true,
    subID: boolean | string = false
  ): Promise<{ data: ItemFromCacheType }> {
    for (const typeKey in prototype) {
      // If the current key is a root query, check cache and set any results to itemFromCache
      if (prototypeKeys.includes(typeKey)) {
        const cacheID = getCacheIDWithFallback(
          prototype[typeKey] as ProtoObjType,
          subID
        );

        const cacheResponse = await getFromRedis(cacheID, redisCache);
        itemFromCache[typeKey] = cacheResponse ? JSON.parse(cacheResponse) : {};
      }

      // If itemFromCache at the current key is an array, iterate through and gather data
      if (Array.isArray(itemFromCache[typeKey])) {
        const array = itemFromCache[typeKey] as string[];
        await processArrayCache(
          array,
          prototype,
          typeKey,
          prototypeKeys,
          itemFromCache
        );
      }
      // Process nested cache queries
      else if (
        typeof prototype[typeKey] === "object" &&
        !typeKey.includes("__")
      ) {
        await processNestedCache(
          prototype,
          typeKey,
          itemFromCache,
          prototypeKeys,
          firstRun
        );
      }
    }

    // Return itemFromCache on a data property to resemble GraphQL response format
    return { data: itemFromCache };
  }

  return buildFromCache;
}

/**
 * Creates a generateCacheID function
 * Helper function that creates cacheIDs based on information from the prototype
 * in the format of 'field--ID'
 */
export function createGenerateCacheID() {
  return function generateCacheID(queryProto: ProtoObjType): string {
    const cacheID: string = queryProto.__id
      ? `${queryProto.__type}--${queryProto.__id}`
      : (queryProto.__type as string);
    return cacheID;
  };
}
