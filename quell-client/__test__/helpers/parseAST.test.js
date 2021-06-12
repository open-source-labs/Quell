const parseAST = require('../../src/helpers/parseAST');
const { parse } = require('graphql/language/parser');

describe('parseAST.js', () => {
  test('should traverses the abstract syntax tree and creates a prototype object', () => {
    const query = `query {
      countries {
        id
        name
        capital
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, protoArgs, operationType } = parseAST(parsedQuery);
    expect(proto).toEqual({
      countries: {
        id: true,
        name: true,
        capital: true,
      },
    });
  });

  test('should work with arguments', () => {
    const query = `query {
      countries(id: 1) {
        id
        name
        capital
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, protoArgs, operationType } = parseAST(parsedQuery);
    expect(proto).toEqual({
      countries: {
        id: true,
        name: true,
        capital: true,
      },
    });
    expect(protoArgs).toEqual({
      countries: {
        id: "1",
      }
    });
  });

  test('should work with nested query', () => {
    const query = `{
      countries { 
        id 
        name 
        capital 
        cities  { 
          id 
          country_id 
          name 
          population  
        } 
      } 
    }`;
    const parsedQuery = parse(query);
    const { proto, protoArgs, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      countries: {
        id: true,
        name: true,
        capital: true,
        cities: { id: true, country_id: true, name: true, population: true },
      },
    });
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
    const { proto, protoArgs, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      countries: { 
        id: true,
        name: true, 
        capital: true, 
      }, 
      book: {
        name: true,
        genre: true
      },
    });
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
    const { proto, protoArgs, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      countries: { 
        id: true,
        name: true, 
        cities: {
          name: true,
        }
      }, 
      book: {
        name: true,
        genre: true,
        similarBooks: {
          name: true,
        }
      },
    });
    expect(operationType).toBe('query');
});
});

