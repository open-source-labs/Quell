const QuellCache = require('../../src/quell.js');
const schema = require('../test-config/testSchema');

const redisPort = 6379;
const timeout = 100;

describe('buildFromCache.test.js', () => {
  // inputs: prototype object (which contains args), collection (defaults to an empty array)
  // outputs: protoype object with fields that were not found in the cache set to false 
  beforeAll(() => {
    const Quell = new QuellCache(schema, redisPort, timeout);
    Quell.writeToCache('country--1', JSON.stringify({id: "1", capitol: {id: "2", name: "DC"}}));
    Quell.writeToCache('country--2', JSON.stringify({id: "2"})); 
    Quell.writeToCache('country--3', JSON.stringify({id: "3"}));
    // sessionStorage.setItem('countries', JSON.stringify(['country--1', 'country--2', 'country--3']));
  })

  test('Basic query', () => {
    const testProto = {
      country: {
        id: true,
        name: true,
        __alias: null,
        __args: { id: '3' },
        __type: 'country',
        }
      };
    const endProto = {
      country: {
        id: true,
        name: false,
        __alias: null,
        __args: { id: '3' },
        __type: 'country',
        }
      };
    const expectedResponseFromCache = {
      data: {
        country: {
          'id': '3'
        }
      }
    }
    const prototypeKeys = Object.keys(testProto); 
    const responseFromCache = buildFromCache(testRedis, testProto, prototypeKeys);
    // we expect prototype after running through buildFromCache to have id has stayed true but every other field has been toggled to false (if not found in sessionStorage)
    expect(testProto).toEqual(endProto);
    expect(responseFromCache).toEqual(expectedResponseFromCache);
  });

  xtest('Multiple nested queries that include args and aliases', () => {
    const testProto = {
      Canada: {
        id: true,
        name: true,
        __alias: 'Canada',
        __args: { id: '1' },
        __type: 'country',
        capitol: {
          id: true,
          name: true,
          population: true,
          __alias: null,
          __args: {},
          __type: 'capitol',
        }
      },
      Mexico: {
        id: true,
        name: true,
        __alias: 'Mexico',
        __args: { id: '2' },
        __type: 'country',
        climate: {
          seasons: true,
          __alias: null,
          __args: {},
          __type: 'climate',
        }
      }
    }
    const endProto = {
      Canada: {
        id: true,
        name: false,
        __alias: 'Canada',
        __args: { id: '1' },
        __type: 'country',
        capitol: {
          id: true,
          name: true,
          population: false,
          __alias: null,
          __args: {},
          __type: 'capitol',
        }
      },
      Mexico: {
        id: true,
        name: false,
        __alias: 'Mexico',
        __args: { id: '2' },
        __type: 'country',
        climate: {
          seasons: false,
          __alias: null,
          __args: {}
        }
      }
    }
    const expectedResponseFromCache = {
      data: {
        Canada: {
          id: '1',
          capitol: {
            id: '2',
            name: 'DC'
          }
        },
        Mexico: {
          id: '2'
        }
      }
    };
    const prototypeKeys = Object.keys(testProto); 
    const responseFromCache = buildFromCache(testProto, prototypeKeys);
    expect(testProto).toEqual(endProto);
    expect(responseFromCache).toEqual(expectedResponseFromCache);
  });

  test('Countries test', () => {
    const testProto = {
      countries: {
        id: true,
        name: true,
        __alias: null,
        __args: {},
        __type: 'countries',
      }
    }
    const endProto = {
      countries: {
        id: true,
        name: false, 
        __alias: null,
        __args: {},
        __type: 'countries',
      },
    }
    const expectedResponseFromCache = {
      data: {
        countries: [
          {
            "id": "1"
          },
          {
            "id": "2"
          },
          {
            "id": "3"
          }
        ]
      }
    };
    const prototypeKeys = Object.keys(testProto); 
    const responseFromCache = buildFromCache(testProto, prototypeKeys);
    expect(testProto).toEqual(endProto);
    expect(responseFromCache).toEqual(expectedResponseFromCache);
  });
});
