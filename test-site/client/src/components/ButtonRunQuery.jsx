import React from 'react';

const ButtonRunQuery = (props) => {
  const { handleRunQueryClick } = props;
  return(
    <div className="button-query-div">
      <button 
        className="button-query" 
        onClick={handleRunQueryClick}
      >Run Query</button>
    </div>
  )
}

export default ButtonRunQuery;