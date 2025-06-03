/* eslint-disable no-undef */
import { getMutationMap } from '../../src/helpers/quellHelpers';
import schema from '../../test-config/testSchema';
import schemaWithoutMuts from '../../test-config/testSchemaWithoutMuts';

describe('server side tests for getMutationMap', () => {
  afterAll((done) => {
    done();
  });
  test('Correctly returns valid mutations and their respective type based on schema', () => {
    expect(getMutationMap(schema)).toEqual({
      addBook: 'Book',
      changeBook: 'Book',
      addBookShelf: 'BookShelf',
      addCountry: 'Country', // Not found in testSchema?
      // deleteCity: 'City' // Not found in testSchema?
    });
  });
  test('Returns empty object for schema without mutations', () => {
    expect(getMutationMap(schemaWithoutMuts)).toEqual({});
  });
});
