import { Request, Response, NextFunction } from "express";
import { RedisClientType } from "redis";
import { ServerErrorType } from "../types/types";
import { createServerError } from "../helpers/cacheUtils";

export interface RateLimiterConfig {
  ipRate: number;
  redisCache: RedisClientType;
}

/**
 * A redis-based IP rate limiter middleware function that limits the number of requests per second based on IP address using Redis.
 *  @param {Request} req - Express request object, including request body with GraphQL query string.
 *  @param {Response} res - Express response object, will carry query response to next middleware.
 *  @param {NextFunction} next - Express next middleware function, invoked when QuellCache completes its work.
 *  @returns {void} Passes an error to Express if no query was included in the request or if the number of requests by the current IP
 *  exceeds the IP rate limit.
 */
export function createRateLimiter(config: RateLimiterConfig) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Set ipRate to the ipRate limit from the request body or use default.
    const ipRateLimit: number = req.body.costOptions?.ipRate ?? config.ipRate;

    // Get the IP address from the request.
    const ipAddress: string = req.ip as string;
    // Get the current time in seconds.
    const currentTimeSeconds: number = Math.floor(Date.now() / 1000);
    // Create a Redis IP key using the IP address and current time.
    const redisIpTimeKey = `${ipAddress}:${currentTimeSeconds}`;

    // Return an error if no query is found on the request.
    if (!req.body.query) {
      const err: ServerErrorType = {
        log: "Error: no GraphQL query found on request body, inside rateLimiter",
        status: 400,
        message: {
          err: "Error in rateLimiter: Bad Request. Check server log for more details.",
        },
      };
      return next(err);
    }

    try {
      // Create a Redis multi command queue.
      const redisRunQueue: ReturnType<typeof config.redisCache.multi> =
        config.redisCache.multi();

      // Add to queue: increment the key associated with the current IP address and time in Redis.
      redisRunQueue.incr(redisIpTimeKey);

      // Add to queue: set the key to expire after 1 second.
      redisRunQueue.expire(redisIpTimeKey, 1);

      // Execute the Redis multi command queue.
      const redisResponse: string[] = (await redisRunQueue.exec()).map(
        (result) => JSON.stringify(result)
      );

      // Save result of increment command, which will be the number of requests made by the current IP address in the last second.
      // Since the increment command was the first command in the queue, it will be the first result in the returned array.
      const numRequestsString: string = redisResponse[0] ?? "0";
      const numRequests: number = parseInt(numRequestsString, 10);

      // If the number of requests is greater than the IP rate limit, throw an error.
      if (numRequests > ipRateLimit) {
        next(
          createServerError(
            `Redis cache error: Express error handler caught too many requests from this IP address (${ipAddress}): limit is: ${ipRateLimit} requests per second, inside rateLimiter`,
            429,
            "Error in rateLimiter middleware. Check server log for more details."
          )
        );
        return;
      }

      console.log(
        `IP ${ipAddress} made a request. Limit is: ${ipRateLimit} requests per second. Result: OK.`
      );

      return next();
    } catch (error) {
      next(
        createServerError(
          `Catch block in rateLimiter middleware, ${error}`,
          500,
          "IPRate Limiting Error. Check server log for more details."
        )
      )
      return;
  }
}
}
