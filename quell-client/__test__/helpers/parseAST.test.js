const parseAST = require('../../src/helpers/parseAST');
const { parse } = require('graphql/language/parser');

xdescribe('parseAST.js', () => {
  test('should traverse the abstract syntax tree and create a prototype object', () => {
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
    const { prototype, operationType } = parseAST(parsedQuery);

    // compare expected prototype & operation Type to actual
    expect(prototype).toEqual({
      countries: {
        id: true,
        name: true,
        capitol: true,
        __args: null,
        __alias: null
      },
    });
    expect(operationType).toBe('query');
  });

  test('should return a prototype from a nested query', () => {
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
    const { prototype, operationType } = parseAST(AST);


    expect(prototype).toEqual({
      countries: {
        id: true,
        name: true,
        capitol: true,
        cities: { 
          id: true, 
          country_id: true, 
          name: true, 
          population: true, 
          __args: null,
        __alias: null
      },
        __args: null,
        __alias: null
      },
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
    const { prototype, operationType } = parseAST(parsedQuery);
    expect(prototype).toEqual({
      ['country--1']: {
        id: true,
        name: true,
        capitol: true,
        __args: { id: "1", name: "USA" },
        __alias: null
      },
    });
    expect(operationType).toEqual('query');
  });

  test('should create prototype that stores alias information', () => {
    const query = `{
      Canada: country (id: 1) {
        id
        name
        capitol
      }
  }`;
    const AST = parse(query);
    const { prototype, operationType } = parseAST(AST);

    expect(prototype).toEqual({
      ['country--1']: {
        id: true,
        name: true,
        capitol: true,
        __args: { id: "1" },
        __alias: 'Canada',
      }
    });
    expect(operationType).toEqual('query');
  });

  test('should create prototype object for multiple queries', () => {
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
    const { prototype, operationType } = parseAST(parsedQuery);

    expect(prototype).toEqual({
      countries: { 
        id: true,
        name: true, 
        capital: true,
        __args: null,
        __alias: null,
      }, 
      book: {
        name: true,
        genre: true,
        __args: null,
        __alias: null,
      },
    });
    expect(operationType).toEqual('query');
  });

  test('should create prototype object for multiple nested queries', () => {
    const query = `{
      countries { 
        id 
        name 
        cities {
          name
        } 
      } 
      book {
        name
        genre
        similarBooks {
          name
        }
      }
    }`;
    const parsedQuery = parse(query);
    const { prototype, operationType } = parseAST(parsedQuery);

    expect(prototype).toEqual({
      countries: { 
        id: true,
        name: true,
        __args: null,
        __alias: null,
        cities: {
          name: true,
          __args: null,
          __alias: null,
        }
      }, 
      book: {
        name: true,
        genre: true,
        __args: null,
        __alias: null,
        similarBooks: {
          name: true,
          __args: null,
          __alias: null,
        }
      },
    });
    expect(operationType).toBe('query');
  });

  test('should create prototype for query with nested arguments', () => {
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
    const { prototype, operationType } = parseAST(parsedQuery);

    expect(prototype).toEqual({
      ['country--1']: { 
        id: true,
        name: true,
        __args: { id: '1'},
        __alias: null,
        ['city--2']: {
          id: true,
          name: true,
          __args: { id: '2'},
          __alias: null,
        },
      },
    });
    expect(operationType).toBe('query');
  });

  test('EDGE- should create prototype for query with alias even without arguments', () => {
    const query = `query {
      Canada: country {
        id
        name
      }
    }`;

    const parsedQuery = parse(query);
    const { prototype, operationType } = parseAST(parsedQuery);

    expect(prototype).toEqual({
      country: {
        id: true,
        name: true,
        __args: null,
        __alias: 'Canada'
      }
    });
    expect(operationType).toBe('query');
  });

  test('should create prototype for query with nested aliases & arguments', () => {
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
    const { prototype, operationType } = parseAST(parsedQuery);

    expect(prototype).toEqual({
      countries: {
        id: true,
        name: true,
        __args: null,
        __alias: null,
        ['city--1']: {
          id: true,
          name: true,
          __args: { id: '1' },
          __alias: 'Toronto',
          ['food--2']: {
            id: true,
            name: true,
            __args: { id: '2' },
            __alias: 'IceCream',
            ['nutrition--3']: {
              calories: true,
              protein: true,
              fat: true,
              carbs: true,
              __args: { id: '3' },
              __alias: null
            }
          }
        }
      }
    });
    expect(operationType).toBe('query');
  });

  test('should add type-specific options to prototype when supplied', () => {
    const query = `query {
      country(id: 1, name: "USA", __cacheTime: 1000) {
        id
        name
        capitol
      }
    }`;
    const parsedQuery = parse(query);
    const { prototype, operationType } = parseAST(parsedQuery);
    expect(prototype).toEqual({
      ['country--1']: {
        id: true,
        name: true,
        capitol: true,
        __args: { id: "1", name: "USA" },
        __alias: null,
        __cacheTime: "1000",
      },
    });
    expect(operationType).toEqual('query');
  });

  // currently fails
  test('should create prototype for query with fragments', () => {
    const query = `query { 
      Canada: country {
        id
        name
        ...fragment
      }
    }
    fragment CountryInfo on Country {
      capitol,
      population
    }`;

    const parsedQuery = parse(query);
    const { prototype, operationType } = parseAST(parsedQuery);

    expect(prototype).toEqual({
      country: {
        id: true,
        name: true,
        capitol: true,
        population: true,
        __args: null,
        __alias: 'Canada'
      }
    });
    expect(operationType).toBe('query');
  });
});

