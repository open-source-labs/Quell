export const configTemplate = `import { QuellCache } from '@quell/server';
import { schema } from './schema'; // Your GraphQL schema
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Quell cache with universal schema support
export const quellCache = new QuellCache({
  schema,
  cacheExpiration: parseInt(process.env.CACHE_EXPIRATION || '1209600'),
  redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  costParameters: {
    maxCost: parseInt(process.env.MAX_COST || '5000'),
    maxDepth: parseInt(process.env.MAX_DEPTH || '10'),
    ipRate: parseInt(process.env.IP_RATE || '3')
  }
});
`;