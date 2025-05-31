/* eslint-disable no-undef */
import { getQueryMap } from '../../src/helpers/quellHelpers';
import schema from '../../test-config/testSchema';
import schemaWithoutQueries from '../../test-config/testSchemaWithoutQueries';

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
