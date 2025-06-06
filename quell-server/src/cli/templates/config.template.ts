export const configTemplate = `import { QuellCache } from '@quell/server';
import { schema } from './src/server/schema/example-schema.ts'; // Your GraphQL schema
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Cost parameters configuration
const costParameters = {
  maxCost: Number(process.env.MAX_COST) || 5000,
  mutationCost: Number(process.env.MUTATION_COST) || 5,
  objectCost: Number(process.env.OBJECT_COST) || 2,
  scalarCost: Number(process.env.SCALAR_COST) || 1,
  depthCostFactor: Number(process.env.DEPTH_COST_FACTOR) || 1.5,
  maxDepth: Number(process.env.MAX_DEPTH) || 10,
  ipRate: Number(process.env.IP_RATE) || 3,
};

// Initialize Quell cache with universal schema support
export const quellCache = new QuellCache({
  schema,
  cacheExpiration: Number(process.env.CACHE_EXPIRATION || 1209600),
  redisPort: Number(process.env.REDIS_PORT || 6379),
  redisHost: process.env.REDIS_HOST || "127.0.0.1",
  redisPassword: process.env.REDIS_PASSWORD || "",
  costParameters,
});
`;