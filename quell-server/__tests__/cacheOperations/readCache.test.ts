/**
* Mock the redis module to prevent actual Redis connections during tests.
* This must be called before any imports that depend on Redis.
*/
jest.mock('redis', () => ({
    createClient: jest.fn(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      flushAll: jest.fn(),
      expire: jest.fn(),
      keys: jest.fn(),
      multi: jest.fn(() => ({
        get: jest.fn(),
        exec: jest.fn()
      }))
    }))
  }));
 
 import type { RedisClientType } from 'redis';
 import { createReadCacheRedisMock } from '../__mocks__/mockRedisClient';
 // Functions you're testing
 import { 
    createBuildFromCache, 
    createGenerateCacheID 
  } from '../../src/cacheOperations/readCache';
  
  // Types needed for testing
  import type {
    BuildFromCacheFunction,
    GenerateCacheIDFunction,
    // ReadCacheConfig,
    CacheResponse
  } from '../../src/types/readCacheTypes';
  
  import type {
    ProtoObjType,
    IdCacheType,
    ItemFromCacheType
  } from '../../src/types/types';
 
 /**
 * Test suite for the createBuildFromCache function.
 * 
 * This suite tests the function's ability to:
 * - Retrieve data from Redis cache
 * - Handle cache misses appropriately
 * - Process nested queries
 * - Handle arrays of cached items
 * - Fall back to ID cache when needed
 */
 describe('createBuildFromCache', () => {
    let mockRedisCache: RedisClientType;
    let mockIdCache: IdCacheType;
    let buildFromCache: BuildFromCacheFunction;
  
    /**
     * Set up test environment before each test.
     * Creates fresh mock instances and initializes the function under test.
     */
    beforeEach(() => {
      // Create mock with test data
      mockRedisCache = createReadCacheRedisMock({
        'country--1': { id: '1', name: 'USA' },
        'country--2': { id: '2', name: 'Canada' },
        'countries': ['country--1', 'country--2']
    }) as unknown as RedisClientType;
  
      mockIdCache = {};
      
      // Create the function under test
      buildFromCache = createBuildFromCache({
        redisCache: mockRedisCache,
        redisReadBatchSize: 10,
        idCache: mockIdCache,
        generateCacheID: createGenerateCacheID()
      });
    });
  
    /**
     * Clean up after each test by clearing all mock state.
     * Ensures tests don't interfere with each other.
     */
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    /**
     * Test: Basic cache retrieval functionality
     * 
     * Verifies that buildFromCache correctly:
     * 1. Generates the appropriate cache key
     * 2. Retrieves data from Redis
     * 3. Returns properly formatted response
     * 4. Calls Redis with correct parameters
     */
    test('retrieves data from cache', async () => {
      // Arrange: Create a prototype representing a GraphQL query
      const prototype = {
        country: {
          id: true,
          name: true,
          __type: 'country',
          __id: '1',
          __args: { id: '1' },
          __alias: null
        }
      };
  
      // Act: Execute the function under test
      const result = await buildFromCache(prototype, ['country']);
      
      // Assert: Verify the response and Redis interactions
      expect(result.data).toEqual({
        country: { id: '1', name: 'USA' }
      });
      expect(mockRedisCache.get).toHaveBeenCalledWith('country--1');
    });
  });