import { useState, useEffect } from 'react';
import NavButton from './NavButton';

const CacheTab = () => {
  //use state to store data from redis server
  const [ redisStats, setRedisStats ] = useState([]);
  const [ activeTab, setActiveTab] = useState('client');

  useEffect(() => {
    //  send fetch to redis route
     fetch('http://localhost:3000/redis')
     .then(response => response.json())
     .then(data => setRedisStats(data))
     .catch(error => console.log('error fetching from redis', error));
  },[])

  const genTable = (title) => {
    const output = [];
    for (let key in redisStats[title]){
      output.push(
        <div className='subStats' style={{maxWidth:'500px'}}>
          <div key={`${title}.name`} style={{fontWeight:'500', fontSize:'0.85rem', color:'#eee', border:'1px solid #555', padding:'3px 12px 3px 10px'}}>{redisStats[title][key].name}</div>
          <div key={`${title}.value`} style={{border:'1px solid #555', padding:'3px 12px 3px 10px'}}>{redisStats[title][key].value}</div>
        </div>
      )
    }
    return output;
  }

  const activeStyle = {backgroundColor:'#444'};
 
  return (
    <div className="cacheStatTab">
      {/* title */}
      <span style={{fontWeight:'bold'}}>Cache Server</span>

      <div className="Cache_Server">
        <div className='serverTable'>
        {genTable('server')}
        </div>

        <div className='cacheTables'>         
          < NavButton 
            text={'client'} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
            altClass={'cacheNavButton'}
          />

          < NavButton 
            text={'memory'} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
            altClass={'cacheNavButton'}
          />

          < NavButton 
            text={'stats'} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
            altClass={'cacheNavButton'}
          />

          <div className='dynamicCacheTable'>
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
        </div>  
      </div>
    </div>
  )
}

export default CacheTab;
