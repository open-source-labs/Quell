import { Response, Request, NextFunction, RequestHandler } from "express";
import { RedisClientType } from "redis";
import { redisCacheMain } from "./redisConnection";
import {
  RedisOptionsType,
  RedisStatsType,
  ServerErrorType,
} from "../types/types";

//connection to Redis server
const redisCache: RedisClientType = redisCacheMain;

/**
 * Reads from Redis cache and returns a promise (Redis v4 natively returns a promise).
 * @param {string} key - The key for Redis lookup.
 * @returns {Promise} A promise representing the value from the redis cache with the provided key.
 */
export const getFromRedis = async (
  key: String,
  redisCache: RedisClientType
): Promise<string | null | void> => {
  try {
    if (typeof key !== "string" || key === undefined) return;
    const lowerKey: string = key.toLowerCase();
    const redisResult: string | null = await redisCache.get(lowerKey);
    return redisResult;
  } catch (error) {
    const err: ServerErrorType = {
      log: `Error in QuellCache trying to getFromRedis, ${error}`,
      status: 400,
      message: {
        err: "Error in getFromRedis. Check server log for more details.",
      },
    };
    console.log("err in getFromRedis: ", err);
  }
};

/**
 * Returns a chain of middleware based on what information (if any) the user would
 * like to request from the specified redisCache. It requires an appropriately
 * configured Express route and saves the specified stats to res.locals, for instance:
 * @example
 *  app.use('/redis', getRedisInfo({
 *    getStats: true,
 *    getKeys: true,
 *    getValues: true
 *  }));
 * @param {Object} options - Three properties with boolean values: getStats, getKeys, getValues
 * @returns {Array} An array of middleware functions that retrieves specified Redis info.
 */

export const getRedisInfo = (
  options: RedisOptionsType = {
    getStats: true,
    getKeys: true,
    getValues: true,
  }
): RequestHandler[] => {
  // console.log("Getting Redis Info");
  const middleware: RequestHandler[] = [];

  /**
   * Helper function within the getRedisInfo function that returns
   * what redis data should be retrieved based on the passed in options.
   * @param {Object} opts - Options object containing a boolean value for getStats, getKeys, and getValues.
   * @returns {string} String that indicates which data should be retrieved from Redis instance.
   */
  const getOptions = (opts: RedisOptionsType): string => {
    const { getStats, getKeys, getValues } = opts;
    if (!getStats && getKeys && getValues) return "dontGetStats";
    else if (getStats && getKeys && !getValues) return "dontGetValues";
    else if (!getStats && getKeys && !getValues) return "getKeysOnly";
    else if (getStats && !getKeys && !getValues) return "getStatsOnly";
    else return "getAll";
  };

  switch (getOptions(options)) {
    case "dontGetStats":
      middleware.push(getRedisKeys, getRedisValues);
      break;
    case "dontGetValues":
      middleware.push(getStatsFromRedis, getRedisKeys);
      break;
    case "getKeysOnly":
      middleware.push(getRedisKeys);
      break;
    case "getStatsOnly":
      middleware.push(getStatsFromRedis);
      break;
    case "getAll":
      middleware.push(getStatsFromRedis, getRedisKeys, getRedisValues);
      break;
  }
  return middleware;
};

/**
 * Gets the key names from the Redis cache and adds them to the response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */

export const getRedisKeys = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  redisCache
    .keys("*")
    .then((response: string[]) => {
      res.locals.redisKeys = response;
      return next();
    })
    .catch((error: ServerErrorType) => {
      const err: ServerErrorType = {
        log: `Error inside catch block of getRedisKeys, keys potentially undefined, ${error}`,
        status: 400,
        message: {
          err: "Error in redis - getRedisKeys. Check server log for more details.",
        },
      };
      return next(err);
    });
};

