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
        <h4>
          Quell is an open source, lightweight client and server-side caching solution for GraphQL.
        </h4>
        <br></br>
        <div className="dots-container">
        <img id="dots"src="../images/graphics/QUELL-dots-ombre dark.svg"></img>
        </div>
        
     
        <p>
          Quell's schema-governed, type-level normalization algorithm deconstructs GraphQL query responses into individual graph nodes to be cached separately as constant-time-readable key-value pairs, with references to connected nodes.
        </p>
        <div className="quell-graph-container">
          <img id="quell-graph" src="../images/graphics/QUELL-illu-query.svg">
          </img>
        </div>
        
        <p>Subsequent GraphQL requests are then checked against the cached data store, allowing Quell to only request the data it needs by dynamically reformulating a new query for what's missing.</p>
        
        <div className="quell-puzzle-container">
          <img id="quell-puzzle" src="../images/graphics/QUELL-illu-puzzle.svg">
          </img>
        </div>
        <p>Query responses are then merged with the data present in the cache and a full response is returned seamlessly.</p> 
        <div className="quell-airmail-container">
          <img id="quell-airmail" src="../images/graphics/QUELL-illu-airmail_3.svg">
          </img>
        </div>
      </div>
      
    </div>
  );
};

export default Info;
