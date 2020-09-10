const quell = {};

quell.quellFetch = (query, endpoint = '/graphql') => {
    // timer Start
    let startTime, endTime;
    startTime = performance.now();

    const promise = new Promise((resolve, reject) => {
        // remove whitespace in query to convert to sessionStorage key
        const stringifyQuery = JSON.stringify(query.replace(/\s/g, ''));
        // search query key in sessionStorage
        const inSessionStorage = sessionStorage.getItem(stringifyQuery);

        // if query key value exists in cache, return that value
        if (inSessionStorage) {
            // timer End
            endTime = performance.now();
            quell.performanceTime = endTime - startTime;

            // return query value
            console.log('Serving from Cache:')
            return resolve(inSessionStorage);
        }

        // if query value does not exist in cache - fetch GQL request > save response to cache > return response value
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: query })
        })
            .then(res => res.json()) // parse the server response
            .then(res => {
                // set sessionStorage key by removing whitespace from query 
                const stringifyQuery = JSON.stringify(query.replace(/\s/g, ''));
                // set sessionStorage value by stringifying data property on res object
                const responseData = JSON.stringify(res.data);
                // save query to session Storage
                sessionStorage.setItem(stringifyQuery, responseData);

                // timer End
                endTime = performance.now();
                quell.performanceTime = endTime - startTime;
                
                // return fetch res value
                console.log('Serving from Fetch:')
                return resolve(responseData);
            })
            .catch(err => reject(err))
    });

    return promise;
}

quell.calculateSessionStorage = () => {
    var _lsTotal = 0,
        _xLen, _x;
    for (_x in sessionStorage) {
        if (!sessionStorage.hasOwnProperty(_x)) {
            continue;
        }
        _xLen = ((sessionStorage[_x].length + _x.length) * 2);
        _lsTotal += _xLen;
        // console.log(_x.substr(0, 50) + " = " + (_xLen / 1024).toFixed(2) + " KB")
    };
    return ((_lsTotal / 1024).toFixed(2) + " KB");
}

export default quell
