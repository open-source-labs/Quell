import React, { useMemo, useState, useEffect } from 'react';
import { useTable } from 'react-table';

const CacheTable = () => {
  //use state to store data from redis server
  const [ redisStats, setRedisStats ] = useState([]);

  useEffect(() => {
    //  send fetch to redis route
     fetch('http://localhost:3000/redis')
     .then(response => response.json())
     .then(data => setRedisStats(data))
     .catch(error => console.log('error fetching from redis', error));
  },[])
  
  const RedisStatTable = ( {redisStats} = props) => {
    const output = [];
    const titles = Object.keys(redisStats);
    // Generates title bar
    output.push(
      <div className="statsColumns">{
        titles.map((el, i) => 
          <div key={i} 
            className='titleElements'>
            {el[0].toUpperCase() + el.slice(1)}
          </div>
        )
      }</div>
    );
    // Generates the rest of the table
    output.push(
      <div className="statsColumns">{
        titles.map(_title => {
          const subTables = []
          for(let i in redisStats[_title]){
            subTables.push(
              <div className='subStats'>
                <div key={`${_title}.name`} style={{border:'1px solid #555', padding:'0 10px 0 10px'}}>{redisStats[_title][i].name}</div>
                <div key={`${_title}.value`} style={{border:'1px solid #555', padding:'0 10px 0 10px'}}>{redisStats[_title][i].value}</div>
              </div>
            );
          }
          return subTables;
        })
      }</div>)
    return output;
  }
 
  return (
    <div>
      <RedisStatTable redisStats={redisStats}/>
    </div>
  )
}
export default CacheTable
