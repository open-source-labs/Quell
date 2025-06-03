
import { QuellCache } from '../src/QuellCache';
import { RequestType } from '../src/types/types';
import schema from '../test-config/testSchema';

import e from 'express';

//Legacy Test Suite for buildFromCache from QuellCache
describe('server test for buildFromCache', () => {
    const Quell = new QuellCache({
        schema: schema,
        redisPort: Number(process.env.REDIS_PORT) || 6379,
        redisHost: process.env.REDIS_HOST || '127.0.0.1',
        redisPassword: process.env.REDIS_PASSWORD || '',
    });
    
    // inputs: prototype object (which contains args), collection (defaults to an empty array)
    // outputs: protoype object with fields that were not found in the cache set to false
    
    beforeAll(() => {
        const promise1 = new Promise((resolve, reject) => {
            resolve(
                Quell.writeToCache('country--1', {
                    id: '1',
                    capitol: { id: '2', name: 'DC' },
                })
            );
        });
        const promise2 = new Promise((resolve, reject) => {
            resolve(Quell.writeToCache('country--2', { id: '2' }))
        });
        const promise3 = new Promise((resolve, reject) => {
            resolve(Quell.writeToCache('country--3', { id: '3' }))
        });
        const promise4 = new Promise((resolve, reject) => {
            resolve(
                Quell.writeToCache('countries', [
                    'country--1',
                    'country--2',
                    'country--3',
                ])
            )
        });
        return Promise.all([promise1, promise2, promise3, promise4]);
    });
    
    afterAll(() => {
        Quell.redisCache.flushAll();
        Quell.redisCache.quit();
    });
    
    test('Basic query', async () => {
        const testProto = {
            country: {
                id: true,
                name: true,
                __alias: null,
                __args: { id: '3' },
                __type: 'country',
                __id: '3',
            },
        };
        const endProto = {
            country: {
                id: true,
                name: false,
                __alias: null,
                __args: { id: '3' },
                __type: 'country',
                __id: '3',
            },
        };
        const expectedResponseFromCache = {
            data: {
                country: {
                    id: '3',
                },
            },
        };
        const prototypeKeys = Object.keys(testProto);
        const responseFromCache = await Quell.buildFromCache(
            testProto,
            prototypeKeys
        );
        // we expect prototype after running through buildFromCache to have id has stayed true but every other field has been toggled to false (if not found in sessionStorage)
        expect(testProto).toEqual(endProto);
        expect(responseFromCache).toEqual(expectedResponseFromCache);
    });
    
    test('Basic query for data not in the cache', async () => {
        const testProto = {
            book: {
                id: true,
                name: true,
                __alias: null,
                __args: { id: '3' },
                __type: 'book',
                __id: '3',
            },
        };
        const endProto = {
            book: {
                id: false,
                name: false,
                __alias: null,
                __args: { id: '3' },
                __type: 'book',
                __id: '3',
            },
        };
        const expectedResponseFromCache = {
            data: { book: {} },
        };
        const prototypeKeys = Object.keys(testProto);
        const responseFromCache = await Quell.buildFromCache(
            testProto,
            prototypeKeys
        );
        // we expect prototype after running through buildFromCache to have id has stayed true but every other field has been toggled to false (if not found in sessionStorage)
        expect(testProto).toEqual(endProto);
        expect(responseFromCache).toEqual(expectedResponseFromCache);
    });
    
    test('Multiple nested queries that include args and aliases', async () => {
        const testProto = {
            Canada: {
                id: true,
                name: true,
                __alias: 'Canada',
                __args: { id: '1' },
                __type: 'country',
                __id: '1',
                capitol: {
                    id: true,
                    name: true,
                    population: true,
                    __alias: null,
                    __args: {},
                    __type: 'capitol',
                    __id: null,
                },
            },
            Mexico: {
                id: true,
                name: true,
                __alias: 'Mexico',
                __args: { id: '2' },
                __type: 'country',
                __id: '2',
                climate: {
                    seasons: true,
                    __alias: null,
                    __args: {},
                    __type: 'climate',
                    __id: null,
                },
            },
        };
        const endProto = {
            Canada: {
                id: true,
                name: false,
                __alias: 'Canada',
                __args: { id: '1' },
                __type: 'country',
                __id: '1',
                capitol: {
                    id: true,
                    name: true,
                    population: false,
                    __alias: null,
                    __args: {},
                    __type: 'capitol',
                    __id: null,
                },
            },
            Mexico: {
                id: true,
                name: false,
                __alias: 'Mexico',
                __args: { id: '2' },
                __type: 'country',
                __id: '2',
                climate: {
                    seasons: false,
                    __alias: null,
                    __args: {},
                    __type: 'climate',
                    __id: null,
                },
            },
        };
        const expectedResponseFromCache = {
            data: {
                Canada: {
                    id: '1',
                    capitol: {
                        id: '2',
                        name: 'DC',
                    },
                },
                Mexico: {
                    id: '2',
                },
            },
        };
        const prototypeKeys = Object.keys(testProto);
        const responseFromCache = await Quell.buildFromCache(
            testProto,
            prototypeKeys
        );
        expect(testProto).toEqual(endProto);
        expect(responseFromCache).toEqual(expectedResponseFromCache);
    });
    
    test('Handles array', async () => {
        const testProto = {
            countries: {
                id: true,
                name: true,
                __alias: null,
                __args: {},
                __type: 'countries',
            },
        };
        const endProto = {
            countries: {
                id: true,
                name: false,
                __alias: null,
                __args: {},
                __type: 'countries',
            },
        };
        const expectedResponseFromCache = {
            data: {
                countries: [
                    {
                        id: '1',
                    },
                    {
                        id: '2',
                    },
                    {
                        id: '3',
                    },
                ],
            },
        };
        const prototypeKeys = Object.keys(testProto);
        const responseFromCache = await Quell.buildFromCache(
            testProto,
            prototypeKeys
        );
        expect(testProto).toEqual(endProto);
        expect(responseFromCache).toEqual(expectedResponseFromCache);
    });
    
    test('Handles deeply nested queries with an empty cache', async () => {
        const testProto = {
            continents: {
                id: true,
                name: true,
                __type: 'continents',
                __alias: null,
                __args: {},
                __id: null,
                cities: {
                    id: true,
                    name: true,
                    __type: 'cities',
                    __alias: null,
                    __args: {},
                    __id: null,
                    attractions: {
                        id: true,
                        name: true,
                        __type: 'attractions',
                        __alias: null,
                        __args: {},
                        __id: null,
                    },
                },
            },
        };
        const endProto = {
            continents: {
                id: false,
                name: false,
                __type: 'continents',
                __alias: null,
                __args: {},
                __id: null,
                cities: {
                    id: false,
                    name: false,
                    __type: 'cities',
                    __alias: null,
                    __args: {},
                    __id: null,
                    attractions: {
                        id: false,
                        name: false,
                        __type: 'attractions',
                        __alias: null,
                        __args: {},
                        __id: null,
                    },
                },
            },
        };
        const expectedResponseFromCache = {
            data: { continents: {} },
        };
        const prototypeKeys = Object.keys(testProto);
        const responseFromCache = await Quell.buildFromCache(
            testProto,
            prototypeKeys
        );
        expect(testProto).toEqual(endProto);
        expect(responseFromCache).toEqual(expectedResponseFromCache);
    });
    
});


