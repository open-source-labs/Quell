const quell = {};

quell.quellFetch = (query, endpoint = '/graphql') => {
    // timer Start
    let startTime, endTime;
    startTime = performance.now();

    const promise = new Promise((resolve, reject) => {

        const inSessionStorage = sessionStorage.getItem(query);

        if (inSessionStorage) {
            console.log('serving from cache')

            // timer End
            endTime = performance.now();
            quell.performanceTime = endTime - startTime;

            return resolve(inSessionStorage);
        }

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
                sessionStorage.setItem(query, responseData);

                // timer End
                endTime = performance.now();
                quell.performanceTime = endTime - startTime;
                
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
