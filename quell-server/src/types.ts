import type { RedisClientType, RedisCommandRawReply } from 'redis';
import type {
  ASTNode,
  DocumentNode,
  Source,
  GraphQLSchema,
  ObjectTypeDefinitionNode
} from 'graphql';

// QuellCache constructor parameters
export interface ConstructorOptions {
  schema: GraphQLSchema;
  cacheExpiration?: number;
  costParameters?: CostParamsType;
  redisPort: number;
  redisHost: string;
  redisPassword: string;
}

export interface IdCacheType {
  [key: any]: any;
}

export interface CostParamsType {
  maxCost: number;
  mutationCost: number;
  objectCost: number;
  scalarCost: number;
  depthCostFactor: number;
  maxDepth: number;
  ipRate: number;
}

export interface CustomError extends Error {
  log?: string;
  status?: number;
  msg?: string;
}
