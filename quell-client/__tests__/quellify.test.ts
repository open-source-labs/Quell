import { Quellify, clearCache, lruCache } from '../src/Quellify';
import { CostParamsType } from '../src/types';

const defaultCostOptions: CostParamsType = {
  maxCost: 5000,
  mutationCost: 5,
  objectCost: 2,
  scalarCost: 1,
  depthCostFactor: 1.5,
  maxDepth: 10,
  ipRate: 3
};

// Command to run jest tests:
// npx jest client/src/quell-client/client-tests/__tests__/quellify.test.ts

describe('Quellify', () => {
  beforeEach(() => {
    // Clear the client cache before each test
    clearCache();
  });

    it('checks that caching queries is working correctly', async () => {
      const endPoint = 'http://localhost:3000/api/graphql';
      const query = 'query { artist(name: "Frank Ocean") { id name albums { id name } } }';
      const costOptions = defaultCostOptions;
      const [data, foundInCache] = await Quellify(endPoint, query, costOptions) as [any, boolean];
  
      // Assertion: the data should not be found in the cache
      expect(foundInCache).toBe(false);

      // Invoke Quellify on query again
      const [cachedData, updatedCache] = await Quellify(endPoint, query, costOptions) as [any, boolean];
      // Assertion: Cached data should be the same as the original query
      expect(cachedData).toBe(data);
      // Assertion: The boolean should return true if it is found in the cache
      expect(updatedCache).toEqual(true);
    
    });

    it('should update the cache for edit mutation queries', async () => {
      const endPoint = 'http://localhost:3000/api/graphql';
      const addQuery = 'mutation { addCity(name: "San Diego", country: "United States") { id name } }'; 
      const costOptions = defaultCostOptions; 
    
      // Perform add mutation query to the cache
      const [addMutationData, addMutationfoundInCache] = await Quellify(endPoint, addQuery, costOptions) as [any, boolean];
      // Get the cityId on the mutation query
      const cityId = addMutationData.addCity.id;
      const city = "Las Vegas";
      // Perform edit mutation on query to update the name
      const editQuery = `mutation { editCity(id: "${cityId}", name: "${city}", country: "United States") { id name } }`; 
      const [editMutationData, editMutationDataFoundInCache] = await Quellify(endPoint, editQuery, costOptions) as [any, boolean];

      //Assertion: The first mutation query name should be updated by the second edit mutation
      expect(addMutationData.name).toEqual(editMutationData.name);
      
    });
    

    it('should delete an item from the server and invalidate the cache', async () => {
      const endPoint = 'http://localhost:3000/api/graphql';
      const addQuery = 'mutation { addCity(name: "Irvine", country: "United States") { id name } }'; 
      const costOptions = defaultCostOptions; 
    
      // Perform add mutation query to the server
      const [addMutationData, addMutationfoundInCache] = await Quellify(endPoint, addQuery, costOptions) as [any, boolean];
      // Get the cityId on the mutation query
      const cityId = addMutationData.addCity.id;

      // Perform a delete mutation on the city
      const deleteQuery = `mutation { deleteCity(id: "${cityId}") { id name } }`; 
      const [deleteMutationData, deleteMutationDataFoundInCache] = await Quellify(endPoint, deleteQuery, costOptions) as [any, boolean];

      //Assertion: The item should be removed from the cache
      expect(deleteMutationDataFoundInCache).toBe(false);

    });
    
  
  it('should evict the LRU item from cache if cache size is exceeded', async () => {
    const endPoint = 'http://localhost:3000/api/graphql';
    const costOptions = defaultCostOptions;
    const query1 = 'query { artist(name: "Frank Ocean") { id name albums { id name } } }';
    const query2 = 'query { country(name: "United States") { id name cities { id name attractions { id name } } } }';
    const query3 = 'mutation { addCity(name: "San Diego", country: "United States") { id name } }';
    

    // Invoke Quellify on each query to add to cache
    await Quellify(endPoint, query1, costOptions);
    await Quellify(endPoint, query2, costOptions);

    // Assertion: lruCache should contain the queries
    expect(lruCache.has(query1)).toBe(true);
    expect(lruCache.has(query2)).toBe(true);

    // Invoke Quellify again on third query to exceed max cache size
    await Quellify(endPoint, query3, costOptions);

    // Assertion: lruCache should evict the LRU item
    expect(lruCache.has(query1)).toBe(false);
    
    // Assertion: lruCache should still contain the most recently used items
    expect(lruCache.has(query2)).toBe(true);
    expect(lruCache.has(query3)).toBe(true);

  });

});
