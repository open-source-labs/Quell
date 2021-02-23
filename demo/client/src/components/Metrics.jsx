import React from 'react';

/*
    Metrics box in the demo
*/

const Metrics = (props) => {
  const { fetchTime, cacheStatus } = props;

  return (
    <>
      <h3 className="metrics-title">Metrics:</h3>
      <div className="metrics-div">
        <div className="metrics-grid">
          <div className="timer-div">
            <div className="metric-value">{fetchTime}</div>
            <div className="metric-label">Cache/Fetch Time</div>
          </div>
        </div>
        <div className="cache-cleared-div">Cache Cleared: {cacheStatus}</div>
      </div>
    </>
  );
};

export default Metrics;
