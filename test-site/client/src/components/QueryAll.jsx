import React, { useState } from 'react';
import Quell from '../quell-client.js'

// component to get ALL data from our created DB
const QueryAll = () => {
  const [queryResponse, setQueryResponse] = useState('');
  const [storageSpace, setStorageSpace] = useState('0');
  const [time, setTime] = useState(0);

  // // query for full dataset
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
  const handleClick = () => {
    Quell.quellFetch(queryCall)
      .then(res => setQueryResponse(res))
      .then(() => {
        setStorageSpace(Quell.calculateSessionStorage())
        setTime(Quell.performanceTime)
      })
      .catch(err => console.log(err))
  }

  return (
    <div className="query-container">
      <h2>Query All</h2>
      <div className="query">Query Input: {queryCall}</div>
      <button className="run-query-btn" onClick={handleClick}>Run Query</button>
      <h3>Results:</h3>
      <div className="results-view">
        {queryResponse}
      </div>
      <h3>Stored In Cache: {storageSpace}</h3>
      <h3>Timer: {time}</h3>
    </div>
  )
}

export default QueryAll;