/* eslint-disable no-undef */
const { parseAST } = require('../../src/helpers/quellHelpers');
const { parse } = require('graphql/language/parser');

describe('server tests for Quell.parseAST.js', () => {
  // beforeAll(() => {
  //   const promise1 = (resolve, reject) => {
  //     resolve(
  //       Quell.writeToCache('country--1', {
  //         id: '1',
  //         capitol: { id: '2', name: 'DC' }
  //       })
  //     );
  //   };
  //   const promise2 = (resolve, reject) => {
  //     resolve(Quell.writeToCache('country--2', { id: '2' }));
  //   };
  //   const promise3 = (resolve, reject) => {
  //     resolve(Quell.writeToCache('country--3', { id: '3' }));
  //   };
  //   const promise4 = (resolve, reject) => {
  //     resolve(
  //       Quell.writeToCache('countries', [
  //         'country--1',
  //         'country--2',
  //         'country--3'
  //       ])
  //     );
  //   };
  //   return [promise1, promise2, promise3, promise4];
  // });

  // afterAll((done) => {
  //   Quell.redisCache.flushAll();
  //   Quell.redisCache.quit(() => {
  //     done();
  //   });
  // });

  test('should traverse the abstract syntax tree and create a proto object', () => {
    // define a query string
    const query = `query {
      countries {
        id
        name
        capitol
      }
    }`;
    // parse query, and parse AST
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    // compare expected proto & operation Type to actual
    expect(proto).toEqual({
      countries: {
        id: true,
        name: true,
        capitol: true,
        __args: null,
        __alias: null,
        __type: 'countries',
        __id: null
      }
    });
    expect(operationType).toBe('query');
  });

  test('should return a proto from a nested query', () => {
    const query = `query {
      countries {
         id
         name
         capitol
         cities {
            id
            country_id
            name
            population
          }
        }
      }`;

    const AST = parse(query);
    const { proto, operationType } = parseAST(AST);

    expect(proto).toEqual({
      countries: {
        __type: 'countries',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        capitol: true,
        cities: {
          __type: 'cities',
          __args: null,
          __alias: null,
          __id: null,
          id: true,
          country_id: true,
          name: true,
          population: true
        }
      }
    });
    expect(operationType).toEqual('query');
  });

  test('should work with multiple arguments', () => {
    const query = `query {
      country(id: 1, name: "USA") {
        id
        name
        capitol
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      country: {
        __type: 'country',
        __args: { id: '1', name: 'USA' },
        __alias: null,
        __id: '1',
        id: true,
        name: true,
        capitol: true
      }
    });
    expect(operationType).toEqual('query');
  });

  test('should create proto that stores alias information', () => {
    const query = `{
      Canada: country (id: 1) {
        id
        name
        capitol
      }
  }`;
    const AST = parse(query);
    const { proto, operationType } = parseAST(AST);

    expect(proto).toEqual({
      Canada: {
        __type: 'country',
        __args: { id: '1' },
        __alias: 'Canada',
        __id: '1',
        id: true,
        name: true,
        capitol: true
      }
    });
    expect(operationType).toEqual('query');
  });

  test('should reject query without id for', () => {
    const query = `{
      countries { 
        id 
        name 
        capital 
      } 
      book {
        name
        genre
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      countries: {
        __type: 'countries',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        capital: true
      }
    });
    expect(operationType).toEqual('noID');
  });

  test('should create proto object for multiple queries', () => {
    const query = `{
      countries { 
        id 
        name 
        capital 
      } 
      book {
        id
        name
        genre
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      countries: {
        __type: 'countries',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        capital: true
      },
      book: {
        __type: 'book',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        genre: true
      }
    });
    expect(operationType).toEqual('query');
  });

  test('should create proto object for multiple nested queries', () => {
    const query = `{
      countries { 
        id 
        name 
        cities {
          id
          name
        } 
      } 
      book {
        id
        name
        genre
        similarBooks {
          id
          name
        }
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      countries: {
        __type: 'countries',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        cities: {
          __type: 'cities',
          __args: null,
          __alias: null,
          __id: null,
          name: true,
          id: true
        }
      },
      book: {
        __type: 'book',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        genre: true,
        similarBooks: {
          __type: 'similarbooks',
          __args: null,
          __alias: null,
          __id: null,
          name: true,
          id: true
        }
      }
    });
    expect(operationType).toBe('query');
  });

  test('should create proto for query with nested arguments', () => {
    const query = `query {
      country(id: 1) {
        id
        name
        city(id: 2) {
          id
          name
        }
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      country: {
        __type: 'country',
        __args: { id: '1' },
        __alias: null,
        __id: '1',
        id: true,
        name: true,
        city: {
          __type: 'city',
          __args: { id: '2' },
          __alias: null,
          __id: '2',
          id: true,
          name: true
        }
      }
    });
    expect(operationType).toBe('query');
  });

  test('EDGE- should create proto for query with alias even without arguments', () => {
    const query = `query {
      Canada: country {
        id
        name
      }
    }`;

    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      Canada: {
        __type: 'country',
        __args: null,
        __alias: 'Canada',
        __id: null,
        id: true,
        name: true
      }
    });
    expect(operationType).toBe('query');
  });

  test('should create proto for query with nested aliases & arguments', () => {
    const query = `query { 
      countries {
        id
        name
        Toronto: city(id: 1) {
          id
          name
          IceCream: food(id: 2) {
            id
            name
            nutrition(id: 3) {
              id
              calories,
              protein,
              fat,
              carbs
            }
          }
        }
      }
    }`;

    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      countries: {
        __type: 'countries',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        Toronto: {
          __type: 'city',
          __args: { id: '1' },
          __alias: 'Toronto',
          __id: '1',
          id: true,
          name: true,
          IceCream: {
            __type: 'food',
            __args: { id: '2' },
            __alias: 'IceCream',
            __id: '2',
            id: true,
            name: true,
            nutrition: {
              __type: 'nutrition',
              __args: { id: '3' },
              __alias: null,
              __id: '3',
              id: true,
              calories: true,
              protein: true,
              fat: true,
              carbs: true
            }
          }
        }
      }
    });
    expect(operationType).toBe('query');
  });
});
