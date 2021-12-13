import { useState, useEffect } from 'react';
import NavButton from './NavButton';

const CacheTab = ({ serverAddress, redisRoute, handleClearCache }) => {
  //use state to store data from redis server
  const [redisStats, setRedisStats] = useState([]);
  const [activeTab, setActiveTab] = useState('client');

  const fetchRedisInfo = (): void => {
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
        <div className="subStats" style={{ maxWidth: '' }}>
          <div
            key={`${title}.name`}
            style={{
              fontWeight: '500',
              fontSize: '0.85rem',
              color: '#eee',
              border: '1px solid #555',
              padding: '3px 12px 3px 10px',
            }}
          >
            {redisStats[title][key].name}
          </div>
          <div
            key={`${title}.value`}
            style={{ border: '1px solid #555', padding: '3px 12px 3px 10px' }}
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
    <div className="cacheStatTab">
      {/* title */}
      {/* <span style={{fontSize: '1.5rem', fontWeight:'bold'}}>Cache Server</span> */}
      <div className="title_bar">Redis Cache Data</div>

      <div className="Cache_Server">
        <div className="serverTable">
          {genTable('server')}
          <div
            style={{
              border: '1px solid #555',
              borderTop: '0px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <button className="editorButtons" onClick={fetchRedisInfo}>
              Refresh Data
            </button>
            <button className="editorButtons" onClick={handleClearCache}>
              Clear Cache
            </button>
          </div>
        </div>

        <div className="cacheTables">
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

          <div className="dynamicCacheTable">
            {activeTab === 'client' && <div>{genTable('client')}</div>}

            {activeTab === 'memory' && <div>{genTable('memory')}</div>}

            {activeTab === 'stats' && <div>{genTable('stats')}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CacheTab;
