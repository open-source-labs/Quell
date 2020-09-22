import React from 'react';
import Tooltip from '@material-ui/core/Tooltip';

const Metrics = (props) => {
  const { fetchTime, cacheStatus } = props;
  return (
    <div className='metrics-div'>
      <h3>Metrics:</h3>
      <div className='metrics-grid'>
        <div className='timer-div'>
          <div className='metric-value'>{fetchTime}</div>

          <div className='metric-label'>Cache/Fetch Time</div>
        </div>
      </div>
      <div className='cache-cleared-div'>Cache Cleared: {cacheStatus}</div>
    </div>
  );
};

export default Metrics;
