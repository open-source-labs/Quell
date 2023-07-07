[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/open-source-labs/Quell/blob/master/LICENSE)
![AppVeyor](https://img.shields.io/badge/build-passing-brightgreen.svg)
![AppVeyor](https://img.shields.io/badge/version-9.0.0-blue.svg)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/open-source-labs/Quell/issues)

# @quell/server

@quell/server is an easy-to-implement Node.js/Express middleware that satisfies and caches GraphQL queries and mutations. Quell's schema-governed, type-level normalization algorithm caches GraphQL query and mutation responses as flattened key-value representations of the graph's nodes, making it possible to partially satisfy queries from the server's Redis cache, reformulate the query, and then fetch additional data from other APIs or databases.

@quell/server is an open-source NPM package accelerated by [OS Labs](https://github.com/open-source-labs) and developed by [Cassidy Komp](https://github.com/mimikomp), [Andrew Dai](https://github.com/andrewmdai), [Stacey Lee](https://github.com/staceyjhlee), [Ian Weinholtz](https://github.com/itsHackinTime), [Angelo Chengcuenca](https://github.com/amchengcuenca), [Emily Hoang](https://github.com/emilythoang), [Keely Timms](https://github.com/keelyt), [Yusuf Bhaiyat](https://github.com/yusuf-bha), [Chang Cai](https://github.com/ccai89), [Robert Howton](https://github.com/roberthowton), [Joshua Jordan](https://github.com/jjordan-90), [Jinhee Choi](https://github.com/jcroadmovie), [Nayan Parmar](https://github.com/nparmar1), [Tashrif Sanil](https://github.com/tashrifsanil), [Tim Frenzel](https://github.com/TimFrenzel), [Robleh Farah](https://github.com/farahrobleh), [Angela Franco](https://github.com/ajfranco18), [Ken Litton](https://github.com/kenlitton), [Thomas Reeder](https://github.com/nomtomnom), [Andrei Cabrera](https://github.com/Andreicabrerao), [Dasha Kondratenko](https://github.com/dasha-k), [Derek Sirola](https://github.com/dsirola1), [Xiao Yu Omeara](https://github.com/xyomeara), [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile), and [Justin Jaeger](https://github.com/justinjaeger).

## Installation

### Installing and Connecting a Redis Server

If not already installed on your server, install Redis.

- Mac-Homebrew:
  - At the terminal, type `brew install redis`
  - After installation completes, type `redis-server`
  - Your server should now have a Redis database connection open (note the port on which it is listening)
- Linux or non-Homebrew:
  - Download appropriate version of Redis from [redis.io/download](http://redis.io/download)
  - Follow installation instructions
  - Once Redis is successfully installed, follow instructions to open a Redis database connection (note the port on which it is listening)


### Install @quell/server

Install the NPM package from your terminal: `npm i @quell/server`.
`@quell/server` will be added as a dependency to your package.json file.

---
## Implementation

1. Import quell-server into your Node.js/Express file:

- Common JS: `const { QuellCache } = require('@quell/server/dist/quell');`
- ES6+: `import { QuellCache } from '@quell/server/dist/quell';`

2. Instantiate QuellCache once for each GraphQL endpoint, passing to it an object with the following properties:

- schema - The GraphQL schema you've defined using the graphql-JS library (NOTE: see 'Schema' section below).

- cacheExpiration - Number of seconds you want data to persist in the Redis cache.

- redisPort - The port number on which the Redis server is listening for incoming connections. The default Redis port is 6379.

- redisHost - The hostname or IP address of the Redis server you want to connect to. For a local Redis instance, you can use '127.0.0.1'.

- redisPassword - The password required to authenticate with the Redis server.

- costParameters (optional, see "Rate and Cost Limiting Implementation" section below). 

3. Add quell-server's controller function `quellCache.query` to the Express route that receives GraphQL queries:

So, for example, to instantiate the middleware to satisfy GraphQL queries using the schema you've stored or imported as `myGraphQLSchema` and cache responses to the Redis database listening on `6379` for `3600` seconds, you would add to your server file:
`const quellCache = new QuellCache(myGraphQLSchema, 6379, 3600);`

And your server file might look like this:

```javascript
const express = require('express');
const myGraphQLSchema = require('./schema/schema');
const { QuellCache } = require('@quell/server/dist/quell')
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const PASSWORD = process.env.PASSWORD;

// create a new Express server
const app = express();

// instantiate quell-server
const quellCache = new QuellCache({ 
  schema: myGraphQLSchema,
  cacheExpiration: 3600,
  redisPort: REDIS_PORT, 
  redisHost: REDIS_HOST, 
  redisPassword: PASSWORD
});

// apply Express's JSON parser
app.use(express.json());

// GraphQL route
app.use('/graphql',
    quellCache.query,
    (req, res) => {
    return res
        .status(200)
        .send(res.locals);
    }
);
// required global error handler
app.use((err, req, res, next) => {
  const defaultErr = {
    log: 'Express error handler caught unknown middleware error',
    status: 500,
    message: { err: 'An error occurred' },
  };
  const errorObj = Object.assign({}, defaultErr, err);
  console.log(errorObj.log);
  return res.status(errorObj.status).json(errorObj.log);
});

// expose Express server on port 3000
app.listen(3000);
```

That's it! You now have a normalized cache for your GraphQL endpoint.

---
## Rate and Cost Limiting Implementation

@quell/server now offers optional cost- and rate-limiting of incoming GraphQL queries for additional endpoint security from malicious nested or costly queries.

Both of these middleware packages use an optional "Cost Object" parameter in the QuellCache constructor. Below is an example of the **default** Cost Object.

```javascript
  const defaultCostParams = {
    maxCost: 5000, // maximum cost allowed before a request is rejected
    mutationCost: 5, // cost of a mutation
    objectCost: 2, // cost of retrieving an object
    scalarCost: 1, // cost of retrieving a scalar
    depthCostFactor: 1.5, // multiplicative cost of each depth level
    depthMax: 10, // maximum depth allowed before a request is rejected
    ipRate: 3 // maximum subsequent calls per second before a request is rejected
  }
```

When parsing an incoming query, @quell/server will build a cost associated with the query relative to how laborious it is to retrieve by using the costs provided in the Cost Object. The costs listed above are the default costs given upon QuellCache instantiation, but these costs can be manually reassigned upon cache creation.

If the cost of a query ever exceeds the `maxCost` defined in our Cost Object, the query will be rejected and return Status 400 before the request is sent to the database. Additionally, if the depth of a query ever exceeds the `depthMax` defined in our Cost Object, the query will be similarly rejected.
The `ipRate` variable limits the ammount of requests a user can submit per second. Any requests above this threshold will be invalidated.

Using the implementation described in our "Cache Implementation" section, we could implement depth- and cost-limiting like so:


```javascript
// instantiate quell-server
const quellCache = new QuellCache({
  schema: myGraphQLSchema,
  cacheExpiration: 3600,
  redisPort: REDIS_PORT, 
  redisHost: REDIS_HOST, 
  redisPassword: PASSWORD,
  costParameters: { maxCost: 100, depthMax: 5, ipRate: 5 }
});


// GraphQL route and Quell middleware
app.use('/graphql',
    quellCache.rateLimit, // optional middleware to include ip rate limiting
    quellCache.costLimit, // optional middleware to include cost limiting
    quellCache.depthLimit,// optional middleware to include depth limiting
    quellCache.query,
    (req, res) => {
    return res
        .status(200)
        .send(res.locals);
    }
);
```

Note: Both of these middleware packages work individually or combined, with or without the caching provided by `quellCache.query`.

---
### Schema

Quell's current iteration requires all schemas passed in to match the schema structure defined in the [GraphQL Docs.](https://graphql.org/learn/schema/) Any other GraphQL schema types (i.e: those made by GraphQL's 'buildSchema' or Apollo's 'makeExecutableSchema') are unreadable by Quell's current schema parser and will result in errors.

In order to efficiently track and invalidate caches associated with specific mutations, you need to map each mutation name to the relevant parts of the schema that it affects. This is crucial for Quell to know which parts of the cache should be invalidated when a mutation occurs.

To do this, you should create a mapping object where each key is the mutation name (as used in your GraphQL queries) and the value is an array of schema names that are affected by this mutation. 

Below is an example of a Quell-compatible schema:

```javascript
const UserType = new GraphQLObjectType({
  name: 'User',
  fields: () => {
    id: {type: GraphQLID},
    usernames: {type: GraphQLString},
    // fields
  }
})

const RootQuery = new GraphQLObjectType({
  name: 'RootQuery',
  field: {
    users: { ... },
    // other queries
  }
})

const RootMutation = new GraphQLObjectType({
  name: 'RootMutation',
  fields: {
    addUsers: { ... },
    deleteUsers: { ... },
    // other mutations
  }
})

export const mutationMap = {
  addUser: ['users'],
  deleteUser: ['users'],
};

module.exports = new GraphQLSchema({
    query: RootQuery,
    mutation: RootMutation,
    types: [UserType]
  });
```
Once you have created this mapping object, you need to export it from the file where it is defined and then import it into the file where Quell is being used. This mapping object should be passed into the invocation of Quellify.
```javascript
const { Quellify, clearCache } = require("@quell/client/dist/Quellify");
const { mutationMap } = require('./schema/schema');
...
Quellify("/api/graphql", query, { maxDepth, maxCost, ipRate }, mutationMap) { ... }
```
By doing this, Quell will be aware of the relationships between mutations and parts of your schema, and can intelligently invalidate the cache as needed when mutations occur.


---
### Usage Notes

- @quell/server reads queries from Express' request object at `request.body.query` and attaches the query response to Express' response object at `response.locals.queryResponse`.
- @quell/server can only cache items it can uniquely identify. It will will look for fields called `id`, `_id`, `Id`, or `ID`. If a query lacks all four, it will execute the query without caching the response.
- Currently, Quell can cache: 
  - query-type requests without variables or directives.
  - mutation-type requests (add, update, and delete) with cache invalidation implemented.
- Quell will still process other requests, but will not cache the responses.

#### For information on @quell/client, please visit the corresponding [README file](https://github.com/open-source-labs/Quell/tree/master/quell-client).