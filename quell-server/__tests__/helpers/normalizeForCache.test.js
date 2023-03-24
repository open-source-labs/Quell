/* eslint-disable no-undef */
const { normalizeForCache2 } = require('../../src/helpers/quellHelpers');

describe('server side tests for normalizeForCache2', () => {
  afterAll((done) => {
    done();
  });
  test('Correctly returns a normalized version of the query response with proper references for nested objects', () => {
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
