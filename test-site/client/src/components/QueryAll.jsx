import React, { useState } from 'react';
import Quell from '../quell-client.js'

// component to get ALL data from our created DB
const QueryAll = () => {
  const [queryResponse, setQueryResponse] = useState({});
  const [storageSpace, setStorageSpace] = useState('0 KB');
  const [fetchTime, setFetchTime] = useState('0.00 ms');
  const [cacheStatus, setCacheStatus] = useState('');

  // query for full dataset
  const queryCall = `
  {
    country(id: "1"){
      id
      name
      capital
      cities{
        country_id
        id
        name
        population
      }
    }
    countries{
      name
    }
    citiesByCountry(country_id: "3"){
      country_id
      id
      name
      population
    }
    cities{
      country_id
      id
      name
      population
    }
  }
  `

  const formatTimer = (time) => {
    return time.toFixed(2) + ' ms'
  }

  const handleFetchClick = () => {
    Quell.quellFetch(queryCall)
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
        {/* <h2>Query All</h2> */}
        <div className="query-div-title">Query All</div>
        <div className="query">Query Input: {queryCall}</div>
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

export default QueryAll;