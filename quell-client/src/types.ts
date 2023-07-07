import type {
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

// Interface for prototype object type
export interface ProtoObjType {
  [key: string]: string | boolean | null | ProtoObjType;
}

// Interface for fragments type
export interface FragsType {
  [fragName: string]: {
    [fieldName: string]: boolean;
  };
}

// Interface for argument object type
export interface ArgsObjType {
  [fieldName: string]: string | boolean | null;
}

// Interface for field arguments type
export interface FieldArgsType {
  [fieldName: string]: AuxObjType;
}

// Interface for auxiliary object type
export interface AuxObjType {
  __type?: string | boolean | null;
  __alias?: string | boolean | null;
  __args?: ArgsObjType | null;
  __id?: string | boolean | null;
}

// Define a type that represents a GraphQL node with directives
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

// Define a type for valid argument node types
export type ValidArgumentNodeType =
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | EnumValueNode;

// Interface for fields values type
export interface FieldsValuesType {
  [fieldName: string]: boolean;
}

// Interface for fields object type
export interface FieldsObjectType {
  [fieldName: string]: string | boolean | null | ArgsObjType;
}

// Interface for cost parameters type
export interface CostParamsType {
  [key: string]: number | undefined;
  maxCost: number;
  mutationCost?: number;
  objectCost?: number;
  scalarCost?: number;
  depthCostFactor?: number;
  maxDepth: number;
  ipRate: number;
}

// Interface for map cache type
export interface MapCacheType {
  data: JSONObject;
  fieldNames: string[];
}

// Interface for fetch object type
export interface FetchObjType {
  method?: string;
  headers: { 'Content-Type': string };
  body: string;
}

// Interface for JSON object
export interface JSONObject {
  [k: string]: JSONValue;
}

// Interface for JSON object with 'id' property
export interface JSONObjectWithId {
  id?: string;
}

// Type for JSON value
export type JSONValue = JSONObject | JSONArray | JSONPrimitive;
type JSONPrimitive = number | string | boolean | null;
type JSONArray = JSONValue[];

// Type for client error
export type ClientErrorType = {
  log: string;
  status: number;
  message: { err: string };
};

// Type for query response
export type QueryResponse = {
  queryResponse: { data: JSONObject }
}