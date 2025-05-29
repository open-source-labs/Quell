interface ReadCacheMockRedisClient {
    get: jest.MockedFunction<(key: string) => Promise<string | null>>;
    multi: jest.MockedFunction<() => ReadCacheMockMulti>;
  }
  
  interface ReadCacheMockMulti {
    get: jest.MockedFunction<(key: string) => ReadCacheMockMulti>;
    exec: jest.MockedFunction<() => Promise<(string | null)[]>>;
  }

  export const createReadCacheRedisMock = (
    cacheData: Record<string, any> = {}
  ) => {
    const stringifiedCache: Record<string, string> = {};
    Object.entries(cacheData).forEach(([key, value]) => {
      stringifiedCache[key.toLowerCase()] = JSON.stringify(value);
    });
  
    const mockRedis = {
      get: jest.fn((key: string) => {
        const value = stringifiedCache[key.toLowerCase()];
        return Promise.resolve(value || null);
      }),
      
      multi: jest.fn(() => {
        const commands: string[] = [];
        
        // Add explicit type annotation
        const multiInstance: {
          get: jest.MockedFunction<(key: string) => any>;
          exec: jest.MockedFunction<() => Promise<(string | null)[]>>;
        } = {
          get: jest.fn((key: string) => {
            commands.push(key);
            return multiInstance;
          }),
          
          exec: jest.fn(() => {
            const results = commands.map(key => 
              stringifiedCache[key.toLowerCase()] || null
            );
            return Promise.resolve(results);
          })
        };
        
        return multiInstance;
      })
    };
  
    return mockRedis;
  };

//   /** Mock Redis Client???
//  * 
//  * @returns 
//  */
// export const createMockRedisClient = () => ({
//     set: jest.fn().mockResolvedValue('OK'),
//     get: jest.fn().mockResolvedValue(null),
//     del: jest.fn().mockResolvedValue(1),
//     EXPIRE: jest.fn().mockResolvedValue(1)
//   });