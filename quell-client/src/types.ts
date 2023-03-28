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

export interface ProtoObjType {
  // [key: string]: unknown;
  [key: string]: string | boolean | null | ProtoObjType;
}

export interface FragsType {
  [fragName: string]: {
    [fieldName: string]: boolean;
  };
}

export interface ArgsObjType {
  [fieldName: string]: string | boolean | null;
}

export interface FieldArgsType {
  [fieldName: string]: AuxObjType;
}

export interface AuxObjType {
  __type?: string | boolean | null;
  __alias?: string | boolean | null;
  __args?: ArgsObjType | null;
  __id?: string | boolean | null;
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

export type ValidArgumentNodeType =
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | EnumValueNode;

export interface FieldsValuesType {
  [fieldName: string]: boolean;
}

export interface FieldsObjectType {
  [fieldName: string]: string | boolean | null | ArgsObjType;
}

export interface CostParamsType {
  maxCost: number;
  mutationCost?: number;
  objectCost?: number;
  scalarCost?: number;
  depthCostFactor?: number;
  maxDepth: number;
  ipRate: number;
}

export interface IDLokiCacheType {
  [k: string]: number;
}
export interface LokiGetType {
  $loki: number;
  [k: string]: JSONValue;
}
export interface FetchObjType {
  method?: string;
  headers: { 'Content-Type': string };
  body: string;
}
export interface JSONObject {
  [k: string]: JSONValue;
}
export type JSONValue = JSONObject | JSONArray | JSONPrimitive;
type JSONPrimitive = number | string | boolean | null;
type JSONArray = JSONValue[];

export type ClientErrorType = {
  log: string;
  status: number;
  message: { err: string };
};
