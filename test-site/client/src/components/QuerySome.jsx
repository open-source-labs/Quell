import React, { useState } from 'react';
import Trend from 'react-trend';
// import OtherQuell from '../quell-client.js'
import Quell from '../../../../quell-client/quell';

// component to get ALL data from our created DB
const QuerySome = () => {
  const [queryInput, setQueryInput] = useState('');
  const [queryResponse, setQueryResponse] = useState({});
  // const [queryResponseError, setQueryResponseError] = useState('');
  const [storageSpace, setStorageSpace] = useState('0 KB');
  // const [fetchTime, setFetchTime] = useState('0.00 ms');
  // const [fetchTimeIntegers, setFetchTimeIntegers] = useState([0,0]);
  const [cacheStatus, setCacheStatus] = useState('');

  const handleChange = e => {
    setQueryInput(e.target.value)
  }

  // const formatTimer = (time) => {
  //   return time.toFixed(2) + ' ms'
  // }

  const handleFetchClick = () => {
    // Quell.quellFetch(queryInput)
    const quell = new Quell(queryInput, {
      countries: 'Country',
      country: 'Country',
      citiesByCountryId: 'City',
      cities: 'City'
    });
    quell.fetch('/graphql') // looks to quell-client.js
      .then(res => {
        console.log('res', res)
        // JSON.parse(res)
      })
      .then(res => {
        // query response state
        setQueryResponse(res);

        // storage state
        // setStorageSpace(OtherQuell.calculateSessionStorage());

        // // timer state
        // const rawTime = OtherQuell.performanceTime;
        // const fTime = formatTimer(rawTime);
        // setFetchTime(fTime);

        // // line graph
        // const newTime = Number(rawTime.toFixed(3));
        // setFetchTimeIntegers([...fetchTimeIntegers, newTime])
      })
      .catch(err => console.log(err))
  }

  const handleClearClick = () => {
    sessionStorage.clear();
    setStorageSpace('0');
    // setFetchTime('0.00 ms');
    let date = new Date();
    setCacheStatus(date.toString());

    // // line graph - zero out
    // setFetchTimeIntegers([0,0]);
  }

  return(
    <div className="dashboard-grid">

      <div className="query-div">
        {/*Query Main*/}
        {/* <h1>Query Some</h1> */}
        <div className="query-div-title">Query Some</div>
        <div className="text-area">
          <label htmlFor="custom-query">Query Input:</label><br/>
          <textarea id="custom-query" placeholder="Enter query..." onChange={handleChange}></textarea><br/>
        </div>
      </div>

      <div className="button-query-div">
        {/*Run Query Button*/}
        <button className="button-query" onClick={handleFetchClick}>Run Query</button>
      </div>
      
      <div className="results-div">
        {/*Results*/}
        <h3>Results:</h3>
        <div className="results-view">
          <pre>
            <code>
              {JSON.stringify(queryResponse, null, 2)}
            </code>
          </pre>
        </div>
      </div>

      <div className="metrics-div">
        {/*Metrics*/}
        <h3>Metrics:</h3>
        <div className="metrics-grid">
          <div className="timer-div">
            {/* <div className="metric-value">{fetchTime}</div> */}
            <div className="metric-label">Fetch Time</div>
            <div></div>
          </div>
          <div className="cache-storage-div">
            <div className="metric-value">{storageSpace}</div>
            <div className="metric-label">Cache Stored</div>
          </div>
        </div>
          <div className="cache-cleared-div">Cache Cleared: {cacheStatus}</div>
      </div>

      <div className="button-cache-div">
        <button className="button-cache" onClick={handleClearClick}>Clear Cache</button>
      </div>

      <div className="graph-div">
        {/*Line graph*/}
        {/* <div className="graph">Line graph here:</div> */}
        <h3>Speed Graph:</h3>
        {/* <Trend
          className="trend"
          // smooth
          // autoDraw
          // autoDrawDuration={3000}
          // autoDrawEasing="ease-out"
          // data={[5.6,0.25,0.16,0.25,0.04,0.05]}

          data={fetchTimeIntegers}
          gradient={['#1feaea', '#ffd200', '#f72047']}
          radius={0.9}
          strokeWidth={3.2}
          strokeLinecap={'round'}
        /> */}
      </div>

    </div>
  )
}

export default QuerySome;