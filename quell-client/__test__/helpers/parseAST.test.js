const parseAST = require('../../helpers/parseAST');
const { parse } = require('graphql/language/parser');

const query1 = `{countries { id name capital } }`;
const query2 = `{countries { id name capital cities  { id country_id name population  } } }`;
const AST1 = parse(query1);
const AST2 = parse(query2);
const QuellStore = { arguments: null, alias: null };

describe('parseAST.js', () => {
  test('should traverses the abstract syntax tree and creates a prototype object', () => {
    expect(parseAST(AST1, QuellStore)).toEqual({
      countries: {
        id: true,
        name: true,
        capital: true,
      },
    });
  });

  test('should work with nested query', () => {
    expect(parseAST(AST2, QuellStore)).toEqual({
      countries: {
        id: true,
        name: true,
        capital: true,
        cities: { id: true, country_id: true, name: true, population: true },
      },
    });
  });
});
