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

export interface ItemToBeCached {
  id: string;
  [field: string]: string | ItemToBeCached[];
}

export interface QueryMapType {
  [query: string]: string;
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

export interface MergedResponseObject {
  [key: string]: Type | Type[];
}

export interface DataResponse {
  [key: string]: Data;
}

interface Data {
  [key: string]: DataField[] | string;
}

interface DataField {
  [key: string]: string;
}

/*
query {
    attractions(name: "Statue of Liberty") {
        id
        name
    }
    country(name: "Japan") {
        id
        name
        cities {
            id
            name
        }
    }
    city(name: "Seattle") {
        id
        name
        attractions {
            id
            name
            }
        }
    }


 mergedResponse = {
  attractions: { id: '636b005e8c11797007e7e4a6', name: 'Statue of Liberty' },
  country: {
    id: '636afe2f8c11797007e7e49c',
    name: 'Japan',
    cities: [
      { id: '636afef18c11797007e7e4a3', name: 'Tokyo' },
      { id: '640f428665fcc5cf42fc9bb1', name: 'Kyoto' },
      { id: '640f42f765fcc5cf42fc9bb8', name: 'Osaka' },
    ],
  },
  city: {
    id: '636afe598c11797007e7e49d',
    name: 'Seattle',
    attractions: [
      { id: '636b01fa8c11797007e7e4ae', name: 'Pike Place Market' },
      { id: '636b01df8c11797007e7e4ad', name: 'Space Needle' },
    ],
  },
};
    */
