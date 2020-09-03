import React, { useState } from 'react';

// component to get ALL data from our created DB
const QuerySome = () => {
  const [queryInput, setQueryInput] = useState('');
  const [queryResponse, setQueryResponse] = useState('');

  const handleChange = e => {
    setQueryInput(e.target.value)
  }

  const handleClick = e => {
    fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({query: queryInput})
    })
    .then(res => res.json())
    .then(res => {
      setQueryResponse(JSON.stringify(res.data.countries));
    })
    .catch(err => console.log(err))
  }

  return(
    <div className="query-container">
      <h2>Query Some</h2>
      <div className="text-area">
        <label htmlFor="custom-query">Query Input: {queryInput}</label><br/>
        <textarea id="custom-query" rows="20" cols="80" placeholder="Enter query..." onChange={handleChange}></textarea><br/>
        <button className="run-query-btn" onClick={handleClick}>Run Query</button>
      </div>
      <h2>Results:</h2>
      <div className="results-view">
        {queryResponse}
      </div>
    </div>
  )
}

export default QuerySome;