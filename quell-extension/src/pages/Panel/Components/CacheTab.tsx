/* eslint-disable react/react-in-jsx-scope */
import React, { useState, useEffect } from 'react';
import NavButton from './NavButton';
import CacheView from './CacheView';
import SearchImg from '../assets/search.png';
import { RedisInfo, RedisStats } from '../interfaces/RedisInfo';

type CacheTabProps = {
  serverAddress: string;
  redisRoute: string;
  handleClearCache: () => void;
};

const CacheTab = ({
  serverAddress,
  redisRoute,
  handleClearCache,
}: CacheTabProps) => {
  //use state to store data from redis server
  const [redisStats, setRedisStats] = useState<RedisStats>({
    server: [],
    client: [],
    memory: [],
    stats: [],
  });
  const [redisKeys, setRedisKeys] = useState<string[]>([]);
  const [redisValues, setRedisValues] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('server');

  const fetchRedisInfo = () => {
    fetch(`${serverAddress}${redisRoute}`)
      .then((response) => response.json())
      .then((data: RedisInfo) => {
        console.log('redis info: ', data);
        if (data.redisStats) setRedisStats(data.redisStats);
        if (data.redisKeys) setRedisKeys(data.redisKeys);
        if (data.redisValues) setRedisValues(data.redisValues);
      })
      .catch((error) =>
        console.log('error fetching from redis endpoint: ', error)
      );
  };

  useEffect(() => {
    fetchRedisInfo();
  }, []);

  const genTable = (title: string) => {
    const output = [];
    if (title in redisStats) {
      for (let key in redisStats[title]) {
        output.push(
          <div className="subStats">
            <div
              key={`${title}.name`}
              style={{
                fontWeight: '500',
                fontSize: '0.85rem',
                color: '#eee',
                border: '1px solid #444',
                borderWidth: ' 0 0 1px 1px ',
                padding: '3px 12px 3px 10px',
              }}
            >
              {redisStats[title][key].name}
            </div>
            <div
              key={`${title}.value`}
              style={{
                border: '1px solid #444',
                borderWidth: '0 1px 1px 1px',
                padding: '3px 12px 3px 10px',
              }}
            >
              {redisStats[title][key].value}
            </div>
          </div>
        );
      }
    }
    return output;
  };

  const [filter, setFilter] = useState('');
  const activeStyle = { backgroundColor: '#444' };
  const handleFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  };

  return (
    <div className="cacheStatTab">
      <div className="title_bar">
        <span>Redis Database Status</span>
        <span>Quell Server Cache</span>
      </div>

      <div className="Cache_Server">
        <div className="cacheTables">
          <div className="cacheButtons">
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

          <div className="dynamicCacheTable">
            {activeTab === 'server' && <div>{genTable('server')}</div>}

            {activeTab === 'client' && <div>{genTable('client')}</div>}

            {activeTab === 'memory' && <div>{genTable('memory')}</div>}

            {activeTab === 'stats' && <div>{genTable('stats')}</div>}
          </div>

          <button
            className="optionButtons"
            id="cacheTabRefresh"
            onClick={fetchRedisInfo}
          >
            Refresh Data
          </button>

          <button
            className="optionButtons"
            id="cacheTabClear"
            onClick={() => {
              handleClearCache();
              fetchRedisInfo();
            }}
          >
            Clear Cache
          </button>
        </div>

        <div className="redisCache">
          <div className="cacheSearchbar">
            <img id="searchIcon" src={SearchImg} alt="search" />
            <input
              className="cache_filter_field"
              type="text"
              placeholder=" Filter by id"
              value={filter}
              onChange={handleFilter}
            />
          </div>
          <div className="cacheViewer">
            <CacheView
              redisKeys={redisKeys}
              redisValues={redisValues}
              filteredVal={filter}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CacheTab;
