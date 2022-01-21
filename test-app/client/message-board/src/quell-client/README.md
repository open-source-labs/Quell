<p align="center"><img src="./assets/QUELL-nested-LG@0.75x.png" width='500' style="margin-top: 10px; margin-bottom: -10px;"></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/open-source-labs/Quell/blob/master/LICENSE)
![AppVeyor](https://img.shields.io/badge/build-passing-brightgreen.svg)
![AppVeyor](https://img.shields.io/badge/version-3.1.1-blue.svg)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/open-source-labs/Quell/issues)

# @quell/client

@quell/client is an easy-to-implement JavaScript library providing a client-side caching solution and cache invalidation for GraphQL. Quell's schema-governed, type-level normalization algorithm caches GraphQL query responses as flattened key-value representations of the graph's nodes, making it possible to partially satisfy queries from LokiJS (client-side cache storage), reformulate the query, and then fetch additional data from other APIs or databases.

@quell/client is an open-source NPM package ccelerated by [OS Labs](https://github.com/open-source-labs) and developed by [Chang Cai](https://github.com/ccai89), [Robert Howton](https://github.com/roberthowton), [Joshua Jordan](https://github.com/jjordan-90), [Jinhee Choi](https://github.com/jcroadmovie), [Nayan Parmar](https://github.com/nparmar1), [Tashrif Sanil](https://github.com/tashrifsanil), [Tim Frenzel](https://github.com/TimFrenzel), [Robleh Farah](https://github.com/farahrobleh), [Angela Franco](https://github.com/ajfranco18), [Ken Litton](https://github.com/kenlitton), [Thomas Reeder](https://github.com/nomtomnom), [Andrei Cabrera](https://github.com/Andreicabrerao), [Dasha Kondratenko](https://github.com/dasha-k), [Derek Sirola](https://github.com/dsirola1), [Xiao Yu Omeara](https://github.com/xyomeara), [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile) and [Justin Jaeger](https://github.com/justinjaeger).

## Installation

Download @quell/client from npm in your terminal with `npm i @quell/client`.
`@quell/client` will be added as a dependency to your package.json file.

## Implementation

Let's take a look at a typical use case for @quell/client by re-writing a fetch request to a GraphQL endpoint.

Sample code of fetch request without Quell:

```
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

function fetchMe(sampleQuery) {
    let results;
    fetch('/graphQL', {
        method: "POST",
        body: JSON.stringify(sampleQuery)
    })
    .then(res => res.json())
    .then(parsedRes => {
      // use parsed results
     });

fetchMe(sampleQuery)
```

To make that same request with Quell:

1. Import Quell with `import Quell from '@quell/client'`
2. Instead of calling `fetchMe(query)`, replace with `Quell(endpoint, query, mutationMap, map, queryTypeMap)`

- The `Quell` method takes in five parameters
  1. **_endpoint_** - your GraphQL endpoint as a string (ex. '/graphQL')
  2. **_query_** - your GraphQL query as a string (ex. see sampleQuery, above)
  3. **_mutationMap_** - an object that maps possible mutations - whether add, update, or delete - to the [user-defined GraphQL mutation types](https://graphql.org/learn/queries/#mutations) they return  
  4. **_map_** - an object that maps named queries to the [user-defined GraphQL types](https://graphql.org/learn/schema/#object-types-and-fields) they return from database/server cache
  5. **_queryTypeMap_** - an object that maps named queries to the [user-defined GraphQL types](https://graphql.org/learn/schema/#object-types-and-fields) they return from client cache
  ```

  const mutationMap = {
    addBook: "Book",
    changeBooksByAuthor: "Book",
    changeBooksByName: "Book",
    deleteBooksByName: "Book",
    deleteBookByAuthor: "Book",
    addBookShelf: "BookShelf",
  };

  const map = {
    countries: 'Country',
    country: 'Country',
    citiesByCountryId: 'City',
    cities: 'City',
  }

  const queryTypeMap = {
    country: 'countries',
    city: 'cities',
    bookShelf: 'BookShelves',
    Book: 'books',
    Books: 'books', 
    Attraction: 'attractions',
    Attractions: 'attractions'
  };

Using the example snippets above, your Quell-powered GraphQL fetch would look like this:

```
Quell('/graphQL', sampleQuery, mutationMap, map, queryTypeMap)
  .then( // use parsed response);
```

Note: Quell will return a promise that resolves into a JS object containing your data in the same form as a typical GraphQL response `{ data: // response }`

That's it! You're now caching your GraphQL queries and mutations in the LokiJS (client-side cache storage).

### Usage Notes

- If you want to specify the headers sent on your GraphQL request, pass in an additional object to Quell like so:

```
const headersObject = {
  'Content-Type': 'application/json',
};

Quell('/graphQL', sampleQuery, mutationMap, map, queryTypeMap, { headers: headersObject })
  .then( // use parsed response);
```

- @quell/client can only cache items it can uniquely identify. It will will look for fields called `id`, `_id`, `Id`, or `ID` on the response. If a query lacks all four, it will execute the query without caching the response.

- Currently, Quell can cache 1) query-type requests without variables or directives and 2) mutation-type requests (add, update, and delete) with cache invalidation implemented. Quell will still process other requests, but will not cache the responses.

#### For information on @quell/server, please visit the corresponding [README file](https://github.com/open-source-labs/Quell/tree/master/quell-server).
