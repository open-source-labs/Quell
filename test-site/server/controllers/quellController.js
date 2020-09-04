const { graphql } = require('graphql')
const schema = require('../schema/schema');

const redis = require('redis')
const REDIS_PORT = 6379
const client = redis.createClient(REDIS_PORT)

const { promisify } = require("util");
client.get = promisify(client.get) // enables cache to return a promise

/* 
  To contact the Redis db, you basically use commands like client.get and client.set

  Some documentation: https://www.npmjs.com/package/redis

  client.set("key", "value", redis.print);
  client.get("key", redis.print);

  client.on("error", function(error) {
    console.error(error);
  });
*/

// ========================== //

const quellController = {}

// ========================= //
// ====== CHECK CACHE ====== //
// ========================= //

/* 
  - Turn query to JSON
  - Make a client.get request
  - It's a promise -- returns true if database contains the key
    - If true, return the value
    - If false, move onto the next middleware
*/

quellController.checkCache = async (req, res, next) => {
  // client.flushall() // uncomment if you want to clear the whole cache
  console.log('REDIS: checkCache');

  const key = JSON.stringify(req.body.query.replace(/\s/g, '')); // .replace takes out "white space"

  const redisCacheValue = await client.get(key) // returns true / false

  if (redisCacheValue) {
    console.log('REDIS CACHE HIT!! ', redisCacheValue)
    return res.status(200).send(redisCacheValue);
  }

  res.locals.key = key
  return next();
};

// ======================== //
// ==== GRAPHQL SCHEMA ==== //
// ======================== //

quellController.graphqlSchema = (req, res, next) => {
  console.log('REDIS: graphqlTest')

  graphql(schema, req.body.query)
    .then(response => {
      res.locals.value = JSON.stringify(response)
      return next();
    })
};

// ======================== //
// ==== WRITE TO REDIS ==== //
// ======================== //

/* 
  Make a client.set request to Redis
    - key = stringified query
    - value = stringified response from our server/db
*/

quellController.writeToCache = async (req, res, next) => {
  console.log('REDIS: writeToCache');

  client.set(res.locals.key, res.locals.value, () => console.log('SUCCESSFULLY SET DB RESPONSE IN REDDIS'));

  next();
};

// ========================== //

module.exports = quellController;