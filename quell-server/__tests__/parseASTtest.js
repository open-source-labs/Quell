const QuellCache = require('../src/quell.js');
const schema = require('./test-config/testSchema');
const { parse } = require('graphql/language/parser');

const redisPort = 6379;
const timeout = 100;
const Quell = new QuellCache(schema, redisPort, timeout);

// const Quell = new QuellCache
// const { proto, protoArgs, operationType } Quell.parseAST();


describe('parseAST.js', () => {

  beforeAll(() => {
    const Quell = new QuellCache(schema, redisPort, timeout);
  });

  test('should traverses the abstract syntax tree and creates a prototype object', () => {
    const query = `query { countries { id name capitol } }`;

    const AST = parse(query);
    const { proto, protoArgs, operationType } = Quell.parseAST(AST);

    expect(proto).toEqual({
      countries: {
        id: true,
        name: true,
        capitol: true,
      },
    })
  });

  test('should work with nested query', () => {
  });

  test('should work for multiple queries on one query string', () => {
  
  });
});