/**
 * Gets the values associated with the Redis cache keys and adds them to the response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
export const getRedisValues = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.locals.redisKeys && res.locals.redisKeys.length !== 0) {
    redisCache
      .mGet(res.locals.redisKeys)
      .then((response: (string | null)[]) => {
        res.locals.redisValues = response;
        return next();
      })
      .catch((error: ServerErrorType) => {
        const err: ServerErrorType = {
          log: `Error inside catch block of getRedisValues, ${error}`,
          status: 400,
          message: {
            err: "Error in redis - getRedisValues. Check server log for more details.",
          },
        };
        return next(err);
      });
  } else {
    res.locals.redisValues = [];
    return next();
  }
};

/**
 * Gets information and statistics about the server and adds them to the response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
export const getStatsFromRedis = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const getStats = () => {
      // redisCache.info returns information and statistics about the server as an array of field:value.
      redisCache
        .info()
        .then((response: string) => {
          const dataLines: string[] = response.split("\r\n");
          const output: RedisStatsType = {
            // SERVER
            server: [
              // Redis version
              {
                name: "Redis version",
                value: dataLines
                  .find((line) => line.match(/redis_version/))
                  ?.split(":")[1],
              },
              // Redis build id
              {
                name: "Redis build id",
                value: dataLines
                  .find((line) => line.match(/redis_build_id/))
                  ?.split(":")[1],
              },
              // Redis mode
              {
                name: "Redis mode",
                value: dataLines
                  .find((line) => line.match(/redis_mode/))
                  ?.split(":")[1],
              },
              // OS hosting Redis system
              {
                name: "Host operating system",
                value: dataLines
                  .find((line) => line.match(/os/))
                  ?.split(":")[1],
              },
              // TCP/IP listen port
              {
                name: "TCP/IP port",
                value: dataLines
                  .find((line) => line.match(/tcp_port/))
                  ?.split(":")[1],
              },
              // Server time
              {
                name: "System time",
                value: dataLines
                  .find((line) => line.match(/server_time_in_usec/))
                  ?.split(":")[1],
              },
              // Number of seconds since Redis server start
              {
                name: "Server uptime (seconds)",
                value: dataLines
                  .find((line) => line.match(/uptime_in_seconds/))
                  ?.split(":")[1],
              },
              // Number of days since Redis server start
              {
                name: "Server uptime (days)",
                value: dataLines
                  .find((line) => line.match(/uptime_in_days/))
                  ?.split(":")[1],
              },
              // Path to server's executable
              {
                name: "Path to executable",
                value: dataLines
                  .find((line) => line.match(/executable/))
                  ?.split(":")[1],
              },
              // Path to server's configuration file
              {
                name: "Path to configuration file",
                value: dataLines
                  .find((line) => line.match(/config_file/))
                  ?.split(":")[1],
              },
            ],
            // CLIENT
            client: [
              // Number of connected clients
              {
                name: "Connected clients",
                value: dataLines
                  .find((line) => line.match(/connected_clients/))
                  ?.split(":")[1],
              },
              // Number of sockets used by cluster bus
              {
                name: "Cluster connections",
                value: dataLines
                  .find((line) => line.match(/cluster_connections/))
                  ?.split(":")[1],
              },
              // Max clients
              {
                name: "Max clients",
                value: dataLines
                  .find((line) => line.match(/maxclients/))
                  ?.split(":")[1],
              },
              // Number of clients being tracked
              {
                name: "Tracked clients",
                value: dataLines
                  .find((line) => line.match(/tracking_clients/))
                  ?.split(":")[1],
              },
              // Blocked clients
              {
                name: "Blocked clients",
                value: dataLines
                  .find((line) => line.match(/blocked_clients/))
                  ?.split(":")[1],
              },
            ],
            // MEMORY
            memory: [
              // Total allocated memory
              {
                name: "Total allocated memory",
                value: dataLines
                  .find((line) => line.match(/used_memory_human/))
                  ?.split(":")[1],
              },
              // Peak memory consumed
              {
                name: "Peak memory consumed",
                value: dataLines
                  .find((line) => line.match(/used_memory_peak_human/))
                  ?.split(":")[1],
              },
              // % of peak out of total
              {
                name: "Peak memory used % total",
                value: dataLines
                  .find((line) => line.match(/used_memory_peak_perc/))
                  ?.split(":")[1],
              },
              // Initial amount of memory consumed at startup
              {
                name: "Memory consumed at startup",
                value: dataLines
                  .find((line) => line.match(/used_memory_startup/))
                  ?.split(":")[1],
              },
              // Size of dataset
              // {
              //   name: 'Dataset size (bytes)',
              //   value: dataLines
              //     .find((line) => line.match(/used_memory_dataset/))
              //     .split(':')[1],
              // },
              // Percent of data out of net memory usage
              // {
              //   name: 'Dataset memory % total',
              //   value: dataLines
              //     .find((line) => line.match(/used_memory_dataset_perc/))
              //     .split(':')[1],
              // },
              // Total system memory
              // {
              //   name: 'Total system memory',
              //   value: dataLines
              //     .find((line) => line.match(/total_system_memory_human/))
              //     .split(':')[1],
              // },
            ],
            // STATS
            stats: [
              // Total number of connections accepted by server
              {
                name: "Total connections",
                value: dataLines
                  .find((line) => line.match(/total_connections_received/))
                  ?.split(":")[1],
              },
              // Total number of commands processed by server
              {
                name: "Total commands",
                value: dataLines
                  .find((line) => line.match(/total_commands_processed/))
                  ?.split(":")[1],
              },
              // Number of commands processed per second
              {
                name: "Commands processed per second",
                value: dataLines
                  .find((line) => line.match(/instantaneous_ops_per_sec/))
                  ?.split(":")[1],
              },
              // Total number of keys being tracked
              // {
              //   name: 'Tracked keys',
              //   value: dataLines
              //     .find((line) => line.match(/tracking_total_keys/))
              //     .split(':')[1],
              // },
              // Total number of items being tracked(sum of clients number for each key)
              // {
              //   name: 'Tracked items',
              //   value: dataLines
              //     .find((line) => line.match(/tracking_total_items/))
              //     .split(':')[1],
              // },
              // Total number of read events processed
              // {
              //   name: 'Reads processed',
              //   value: dataLines
              //     .find((line) => line.match(/total_reads_processed/))
              //     .split(':')[1],
              // },
              // Total number of write events processed
              // {
              //   name: 'Writes processed',
              //   value: dataLines
              //     .find((line) => line.match(/total_writes_processed/))
              //     .split(':')[1],
              // },
              // Total number of error replies
              {
                name: "Error replies",
                value: dataLines
                  .find((line) => line.match(/total_error_replies/))
                  ?.split(":")[1],
              },
              // Total number of bytes read from network
              {
                name: "Bytes read from network",
                value: dataLines
                  .find((line) => line.match(/total_net_input_bytes/))
                  ?.split(":")[1],
              },
              // Networks read rate per second
              {
                name: "Network read rate (Kb/s)",
                value: dataLines
                  .find((line) => line.match(/instantaneous_input_kbps/))
                  ?.split(":")[1],
              },
              // Total number of bytes written to network
              // {
              //   name: 'Bytes written to network',
              //   value: dataLines
              //     .find((line) => line.match(/total_net_output_bytes/))
              //     .split(':')[1],
              // },
              // Networks write rate per second
              {
                name: "Network write rate (Kb/s)",
                value: dataLines
                  .find((line) => line.match(/instantaneous_output_kbps/))
                  ?.split(":")[1],
              },
            ],
          };
          res.locals.redisStats = output;
          return next();
        })
        .catch((error: string) => {
          const err: ServerErrorType = {
            log: `Error inside catch block of getting info within getStatsFromRedis, ${error}`,
            status: 400,
            message: {
              err: "Error in redis - getStatsFromRedis. Check server log for more details.",
            },
          };
          return next(err);
        });
    };
    getStats();
  } catch (error) {
    const err: ServerErrorType = {
      log: `Error inside catch block of getStatsFromRedis, ${error}`,
      status: 400,
      message: {
        err: "Error in redis - getStatsFromRedis. Check server log for more details.",
      },
    };
    return next(err);
  }
};
