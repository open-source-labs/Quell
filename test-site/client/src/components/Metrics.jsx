import React from 'react';

const Metrics = (props) => {
  const { fetchTime, cacheStatus } = props;
  return(
    <div className="metrics-div">
      <h3>Metrics:</h3>
      <div className="metrics-grid">
        <div className="timer-div">
          <div className="metric-value">{fetchTime}</div>
          <div className="metric-label">Cache/Fetch Time</div>
          <div></div>
        </div>
        <div className="cache-storage-div">
          {/* <div className="metric-value">{storageSpace}</div> */}
          <div className="metric-label">Cache Stored</div>
        </div>
      </div>
      <div className="cache-cleared-div">Cache Cleared: {cacheStatus}</div>
    </div>
  )
}

export default Metrics;