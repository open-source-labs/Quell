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
    console.log(`Generated base cache ID: ${cacheID}`);

    // Get key name from args if available
    let keyName: string | undefined;
    if (prototype.__args === null) {
      keyName = undefined;
    } else {
      keyName = Object.values(prototype.__args as object)[0];
    }
    console.log(`Key name from args: ${keyName}`);

    // Check ID cache for mapping
    if (keyName && idCache[keyName]) {
      console.log(`Found ID cache for ${keyName}:`, idCache[keyName]);

      if (idCache[keyName][cacheID]) {
        const mappedValue = idCache[keyName][cacheID];

        // Handle both string and array cases
        if (typeof mappedValue === "string") {
          cacheID = mappedValue;
          console.log(`Updated cache ID from ID cache: ${cacheID}`);
        } else if (Array.isArray(mappedValue) && mappedValue.length > 0) {
          // If it's an array, use the first value (they should all be the same anyway)
          cacheID = mappedValue[0];
          console.log(`Updated cache ID from ID cache array: ${cacheID}`);
        }
      }

      // Try capitalized version
      const capitalized = cacheID.charAt(0).toUpperCase() + cacheID.slice(1);
      if (idCache[keyName][capitalized]) {
        const mappedValue = idCache[keyName][capitalized];

        // Handle both string and array cases
        if (typeof mappedValue === "string") {
          cacheID = mappedValue;
          console.log(`Updated cache ID from capitalized version: ${cacheID}`);
        } else if (Array.isArray(mappedValue) && mappedValue.length > 0) {
          // If it's an array, use the first value
          cacheID = mappedValue[0];
          console.log(`Updated cache ID from capitalized array: ${cacheID}`);
        }
      }
    }
    console.log(`Final cache ID: ${cacheID}`);

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
   * Helper function to recursively mark all primitive fields in a nested object as false
   * This ensures they get included in the database query
   */
  const markNestedFieldsAsFalse = (obj: ProtoObjType): void => {
    for (const key in obj) {
      if (key.includes("__")) continue; // Skip meta fields

      if (typeof obj[key] === "object" && obj[key] !== null) {
        // Recursively mark nested objects
        markNestedFieldsAsFalse(obj[key] as ProtoObjType);
      } else {
        // Mark primitive fields as false
        obj[key] = false;
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
      // Handle recursive calls (non-root level)

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
      // Handle root level processing (firstRun = true)
      for (const field in prototype[typeKey] as ProtoObjType) {
        // Skip meta fields
        if (field.includes("__")) continue;

        const fieldPrototype = (prototype[typeKey] as ProtoObjType)[field];
        const isFieldObject = typeof fieldPrototype === "object";
        const fieldExistsInCache =
          itemFromCache[typeKey] &&
          Object.prototype.hasOwnProperty.call(itemFromCache[typeKey], field);
        const cacheDataExists = itemFromCache[typeKey];

        if (isFieldObject) {
          // Handle nested object/array fields (like albums)
          if (fieldExistsInCache) {
            // Field exists in cache, recurse to process nested data
            await buildFromCache(
              fieldPrototype as ProtoObjType,
              prototypeKeys,
              itemFromCache[typeKey][field] || {},
              false
            );
          } else {
            // Field doesn't exist in cache - mark it for database retrieval
            console.log(
              `Field '${field}' not found in cache, will query from database`
            );

            // For nested objects, we need to mark all their primitive fields as false
            // so that createQueryObj includes them in the database query
            markNestedFieldsAsFalse(fieldPrototype as ProtoObjType);
          }
        } else {
          // Handle primitive fields (like id, name)
          if (!fieldExistsInCache) {
            if (cacheDataExists) {
              // Cache has entity data but missing this field
              (prototype[typeKey] as ProtoObjType)[field] = false;
            } else {
              // No cache data at all - mark field for database retrieval
              (prototype[typeKey] as ProtoObjType)[field] = false;
            }
          }
          // If field exists in cache, leave it as is (it will be used from cache)
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
    console.log("=== BUILD FROM CACHE START ===");
    console.log("Prototype:", JSON.stringify(prototype, null, 2));
    console.log("Prototype Keys:", prototypeKeys);
    for (const typeKey in prototype) {
      // If the current key is a root query, check cache and set any results to itemFromCache
      if (prototypeKeys.includes(typeKey)) {
        const cacheID = getCacheIDWithFallback(
          prototype[typeKey] as ProtoObjType,
          subID
        );

        console.log(`Looking for cache with key: ${cacheID}`);
        const cacheResponse = await getFromRedis(cacheID, redisCache);
        console.log(`Cache response for ${cacheID}:`, cacheResponse);

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

    console.log("=== BUILD FROM CACHE END ===");
    console.log("Final itemFromCache:", JSON.stringify(itemFromCache, null, 2));

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
