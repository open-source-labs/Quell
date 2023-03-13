import type { GraphQLSchema, ASTNode, DirectiveNode } from 'graphql';

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
  [queryName: string]: {
    [fieldName: string]: string | string[];
  };
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

export interface ProtoObjType {
  [key: string]: unknown | ProtoObjType;
}

export interface FragsType {
  [fragName: string]: {
    [fieldName: string]: boolean;
  };
}

export interface MutationMapType {
  [mutationName: string]: string;
}

export interface QueryMapType {
  [queryName: string]: string | string[];
}

export interface FieldsMapType {
  [typeName: string]: {
    [fieldName: string]: string;
  };
}

// Incomplete because not being used
export interface IdMapType {
  [fieldType: string]: unknown;
}

export interface ParseASTOptions {
  userDefinedID?: string | null;
}

export interface ArgsObjType {
  [fieldName: string]: [argument: unknown];
}

export interface FieldArgsType {
  [fieldType: string]: {
    [fieldName: string]: {
      __type?: string;
      __alias?: string;
      __args?: Record<string, ArgsObjType> | null;
      __id?: string | null;
    };
  };
}
