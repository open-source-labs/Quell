// src/quellRouter.ts
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { RedisClientType } from 'redis';

/**
 * Interface for endpoints configuration
 * Keys are endpoint paths, values are either 'local' or API URLs
 */
interface EndpointConfig {
  [path: string]: string;
}

/**
 * Options for the createQuellRouter function
 */
interface QuellRouterOptions {
  endpoints: EndpointConfig;         // Mapping of paths to API URLs
  cache: RedisClientType;            // Redis client from Quell's cache
  cacheExpiration?: number;          // Cache TTL in seconds
  debug?: boolean;                   // Enable debug logging
  headers?: {                        // Default headers for each API
    [apiName: string]: {             // API name as the key (derived from endpoint path)
      [headerName: string]: string;  // Header name and value
    };
  };
}

/**
 * Creates a router middleware for handling GraphQL requests to multiple endpoints
 * 
 * @param options Configuration options
 * @returns Express middleware function
 */
export function createQuellRouter(options: QuellRouterOptions) {
  const { 
    endpoints, 
    cache, 
    cacheExpiration = 3600,
    debug = false,
    headers = {}
  } = options;

  // Create router middleware function
  const routerMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip non-POST requests
      if (req.method !== 'POST') {
        return next();
      }

      // Get the path and check if it's a configured endpoint
      const path = req.path;
      const targetUrl = endpoints[path];

      // If path not found or marked as 'local', pass to next middleware
      if (!targetUrl || targetUrl === 'local') {
        if (debug) console.log(`QUELL ROUTER: Path ${path} not found or marked as local, passing to next middleware`);
        return next();
      }

      // Get the API name from the path (for cache namespacing)
      const apiName = path.split('/').pop() || 'api';

      // Extract GraphQL query, variables, and operation name
      const { query, variables, operationName } = req.body;

      // Skip if no query provided
      if (!query) {
        if (debug) console.log('QUELL ROUTER: No query provided, passing to next middleware');
        return next();
      }

      if (debug) {
        console.log(`QUELL ROUTER: Processing ${apiName} query`);
        console.log('QUERY:', query);
        console.log('VARIABLES:', variables);
      }

      // Generate a cache key based on the API, query, and variables
      const queryHash = generateHash({ query, variables, operationName });
      const cacheKey = `quellrouter:${apiName}:${queryHash}`;

      try {
        // Check if response is cached
        const cachedResponse = await cache.get(cacheKey);
        
        if (cachedResponse) {
          if (debug) console.log(`QUELL ROUTER: Cache hit for ${apiName}`);
          
          // Parse the cached response
          const parsedResponse = JSON.parse(cachedResponse);
          
          // Send the cached response
          return res.json(parsedResponse);
        }
      } catch (cacheError) {
        console.error(`QUELL ROUTER: Cache read error:`, cacheError);
        // Continue even if cache read fails
      }

      if (debug) console.log(`QUELL ROUTER: Cache miss for ${apiName}, fetching from API at ${targetUrl}`);
      
      // Get API-specific headers
      const apiHeaders = headers[apiName] || {};
      
      // Execute the query against the target API using native fetch
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...apiHeaders,
          // Pass through auth headers if present
          ...(req.headers.authorization ? 
              { 'Authorization': req.headers.authorization as string } : {})
        },
        body: JSON.stringify({
          query,
          variables,
          operationName
        })
      });

      // Check for HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GraphQL API error (${response.status}): ${errorText}`);
      }

      // Parse the API response
      const apiResponse = await response.json();

      if (debug) {
        console.log(`QUELL ROUTER: Received response from ${apiName} API`);
        if (apiResponse.errors) {
          console.log('RESPONSE ERRORS:', apiResponse.errors);
        }
      }

      // Cache the response if there are no errors
      if (!apiResponse.errors) {
        try {
          // Stringify the response before caching
          const stringifiedResponse = JSON.stringify(apiResponse);
          
          // Use SET with EX option to set expiration
          await cache.set(cacheKey, stringifiedResponse, {
            EX: cacheExpiration
          });
          
          if (debug) console.log(`QUELL ROUTER: Cached response for ${apiName} (TTL: ${cacheExpiration}s)`);
        } catch (cacheError) {
          console.error(`QUELL ROUTER: Cache write error:`, cacheError);
          // Continue even if cache write fails
        }
      }

      // Send the API response
      return res.json(apiResponse);
    } catch (error) {
      console.error('QUELL ROUTER ERROR:', error);
      
      // Return a GraphQL-formatted error response
      return res.status(500).json({
        errors: [{
          message: `Error in GraphQL router: ${error instanceof Error ? error.message : String(error)}`,
          extensions: { code: 'ROUTER_ERROR' }
        }]
      });
    }
  };
  
  // Add utility methods to the middleware function
  
  /**
   * Clears cache for a specific API
   */
  routerMiddleware.clearApiCache = async (apiName: string): Promise<number> => {
    try {
      const pattern = `quellrouter:${apiName}:*`;
      const keys = await cache.keys(pattern);
      
      if (keys.length > 0) {
        await cache.del(keys);
        if (debug) console.log(`QUELL ROUTER: Cleared ${keys.length} cached responses for ${apiName}`);
        return keys.length;
      }
      
      return 0;
    } catch (error) {
      console.error(`QUELL ROUTER: Error clearing API cache:`, error);
      return 0;
    }
  };
  
  /**
   * Clears all router cache entries
   */
  routerMiddleware.clearAllCache = async (): Promise<number> => {
    try {
      const pattern = 'quellrouter:*';
      const keys = await cache.keys(pattern);
      
      if (keys.length > 0) {
        await cache.del(keys);
        if (debug) console.log(`QUELL ROUTER: Cleared ${keys.length} cached responses`);
        return keys.length;
      }
      
      return 0;
    } catch (error) {
      console.error(`QUELL ROUTER: Error clearing all cache:`, error);
      return 0;
    }
  };

  return routerMiddleware;
}

/**
 * Generates a deterministic hash for cache keys
 */
function generateHash(data: any): string {
  const stringified = JSON.stringify(data);
  return createHash('sha256').update(stringified).digest('hex').substring(0, 16);
}