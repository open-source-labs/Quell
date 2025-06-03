import { createQueryObj, createQueryStr } from '../../src/helpers/quellHelpers';

describe("server side tests for createQueryStr.js", () => {
  test("inputs query object w/ no values", () => {
    const queryObject = {};

    expect(createQueryStr(queryObject)).toEqual("");
  });

  test("inputs query object w/ only scalar types and outputs GQL query string", () => {
    const queryObject = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: "countries",
        id: false,
        name: false,
        capitol: false,
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{ countries { id name capitol } }`
    );
  });

  test("inputs query object w/ only nested objects and outputs GQL query string", () => {
    const queryObject = {
      countries: {
        __id: null,
        __type: "countries",
        __alias: null,
        __args: {},
        cities: {
          __id: null,
          __type: "cities",
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
      `{ countries { cities { id country_id name population } } }`
    );
  });

  test("inputs query object w/ both scalar & object types and outputs GQL query string", () => {
    const queryObject = {
      countries: {
        __id: null,
        __type: "countries",
        __alias: null,
        __args: {},
        id: false,
        name: false,
        capitol: false,
        cities: {
          __id: null,
          __type: "cities",
          __alias: null,
          __args: {},
          id: false,
          country_id: false,
          name: false,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{ countries { id name capitol cities { id country_id name } } }`
    );
  });

  test("inputs query object w/ an argument & w/ both scalar & object types should output GQL query string", () => {
    const queryObject = {
      country: {
        __id: "1",
        __type: "country",
        __alias: null,
        __args: { id: "1" },
        id: false,
        name: false,
        capitol: false,
        cities: {
          __id: null,
          __type: "cities",
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
      `{ country(id: "1") { id name capitol cities { id country_id name population } } }`
    );
  });

  test("inputs query object w/ multiple arguments & w/ both scalar & object types should output GQL query string", () => {
    const queryObject = {
      country: {
        __id: null,
        __type: "country",
        __alias: null,
        __args: {
          name: "China",
          capitol:"Beijing",
        },
        id: false,
        name: false,
        capital: false,
        cities: {
          __id: null,
          __type: "cities",
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
      `{ country(name: "China", capitol: "Beijing") { id name capital cities { id country_id name population } } }`
    );
  });

  test("inputs query object with alias should output GQL query string", () => {
    const queryObject = {
      Canada: {
        __id: "3",
        __type: "country",
        __args: { id: "3" },
        __alias: "Canada",
        id: false,
        cities: {
          __id: null,
          __type: "cities",
          __args: {},
          __alias: null,
          id: false,
          name: false,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{ Canada: country(id: "3") { id cities { id name } } }`
    );
  });

  test("inputs query object with nested alias should output GQL query string", () => {
    const queryObject = {
      Canada: {
        __type: "country",
        __args: { id: 3 },
        __alias: "Toronto",
        id: false,
        Toronto: {
          __type: "city",
          __args: { id: 5 },
          __alias: "Toronto",
          id: false,
          name: false,
        },
      },
    };
    
    expect(createQueryStr(queryObject)).toEqual(
      `{ Canada: country(id: "3") { id Toronto: city(id: "5") { id name } } }`
    );
  });

  test("inputs query object with multiple queries should output GQL query string", () => {
    const queryObject = {
      country: {
        __id: "1",
        __type: "country",
        __args: { id: "1" },
        __alias: null,
        id: false,
        name: false,
        cities: {
          __id: null,
          __type: "cities",
          __args: {},
          __alias: null,
          id: false,
          name: false,
        },
      },
      book: {
        __id: "2",
        __type: "book",
        __args: { id: "2" },
        __alias: null,
        id: false,
        title: false,
        author: {
          __id: null,
          __type: "author",
          id: false,
          name: false,
          __args: {},
          __alias: null,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{ country(id: "1") { id name cities { id name } } book(id: "2") { id title author { id name } } }`
    );
  });

  test("deeply nested query object", () => {
    const queryObject = {
      countries: {
        id: true,
        __type: "countries",
        __alias: null,
        __args: {},
        __id: null,
        cities: {
          id: true,
          __type: "cities",
          __alias: null,
          __args: {},
          __id: null,
          attractions: {
            id: true,
            __type: "attractions",
            __alias: null,
            __args: {},
            __id: null,
            location: {
              id: true,
              __type: "location",
              __alias: null,
              __args: {},
              __id: null,
              latitude: {
                id: true,
                __type: "latitude",
                __alias: null,
                __args: {},
                __id: null,
                here: {
                  id: true,
                  __type: "here",
                  __alias: null,
                  __args: {},
                  __id: null,
                  not: {
                    id: true,
                    __type: "not",
                    __alias: null,
                    __args: {},
                    __id: null,
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(createQueryStr(queryObject)).toEqual(
      `{ countries { id cities { id attractions { id location { id latitude { id here { id not { id } } } } } } } }`
    );
  });
});

describe('server side tests for createQueryObj.js', () => {

  // TO-DO: Add the same test to the client side test folder
  test('inputs prototype w/ all true should output empty object', () => {
    const prototype = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: true,
        name: true,
        capitol: true,
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: true,
          country_id: true,
          name: true,
          population: true,
        },
      },
    };

    expect(createQueryObj(prototype)).toEqual({});
  });

  test('inputs prototype w/ only false scalar types should output same object', () => {
    const map = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capitol: false,
      },
    };

    expect(createQueryObj(map)).toEqual({

      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capitol: false,
      },
    });
  });

  test('inputs prototype w/ false for only scalar types should output object for scalar types only', () => {
    const map = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capitol: false,
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: true,
          country_id: true,
          name: true,
          population: true,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({

      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capitol: false,
      },
    });
  });

  test('inputs prototype w/ false for only object types should output object for object types only', () => {
    const map = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: true,
        name: true,
        capital: true,
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: false,
          country_id: false,
          name: false,
          population: false,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({
      countries: {
        id: false,
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: false,
          country_id: false,
          name: false,
          population: false,
        },
      },
    });
  });

  test('inputs prototype w/ true/false for both scalar & object types and outputs object for all false', () => {
    const map = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: true,
        name: false,
        capital: false,
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: true,
          country_id: false,
          name: true,
          population: false,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({

      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capital: false,
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: false,
          country_id: false,
          population: false,
        },
      },
    });
  });

  test('inputs prototype with multiple queries', () => {
    const map = {
      Canada: {
        __id: '1',
        __alias: 'Canada',
        __args: { id: '1' },
        __type: 'country',
        id: true,
        name: false,
        capitol: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'capitol',
          id: false,
          name: true,
          population: false,
        },
      },
      Mexico: {
        __id: '2',
        __alias: 'Mexico',
        __args: { id: '2' },
        __type: 'country',
        id: true,
        name: false,
        climate: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'climate',
          seasons: true,
          id: false,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({

      Canada: {
        __id: '1',
        __type: 'country',
        name: false,
        id: false,
        __alias: 'Canada',
        __args: { id: '1' },
        capitol: {
          id: false,
          population: false,
          __alias: null,
          __args: {},
          __type: 'capitol',
          __id: null,
        },
      },
      Mexico: {
        name: false,
        id: false,
        __alias: 'Mexico',
        __args: { id: '2' },
        __type: 'country',
        __id: '2',
      },
    });
  });

  test('test requests with multiple queries in which half of the request if managed by the cache and the other half is managed by the response', () => {
    const map = {
      Canada: {
        __id: '1',
        __alias: 'Canada',
        __args: { id: '1' },
        __type: 'country',
        id: true,
        name: true,
        capitol: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'capitol',
          id: true,
          name: true,
          population: true,
        },
      },
      WarBook: {
        __id: '2',
        __alias: 'WarBook',
        __args: { id: '10' },
        __type: 'book',
        id: false,
        name: false,
        author: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'author',
          id: false,
          name: false,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({

      WarBook: {
        __id: '2',
        __alias: 'WarBook',
        __args: { id: '10' },
        __type: 'book',
        id: false,
        name: false,
        author: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'author',
          name: false,
          id: false,
        },
      },
    });
  });
});

