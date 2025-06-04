import dotenv from 'dotenv';
dotenv.config();

import { QuellCache } from '../src/QuellCache';
import { RequestType } from '../src/types/types';
import { redisCacheMain } from '../src/helpers/redisConnection';
import schema from '../test-config/testSchema';
import e from 'express';

let Quell: QuellCache;

beforeAll(async () => {
    Quell = new QuellCache({
      schema,
      redisPort: +process.env.REDIS_PORT! || 6379,
      redisHost: process.env.REDIS_HOST || '127.0.0.1',
      redisPassword: process.env.REDIS_PASSWORD || '',
    });

    // Ensure the Redis client QuellCache uses is connected
    if (!Quell.redisCache.isOpen) await Quell.redisCache.connect();
    // Optionally ensure the shared client is connected too
    if (!redisCacheMain.isOpen) await redisCacheMain.connect();

    // Write initial cache state
    await Promise.all([
        Quell.writeToCache('country--1', { id: '1', capitol: { id: '2', name: 'DC' } }),
        Quell.writeToCache('country--2', { id: '2' }),
        Quell.writeToCache('country--3', { id: '3' }),
        Quell.writeToCache('countries', ['country--1', 'country--2', 'country--3']),
  ]);
});

afterAll(async () => {
    if (Quell.redisCache.isOpen) {
      await Quell.redisCache.flushAll();
      await Quell.redisCache.quit();
    }
  });

//Legacy Test Suite for buildFromCache from QuellCache
describe('server test for buildFromCache', () => {
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
        const expectedResponse = { data: { country: { id: '3' } } };
        const result = await Quell.buildFromCache(testProto, Object.keys(testProto));
        // we expect prototype after running through buildFromCache to have id has stayed true but every other field has been toggled to false (if not found in sessionStorage)
        expect(testProto).toEqual(endProto);
        expect(result).toEqual(expectedResponse);
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
        const expectedResponseFromCache = { data: { book: {} }  };
        const responseFromCache = await Quell.buildFromCache(testProto, Object.keys(testProto));
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
        const responseFromCache = await Quell.buildFromCache(testProto, Object.keys(testProto));
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
                    {   id: '1' },
                    {   id: '2' },
                    {   id: '3' },
                ],
            },
        };
        const responseFromCache = await Quell.buildFromCache(testProto, Object.keys(testProto));
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
        const expectedResponseFromCache = { data: { continents: {} }  };
        const prototypeKeys = Object.keys(testProto);
        const responseFromCache = await Quell.buildFromCache(testProto, Object.keys(testProto));
        expect(testProto).toEqual(endProto);
        expect(responseFromCache).toEqual(expectedResponseFromCache);
    });
    
});


//Legacy Test Suite for basic query form QuellCache
describe('server test for query', () => {
  test('If query is empty, should error out in rateLimiter', async () => {
    const mockReq = <RequestType> { body: {} }; 
    
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

  test('query errors on empty query', async () => {
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