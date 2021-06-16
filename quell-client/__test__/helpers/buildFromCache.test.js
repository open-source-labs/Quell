const buildFromCache = require('../../src/helpers/buildFromCache');

describe('buildFromCache.test.js', () => {
  // inputs: prototype object (which contains args), collection (defaults to an empty array)
  // outputs: protoype object with fields that were not found in the cache set to false 
  beforeAll(() => {
    sessionStorage.setItem('country--2', JSON.stringify({id: "2"})); 
    sessionStorage.setItem('country--3', JSON.stringify({id: "3"}));
    sessionStorage.setItem('country--1', JSON.stringify({id: "1", capitol: {id: "2", name: "DC"}}));
  })

  xtest('Basic query', () => {
    const testProto = {
      'country--1': {
        id: true,
        name: true,
        __alias: null,
        __args: { id: '1' },
        }
      };
    const endProto = {
      'country--1': {
        id: true,
        name: false,
        __alias: null,
        __args: { id: '1' },
        }
      };
    // we expect prototype after running through buildFromCache to have id has stayed true but every other field has been toggled to false (if not found in sessionStorage)
    expect(buildFromCache(testProto)).toEqual(endProto);
  });

  test('Multiple nested queries that include args and aliases', () => {
    const testProto = {
      'country--1': {
        id: true,
        name: true,
        __alias: 'Canada',
        __args: { id: '1' },
        capitol: {
          id: true,
          name: true,
          population: true,
          __alias: null,
          __args: {}
        }
      },
      'country--2': {
        id: true,
        name: true,
        __alias: 'Mexico',
        __args: { id: '2' },
        climate: { seasons: true, __alias: null, __args: {} }
      }
    }
    const endProto = {
      'country--1': {
        id: true,
        name: false,
        __alias: 'Canada',
        __args: { id: '1' },
        capitol: {
          id: true,
          name: true,
          population: false,
          __alias: null,
          __args: {}
        }
      },
      'country--2': {
        id: true,
        name: false,
        __alias: 'Mexico',
        __args: { id: '2' },
        climate: { seasons: false, __alias: null, __args: {} }
      }
    }
    // we expect prototype after running through buildFromCache to have id has stayed true but every other field has been toggled to false (if not found in sessionStorage)
    expect(buildFromCache(testProto)).toEqual(endProto);
  });
});
