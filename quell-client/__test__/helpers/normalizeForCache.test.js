const normalizeForCache = require('../../src/helpers/normalizeForCache');

// normalizeForCache does not return any values, rather writes to the cache
// way to mock sessionStorage like in buildFromCache tests?

xdescribe('normalizeForCache.test.js', () => {
  // inputs: response data object
  // outputs: none, but values should be on session storage when done 

  xtest('Basic response, with no arrays or nested objects', () => {
    const objBasic = {
      "country": {
        "id": 2,
        "name": "Bolivia"
      }
    };

    // normalize object & set on cache
    normalizeForCache(objBasic);
    // make sure object is on cache
    expect(sessionStorage.getItem('country--2')).toEqual(
      "{\"id\":2,\"name\":\"Bolivia\"}"
    );
  });

  xtest('nested response should produce individual values for both queries inside of it', () => {
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
        __alias: null,
        __args: null,
        city: { id: true, name: true, __alias: null, __args: null }
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

  xtest('deeply nested response should produce individual values for all queries on response', () => {
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
        __alias: null,
        __args: null,
        state: {
          id: true,
          name: true,
          __alias: null,
          __args: null,
          county: {
            id: true,
            name: true,
            __alias: null,
            __args: null,
            city: {
              id: true,
              name: true,
              __alias: null,
              __args: null,
              mayor: {
                id: true,
                name: true,
                __alias: null,
                __args: null,
                hobby: {
                  id: true,
                  name: true,
                  __alias: null,
                  __args: null
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

  xtest('individual items on same response object should be cached individually', () => {
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

    normalizeForCache(multipleRes);

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

  xtest('a response array should cache an array of refs along with information on individual elements', () => {
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
        __alias: null,
        __args: null
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

  });
});