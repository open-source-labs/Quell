[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/open-source-labs/Quell/blob/master/LICENSE)
![AppVeyor](https://img.shields.io/badge/version-2.3.1-blue.svg)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/open-source-labs/Quell/issues)

# @quell/server

@quell/server is an easy-to-implement Node.js/Express middleware that satisfies and caches GraphQL queries and mutations. Quell's schema-governed, type-level normalization algorithm caches GraphQL query and mutation responses as flattened key-value representations of the graph's nodes, making it possible to partially satisfy queries from the server's Redis cache, reformulate the query, and then fetch additional data from other APIs or databases.

New with Quell 5.0! 
- (New!) Quell has now migrated from Node-Redis 3.0 to Node-Revis 4.4. This was a breaking change for how Quell stood-up the Redis cache but shouldn't change how Quell is implemented!
- (New!) Quell has now migrated from GraphQL V14.x to GraphQL V16.x. This was a breaking change for Quell logic but shouldn't change how Quell is implemented!
- (New!) Quell/server now offers optional depth and cost limiting middleware to protect your GraphQL endpoint! To use, please explore the [@quell/server readme](./quell-server/README.md).
- (New!) Server-side caching now properly handles fragments and individually caches each datapoint. 
- (New!) Server-side cache now caches entire query in instances where it is unable to cache inidividual datapoints. 
- (New!) Server-side cache will properly join partial responses where the database and cache have different datapoints for the same query.

@quell/server is an open-source NPM package accelerated by [OS Labs](https://github.com/open-source-labs) and developed by [Alex Martinez](https://github.com/alexmartinez123), [Cera Barrow](https://github.com/cerab), [Jackie He](https://github.com/Jckhe), [Zoe Harper](https://github.com/ContraireZoe), [David Lopez](https://github.com/DavidMPLopez),[Sercan Tuna](https://github.com/srcntuna),[Idan Michael](https://github.com/IdanMichael),[Tom Pryor](https://github.com/Turmbeoz), [Chang Cai](https://github.com/ccai89), [Robert Howton](https://github.com/roberthowton), [Joshua Jordan](https://github.com/jjordan-90), [Jinhee Choi](https://github.com/jcroadmovie), [Nayan Parmar](https://github.com/nparmar1), [Tashrif Sanil](https://github.com/tashrifsanil), [Tim Frenzel](https://github.com/TimFrenzel), [Robleh Farah](https://github.com/farahrobleh), [Angela Franco](https://github.com/ajfranco18), [Ken Litton](https://github.com/kenlitton), [Thomas Reeder](https://github.com/nomtomnom), [Andrei Cabrera](https://github.com/Andreicabrerao), [Dasha Kondratenko](https://github.com/dasha-k), [Derek Sirola](https://github.com/dsirola1), [Xiao Yu Omeara](https://github.com/xyomeara), [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile) and [Justin Jaeger](https://github.com/justinjaeger).

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

## Cache Implementation

1. Import quell-server into your Node.js/Express file:

- Common JS: `const { QuellCache } = require('@quell/server');`
- ES6+: `import { QuellCache } from '@quell/server';`

2. Instantiate QuellCache once for each GraphQL endpoint, passing to it the following arguments:

- schema - the GraphQL schema you've defined using the graphql-JS library (NOTE: see 'Schema' section below)
- Redis configuration object - an object with the keys `redisPort`, `redisHost`, and `redisPassword`, with the values mapping to your corresponding Redis server. 
- cacheExpiration - number of seconds you want data to persist in the Redis cache
- costParameters (optional, see "Rate and Cost Limiting Implementation" section below) 

3. Add quell-server's controller function `quellCache.query` to the Express route that receives GraphQL queries:

So, for example, to instantiate the middleware to satisfy GraphQL queries using the schema you've stored or imported as `myGraphQLSchema` and cache responses to a Redis database on your local machine listening at port `6379` for `3600` seconds, you would add to your server file:
`const quellCache = new QuellCache(myGraphQLSchema, 6379, 'localhost', 3600);`

And your server file might look like this:

```javascript
const express = require('express');
const myGraphQLSchema = require('./schema/schema');
const { QuellCache } = require('@quell/server')

// create a new Express server
const app = express();

// instantiate quell-server
const quellCache = new QuellCache(myGraphQLSchema, { redisPort: 6379, redisHost: '127.0.0.1', redisPassword: '...'}, 3600);

// apply Express's JSON parser
app.use(express.json());

// GraphQL route
app.use('/graphql',
    quellCache.query,
    (req, res) => {
    return res
        .status(200)
        .send(res.locals.queryResponse);
    }
);

// expose Express server on port 3000
app.listen(3000);
```

That's it! You now have a normalized cache for your GraphQL endpoint.

## Rate and Cost Limiting Implementation

@quell/server now offers optional cost- and rate-limiting of incoming GraphQL queries for additional endpoint security from malicious nested or costly queries.

Both of these middleware packages use an optional, fourth "Cost Object" parameter in the QuellCache constructor. Below is an example of the default Cost Object.

```javascript
  const defaultCostParams = {
    maxCost: 5000, // maximum cost allowed before a request is rejected
    mutationCost: 5, // cost of a mutation
    objectCost: 2, // cost of retrieving an object
    scalarCost: 1, // cost of retrieving a scalar
    depthCostFactor: 1.5, // multiplicative cost of each depth level
    depthMax: 10 // maximum depth allowed before a request is rejected
  }
```

When parsing an incoming query, @quell/server will build a cost associated with the query relative to how laborious it is to retrieve by using the costs provided in the Cost Object. The costs listed above are the default costs given upon QuellCache instantiation, but these costs can be manually reassigned upon cache creation.

If the cost of a query ever exceeds the `maxCost` defined in our Cost Object, the query will be rejected and return Status 400 before the request is sent to the database. Additionally, if the depth of a query ever exceeds the `depthMax` defined in our Cost Object, the query will be similarly rejected.

Using the implementation described in our "Cache Implementation" section, we could implement depth- and cost-limiting like so:

```javascript
// instantiate quell-server
const quellCache = new QuellCache(myGraphQLSchema, { redisPort: 6379, redisHost: '127.0.0.1', redisPassword: '...'}, 3600, {maxCost: 100, depthMax: 5});

// GraphQL route
app.use('/graphql',
    quellCache.costLimit,
    quellCache.depthLimit,
    quellCache.query,
    (req, res) => {
    return res
        .status(200)
        .send(res.locals.queryResponse);
    }
);
```

Note: Both of these middleware packages work individually or combined, with or without the caching provided by `quellCache.query`.

### Schema

Quell's current iteration requires all schemas passed in to match the schema structure defined in the [GraphQL Docs.](https://graphql.org/learn/schema/) Any other GraphQL schema types (i.e: those made by GraphQL's 'buildSchema' or Apollo's 'makeExecutableSchema') are unreadable by Quell's current schema parser and will result in errors.

Below is an example of a Quell-compatible schema:

```javascript
const UserType = new GraphQLObjectType({
  name: 'User',
  fields: () => {
    id: {type: GraphQLID},
    usernames: {type: GraphQLString},
    /// fields
  }
})

const RootQuery = new GraphQLObjectType({
  name: 'RootQuery',
  field: {
    /// queries
  }
})

const RootMutation = new GraphQLObjectType({
  name: 'RootMutation',
  fields: {
    /// mutations
  }
})

module.exports = new GraphQLSchema({
    query: RootQuery,
    mutation: RootMutation,
    types: [UserType]
  });
```

### Usage Notes

- @quell/server reads queries from Express' request object at `request.body.query` and attaches the query response to Express' response object at `response.locals.queryResponse`.
- @quell/server can only cache items it can uniquely identify. It will will look for fields called `id`, `_id`, `Id`, or `ID`. If a query lacks all four, it will execute the query without caching the response.
- Currently, Quell can cache 1) query-type requests without variables or directives and 2) mutation-type requests (add, update, and delete) with cache invalidation implemented. Quell will still process other requests, but will not cache the responses.

### Future Additions
Goals for the future of @quell/server include:
  - The current caching logic depends on the GraphQL query put in, which depends on the shape and type of Schema used. The current implementation of Quell requires defining your schema using GraphQL Object Types, and as such will not work properly with many users Apollo Schemas.
    1) Implement alternative Parsing functions to identify and handle alternative schema creation, such as schemas made via makeExectuableSchema or BuildSchema from Apollo. These cases were not caught in previous implementations of GraphQL and were not known limitations. 
  - The current caching logic is all bound within a class, making it difficult to separate functionality and modularize and test individual pieces.
    1) Move functions out of the Quell.js file into their own helper functions to be called as needed. This will allow future functionality to be easier to test and implement.
    2) Re-write tests, move tests to be associated with each helper function rather than being a long middleware chain. 

#### For information on @quell/client, please visit the corresponding [README file](../quell-client/README.md).
