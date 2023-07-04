import { RedisClientType } from "redis";
import { createClient } from "redis";

const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPassword = process.env.REDIS_PASSWORD || "";

// Create and export the Redis client instance
export const redisCacheMain: RedisClientType = createClient({
  socket: { host: redisHost, port: redisPort },
  password: redisPassword,
});

// Handle errors during the connection
redisCacheMain.on("error", (error: Error) => {
  console.error(`Error when trying to connect to redisCacheMain: ${error}`);
});

// Establish the connection to Redis
redisCacheMain.connect().then(() => {
  console.log("Connected to redisCacheMain");
});
