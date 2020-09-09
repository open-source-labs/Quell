import React, { useState } from 'react';
import Quell from '../quell-client.js'

// component to get ALL data from our created DB
const QuerySome = () => {
  const [queryInput, setQueryInput] = useState('');
  const [queryResponse, setQueryResponse] = useState({});
  // const [queryResponseError, setQueryResponseError] = useState('');
  const [storageSpace, setStorageSpace] = useState('0 KB');
  const [fetchTime, setFetchTime] = useState('0.00 ms');
  const [cacheStatus, setCacheStatus] = useState('');

  const handleChange = e => {
    setQueryInput(e.target.value)
  }

  const formatTimer = (time) => {
    return time.toFixed(2) + ' ms'
  }

  const handleFetchClick = () => {
    Quell.quellFetch(queryInput)
      .then(res => JSON.parse(res))
      .then(res => {
        // query response state
        setQueryResponse(res);

        // storage state
        setStorageSpace(Quell.calculateSessionStorage());

        // timer state
        const fTime = formatTimer(Quell.performanceTime);
        setFetchTime(fTime);
      })
      .catch(err => console.log(err))
  }

  const handleClearClick = () => {
    sessionStorage.clear();
    setStorageSpace('0');
    setFetchTime('0.00 ms');
    let date = new Date();
    setCacheStatus(date.toString());
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
            <div className="metric-value">{fetchTime}</div>
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
      </div>

    </div>
  )
}

export default QuerySome;