<p align="center"><img src="./assets/QUELL-nested-LG@0.75x.png" width='500' style="margin-top: 10px; margin-bottom: -10px;"></p>

# @quell/client

@quell/client is an easy-to-implement client-side caching solution for GraphQL.  Quell's schema-governed, type-level normalization algorithm caches GraphQL query responses as flattened key-value representations of the graph's nodes, making it possible to partially satisfy queries from the browser's sessionStorage, reformulate the query, and fetch from other APIs or databases only the data not already cached.  

@quell/client is an open-source NPM package accelerated by [OS Labs](https://github.com/oslabs-beta/) and developed by [Nick Kruckenberg](https://github.com/kruckenberg), [Mike Lauri](https://github.com/MichaelLauri), [Rob Nobile](https://github.com/RobNobile) and [Justin Jaeger](https://github.com/justinjaeger).

## Installation

Download @quell/client from npm in your terminal with `npm i @quell/client`.
`@quell/client` will be added as a dependency to your package.json file.

## Implementation

Let's take a look at a typical use case for @quell/client by re-writing a GraphQL fetch.

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
2. Instead of calling `fetchMe(query)`, replace with `Quell(endpoint, query, map, fieldsMap)`
  - The `Quell` method takes in four parameters
    1. **_endpoint_** - your GraphQL endpoint as a string (ex. '/graphQL')
    2. **_query_** - your GraphQL query as a string (ex. see sampleQuery, above)
    3. **_map_** - an object that maps named queries to the [user-defined GraphQL types](https://graphql.org/learn/schema/#object-types-and-fields) they return
    ```
    const sampleMap = {
      countries: 'Country',
      country: 'Country',
      citiesByCountryId: 'City',
      cities: 'City',
    }
    ```
    4. **_fieldsMap_** - an object that maps fields to the [user-defined GraphQL types](https://graphql.org/learn/schema/#object-types-and-fields) they return
    ```
    const sampleFieldsMap = {
      cities: 'City'
    }
    ```

Using the example snippets above, your Quell-powered GraphQL fetch would look like this:
```
Quell('/graphQL', sampleQuery, sampleMap, sampleFieldsMap)
  .then( // use parsed response);
```
Note: Quell will return a promise that resolves into a JS object containting your data in the same form as a typical GraphQL response `{ data: // response }`

That's it! You're now caching your GraphQL queries in the browser's sessionStorage.

## Usage Notes

- Currently, Quell can only cache query-type requests without arguments, aliases, fragments, variables, or directives. Quell will still process these other requests, but will not cache the responses.

#### For information on @quell/server, please visit the corresponding [README file](https://github.com/oslabs-beta/Quell/tree/master/quell-server).
