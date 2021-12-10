import React, { useState, useEffect } from 'react';


const Stats = (props) => {

  // const [redisAddress, setRedisAddress] = useState('http://localhost:6379');
  //anytime we have a query generated, stats should get updated about how cache is performing
  //store data in state

  useEffect(() => {

    fetch('http://localhost:3000/redis')
      .then(data => {
        console.log(data)
      })
      .catch(error => console.log(error))
  })

  return (
    <div>
      <h1>Stats</h1>
    </div>
  );
};

/*
  1) "peak.allocated in bytes 1245584
  2) "total.allocated" in bytes 1155392
  3) "startup.allocated" in bytes 1011840


  4) "keys.count" 90
  5) "keys.bytes-per-key" 1595
  6)"dataset.bytes" 65984
  7) "dataset.percentage" "45.965225219726562 out of net memory usage
  8) "peak.percentage" "92.759056091308594" out of total


*/
export default Stats;