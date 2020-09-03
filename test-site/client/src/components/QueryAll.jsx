import React, { useState } from 'react';

// component to get ALL data from our created DB
const QueryAll = () => {
  const [queryResponse, setQueryResponse] = useState('');

  // // query for full dataset
  const query = `
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
    fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({query: query})
    })
    .then(res => res.json())
    .then(res => {
      setQueryResponse(JSON.stringify(res.data));
    })
    .catch(err => console.log(err))
  }

  return(
    <div className="query-container">
      <h2>Query All</h2>
    <div className="query">Query Input: {query}</div>
      <button className="run-query-btn" onClick={handleClick}>Run Query</button>
      <h3>Results:</h3>
      <div className="results-view">
        {queryResponse}
      </div>
    </div>
  )
}

export default QueryAll;