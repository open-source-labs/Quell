import React, { useState } from 'react';

// component to get ALL data from our created DB
const GetAll = () => {
  const [queryResponse, setQueryResponse] = useState('');

  // this.state = {
  //   count: 0,
  // }
  // this.setState( { count: 5 } )
  // <h1>this.state.count</h1>

  

  // query for full dataset
  const query = `
    // countries {
    //   results {
    //     id
    //     name
    //     capital
    //     languages {
    //       results {
    //         name
    //       }
    //     }
    //     cities {
    //       results {
    //         country {
    //           id
    //         }
    //         id
    //         cityId
    //         name
    //         population
    //       }
    //     }
    //   }
    // }
    {
      countries {
        name
        id
        capital
      }
    }
  `

  function handleClick() {
    fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({query: query})
    })
    .then(res => res.json())
    .then(res => {
      console.log(res);
      setQueryResponse(`${res}`);
    })
    .catch(err => console.log(err))
  }

  return(
    <div className="query-container">
      <h2>Query All</h2>
      <div className="query">Query Input</div>
      <button className="run-query-btn" onClick={handleClick}>Run Query</button>
      <div className="results-view">
        <h2>Results View</h2>
        {queryResponse}
      </div>
    </div>
  )
}

export default GetAll;