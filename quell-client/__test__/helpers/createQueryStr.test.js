const createQueryStr = require('../../src/helpers/createQueryStr');

// NOTE: we changed the spacing on the results object, not sure if it matters?

describe('createQueryStr.js', () => {
  test('inputs query object w/ no values', () => {
    expect(createQueryStr(queryObject)).toEqual(

    );
  });

  test('inputs query object w/ only scalar types and outputs GCL query string', () => {
    const queryObject = {
      countries: {
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capitol: false,
      }
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{countries { id name capitol } }`
    );
  });

  test('inputs query object w/ only nested objects and outputs GQL query string', () => {
    const queryObject = {
      countries: {
        __type: 'countries',
        __alias: null,
        __args: {},
        cities: {
          __type: 'cities',
          __alias: null,
          __args: {},
          id: false,
          country_id: false,
          name: false,
          population: false,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{countries { cities { id country_id name population } } }`
    );
  });

  test('inputs query object w/ both scalar & object types and outputs GCL query string', () => {
    const queryObject = {
      countries: {
        __type: 'countries',
        __alias: null,
        __args: {},
        id: false,
        name: false,
        capitol: false,
        cities: {
          __type: 'cities',
          __alias: null,
          __args: {},
          id: false,
          country_id: false,
          name: false
        }
      }
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{countries { id name capitol cities { id country_id name } } }`
    );
  });

  test('inputs query object w/ an argument & w/ both scalar & object types should output GCL query string', () => {
    const queryObject = {
      country: {
        __type: 'country',
        __alias: null,
        __args: { id: 1 },
        id: false,
        name: false,
        capitol: false,
        cities: {
          __type: 'cities',
          __alias: null,
          __args: {},
          id: false,
          country_id: false,
          name: false,
          population: false
        },
      }
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{country(id: 1) { id name capitol cities { id country_id name population } } }`
    );
  });

  test('inputs query object w/ multiple arguments & w/ both scalar & object types should output GCL query string', () => {
    const queryObject = {
      country: {
        __type: 'country',
        __alias: null,
        __args: {
          name: "China", 
          capitol: "Beijing"
        },
        id: false,
        name: false,
        capital: false,
        cities: {
          __type: 'cities',
          __alias: null,
          __args: {},
          id: false,
          country_id: false,
          name: false,
          population: false,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{country(name: China, capitol: Beijing) { id name capital cities { id country_id name population } } }`
    );
  });

  test('inputs query object with alias should output GCL query string', () => {
    const queryObject = {
      country: {
        __type: 'country',
        __args: {id: 3},
        __alias: "Canada",
        id: false,
        cities: {
          __type: 'cities',
          __args: {},
          __alias: null,
          id: false,
          name: false,
        },
      }
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{Canada: country(id: 3) { id cities { id name } } }`
    );
  });

  test('inputs query object with multiple queries should output GCL query string', () => {
    const queryObject = {
      country: {
        __type: 'country',
        __args: { id: 1},
        __alias: null,
        id: false,
        name: false,
        cities: {
          __type: 'cities',
          __args: {},
          __alias: null,
          id: false,
          name: false,
        },
      },
      book: {
        __type: 'book',
        __args: { id: 2},
        __alias: null,
        id: false,
        title: false,
        author: {
          __type: 'author',
          id: false,
          name: false,
          __args: {},
          __alias: null,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{country(id: 1) { id name cities { id name } } book(id: 2) { id title author { id name } } }`
    );
  });

  test('deeply nested query object', () => {
    const queryObject = {
      countries: {
        id: true,
        __type: 'countries',
        __alias: null,
        __args: {},
        cities: {
          id: true,
          __type: 'cities',
          __alias: null,
          __args: {},
          attractions: {
            id: true,
            __type: 'attractions',
            __alias: null,
            __args: {},
            location: {
              id: true,
              __type: 'location',
              __alias: null,
              __args: {},
              latitude: {
                id: true,
                __type: 'latitude',
                __alias: null,
                __args: {},
                here: {
                  id: true,
                  __type: 'here',
                  __alias: null,
                  __args: {},
                  not: {
                    id: true,
                    __type: 'not',
                    __alias: null,
                    __args: {}
                  }
                }
              }
            }
          }
        }
      }
    };
    expect(createQueryStr(queryObject)).toEqual(
      `{countries { id cities { id attractions { id location { id latitude { id here { id not { id } } } } } } } }`
    );
  })
});