//Legacy Test Suite for basic query form QuellCache
describe('server test for query', () => {
  const Quell = new QuellCache({
    schema: schema,
    redisPort: Number(process.env.REDIS_PORT) || 6379,
    redisHost: process.env.REDIS_HOST || '127.0.0.1',
    redisPassword: process.env.REDIS_PASSWORD || '',
  });
  // inputs: prototype object (which contains args), collection (defaults to an empty array)
  // outputs: protoype object with fields that were not found in the cache set to false

  beforeAll(() => {
    const promise1 = new Promise((resolve, reject) => {
      resolve(
        Quell.writeToCache('country--1', {
          id: '1',
          capitol: { id: '2', name: 'DC' },
        })
      );
    });
    const promise2 = new Promise((resolve, reject) => {
      resolve(Quell.writeToCache('country--2', { id: '2' }));
    });
    const promise3 = new Promise((resolve, reject) => {
      resolve(Quell.writeToCache('country--3', { id: '3' }));
    });
    const promise4 = new Promise((resolve, reject) => {
      resolve(
        Quell.writeToCache('countries', [
          'country--1',
          'country--2',
          'country--3',
        ])
      );
    });
    return Promise.all([promise1, promise2, promise3, promise4]);
  });

  // afterAll(() => {
  //   Quell.redisCache.flushAll();
  //   Quell.redisCache.quit();
  // });

  test('If query is empty, should error out in rateLimiter', async () => {
    const mockReq = <RequestType> {
      body: {}
    } 
    
    const mockRes = <e.Response<any, Record<string, any>>> {};
    const mockNext = <e.NextFunction> jest.fn();
  
    await Quell.rateLimiter(
      mockReq, mockRes, mockNext
    );
  
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith({
      log: "Error: no GraphQL query found on request body, inside rateLimiter",
      status: 400,
      message: {
        err: "Error in rateLimiter: Bad Request. Check server log for more details.",
      },
    })
  });

  test('If query is empty, should error out in query', async () => {
    const mockReq = <RequestType> {
      body: {}
    } 

    const mockRes = <e.Response<any, Record<string, any>>> {};
    const mockNext = <e.NextFunction> jest.fn();

    await Quell.query(
      mockReq, mockRes, mockNext
    );

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith({
      log: "Error: no GraphQL query found on request body",
      status: 400,
      message: {
        err: "Error in quellCache.query: Check server log for more details.",
      },
    })
  });

});