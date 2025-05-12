import e from 'express';
import { QuellCache } from '../src/quell';
import { RequestType } from '../src/types';
import schema from '../test-config/testSchema';
// import { describe, expect, test, beforeAll, } from 'jest';

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