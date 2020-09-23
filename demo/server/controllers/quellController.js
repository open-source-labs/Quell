const { graphql } = require('graphql');
const redis = require('redis');

/*
  - Connect to Redis server at REDIS_PORT. 
    (Redis server must be running and listening for connections on your local machine (at the default PORT 6379))
  - Make Redis GET method return a promise in order to use it asynchronously. 
    (promisify is a utility function that takes as an argument another function. It creates a promise that resolves 
    when the callback function finishes executing.)
*/

const REDIS_PORT = 6379
const client = redis.createClient(REDIS_PORT)

const { promisify } = require("util");
client.get = promisify(client.get) // enables cache to return a promise

/* 
  - Stringify query and save as the "key"

  1. Check the Redis server to see if it has been cached
    - Use Client.get
    - Returns a promise -- is true if database contains the key
    - If true, return the result of the cache hit in res.locals -- the function ends
    - If false, move on to check if it's in the db

  2. Parse through GraphQL & Send to DB
    - sends req.body.query (the key) to db
    - sends back the response (the value) as a normal JS object
    - we stringify the response and save to res.locals -- this is our final response to client
    
  3. Save in Redis for future cache hits
      - via client.set, makes request to Redis
      - key = stringified query
      - value = stringified response from server/db

  some Redis / node documentation: https://www.npmjs.com/package/redis
*/

const quellController = {}

quellController.quell = (schema) => {

  return async (req, res, next) => {
    // client.flushall(); // uncomment if you want to clear the Redis cache
    
    // If request body does not contain a query, set response to empty object and pass to next middleware
    if (!req.body.query) {
      res.locals.value = {};
      return next();
    }

    // Create a key - strip white space from query string & stringify
    const key = JSON.stringify(req.body.query.replace(/\s/g, ''));

    // Check cache
    const redisCacheValue = await client.get(key)
    
    // If query is in cache, set res.locals.value and move to next middleware
    if (redisCacheValue) {
      res.locals.value = redisCacheValue;
      return next();
    }

    graphql(schema, req.body.query)
      .then((response) => {
        // Save GraphQL response to Express response object
        res.locals.value = JSON.stringify(response);
        // Write GraphQL response to Redis cache
        client.set(key, res.locals.value);
        return next()
      })
      .catch((error) => {
        const errorObject = {
          log: `Error in GraphQL layer: ${error}`,
          status: 500,
          message: { err: 'Unable to parse or fetch GraphQL query' }
        };
        next(errorObject);
      });
  };
};

module.exports = quellController;