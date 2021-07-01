const QuellCache = require('../../src/quell');
const schema = require('../../test-config/testSchema');

const redisPort = 6379;
const timeout = 100;


describe('server test for normalizeForCache', () => {
  const Quell = new QuellCache(schema, redisPort, timeout);
  // inputs: prototype object (which contains args), collection (defaults to an empty array)
  // outputs: protoype object with fields that were not found in the cache set to false 

  afterAll((done) => {
    Quell.redisCache.flushall();
    Quell.redisCache.quit(() => {
      console.log('closing redis server');
      done();
    });
  });

  test('Basic response, with no arrays or nested objects', async () => {
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
    await Quell.normalizeForCache(objBasic, {}, protoObj);
    // make sure object is on cache
    await expect(Quell.getFromRedis('country--2')).resolves.toEqual(
      "{\"id\":2,\"name\":\"Bolivia\"}"
    );
  });

  test('nested response should produce individual values for both queries inside of it', async () => {
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
    
    await Quell.normalizeForCache(nestedObj, 'map', nestedProto);

    await expect(Quell.getFromRedis('country--2')).resolves.toEqual(
      "{\"id\":2,\"name\":\"Bolivia\",\"city\":{\"id\":1,\"name\":\"Los Angeles\"}}"
    );
    await expect(Quell.getFromRedis('city--1')).resolves.toEqual(
      "{\"id\":1,\"name\":\"Los Angeles\"}"
    )
  });

  test('deeply nested response should produce individual values for all queries on response', async () => {
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
    
    await Quell.normalizeForCache(deeplyNestedObj, 'map', deeplyNestedProto);

    await expect(Quell.getFromRedis('country--1')).resolves.toEqual(
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
    await expect(Quell.getFromRedis('state--2')).resolves.toEqual(
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
    await expect(Quell.getFromRedis('county--3')).resolves.toEqual(
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
    await expect(Quell.getFromRedis('city--4')).resolves.toEqual(
      JSON.stringify({
        id: 4,
        name: 'Los Angeles',
        mayor: { id: 5, name: 'Shana', hobby: { id: 6, name: 'Bigfoot Hunting' } }
      })
    );
    await expect(Quell.getFromRedis('mayor--5')).resolves.toEqual(
      JSON.stringify({ id: 5, name: 'Shana', hobby: { id: 6, name: 'Bigfoot Hunting' } })
    );
    await expect(Quell.getFromRedis('hobby--6')).resolves.toEqual(
      JSON.stringify({ id: 6, name: 'Bigfoot Hunting' })
    );
  });

  test('individual items on same response object should be cached individually', async () => {
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

    await Quell.normalizeForCache(multipleRes, {}, protoObj);

    await expect(Quell.getFromRedis('country--3')).resolves.toEqual(
      JSON.stringify({
        id: 3,
        name: "Portugal",
        cuisine: "Delicious"
      })
    );
    await expect(Quell.getFromRedis('book--10')).resolves.toEqual(
      JSON.stringify({
        id: 10,
        title: "Axiom's End",
        author: "Lindsay Ellis"
      })
    );
  });

  test('a response array should cache an array of refs along with information on individual elements', async () => {
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

    await Quell.normalizeForCache(responseObj, map, prototype);

    await expect(Quell.getFromRedis('countries')).resolves.toEqual(
      JSON.stringify(['country--1', 'country--2'])
    );
    await expect(Quell.getFromRedis('country--1')).resolves.toEqual(
      JSON.stringify({
        "id": 1,
        "name": "Andorra",
      })
    );
    await expect(Quell.getFromRedis('country--2')).resolves.toEqual(
      JSON.stringify({
        "id": 2,
        "name": "Bolivia"
      })
    );
  });

  test('a response with alias values can go to the cache', async () => {
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

    await Quell.normalizeForCache(responseObj, map, prototype);

    await expect(Quell.getFromRedis('country--1')).resolves.toEqual(
      JSON.stringify({
        "id": '1',
        "name": "United States of America",
        "location": "Northern Hemisphere"
      })
    );
  })
});