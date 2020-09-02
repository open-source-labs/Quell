import React, { useState } from 'react';

// component to get ALL data from our created DB
const GetSome = () => {
  const [queryInput, setQueryInput] = useState('');
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

  function handleClick(e) {
    console.log(e.target)
    // fetch('/graphql', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({query: query})
    // })
    // .then(res => res.json())
    // .then(res => {
    //   console.log(res);
    //   setQueryResponse(`${res}`);
    // })
    // .catch(err => console.log(err))
  }

  return(
    <div className="query-container">
      <h2>Query Some</h2>
      <div className="text-area">
        <label for="custom-query">Query Input</label><br/>
        <textarea id="custom-query" rows="20" cols="80">Enter query...</textarea><br/>
        <button className="run-query-btn" onClick={handleClick(e => e.target.value)}>Run Query</button>
      </div>
      <div className="results-view">
        <h2>Results View</h2>
        {queryResponse}
      </div>
    </div>
  )
}

export default GetSome;