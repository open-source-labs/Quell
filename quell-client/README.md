[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/open-source-labs/Quell/blob/master/LICENSE)
![AppVeyor](https://img.shields.io/badge/build-passing-brightgreen.svg)
![AppVeyor](https://img.shields.io/badge/version-9.0.0-blue.svg)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/open-source-labs/Quell/issues)

# @quell/client

@quell/client is an easy-to-implement JavaScript library providing a client-side caching solution and cache invalidation for GraphQL. Quell's schema-governed, type-level normalization algorithm caches GraphQL query responses as flattened key-value representations of the graph's nodes, making it possible to partially satisfy queries from the client-side cache storage, reformulate the query, and then fetch additional data from other APIs or databases.

@quell/client is an open-source NPM package accelerated by [OS Labs](https://github.com/open-source-labs) and developed by [Cassidy Komp](https://github.com/mimikomp), [Andrew Dai](https://github.com/andrewmdai), [Stacey Lee](https://github.com/staceyjhlee), [Ian Weinholtz](https://github.com/itsHackinTime), [Angelo Chengcuenca](https://github.com/amchengcuenca), [Emily Hoang](https://github.com/emilythoang), [Keely Timms](https://github.com/keelyt), [Yusuf Bhaiyat](https://github.com/yusuf-bha), [David Lopez](https://github.com/DavidMPLopez), [Sercan Tuna](https://github.com/srcntuna), [Idan Michael](https://github.com/IdanMichael), [Tom Pryor](https://github.com/Turmbeoz), [Chang Cai](https://github.com/ccai89), [Robert Howton](https://github.com/roberthowton), [Joshua Jordan](https://github.com/jjordan-90), [Jinhee Choi](https://github.com/jcroadmovie), [Nayan Parmar](https://github.com/nparmar1), [Tashrif Sanil](https://github.com/tashrifsanil), [Tim Frenzel](https://github.com/TimFrenzel), [Robleh Farah](https://github.com/farahrobleh), [Angela Franco](https://github.com/ajfranco18), [Ken Litton](https://github.com/kenlitton), [Thomas Reeder](https://github.com/nomtomnom), [Andrei Cabrera](https://github.com/Andreicabrerao), [Dasha Kondratenko](https://github.com/dasha-k), [Derek Sirola](https://github.com/dsirola1), [Xiao Yu Omeara](https://github.com/xyomeara), [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile), and [Justin Jaeger](https://github.com/justinjaeger).

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

1. Import Quell with `import { Quellify } from '@quell/client/dist/Quellify'`
2. Instead of calling `fetch(endpoint)` and passing the query through the request body, replace with `Quellify(endpoint, query, costOptions)`

- The `Quellify` method takes in three parameters
  1. **_endpoint_** - your GraphQL endpoint as a string (ex. '/graphQL')
  2. **_query_** - your GraphQL query as a string (ex. see sampleQuery, above)
  3. **_costOptions_** - your cost limit, depth limit, and IP rate limit for your queries (ex. see costOptions, above)
  4. **_mutationMap_** - maps mutation names to corresponding parts of the schema.   
        *(For more information, see the Schema section in @quell/server [README file](https://github.com/open-source-labs/Quell/tree/master/quell-server))*


And in the end , your Quell-powered GraphQL fetch would look like this:

```javascript
Quellify('/graphQL', sampleQuery, costOptions, mutationMap)
  .then( /* use parsed response */ );
```

Note: Quell will return a promise that resolves into an array with two elements. The first element will be a JS object containing your data; this is in the same form as the response found on the 'data' key of a typical GraphQL response `{ data: // response }`. The second element will be a boolean indicating whether or not the data was found in the client-side cache.

That's it! You're now caching your GraphQL queries in the client-side cache storage.

### Usage Notes

- @quell/client now client-side caching speed is 4-5 times faster than it used to be.

- Currently, Quell can cache any non-mutative query. Quell will still process other requests, but all mutations will cause cache invalidation for the entire client-side cache. Please report edge cases, issues, and other user stories to us, we would be grateful to expand on Quells use cases! 

#### For information on @quell/server, please visit the corresponding [README file](https://github.com/open-source-labs/Quell/tree/master/quell-server).
