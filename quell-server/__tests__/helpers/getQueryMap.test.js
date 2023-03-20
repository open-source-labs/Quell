/* eslint-disable no-undef */
const { getQueryMap } = require('../../src/quell');
const schema = require('../../test-config/testSchema');
const schemaWithoutMuts = require('../../test-config/testSchemaWithoutMuts');

describe('server side tests for getMutationMap', () => {
  afterAll((done) => {
    done();
  });
  test('Correctly returns valid mutations and their respective type based on schema', () => {
    expect(getMutationMap(schema)).toEqual({
      addBook: 'Book',
      changeBook: 'Book',
      addBookShelf: 'BookShelf',
      addCountry: 'Country',
      deleteCity: 'City'
    });
  });
  test('Returns empty object for schema without mutations', () => {
    expect(getMutationMap(schemaWithoutMuts)).toEqual({});
  });
});
