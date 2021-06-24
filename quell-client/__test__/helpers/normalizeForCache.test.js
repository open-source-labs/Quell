const normalizeForCache = require('../../src/helpers/normalizeForCache');

// normalizeForCache does not return any values, rather writes to the cache
// way to mock sessionStorage like in buildFromCache tests?

describe('normalizeForCache.test.js', () => {
  // inputs: response data object
  // outputs: none, but values should be on session storage when done 
  beforeEach(() => {
    sessionStorage.clear();
  })

  test('Basic response, with no arrays or nested objects', () => {
    const objBasic = {
      "country": {
        "id": 2,
        "name": "Bolivia"
      }
    };

    const protoObj = {
      country: {
        "id": true,
        "name": true,
        __id: '2',
        __args: null,
        __alias: null,
        __type: 'country',
      }
    };

    // normalize object & set on cache
    normalizeForCache(objBasic, {}, protoObj);
    // make sure object is on cache
    expect(sessionStorage.getItem('country--2')).toEqual(
      "{\"id\":2,\"name\":\"Bolivia\"}"
    );
  });

  test('nested response should produce individual values for both queries inside of it', () => {
    const nestedObj = {
      "country": {
        "id": 2,
        "name": "Bolivia",
        "city": {
          "id": 1,
          "name": "Los Angeles",
        },
      },
    };

    const nestedProto = {
      country: {
        id: true,
        name: true,
        __id: '2',
        __args: null,
        __alias: null,
        __type: 'country',
        city: {
          id: true,
          name: true,
          __id: '1',
          __args: null,
          __alias: null,
          __type: 'city',
        }
      }
    }
    
    normalizeForCache(nestedObj, 'map', nestedProto);

    expect(sessionStorage.getItem('country--2')).toEqual(
      "{\"id\":2,\"name\":\"Bolivia\",\"city\":{\"id\":1,\"name\":\"Los Angeles\"}}"
    );
    expect(sessionStorage.getItem('city--1')).toEqual(
      "{\"id\":1,\"name\":\"Los Angeles\"}"
    )
  });

  test('deeply nested response should produce individual values for all queries on response', () => {
    const deeplyNestedObj = {
      country: {
        id: 1,
        name: "USA",
        state: {
          id: 2,
          name: "California",
          county: {
            id: 3,
            name: "Los Angeles",
            city: {
              id: 4,
              name: "Los Angeles",
              mayor: {
                id: 5,
                name: "Shana",
                hobby: {
                  id: 6,
                  name: "Bigfoot Hunting"
                }
              }
            }
          }
        },
      },
    };

    const deeplyNestedProto = {
      country: {
        id: true,
        name: true,
        __id: '1',
        __args: null,
        __alias: null,
        __type: 'country',
        state: {
          id: true,
          name: true,
          __id: '2',
          __args: null,
          __alias: null,
          __type: 'state',
          county: {
            id: true,
            name: true,
            __id: '3',
            __args: null,
            __alias: null,
            __type: 'county',
            city: {
              id: true,
              name: true,
              __id: '4',
              __args: null,
              __alias: null,
              __type: 'city',
              mayor: {
                id: true,
                name: true,
                __id: '5',
                __args: null,
                __alias: null,
                __type: 'mayor',
                hobby: {
                  id: true,
                  name: true,
                  __id: '6',
                  __args: null,
                  __alias: null,
                  __type: 'hobby',
                }
              }
            }
          }
        }
      }
    };
    
    normalizeForCache(deeplyNestedObj, 'map', deeplyNestedProto);

    expect(sessionStorage.getItem('country--1')).toEqual(
      JSON.stringify({
        id: 1,
        name: 'USA',
        state: {
          id: 2,
          name: 'California',
          county: {
            id: 3,
            name: 'Los Angeles',
            city: {
              id: 4, name: 'Los Angeles',
              mayor: {
                id: 5,
                name: 'Shana',
                hobby: {
                  id: 6,
                  name: 'Bigfoot Hunting'
                }
              }
            }
          }
        }
      })
    );
    expect(sessionStorage.getItem('state--2')).toEqual(
      JSON.stringify({
        id: 2,
        name: 'California',
        county: {
          id: 3,
          name: 'Los Angeles',
          city: {
            id: 4, name: 'Los Angeles',
            mayor: {
              id: 5,
              name: 'Shana',
              hobby: {
                id: 6,
                name: 'Bigfoot Hunting'
              }
            }
          }
        }
      })
    );
    expect(sessionStorage.getItem('county--3')).toEqual(
      JSON.stringify({
        id: 3,
        name: 'Los Angeles',
        city: {
          id: 4,
          name: 'Los Angeles',
          mayor: {
            id: 5,
            name: 'Shana',
            hobby: {
              id: 6,
              name: 'Bigfoot Hunting'
            }
          }
        }
      })
    );
    expect(sessionStorage.getItem('city--4')).toEqual(
      JSON.stringify({
        id: 4,
        name: 'Los Angeles',
        mayor: { id: 5, name: 'Shana', hobby: { id: 6, name: 'Bigfoot Hunting' } }
      })
    );
    expect(sessionStorage.getItem('mayor--5')).toEqual(
      JSON.stringify({ id: 5, name: 'Shana', hobby: { id: 6, name: 'Bigfoot Hunting' } })
    );
    expect(sessionStorage.getItem('hobby--6')).toEqual(
      JSON.stringify({ id: 6, name: 'Bigfoot Hunting' })
    );
  });

  test('individual items on same response object should be cached individually', () => {
    const multipleRes = {
      country: {
        id: 3,
        name: "Portugal",
        cuisine: "Delicious"
      },
      book: {
        id: 10,
        title: "Axiom's End",
        author: "Lindsay Ellis"
      }
    };

    const protoObj = {
      country: {
        id: true,
        name: true,
        cuisine: true,
        __id: '3',
        __args: null,
        __alias: null,
        __type: 'country',
      },
      book: {
        __id: '10',
        __args: null,
        __alias: null,
        __type: 'book',
        id: true,
        title: true,
        author: true
      }
    }

    normalizeForCache(multipleRes, {}, protoObj);

    expect(sessionStorage.getItem('country--3')).toEqual(
      JSON.stringify({
        id: 3,
        name: "Portugal",
        cuisine: "Delicious"
      })
    );
    expect(sessionStorage.getItem('book--10')).toEqual(
      JSON.stringify({
        id: 10,
        title: "Axiom's End",
        author: "Lindsay Ellis"
      })
    );
  });

  test('a response array should cache an array of refs along with information on individual elements', () => {
    const responseObj = {
      "countries": [
        {
          "id": 1,
          "name": "Andorra",
        },
        {
          "id": 2,
          "name": "Bolivia"
        }
      ]
    };

    const prototype = {
      countries: {
        id: true,
        name: true,
        __id: null,
        __args: null,
        __alias: null,
        __type: 'countries',
      }
    };
    
    const map = {
      countries: 'country',
    };

    normalizeForCache(responseObj, map, prototype);

    expect(sessionStorage.getItem('countries')).toEqual(
      JSON.stringify(['country--1', 'country--2'])
    );
    expect(sessionStorage.getItem('country--1')).toEqual(
      JSON.stringify({
        "id": 1,
        "name": "Andorra",
      })
    );
    expect(sessionStorage.getItem('country--2')).toEqual(
      JSON.stringify({
        "id": 2,
        "name": "Bolivia"
      })
    );
  });

  test('a response with alias values can go to the cache', () => {
    const responseObj = {
        USA: {
          id: '1',
          name: 'United States of America',
          location: 'Northern Hemisphere'
        },
    };

    const prototype = {
      USA: {
        id: true,
        name: true,
        location: true,
        __alias: 'USA',
        __args: null,
        __id: '1',
        __type: 'country',
      }
    };

    const map = {
      countries: 'country',
    };

    normalizeForCache(responseObj, map, prototype);

    expect(sessionStorage.getItem('country--1')).toEqual(
      JSON.stringify({
        "id": '1',
        "name": "United States of America",
        "location": "Northern Hemisphere"
      })
    );
  })
});