/* eslint-disable no-undef */
const { normalizeForCache2 } = require('../../src/helpers/quellHelpers');

describe('server side tests for normalizeForCache2', () => {
  beforeEach((done) => {
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
    const unNormalizedResponse = {
      artist: [
        {
          id: '6365be1ff176b90f3b81f0e9',
          name: 'Frank Ocean',
          albums: [
            { id: '6359930abeb03be432d17785', name: 'Channel Orange' },
            { id: '63599379beb03be432d17786', name: 'Blonde' }
          ]
        }
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
    expect(normalizeForCache2(unNormalizedResponse, map)).toEqual({
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
    });
  });
  test('Correctly returns a normalized version of the query response for deeply nested objects', () => {
    const unNormalizedResponse = {
      country: [
        {
          id: '6365be1ff176b90f3b81f0e9',
          name: 'United States',
          cities: [
            {
              id: '6359930abeb03be432d17785',
              name: 'Los Angeles',
              attractions: [
                { id: '6359930abeb03be432lasdbf', name: 'Hollywood' }
              ]
            },
            {
              id: '63599379beb03be432d17786',
              name: 'San Francisco',
              attractions: [
                {
                  id: '6359930abeb03be432lasdfvzxc',
                  name: 'Golden Gate Bridge'
                }
              ]
            }
          ]
        }
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
    expect(normalizeForCache2(unNormalizedResponse, map)).toEqual({
      '6365be1ff176b90f3b81f0e9': {
        id: '6365be1ff176b90f3b81f0e9',
        name: 'United States',
        cities: [
          { _ref: '6359930abeb03be432d17785' },
          { _ref: '63599379beb03be432d17786' }
        ]
      },
      '6359930abeb03be432d17785': {
        id: '6359930abeb03be432d17785',
        name: 'Los Angeles',
        attractions: [{ _ref: '6359930abeb03be432lasdbf' }]
      },
      '63599379beb03be432d17786': {
        id: '63599379beb03be432d17786',
        name: 'San Francisco',
        attractions: [{ _ref: '6359930abeb03be432lasdfvzxc' }]
      },
      '6359930abeb03be432lasdbf': {
        id: '6359930abeb03be432lasdbf',
        name: 'Hollywood'
      },
      '6359930abeb03be432lasdfvzxc': {
        id: '6359930abeb03be432lasdfvzxc',
        name: 'Golden Gate Bridge'
      }
    });
  });
});
