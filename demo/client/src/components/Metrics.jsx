import React from 'react';

/*
    Metrics box in the demo
*/

const Metrics = (props) => {
  const {
    fetchTime,
    cacheStatus,
    cacheAddStatus,
    cacheClearStatus,
    uncachedTime,
  } = props;

  return (
    <>
      <div>
        <h3
          className='metrics-title'
          style={{ marginTop: '10px', paddingTop: '8px' }}
        >
          Metrics:
        </h3>
      </div>
      <div className='metrics-div'>
        <div className='metrics-grid'>
          <div className='timer-div'>
            <div className='metric-value'>{fetchTime}</div>
            <div className='metric-label'>Cache/Fetch Time</div>
          </div>
        </div>
        <div className='cache-cleared-div'>
          Added To Cache (Y/N): {cacheAddStatus}
        </div>
        <div className='cache-cleared-div'>
          Cache Cleared (Y/N): {cacheClearStatus}
        </div>
        <div className='cache-cleared-div'>
          Uncached Runtime: {uncachedTime}
        </div>
      </div>
    </>
  );
};

export default Metrics;
