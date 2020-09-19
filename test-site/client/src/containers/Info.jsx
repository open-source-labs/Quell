import React from 'react';

const Info = () => {
  return (
    <div className='info-container'>
      <div id='info-header-container'>
        <img
          id='info-header'
          src='../images/headers/QUELL-headers-info w lines_2.svg'
        ></img>
      </div>
      <div className="info-text">
        <p>
          Quell is an open source, lightweight client and server-side caching solution for GraphQL.
        </p>
        <br></br>
        <p>
          Quell's schema-governed, type-level normalization algorithm deconstructs GraphQL query responses into individual graph nodes to be cached separately as constant-time-readable key-value pairs, with references to connected nodes.
        </p>
        <br></br>
        <p>Subsequent GraphQL requests are then checked against the cached data store, allowing Quell to only request the data it needs by dynamically reformulating a new query for what's missing.</p>
        <br></br>
        <p>Query responses are then merged with the data present in the cache and a full response is returned seamlessly.</p> 
      </div>
      
    </div>
  );
};

export default Info;
