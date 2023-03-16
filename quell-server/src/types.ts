import type {
  GraphQLSchema,
  IntValueNode,
  FloatValueNode,
  StringValueNode,
  BooleanValueNode,
  EnumValueNode,
  OperationDefinitionNode,
  VariableDefinitionNode,
  FieldNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
  SchemaDefinitionNode,
  ScalarTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  InputObjectTypeDefinitionNode,
  SchemaExtensionNode,
  ScalarTypeExtensionNode,
  ObjectTypeExtensionNode,
  InterfaceTypeExtensionNode,
  UnionTypeExtensionNode,
  EnumTypeExtensionNode,
  InputObjectTypeExtensionNode
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
  [key: string]: unknown;
  // [key: string]: string | boolean | null | ArgsObjType | ProtoObjType;
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

/*
 * The argsObj is used to store arguments. It is only used if the argument node is one of the
 * valid nodes included in the ValidArgumentNodeType interface. It key will be the field name (string)
 * and value will be the 'value' property of the argument node. For the valid argument nodes, the
 * 'value' property will be a string, boolean, or null.
 */
export interface ArgsObjType {
  [fieldName: string]: string | boolean | null;
}

export interface AuxObjType {
  __type?: string | boolean | null;
  __alias?: string | boolean | null;
  __args?: ArgsObjType | null;
  __id?: string | boolean | null;
}

export interface FieldArgsType {
  [fieldName: string]: AuxObjType;
}

/*
 * Types of arguments that Quell is able to cache
 */
export type ValidArgumentNodeType =
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | EnumValueNode;
// Excludes the following types:
// | VariableNode
// | NullValueNode
// | ListValueNode
// | ObjectValueNode

export interface FieldsObjectType {
  [fieldName: string]: string | boolean | null | ArgsObjType | null;
}

export interface FieldsValuesType {
  [fieldName: string]: boolean;
}

export interface GQLResponseType {
  [key: string]: unknown;
}

export type GQLNodeWithDirectivesType =
  | OperationDefinitionNode
  | VariableDefinitionNode
  | FieldNode
  | FragmentSpreadNode
  | InlineFragmentNode
  | FragmentDefinitionNode
  | SchemaDefinitionNode
  | ScalarTypeDefinitionNode
  | ObjectTypeDefinitionNode
  | FieldDefinitionNode
  | InputValueDefinitionNode
  | InterfaceTypeDefinitionNode
  | UnionTypeDefinitionNode
  | EnumTypeDefinitionNode
  | EnumValueDefinitionNode
  | InputObjectTypeDefinitionNode
  | SchemaExtensionNode
  | ScalarTypeExtensionNode
  | ObjectTypeExtensionNode
  | InterfaceTypeExtensionNode
  | UnionTypeExtensionNode
  | EnumTypeExtensionNode
  | InputObjectTypeExtensionNode;
export interface QueryObject {
  [query: string]: QueryFields;
}

export interface QueryFields {
  __id: string | null;
  __type: string;
  __alias: string | null;
  __args: null | Argument;
  // key can either be a field (ie. id, name) which would then have value of boolean
  // key can also be another QueryFields
  // null, string, and Argument are add'l types due to string index rules
  [key: string]: QueryFields | string | null | Argument | boolean;
}

interface Argument {
  [arg: string]: string | boolean;
}

export interface MapType {
  [query: string]: string | undefined;
}

/* dbRespDataRaw for Query is {"data":{"city":{"id":"636afe808c11797007e7e49f","name":"New York","country":"United States"}}} */
/* dbRespDataRaw for Mutation is {"data":{"addCountry":{"id":"640e8298346ed37d0d33a132","name":"Brazil"}}} */
export interface DatabaseResponseDataRaw {
  data: TypeData;
}

/* TypeData for a Query is {"city":{"id":"636afe808c11797007e7e49f","name":"New York","country":"United States"}} */
/* TypeData for a Mutation is {"addCountry":{"id":"640e8298346ed37d0d33a132","name":"Brazil"}} */
export interface TypeData {
  [type: string]: string | Type | Type[];
}

/* Type for a Query is {"id":"636afe808c11797007e7e49f","name":"New York","country":"United States"} */
/* Type for a Mutation is {"id":"640e8298346ed37d0d33a132","name":"Brazil"} */
export interface Type {
  id?: string;
  name?: string;
  [type: string]: Type | Type[] | string | undefined;
  [index: number]: Type | Type[] | string | undefined;
}

export interface MergedResponse {
  [key: string]: Data | Data[];
}

export interface DataResponse {
  [key: string]: Data | Data[];
}

export interface Data {
  [key: string]: DataField[] | string | Data | Data[];
}

interface DataField {
  [key: string]: string;
}

export type MutationTypeFieldsType = {
  [key: string]: string | MutationTypeFieldsType | MutationTypeFieldsType[];
};

export type QueryTypeFieldsType = {
  [key: string]: string | QueryTypeFieldsType | QueryTypeFieldsType[];
};

export type TypeMapFieldsType = {
  [key: string]: string | TypeMapFieldsType | TypeMapFieldsType[];
};

export type ItemFromCacheType = {
  [key: string]: any;
};

export type PropsFilterType = {
  [k: string]: null | string | PropsFilterType;
};

export type RedisOptionsType = {
  getStats: boolean;
  getKeys: boolean;
  getValues: boolean;
};

export type RedisStatsType = {
  server: { name: string; value?: string }[];
  client: { name: string; value?: string }[];
  memory: { name: string; value?: string }[];
  stats: { name: string; value?: string }[];
};
export type ServerErrorType = {
  log: string;
  status: number;
  message: { err: string };
};

export type ResponseDataType = {
  [k: string]: string | ResponseDataType | ResponseDataType[];
};
