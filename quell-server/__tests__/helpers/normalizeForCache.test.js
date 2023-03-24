/* eslint-disable no-undef */
const { normalizeForCache2 } = require('../../src/helpers/quellHelpers');

describe('server side tests for normalizeForCache2', () => {
  beforeEach((done) => {
    const unNormalizedResponse = {
      id: '6365be1ff176b90f3b81f0e9',
      name: 'Frank Ocean',
      albums: [
        { id: '6359930abeb03be432d17785', name: 'Channel Orange' },
        { id: '63599379beb03be432d17786', name: 'Blonde' }
      ]
    };
    const map = {
      song: 'Song',
      album: 'Album',
      artist: ['Artist'],
      country: 'Country',
      city: 'City',
      attractions: 'Attractions'
    };
    const idCache = {
      '6365be1ff176b90f3b81f0e9': {
        id: '6365be1ff176b90f3b81f0e9',
        name: 'Frank Ocean',
        albums: [
          { _ref: '6359930abeb03be432d17785' },
          { _ref: '63599379beb03be432d17786' }
        ]
      },
      '6359930abeb03be432d17785': {
        id: '6359930abeb03be432d17785',
        name: 'Channel Orange'
      },
      '63599379beb03be432d17786': {
        id: '63599379beb03be432d17786',
        name: 'Blonde'
      }
    };
    done();
  });
  afterAll((done) => {
    done();
  });
  test('Correctly returns a normalized version of the query response with proper references for nested objects', () => {
    expect(normalizeForCache2(unNormalizedResponse, map)).toEqual({
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
