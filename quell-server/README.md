[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/open-source-labs/Quell/blob/master/LICENSE)
![AppVeyor](https://img.shields.io/badge/build-passing-brightgreen.svg)
![AppVeyor](https://img.shields.io/badge/version-10.0.0-blue.svg)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/open-source-labs/Quell/issues)

# @quell/server

@quell/server is an easy-to-implement Node.js/Express middleware that satisfies and caches GraphQL queries and mutations. Quell's schema-governed, type-level normalization algorithm caches GraphQL query and mutation responses as flattened key-value representations of the graph's nodes, making it possible to partially satisfy queries from the server's Redis cache, reformulate the query, and then fetch additional data from other APIs or databases.
<div align="center">

![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Jest](https://img.shields.io/badge/-jest-%23C21325?style=for-the-badge&logo=jest&logoColor=white)
![Testing-Library](https://img.shields.io/badge/-TestingLibrary-%23E33332?style=for-the-badge&logo=testing-library&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?&style=for-the-badge&logo=redis&logoColor=white)
![GraphQL](https://img.shields.io/badge/-GraphQL-E10098?style=for-the-badge&logo=graphql&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![MySQL](https://img.shields.io/badge/mysql-%2300f.svg?style=for-the-badge&logo=mysql&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

</div>

## Table of Contents

- [Installation](#installation)
  - [Installing and Connecting a Redis Server](#installing-and-connecting-a-redis-server)
  - [Install @quell/server](#install-quellserver)
- [Quick Setup with CLI](#quick-setup-with-cli)
  - [Installation](#installation-1)
  - [CLI Options](#cli-options)
  - [Basic Commands](#basic-commands)
  - [What the CLI Creates](#what-the-cli-creates)
  - [Generated Dependencies](#generated-dependencies)
  - [Post-Installation Setup](#post-installation-setup)
- [Implementation Guide](#implementation-guide)
  - [QuellCache vs QuellRouter](#quellcache-vs-quellrouter)
  - [QuellCache - For Local Schemas](#quellcache---for-local-schemas)
  - [QuellRouter - For 3rd Party APIs](#quellrouter---for-3rd-party-apis)
  - [Hybrid Implementation](#hybrid-implementation)
- [Rate and Cost Limiting Implementation](#rate-and-cost-limiting-implementation)
- [Schema Compatibility Layer](#schema-compatibility-layer)
- [Usage Notes](#usage-notes)
  - [Caching Behavior](#caching-behavior)
- [Contributors](#contributors)
- [Related Documentation](#related-documentation)

---

@quell/server is an open-source NPM package accelerated by [OS Labs](https://github.com/open-source-labs) and developed by [Cassidy Komp](https://github.com/mimikomp), [Andrew Dai](https://github.com/andrewmdai), [Stacey Lee](https://github.com/staceyjhlee), [Ian Weinholtz](https://github.com/itsHackinTime), [Angelo Chengcuenca](https://github.com/amchengcuenca), [Emily Hoang](https://github.com/emilythoang), [Keely Timms](https://github.com/keelyt), [Yusuf Bhaiyat](https://github.com/yusuf-bha), [Chang Cai](https://github.com/ccai89), [Robert Howton](https://github.com/roberthowton), [Joshua Jordan](https://github.com/jjordan-90), [Jinhee Choi](https://github.com/jcroadmovie), [Nayan Parmar](https://github.com/nparmar1), [Tashrif Sanil](https://github.com/tashrifsanil), [Tim Frenzel](https://github.com/TimFrenzel), [Robleh Farah](https://github.com/farahrobleh), [Angela Franco](https://github.com/ajfranco18), [Ken Litton](https://github.com/kenlitton), [Thomas Reeder](https://github.com/nomtomnom), [Andrei Cabrera](https://github.com/Andreicabrerao), [Dasha Kondratenko](https://github.com/dasha-k), [Derek Sirola](https://github.com/dsirola1), [Xiao Yu Omeara](https://github.com/xyomeara), [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile), and [Justin Jaeger](https://github.com/justinjaeger), [Alicia Brooks](https://github.com/abrooks11), [Aditi Srivastava](https://github.com/dsriva03), [Jeremy Dalton](https://github.com/jeremycoledalton).

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

# Quick Setup with CLI

The fastest way to get started with Quell is using our CLI tool, which automatically sets up your project with all necessary files and dependencies.

## Installation

Run the Quell CLI in your project directory:

```bash
npx quell init
```

## CLI Options

### Basic Commands

```bash
# Basic initialization
npx quell init

# Initialize with example files
npx quell init --example

# Overwrite existing files
npx quell init --force

# Skip automatic dependency installation
npx quell init --skip-install

# Use JavaScript templates instead of TypeScript
npx quell init --javascript
```

## What the CLI Creates

The CLI automatically generates these files in your project:

### Configuration Files
- **`.env`** - Environment variables for Redis and caching configuration
- **`quell-config.ts`** - Main Quell configuration with schema integration
- **`.gitignore`** - Updated with Quell-specific entries

### Example Files (with `--example` flag)
- **`src/server/example-server.ts`** - Complete Express server with Quell middleware
- **`src/server/schema/example-schema.ts`** - Sample GraphQL schema with resolvers

### Package Configuration
- **`package.json`** - Updated with necessary scripts and dependencies

## Generated Dependencies

The CLI automatically installs these packages:

**Production Dependencies:**
- `express` - Web framework
- `graphql` - GraphQL implementation
- `redis` - Redis client
- `dotenv` - Environment variable loader

**Development Dependencies:**
- `nodemon` - Development server with auto-reload
- `typescript` - TypeScript compiler
- `ts-node` - TypeScript execution engine
- `@types/express` - Express type definitions
- `@types/node` - Node.js type definitions

## Post-Installation Setup

After running the CLI, follow these steps:

### 1. Configure Redis

Update your `.env` file with your Redis connection details:

```env
# Local Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Or Redis Cloud/hosted service
REDIS_HOST=your-redis-host.com
REDIS_PORT=12345
REDIS_PASSWORD=your-password
```

### 2. Update Your Schema

Replace the example schema in `quell-config.ts` with your actual GraphQL schema:

```typescript
import { QuellCache } from '@quell/server';
import { yourSchema } from './path/to/your/schema'; // Replace this

export const quellCache = new QuellCache({
  schema: yourSchema, // Use your actual schema
  cacheExpiration: Number(process.env.CACHE_EXPIRATION || 1209600),
  redisPort: Number(process.env.REDIS_PORT || 6379),
  redisHost: process.env.REDIS_HOST || "127.0.0.1",
  redisPassword: process.env.REDIS_PASSWORD || "",
});
```

### 3. Start Development

```bash
# Start the development server
npm run dev

# Visit your GraphQL endpoint
# http://localhost:4000/graphql
```

## Implementation Guide

### QuellCache vs QuellRouter

Quell provides two complementary caching strategies:

#### QuellCache - For Local Schemas
- **Use Case**: Your own GraphQL server with direct schema access
- **Caching**: Normalized, entity-based caching
- **Features**: 
  - Field-level cache invalidation
  - Automatic cache key generation
  - Mutation-aware cache updates
  - Schema introspection for universal compatibility

```typescript
import { QuellCache } from '@quell/server';

const quellCache = new QuellCache({
  schema: yourGraphQLSchema,
  cacheExpiration: 3600,
  redisHost: process.env.REDIS_HOST,
  redisPort: Number(process.env.REDIS_PORT)
});

app.use('/graphql', 
  quellCache.rateLimiter,
  quellCache.costLimit,
  quellCache.depthLimit,
  quellCache.query,
  (req, res) => res.json({ queryResponse: res.locals })
);
```

#### QuellRouter - For 3rd Party APIs
- **Use Case**: External GraphQL APIs (GitHub, Contentful, etc.)
- **Caching**: Query-based key-value caching
- **Features**:
  - Hash-based cache keys
  - API-specific cache namespacing
  - Custom headers per API
  - Automatic cache TTL management

```typescript
import { createQuellRouter } from '@quell/server';

const quellRouter = createQuellRouter({
  endpoints: {
    '/graphql': 'local',                                    // Use QuellCache
    '/graphql/github': 'https://api.github.com/graphql',  // External API
    '/graphql/spacex': 'https://api.spacex.land/graphql'  // External API
  },
  cache: quellCache.redisCache,
  cacheExpiration: 3600,
  debug: true,
  headers: {
    github: {
      'Authorization': 'Bearer your-github-token',
      'User-Agent': 'YourApp/1.0'
    }
  }
});

app.use(quellRouter);
```

### Hybrid Implementation

Combine both for maximum flexibility:

```typescript
import express from 'express';
import { QuellCache, createQuellRouter } from '@quell/server';
import { localSchema } from './schema';

const app = express();

// Initialize QuellCache for local schema
const quellCache = new QuellCache({
  schema: localSchema,
  cacheExpiration: 3600
});

// Create router for handling both local and external APIs
const quellRouter = createQuellRouter({
  endpoints: {
    '/graphql': 'local',                          // Routes to QuellCache
    '/graphql/external': 'https://api.external.com/graphql'
  },
  cache: quellCache.redisCache,
  debug: process.env.NODE_ENV === 'development'
});

// Apply router first (handles routing logic)
app.use(quellRouter);

// Local GraphQL endpoint (processed after router)
app.use('/graphql',
  quellCache.query,
  (req, res) => res.json({ queryResponse: res.locals })
);

// Cache management endpoints
app.get('/clear-cache', quellCache.clearCache);
app.get('/clear-external-cache', async (req, res) => {
  const cleared = await quellRouter.clearApiCache('external');
  res.json({ message: `Cleared ${cleared} external cache entries` });
});
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

### Schema Compatibility Layer

Quell uses GraphQL introspection to achieve universal schema compatibility:

```typescript
// Any schema format works
const apolloSchema = makeExecutableSchema({ typeDefs, resolvers });
const vanillaSchema = buildSchema(`type Query { hello: String }`);
const customSchema = new GraphQLSchema({ query: queryType });

// All automatically converted to standardized format
const quellCache = new QuellCache({ schema: anySchema });
```

---

## Usage Notes

### **Caching Behavior**

- **@quell/server** reads GraphQL queries from `request.body.query` and attaches responses to `response.locals.queryResponse`

- **Cacheable queries** must include ID fields (`id`, `_id`, `Id`, or `ID`) for unique entity identification

### **Supported operations:**
 - Queries with variables, arguments, nested fields, fragments, and aliases
 - Mutations (add/update/delete) with automatic cache invalidation

### **Non-cacheable operations** (executed without caching):
 - Queries with GraphQL directives (`@include`, `@skip`)
 - Subscription operations  
 - Queries with introspection fields (starting with `__`)
 - Queries missing ID fields

- **Universal schema compatibility** works with any GraphQL schema format through introspection

---

## Contributors

@quell/server is an open-source NPM package accelerated by [OS Labs](https://github.com/open-source-labs) and developed by [Cassidy Komp](https://github.com/mimikomp), [Andrew Dai](https://github.com/andrewmdai), [Stacey Lee](https://github.com/staceyjhlee), [Ian Weinholtz](https://github.com/itsHackinTime), [Angelo Chengcuenca](https://github.com/amchengcuenca), [Emily Hoang](https://github.com/emilythoang), [Keely Timms](https://github.com/keelyt), [Yusuf Bhaiyat](https://github.com/yusuf-bha), [Chang Cai](https://github.com/ccai89), [Robert Howton](https://github.com/roberthowton), [Joshua Jordan](https://github.com/jjordan-90), [Jinhee Choi](https://github.com/jcroadmovie), [Nayan Parmar](https://github.com/nparmar1), [Tashrif Sanil](https://github.com/tashrifsanil), [Tim Frenzel](https://github.com/TimFrenzel), [Robleh Farah](https://github.com/farahrobleh), [Angela Franco](https://github.com/ajfranco18), [Ken Litton](https://github.com/kenlitton), [Thomas Reeder](https://github.com/nomtomnom), [Andrei Cabrera](https://github.com/Andreicabrerao), [Dasha Kondratenko](https://github.com/dasha-k), [Derek Sirola](https://github.com/dsirola1), [Xiao Yu Omeara](https://github.com/xyomeara), [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile), and [Justin Jaeger](https://github.com/justinjaeger), [Alicia Brooks](https://github.com/abrooks11), [Aditi Srivastava](https://github.com/dsriva03), [Jeremy Dalton](https://github.com/jeremycoledalton).

## Related Documentation

#### For information on @quell/client, please visit the corresponding [README file](https://github.com/open-source-labs/Quell/tree/master/quell-client).