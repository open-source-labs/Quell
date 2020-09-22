# Quell-Client

## Installation

Download Quell-Client from npm in your terminal with `npm i quell-client`.

## Implementation

Let's take a look at a typical use case for Quell-Client by re-writing a GraphQL fetch.

Sample Code of existing fetch:

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
    .then(parsedRes => results = parsedRes)

    ... (use results)
}

fetchMe(sampleQuery)

```

Require in Quell with `import Quell from 'quell-client'`.

Now, instead of calling `fetchMe(query)`, replace with `Quell.quellify(endpoint, query, map, fieldsMap)`.

The `quellify` method takes in four parameters.

1. **_endpoint_** - your GraphQL endpoint as a string (ex. '/graphQL')
2. **_query_** - your GraphQL query as a string (ex. see sampleQuery above)
3. **_map_** - an object that maps named queries to GraphQL Object Types (ex. see sampleMap below)
4. **_fieldsMap_** - an object that maps Fields to GraphQL Object Types (ex. see sampleFieldsMap below)

```
const sampleMap = {
    countries: 'Country',
    country: 'Country',
    citiesByCountryId: 'City',
    cities: 'City',
}

const sampleFieldsMap = {
    cities: 'City'
}

```

Using the example snippets above, your final replacement function would look like this:

`Quell.quellify('/graphQL', sampleQuery, sampleMap, sampleFieldsMap) .then( ... (use results) )`

You will now be caching and retrieving your results from sessionStorage!

#### For information on Quell-Server, please visit the corresponding README file.
