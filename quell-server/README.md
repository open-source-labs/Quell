# Quell-Server

Quell-Server is an easy-to-implement Node.js/Express middleware that satisfies and caches GraphQL queries. Quell's schema-governed, type-level normalization algorithm caches GraphQL query responses as flattened key-value representations of the graph's nodes, making it possible to partially satisfy queries from the server's Redis cache, reformulate the query, and fetch from other APIs or databases only the data not already cached.

Quell-Server is an open-source NPM package accelerated by [OS Labs](https://github.com/oslabs-beta/) and developed by [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile) and [Justin Jaeger](https://github.com/justinjaeger). 

## Installation

### Installing and Connecting a Redis Server

If not already installed on your server, install Redis.
- Mac-Homebrew:
    - At the terminal, type `brew install redis`.
    - After installation completes, type `redis-server`.
    - Your server should now have a Redis database connection open. Note the port on which it is listening.
- Linux or non-Homebrew:
    - Download appropriate version of Redis from [redis.io/download](http://redis.io/download).
    - Follow installation instructions.
    - Once Redis is successfully installed, follow instructions to open a Redis database connection and note the port on which it is listening.

### Install Quell-Server

Install the NPM package from your terminal: `npm i @quell/server`. 
`@quell/server` will be added as a dependency to your package.json file.

## Implementation

1. Import quell-server into your Node.js/Express file:
  - Common JS: `const { QuellCache } = require('@quell/server');`
  - ES6+: `import { QuellCache } from '@quell/server';`
2. Instantiate QuellCache once for each GraphQL endpoint, passing to it the following arguments:
  - schema - the GraphQL schema you've defined using the graphql-JS library
  - redisPort - the port on which your Redis server is listening
  - cacheExpiration - number of seconds you want data to persist in the Redis cache
3. Add quell-server's controller function `quellCache.query` to the Express route that receives GraphQL queries:

So, for example, to instantiate the middleware to satisfy GraphQL queries using the schema you've stored or imported as `myGraphQLSchema` and cache responses to the Redis database listening on `6379` for `3600` seconds, you would add to your server file:
`const quellCache = new QuellCache(myGraphQLSchema, 6379, 3600);`

And your server file might look like this:
```
const express = require('express');
const myGraphQLSchema = require('./schema/schema');
const { QuellCache } = require('@quell/server')

// create a new Express server
const app = express();

// instantiate quell-server 
const quellCache = new QuellCache(myGraphQLSchema, 6379, 3600);

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

## Usage Notes and Best Practices

- Quell-Server reads queries from Express' request object at `request.body.query` and attaches the query response to Express' response object at `response.locals.queryResponse`.
- Quell-Server can only cache items it can uniquely identify. It will first inspect your schema to identify fields with a [GraphQL ID type](https://graphql.org/learn/schema/#scalar-types). If it cannot find any ID-type fields, it will look for fields called `id` of `_id`. If a query lacks all three, it will execute the query without caching the response.
- Currently, Quell-Server can only cache query-type requests without arguments, aliases, fragments, variables, or directives. Quell-Server will still process these other requests, but will not cache the responses.

#### For information on Quell-Client, please visit the corresponding [README file](https://github.com/oslabs-beta/Quell/tree/master/quell-client).
