import React from 'react';
import Trend from 'react-trend';

/*
  The "speed graph" in the demo
*/

const Graph = (props) => {
  const { fetchTimeIntegers } = props;

  return(
    <div className="graph-div">
      <h3>Speed Graph:</h3>
      <Trend
        className="trend"
        data={fetchTimeIntegers}
        gradient={['#1feaea', '#ffd200', '#f72047']}
        radius={0.9}
        strokeWidth={3.2}
        strokeLinecap={'round'}
      />
    </div>
  )
}

export default Graph;