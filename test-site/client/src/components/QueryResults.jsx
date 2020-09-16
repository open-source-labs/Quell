import React from 'react';

const QueryResults = (props) => {
  const { queryResponse } = props;
  return(
    <div className="results-div">
      <h3>Results:</h3>
      <div className="results-view">
        <pre>
          <code>
            {JSON.stringify(queryResponse, null, 2)}
          </code>
        </pre>
      </div>
    </div>
  )
}

export default QueryResults;