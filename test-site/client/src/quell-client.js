const quell = {};

quell.checkStorage = (query) => {
    // is query in storage?
    if (sessionStorage.getItem(query)) return true
    return false
}

quell.serveFromCache = (query) => {
    // return from storage and update state
    console.log('Serving from cache:')
    // console.log(sessionStorage.getItem(query))
    return sessionStorage.getItem(query)
}

quell.fetchAndServe = (query, endpoint = '/graphql') => {
    // return from fetch and update state
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: query })
        })
        .then(res => res.json())
        .then(res => {
            const responseData = JSON.stringify(res.data);
            console.log('Serving from Fetch:')
            // console.log(responseData)
            sessionStorage.setItem(query, responseData);
            return responseData;
        })
        .catch(err => console.log(err))
}

quell.quellFetch = function(query) {
    // check if full query is in cache, if so serve result from cache
    if (this.checkStorage(query)) return this.serveFromCache(query)

    // query not found in cache, fetch data from server and return data
    return this.fetchAndServe(query)
}

export default quell