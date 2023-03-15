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
