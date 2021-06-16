const parseAST = require('../../src/helpers/parseAST');
const { parse } = require('graphql/language/parser');

xdescribe('parseAST.js', () => {
  test('should traverse the abstract syntax tree and create a prototype object', () => {
    const query = `query {
      countries {
        id
        name
        capital
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
        __alias: null
      },
    });
  });

  test('should work with arguments', () => {
    const query = `query {
      countries(id: 1) {
        id
        name
        capitol
      }
    }`;
    const parsedQuery = parse(query);
    const { prototype, operationType } = parseAST(parsedQuery);
    expect(prototype).toEqual({
      ['countries--1']: {
        id: true,
        name: true,
        capitol: true,
        __args: { id: "1" },
        __alias: null
      },
    });
    expect(operationType).toEqual('query');
  });

  test('should return a prototype from a nested query', () => {
    const query = `{countries { id name capital cities  { id country_id name population  } } }`;
    const AST = parse(query);
    const { prototype, operationType } = parseAST(AST);


    expect(prototype).toEqual({
      countries: {
        id: true,
        name: true,
        capital: true,
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

  test('should return arguments on prototype', () => {
    const query = `{ country (id: 1) { id name population } }`;
    const AST = parse(query);
    const { prototype, operationType } = parseAST(AST);

    expect(prototype).toEqual({
      ['country--1']: {
        id: true,
        name: true,
        population: true,
        __args: { id: "1" },
        __alias: null
      }
    });
    expect(operationType).toEqual('query');
  });

  test('should work with alias', () => {
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
});

