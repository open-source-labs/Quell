const QuellCache = require('../../src/quell.js');
const schema = require('../../test-config/testSchema');
const redisPort = 6379;
const timeout = 100;


describe('server side tests for createQueryStr.js', () => {
  const Quell = new QuellCache(schema, redisPort, timeout);

  afterAll((done) => {
    Quell.redisCache.flushall();
    Quell.redisCache.quit(() => {
      console.log('closing redis server');
      done();
    });
  });
  
  test('inputs query object w/ no values', () => {
    const queryObject = {};

    expect(Quell.createQueryStr(queryObject)).toEqual('');
  });

  test('inputs query object w/ only scalar types and outputs GQL query string', () => {
    const queryObject = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capitol: false,
      }
    };

    expect(Quell.createQueryStr(queryObject)).toEqual(
      `{ countries { id name capitol } }`
    );
  });

  test('inputs query object w/ only nested objects and outputs GQL query string', () => {
    const queryObject = {
      countries: {
        __id: null,
        __type: 'countries',
        __alias: null,
        __args: {},
        cities: {
          __id: null,
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

    expect(Quell.createQueryStr(queryObject)).toEqual(
      `{ countries { cities { id country_id name population } } }`
    );
  });

  test('inputs query object w/ both scalar & object types and outputs GQL query string', () => {
    const queryObject = {
      countries: {
        __id: null,
        __type: 'countries',
        __alias: null,
        __args: {},
        id: false,
        name: false,
        capitol: false,
        cities: {
          __id: null,
          __type: 'cities',
          __alias: null,
          __args: {},
          id: false,
          country_id: false,
          name: false
        }
      }
    };

    expect(Quell.createQueryStr(queryObject)).toEqual(
      `{ countries { id name capitol cities { id country_id name } } }`
    );
  });

  test('inputs query object w/ an argument & w/ both scalar & object types should output GQL query string', () => {
    const queryObject = {
      country: {
        __id: '1',
        __type: 'country',
        __alias: null,
        __args: { id: '1' },
        id: false,
        name: false,
        capitol: false,
        cities: {
          __id: null,
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

    expect(Quell.createQueryStr(queryObject)).toEqual(
      `{ country(id: 1) { id name capitol cities { id country_id name population } } }`
    );
  });

  test('inputs query object w/ multiple arguments & w/ both scalar & object types should output GQL query string', () => {
    const queryObject = {
      country: {
        __id: null,
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
          __id: null,
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

    expect(Quell.createQueryStr(queryObject)).toEqual(
      `{ country(name: China, capitol: Beijing) { id name capital cities { id country_id name population } } }`
    );
  });

  test('inputs query object with alias should output GQL query string', () => {
    const queryObject = {
      Canada: {
        __id: '3',
        __type: 'country',
        __args: {id: '3'},
        __alias: "Canada",
        id: false,
        cities: {
          __id: null,
          __type: 'cities',
          __args: {},
          __alias: null,
          id: false,
          name: false,
        },
      }
    };

    expect(Quell.createQueryStr(queryObject)).toEqual(
      `{ Canada: country(id: 3) { id cities { id name } } }`
    );
  });

  test('inputs query object with nested alias should output GQL query string', () => {
    const queryObject = {
      Canada: {
        __type: 'country',
        __args: {id: 3},
        __alias: 'Toronto',
        id: false,
        Toronto: {
          __type: 'city',
          __args: {id: 5},
          __alias: 'Toronto',
          id: false,
          name: false,
        },
      }
    };

    expect(Quell.createQueryStr(queryObject)).toEqual(
      `{ Canada: country(id: 3) { id Toronto: city(id: 5) { id name } } }`
    );
  });

  test('inputs query object with multiple queries should output GQL query string', () => {
    const queryObject = {
      country: {
        __id: '1',
        __type: 'country',
        __args: { id: '1' },
        __alias: null,
        id: false,
        name: false,
        cities: {
          __id: null,
          __type: 'cities',
          __args: {},
          __alias: null,
          id: false,
          name: false,
        },
      },
      book: {
        __id: '2',
        __type: 'book',
        __args: { id: '2' },
        __alias: null,
        id: false,
        title: false,
        author: {
          __id: null,
          __type: 'author',
          id: false,
          name: false,
          __args: {},
          __alias: null,
        },
      },
    };

    expect(Quell.createQueryStr(queryObject)).toEqual(
      `{ country(id: 1) { id name cities { id name } } book(id: 2) { id title author { id name } } }`
    );
  });

  test('deeply nested query object', () => {
    const queryObject = {
      countries: {
        id: true,
        __type: 'countries',
        __alias: null,
        __args: {},
        __id: null,
        cities: {
          id: true,
          __type: 'cities',
          __alias: null,
          __args: {},
          __id: null,
          attractions: {
            id: true,
            __type: 'attractions',
            __alias: null,
            __args: {},
            __id: null,
            location: {
              id: true,
              __type: 'location',
              __alias: null,
              __args: {},
              __id: null,
              latitude: {
                id: true,
                __type: 'latitude',
                __alias: null,
                __args: {},
                __id: null,
                here: {
                  id: true,
                  __type: 'here',
                  __alias: null,
                  __args: {},
                  __id: null,
                  not: {
                    id: true,
                    __type: 'not',
                    __alias: null,
                    __args: {},
                    __id: null,
                  }
                }
              }
            }
          }
        }
      }
    };
    expect(Quell.createQueryStr(queryObject)).toEqual(
      `{ countries { id cities { id attractions { id location { id latitude { id here { id not { id } } } } } } } }`
    );
  })
});
