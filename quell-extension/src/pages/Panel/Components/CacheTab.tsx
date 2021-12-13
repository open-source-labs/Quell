/* eslint-disable react/react-in-jsx-scope */
import React, { useState, useEffect } from 'react';
import NavButton from './NavButton';

const CacheTab = ({ serverAddress, redisRoute, handleClearCache }) => {
  //use state to store data from redis server
  const [redisStats, setRedisStats] = useState([]);
  const [activeTab, setActiveTab] = useState('server');

  const fetchRedisInfo = () => {
    fetch(`${serverAddress}${redisRoute}`)
      .then((response) => response.json())
      .then((data) => setRedisStats(data))
      .catch((error) =>
        console.log('error fetching from redis endpoint: ', error)
      );
  };

  useEffect(() => {
    fetchRedisInfo();
  }, []);

  const genTable = (title) => {
    // console.log(redisStats)
    const output = [];
    for (let key in redisStats[title]) {
      output.push(
        <div className='subStats' >
          <div
            key={`${title}.name`}
            style={{
              fontWeight: '500',
              fontSize: '0.85rem',
              color: '#eee',
              border: '1px solid #333',
              borderWidth: ' 1px 1px ',
              padding: '3px 12px 3px 10px',
            }}
          >
            {redisStats[title][key].name}
          </div>
          <div
            key={`${title}.value`}
            style={{ 
              borderTop: '1px solid #333', 
              padding: '3px 12px 3px 10px' 
            }}
          >
            {redisStats[title][key].value}
          </div>
        </div>
      );
    }
    return output;
  };

  const activeStyle = { backgroundColor: '#444' };

  return (
    <div className='cacheStatTab'>
      {/* title */}
      {/* <span style={{fontSize: '1.5rem', fontWeight:'bold'}}>Cache Server</span> */}
      <div className='title_bar'>Redis Cache Data</div>

      <div className='Cache_Server'>
        <div className='cacheTables'>
          <div className='cacheButtons'>
            <NavButton
              text={'server'}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              altClass={'cacheNavButton'}
            />

            <NavButton
              text={'client'}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              altClass={'cacheNavButton'}
            />

            <NavButton
              text={'memory'}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              altClass={'cacheNavButton'}
            />

            <NavButton
              text={'stats'}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              altClass={'cacheNavButton'}
            />
          </div>

          <div className='dynamicCacheTable'>
            {activeTab === 'server' && <div>{genTable('server')}</div>}

            {activeTab === 'client' && <div>{genTable('client')}</div>}

            {activeTab === 'memory' && <div>{genTable('memory')}</div>}

            {activeTab === 'stats' && <div>{genTable('stats')}</div>}
          </div>
        <button className='optionButtons' id='cacheTabRefresh' onClick={fetchRedisInfo}>
          Refresh Data
        </button>
        <button className='optionButtons' id='cacheTabClear' onClick={handleClearCache}>
          Clear Cache
        </button>
        </div>
      </div>
    </div>
  );
};

export default CacheTab;
