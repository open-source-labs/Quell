const createQueryStr = require('../../src/helpers/createQueryStr');

// NOTE: we changed the spacing on the results object, not sure if it matters?

describe('createQueryStr.js', () => {
  test('inputs query object w/ no values', () => {
    const queryObject = {};

    expect(createQueryStr(queryObject)).toEqual('');
  });

  test('inputs query object w/ only scalar types and outputs GQL query string', () => {
    const queryObject = {
      countries: {
        id: false,
        name: false,
        capitol: false,
        __alias: null,
        __args: {}
      }
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{countries { id name capitol } }`
    );
  });

  test('inputs query object w/ only nested objects and outputs GQL query string', () => {
    const queryObject = {
      countries: {
        cities: {
          id: false,
          country_id: false,
          name: false,
          population: false,
          __alias: null,
          __args: {}
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{countries { cities { id country_id name population } } }`
    );
  });

  test('inputs query object w/ both scalar & object types and outputs GQL query string', () => {
    const queryObject = {
      countries: {
        id: false, name: false, capitol: false,
        cities: {
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

  test('inputs query object w/ an argument & w/ both scalar & object types should output GQL query string', () => {
    const queryObject = {
      ['country--1']: {
        id: false,
        name: false,
        capitol: false,
        cities: {
          id: false,
          country_id: false,
          name: false,
          population: false
        },
        __args: { id: 1 },
        __alias: null
      }
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{country(id: 1) { id name capitol cities { id country_id name population } } }`
    );
  });

  test('inputs query object w/ multiple arguments & w/ both scalar & object types should output GQL query string', () => {
    const queryObject = {
      country: {
        id: false,
        name: false,
        capital: false,
        __args: {
          name: "China", 
          capitol: "Beijing"
        },
        __alias: null,
        cities: {
          id: false,
          country_id: false,
          name: false,
          population: false,
          __args: {},
          __alias: null,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{country(name: China, capitol: Beijing) { id name capital cities { id country_id name population } } }`
    );
  });

  test('inputs query object with alias should output GQL query string', () => {
    const queryObject = {
      ['country--3']: {
        id: false,
        cities: {
          id: false,
          name: false,
          __args: {},
          __alias: null,
        },
        __args: {id: 3},
        __alias: "Canada"
      }
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{Canada: country(id: 3) { id cities { id name } } }`
    );
  });

  test('inputs query object with multiple queries should output GQL query string', () => {
    const queryObject = {
      ['country--1']: {
        id: false,
        name: false,
        cities: {
          id: false,
          name: false,
          __args: {},
          __alias: null,
        },
        __args: { id: 1 },
        __alias: null,
      },
      ['book--2']: {
        id: false,
        title: false,
        author: {
          id: false,
          name: false,
          __args: {},
          __alias: null,
        },
        __args: { id: 2 },
        __alias: null,
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
        __alias: null,
        __args: {},
        cities: {
          id: true,
          __alias: null,
          __args: {},
          attractions: {
            id: true,
            __alias: null,
            __args: {},
            location: {
              id: true,
              __alias: null,
              __args: {},
              latitude: {
                id: true,
                __alias: null,
                __args: {},
                here: {
                  id: true,
                  __alias: null,
                  __args: {},
                  not: {
                    id: true,
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
