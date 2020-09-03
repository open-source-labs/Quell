import React, { useState } from 'react';

// component to get ALL data from our created DB
const QueryAll = () => {
  const [queryResponse, setQueryResponse] = useState('');

  // // query for full dataset
  // const query = `
  //   countries {
  //     results {
  //       id
  //       name
  //       capital
  //       languages {
  //         results {
  //           name
  //         }
  //       }
  //       cities {
  //         results {
  //           country {
  //             id
  //           }
  //           id
  //           cityId
  //           name
  //           population
  //         }
  //       }
  //     }
  //   }
  // `
  
  const query = `
  {
    countries {
      name
      id
      capital
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
      setQueryResponse(JSON.stringify(res.data.countries));
    })
    .catch(err => console.log(err))
  }

  return(
    <div className="query-container">
      <h2>Query All</h2>
    <div className="query">Query Input: {query}</div>
      <button className="run-query-btn" onClick={handleClick}>Run Query</button>
      <h2>Results:</h2>
      <div className="results-view">
        {queryResponse}
      </div>
    </div>
  )
}

export default QueryAll;