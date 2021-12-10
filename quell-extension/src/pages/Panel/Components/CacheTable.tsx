import React, { useMemo, useState, useEffect } from 'react';

const CacheTable = () => {
  //use state to store data from redis server
  const [ redisStats, setRedisStats ] = useState([]);
  const [ activeTab, setActiveTab] = useState('server');

  useEffect(() => {
    //  send fetch to redis route
     fetch('http://localhost:3000/redis')
     .then(response => response.json())
     .then(data => setRedisStats(data))
     .catch(error => console.log('error fetching from redis', error));
  },[])
  
  // for four panel table
  const RedisStatTable = ( {redisStats} = props) => {
    const output = [];
    const titles = Object.keys(redisStats);
    // Generates title bar by mapping keys of each object pair
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

    //generating cell pairs for the sub-table
    const getCellPairs = (title) => {
      const cellPairs = []
      for(let i in redisStats[title]){
        cellPairs.push(
          <div className='subStats'>
            <div key={`${title}.name`} style={{border:'1px solid #555', padding:'0 12px 0 10px'}}>{redisStats[title][i].name}</div>
            <div key={`${title}.value`} style={{border:'1px solid #555', padding:'0 12px 0 10px'}}>{redisStats[title][i].value}</div>
          </div>
        )
      }
      return cellPairs;
    }

    // combines each group of sub-tables under each Title
    output.push(
      <div className="tableColumns">{
        titles.map(title => {
          return (
            <div className='subTables'>
              {getCellPairs(title)}
            </div>
          )
        })
      }</div>)

    return output;
  }

  const genTable = (title) => {
    const output = [];
    for (let key in redisStats[title]){
      output.push(
        <div className='subStats' style={{maxWidth:'300px'}}>
          <div key={`${title}.name`} style={{border:'1px solid #555', padding:'0 12px 0 10px'}}>{redisStats[title][key].name}</div>
          <div key={`${title}.value`} style={{border:'1px solid #555', padding:'0 12px 0 10px'}}>{redisStats[title][key].value}</div>
        </div>
      )
    }
    return output;
  }

  const activeStyle = {backgroundColor:'#444'};
 
  return (
    <div className="cacheStatTab">
      {/* <RedisStatTable redisStats={redisStats}/> // uncomment for 4 panel style*/}
      <div className="cacheNavBar">
        <button 
          className='cacheNavbutton' 
          style={activeTab==='server' ? activeStyle : {}}
          onClick={() => setActiveTab('server')}>
          Server
        </button>
        
        <button 
          className='cacheNavbutton'
          style={activeTab==='client' ? activeStyle: {}}
          onClick={() => setActiveTab('client')}>
          Client
        </button>
        
        <button 
          className='cacheNavbutton'
          style={activeTab==='memory' ? activeStyle: {}}
          onClick={() => setActiveTab('memory')}>
          Memory
        </button>
        
        <button 
          className='cacheNavbutton'
          style={activeTab==='stats' ? activeStyle: {}}
          onClick={() => setActiveTab('stats')}>
          Stats
        </button>
      </div>

      {activeTab === 'server' && 
        <div>
          {genTable('server')}
        </div>
      }

      {activeTab === 'client' && 
        <div>
          {genTable('client')}
        </div>
      }

      {activeTab === 'memory' && 
        <div>
          {genTable('memory')}
        </div>
      }

      {activeTab === 'stats' && 
        <div>
          {genTable('stats')}
        </div>
      }

    </div>
  )
}
export default CacheTable
