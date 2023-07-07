import { RedisClientType } from "redis";
import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();


// Create and export the Redis client instance

const redisPort = Number(process.env.REDIS_PORT);
const redisHost = process.env.REDIS_HOST;
const redisPassword = process.env.REDIS_PASSWORD;


export const redisCacheMain: RedisClientType = createClient({
  socket: { host: redisHost, port: Number(redisPort) },
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