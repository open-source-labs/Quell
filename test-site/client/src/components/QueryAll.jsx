import React, { useState } from 'react';
import Quell from '../quell-client.js'

// component to get ALL data from our created DB
const QueryAll = () => {
  const [queryResponse, setQueryResponse] = useState('');

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

  // const checkStorage = (query) => {
  //   // is query in storage?
  //   if (sessionStorage.getItem(query)) return true
  //   return false
  // }

  // const serveFromCache = (query) => {
  //   // return from storage and update state
  //   console.log('Serving from cache')
  //   return sessionStorage.getItem(query)
  // }

  // const fetchAndServe = (query, endpoint = '/graphql') => {
  //   // return from fetch and update state
  //   fetch(endpoint, {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json'
  //     },
  //     body: JSON.stringify({ query: query })
  //   })
  //     .then(res => res.json())
  //     .then(res => {
  //       const responseData = JSON.stringify(res.data);
  //       console.log('Saving to cache')
  //       sessionStorage.setItem(query, responseData);

  //       return responseData;
  //     })
  //     .catch(err => console.log(err))
  // }

  // const quellFetch = (query) => {
  //   // check if full query is in cache, if so serve result from cache
  //   if (checkStorage(query)) return serveFromCache(query)

  //   // query not found in cache, fetch data from server and return data
  //   return fetchAndServe(query)
  // }

  const handleClick = () => {
    // run quellFetch() to receive result
    const displayResults = Quell.quellFetch(queryCall)
    console.log('handleClick for displayResults', displayResults)
    // update state to display results
    setQueryResponse(displayResults);
  }

  return (
    <div className="query-container">
      <h2>Query All</h2>
      <div className="query">Query Input: {queryResponse}</div>
      <button className="run-query-btn" onClick={handleClick}>Run Query</button>
      <h3>Results:</h3>
      <div className="results-view">
        {queryResponse}
      </div>
    </div>
  )
}

export default QueryAll;