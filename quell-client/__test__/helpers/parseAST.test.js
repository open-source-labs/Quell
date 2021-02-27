const parseAST = require('../../helpers/parseAST');
const { parse } = require('graphql/language/parser');

describe('parseAST.js', () => {
  test('should traverses the abstract syntax tree and creates a prototype object', () => {
    const query = `{countries { id name capital } }`;
    const AST = parse(query);
    const QuellStore = { arguments: null, alias: null };

    expect(parseAST(AST, QuellStore)).toEqual({
      countries: {
        id: true,
        name: true,
        capital: true,
      },
    });
  });

  test('should work with nested query', () => {
    const query = `{countries { id name capital cities  { id country_id name population  } } }`;
    const AST = parse(query);
    const QuellStore = { arguments: null, alias: null };

    expect(parseAST(AST, QuellStore)).toEqual({
      countries: {
        id: true,
        name: true,
        capital: true,
        cities: { id: true, country_id: true, name: true, population: true },
      },
    });
  });
});
