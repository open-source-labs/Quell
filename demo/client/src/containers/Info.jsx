import React from 'react';
import Header from '../images/headers/QUELL-headers-info w lines_2.svg';
import Dots from '../images/graphics/QUELL-dots-ombre dark.svg';
import Query from '../images/graphics/QUELL-illu-query.svg';
import Puzzle from '../images/graphics/QUELL-illu-puzzle.svg';
import Airmail from '../images/graphics/QUELL-illu-airmail_3.svg';

const Info = () => {
  return (
    <div className='info-container'>
      <div id='info-header-container'>
        <img id='info-header' src={Header}></img>
      </div>
      <div className='info-text'>
        <h4>
          Quell is an open source, lightweight JavaScript library providing a client- and server-side caching
          solution and cache invalidation for GraphQL.
        </h4>
        <br></br>
        <div className='dots-container'>
          <img id='dots' src={Dots}></img>
        </div>

        <p>
          Quell's schema-governed, type-level normalization algorithm
          deconstructs GraphQL query and mutation responses into individual graph nodes to be
          cached separately as constant-time-readable key-value pairs, with
          references to connected nodes.
        </p>
        <div className='quell-graph-container'>
          <img id='quell-graph' src={Query}></img>
        </div>

        <p>
          Subsequent GraphQL requests are then checked against the cached data
          store in client-side cache storage first, allowing Quell to only request the data 
          it needs by dynamically reformulating a new query for what's missing.
        </p>

        <div className='quell-puzzle-container'>
          <img id='quell-puzzle' src={Puzzle}></img>
        </div>
        <p>
          Query responses are then merged with the data present in the client cache storage and
          a full response is returned seamlessly.
        </p>
        <div className='quell-airmail-container'>
          <img id='quell-airmail' src={Airmail}></img>
        </div>
      </div>
    </div>
  );
};

export default Info;
