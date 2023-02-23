
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/open-source-labs/Quell/blob/master/LICENSE)
![AppVeyor](https://img.shields.io/badge/version-5.0.0-blue.svg)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/open-source-labs/Quell/issues)

# @quell/client

@quell/client is an easy-to-implement JavaScript library providing a simple, client-side caching solution and cache invalidation for GraphQL. Quell's client-side cache implementation caches whole queries as keys and saves their results as values in LokiJS. 

@quell/client is an open-source NPM package accelerated by [OS Labs](https://github.com/open-source-labs) and developed by [Hannah Spencer](https://github.com/Hannahspen), [Garik Asplund](https://github.com/garikAsplund), [Katie Sandfort](https://github.com/katiesandfort), [Sarah Cynn](https://github.com/cynnsarah), [Rylan Wessel](https://github.com/XpIose), [Alex Martinez](https://github.com/alexmartinez123), [Cera Barrow](https://github.com/cerab), [Jackie He](https://github.com/Jckhe), [Zoe Harper](https://github.com/ContraireZoe), [David Lopez](https://github.com/DavidMPLopez), [Sercan Tuna](https://github.com/srcntuna), [Idan Michael](https://github.com/IdanMichael), [Tom Pryor](https://github.com/Turmbeoz), [Chang Cai](https://github.com/ccai89), [Robert Howton](https://github.com/roberthowton), [Joshua Jordan](https://github.com/jjordan-90), [Jinhee Choi](https://github.com/jcroadmovie), [Nayan Parmar](https://github.com/nparmar1), [Tashrif Sanil](https://github.com/tashrifsanil), [Tim Frenzel](https://github.com/TimFrenzel), [Robleh Farah](https://github.com/farahrobleh), [Angela Franco](https://github.com/ajfranco18), [Ken Litton](https://github.com/kenlitton), [Thomas Reeder](https://github.com/nomtomnom), [Andrei Cabrera](https://github.com/Andreicabrerao), [Dasha Kondratenko](https://github.com/dasha-k), [Derek Sirola](https://github.com/dsirola1), [Xiao Yu Omeara](https://github.com/xyomeara), [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile) and [Justin Jaeger](https://github.com/justinjaeger).

## Installation

Download @quell/client from npm in your terminal with `npm i @quell/client`.
`@quell/client` will be added as a dependency to your package.json file.

## Implementation

Let's take a look at a typical use case for @quell/client by re-writing a fetch request to a GraphQL endpoint.

Sample code of fetch request without Quell:

```javascript
const sampleQuery = `query {
    countries {
        id
        name
        cities {
            id
            name
            population
        }
    }
}`


fetch('/graphQL', {
    method: "POST",
    body: JSON.stringify(sampleQuery)
})

costOptions = {
  maxCost: 50,
  maxDepth: 10,
  ipRate: 5 
}
```

To make that same request with Quell:

1. Import Quell with `import { Quellify } from '@quell/client'`
2. Instead of calling `fetch(endpoint)` and passing the query through the request body, replace with `Quellify(endpoint, query, costOptions)`

- The `Quellify` method takes in three parameters
  1. **_endpoint_** - your GraphQL endpoint as a string (ex. '/graphQL')
  2. **_query_** - your GraphQL query as a string (ex. see sampleQuery, above)
  3. **_costOptions_** - your cost limit, depth limit, and ip rate limit for your queries (ex. see costOptions, above)


And in the end , your Quell-powered GraphQL fetch would look like this:

```javascript
Quellify('/graphQL', sampleQuery, costOptions)
  .then( /* use parsed response */ );
```

Note: Quell will return a promise that resolves into a JS object containing your data in the same form as a typical GraphQL response `{ data: // response }`

That's it! You're now caching your GraphQL queries in the LokiJS client-side cache storage.

### Usage Notes

- @quell/client now client-side caching speed is 4-5 times faster than it used to be.

- Currently, Quell can cache any non-mutative query. Quell will still process other requests, but all mutations will cause cache invalidation for the entire client-side cache. Please report edge cases, issues, and other user stories to us, we would be grateful to expand on Quells use cases! 

# Future Additions
Goals for the future of Quell/client include:
  - The caching logic for the server-side is multi-faceted, allowing for each query to be broken down into parts and have each data point cached individually. The client-side logic was not working as intended and was iterating through each data-point in the cache. As the cache grew in size this became extremely slow, and as such, the most recent iteration of quell removes much of the functionality to trim the file size down and prevent this issue. 
    1) Implement caching algorithims for caching subsequest queries after a mutation (currently cache invalidation resets the cache after a mutation).
    2) Re-write much of the core logic, as LokiDB has significantly different functions and benefits than a Redis DB. Alternatively, as the logic is very simple right now, the DB could be transitioned from LokiDB to a newer DB technology that also offers in-memory storage for quick retrieval of data. 
  - The previous testing suites created during the original implementation of Quell/client were very thorough, but as the project grew in complexity and versins these tests were not updated to test the new functionality. 
    1) Create new testing suites for the current implementation of the client-side cache.
    2) Restart TDD from the ground up while implementing mutation caching logic. 

#### For information on @quell/server, please visit the corresponding [README file](../quell-server/README.md)).
