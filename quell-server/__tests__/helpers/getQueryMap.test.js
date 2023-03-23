/* eslint-disable no-undef */
const { getQueryMap } = require('../../src/quell');
const schema = require('../../test-config/testSchema');
const schemaWithoutQueries = require('../../test-config/testSchemaWithoutQueries');

describe('server side tests for getQueryMap', () => {
  afterAll((done) => {
    done();
  });
  test('Correctly returns valid queries and their respective type based on schema', () => {
    expect(getQueryMap(schema)).toEqual({
      book: 'Book',
      bookShelf: 'BookShelf',
      bookShelves: ['BookShelf'],
      books: ['Book'],
      cities: ['City'],
      citiesByCountry: ['City'],
      city: 'City',
      countries: ['Country'],
      country: 'Country'
    });
  });
  test('Returns empty object for schema without queries', () => {
    expect(getQueryMap(schemaWithoutQueries)).toEqual({});
  });
});
