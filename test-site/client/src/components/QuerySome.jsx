import React, { useState } from 'react';
import Quell from '../quell-client.js'

// component to get ALL data from our created DB
const QuerySome = () => {
  const [queryInput, setQueryInput] = useState('');
  const [queryResponse, setQueryResponse] = useState({});
  // const [queryResponseError, setQueryResponseError] = useState('');
  const [storageSpace, setStorageSpace] = useState('0');
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
    <div className="dashboard-container">

      <div className="left-div">
        <div className="query-div">
          {/*Query Main*/}
          <h2>Query Some</h2>
          <div className="text-area">
            <label htmlFor="custom-query">Query Input:</label><br/>
            <textarea id="custom-query" placeholder="Enter query..." onChange={handleChange}></textarea><br/>
          </div>
        </div>

        <div className="button-div">
          {/*Run Query Button*/}
          <button className="run-query-btn" onClick={handleFetchClick}>Run Query</button>
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
      </div>

      <div className="right-div">
        <div className="metrics-div">
          {/*Metrics*/}
          <h3>Stored In Cache: {storageSpace}</h3>
          <h3>Timer: {fetchTime}</h3>
        </div>

        <div className="button-div">
          <button onClick={handleClearClick}>Clear Cache</button>
          <span>  Cleared: {cacheStatus}</span>
        </div>

        <div className="graph-div">
          {/*Line graph*/}
          <div className="graph">Line graph here:</div>
        </div>
      </div>
      
    </div>
  )
}

export default QuerySome;