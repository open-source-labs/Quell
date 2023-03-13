export interface QueryObject {
  [query: string]: QueryFields;
}

export interface QueryFields {
  __id: string | null;
  __type: string;
  __alias: string | null;
  __args: Argument;
  query: QueryFields;
  field: Field;
}
/* TODO not sure how to define a key with unknown name (i.e. id, name) but known type (boolean) */

export interface Field {
    [field: string]: boolean;
}

export interface Argument {
    [argument: string]: string;
}

export interface ItemToBeCached {
    id: string;

}

export interface QueryMapType {
    [query: string]: string
}

export interface DatabaseResponse {
    GraphQLType: 
}


/* dbRespDataRaw is {"data":{"addCountry":{"id":"640e8298346ed37d0d33a132","name":"Brazil"}}} */
export interface DatabaseResponseDataRaw {
  data: MutationData;
}

/* MutationData is {"addCountry":{"id":"640e8298346ed37d0d33a132","name":"Brazil"}} */
export interface MutationData {
  mutationType: Mutation;
}

/* Mutation is {"id":"640e8298346ed37d0d33a132","name":"Brazil"} */
export interface Mutation {
  id: string;
  name: string;
}
