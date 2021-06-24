const QuellCache = require('../../src/quell.js');
const schema = require('../../test-config/testSchema');
const { parse } = require('graphql/language/parser');
// const parseAST = require('../../../helpers/parseAST');

const redisPort = 6379;
const timeout = 100;
const Quell = new QuellCache(schema, redisPort, timeout);

// const Quell = new QuellCache
// const { proto, protoArgs, operationType } Quell.parseAST();


describe('server tests for parseAST.js', () => {

  const Quell = new QuellCache(schema, redisPort, timeout);
  
  beforeAll(() => {
    const promise1 = new Promise((resolve, reject) => {
      resolve(Quell.writeToCache('country--1', {id: "1", capitol: {id: "2", name: "DC"}}));
    });
    const promise2 = new Promise((resolve, reject) => {
      resolve(Quell.writeToCache('country--2', {id: "2"}));
    }); 
    const promise3 = new Promise((resolve, reject) => {
      resolve(Quell.writeToCache('country--3', {id: "3"}));
    });
    const promise4 = new Promise((resolve, reject) => {
      resolve(Quell.writeToCache('countries', ['country--1', 'country--2', 'country--3']));
    });
    return Promise.all([promise1, promise2, promise3, promise4]);
  })

  afterAll(() => Quell.redisCache.quit(() => console.log('closing redis server')));

  xtest('should traverse the abstract syntax tree and create a prototype object', () => {
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
        __alias: null,
        __type: 'countries'
      },
    });
    expect(operationType).toBe('query');
  });

  xtest('should work with nested query', () => {
  });

  xtest('should work for multiple queries on one query string', () => {
  
  });
});
