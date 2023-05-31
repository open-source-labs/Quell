[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/open-source-labs/Quell/blob/master/LICENSE)
![AppVeyor](https://img.shields.io/badge/version-5.0.0-blue.svg)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/open-source-labs/Quell/issues)

# @quell/client

@quell/client is an easy-to-implement JavaScript library providing a simple, client-side caching solution and cache invalidation for GraphQL. Quell's client-side cache implementation caches whole queries as keys and saves their results as values in LokiJS.

@quell/client is an open-source NPM package accelerated by [OS Labs](https://github.com/open-source-labs) and developed by [Jonah Weinbaum](https://github.com/jonahpw), [Justin Hua](https://github.com/justinfhua), [Lenny Yambao](https://github.com/lennin6), [Michael Lav](https://github.com/mikelav258), [Angelo Chengcuenca](https://github.com/amchengcuenca), [Emily Hoang](https://github.com/emilythoang), [Keely Timms](https://github.com/keelyt), [Yusuf Bhaiyat](https://github.com/yusuf-bha), [Hannah Spencer](https://github.com/Hannahspen), [Garik Asplund](https://github.com/garikAsplund), [Katie Sandfort](https://github.com/katiesandfort), [Sarah Cynn](https://github.com/cynnsarah), [Rylan Wessel](https://github.com/XpIose), [Alex Martinez](https://github.com/alexmartinez123), [Cera Barrow](https://github.com/cerab), [Jackie He](https://github.com/Jckhe), [Zoe Harper](https://github.com/ContraireZoe), [David Lopez](https://github.com/DavidMPLopez), [Sercan Tuna](https://github.com/srcntuna), [Idan Michael](https://github.com/IdanMichael), [Tom Pryor](https://github.com/Turmbeoz), [Chang Cai](https://github.com/ccai89), [Robert Howton](https://github.com/roberthowton), [Joshua Jordan](https://github.com/jjordan-90), [Jinhee Choi](https://github.com/jcroadmovie), [Nayan Parmar](https://github.com/nparmar1), [Tashrif Sanil](https://github.com/tashrifsanil), [Tim Frenzel](https://github.com/TimFrenzel), [Robleh Farah](https://github.com/farahrobleh), [Angela Franco](https://github.com/ajfranco18), [Ken Litton](https://github.com/kenlitton), [Thomas Reeder](https://github.com/nomtomnom), [Andrei Cabrera](https://github.com/Andreicabrerao), [Dasha Kondratenko](https://github.com/dasha-k), [Derek Sirola](https://github.com/dsirola1), [Xiao Yu Omeara](https://github.com/xyomeara), [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile) and [Justin Jaeger](https://github.com/justinjaeger).

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
}`;

fetch('/graphQL', {
  method: 'POST',
  body: JSON.stringify(sampleQuery)
});

costOptions = {
  maxCost: 50,
  maxDepth: 10,
  ipRate: 5
};
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
Quellify('/graphQL', sampleQuery, costOptions).then(/* use parsed response */);
```

Note: Quell will return a promise that resolves into an array with two elements. The first element will be a JS object containing your data; this is in the same form as the response found on the 'data' key of a typical GraphQL response `{ data: // response }`. The second element will be a boolean indicating whether or not the data was found in the client-side cache.

That's it! You're now caching your GraphQL queries in the LokiJS client-side cache storage.

### Usage Notes

- Quell Client now supports GraphQL mutations, simplifying the process of caching mutations and keeping the cache synchronized with the server. When a mutation is executed, the mutation request is sent to the GraphQL server as usual, and once the server responds with the mutation result, Quell Client updates the cache with the new data. Quell can handle create, edit, or delete mutations.

- The LRU Cache uses a MAX_CACHE_SIZE to determine the size of the cache. You can update this number to fit your needs.


# Future Additions


Goals for the future of Quell/client include:

- The caching logic for the server-side is multi-faceted and robust, while recent iterations of Quell removed much of the functionality on the client-side. Though the current iteration works to address some of these issues and rebuild functionality, starting with handling mutations and implementing LRU caching, more work can be done on the client-side. This includes:

1. The client-side DB could be transitioned from LokiDB to a newer DB technology that also offers in-memory storage for quick retrieval of data, as LokiDB has been largely deprecated.

2. Extending the algorithm beyond LRU, such as adding a Least Frequently Used (LFU) caching algorithm to account for different data access patterns.

3. Refactoring and removing any redundancies, in particular with refetching and updating the LRU cache.

4. Increase testing coverage for the current implementation of the client-side cache.

#### For information on @quell/server, please visit the corresponding [README file](../quell-server/README.md).
