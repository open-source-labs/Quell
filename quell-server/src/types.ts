export interface QueryObject {
  [query: string]: QueryFields;
}

// export interface QueryFields {
//   __id: string | null;
//   __type: string;
//   __alias: string | null;
//   __args: string | null;
//   query: QueryFields;
//   [field: string]: boolean | string | QueryFields;
// }
/* TODO not sure how to define a key with unknown name (i.e. id, name) but known type (boolean) */

export interface Fields {
  __id: string | null;
  __type: string;
  __alias: string | null;
  __args: string | null;
  query?: Fields;
}

export interface Field {
  [field: string]: boolean;
}

export type QueryFields = Fields & Field;

export interface ItemToBeCached {
  id: string;
  [field: string]: string | ItemToBeCached[];
}

export interface QueryMapType {
  [query: string]: string;
}

/* dbRespDataRaw for Query is {"data":{"city":{"id":"636afe808c11797007e7e49f","name":"New York","country":"United States"}}} */
/* dbRespDataRaw for Mutation is {"data":{"addCountry":{"id":"640e8298346ed37d0d33a132","name":"Brazil"}}} */
export interface DatabaseResponseDataRaw {
  data: TypeData;
}

/* TypeData for a Query is {"city":{"id":"636afe808c11797007e7e49f","name":"New York","country":"United States"}} */
/* TypeData for a Mutation is {"addCountry":{"id":"640e8298346ed37d0d33a132","name":"Brazil"}} */
export interface TypeData {
  [type: string]: Type;
}

/* Type for a Query is {"id":"636afe808c11797007e7e49f","name":"New York","country":"United States"} */
/* Type for a Mutation is {"id":"640e8298346ed37d0d33a132","name":"Brazil"} */
export interface Type {
  id: string;
  name: string;
  [field: string]: string;
}
