import React, { useState, useEffect, useRef } from 'react';
import * as fs from 'fs';
// Components for extension
import Client from './Input/Client';
import Output from './Components/Output';
import CacheTable from './Components/CacheTable';
import Metrics from './Components/Metrics';
import Management from './Management/Management';
import Editor from './Components/Editor';
import Network from './Components/Network';
import styles from './App.scss';
import Logo from './assets/Quell_full_size.png';
import SplitPane from 'react-split-pane';

// GraphQL
import { getIntrospectionQuery, buildClientSchema } from 'graphql';
import Settings from './Components/Settings';

// Sample clientRequest data for building Network component
import data from './data/sampleClientRequests';

const App = () => {
  // queried data results
  const [results, setResults] = useState({});
  const [schema, setSchema] = useState({});
  const [queryString, setQueryString] = useState<string>('');
  const [graphQLRoute, setGraphQLRoute] = useState<string>('/graphQL');
  const [clientAddress, setClientAddress] = useState<string>('http://localhost:8080');
  const [serverAddress, setServerAddress] = useState<string>('http://localhost:3000');
  const [redisAddress, setRedisAddress] = useState<string>('http://localhost:6379');
  const [clearCacheRoute, setClearCacheRoute] = useState<string>('/clearCache');
  const [queryResponseTime, setQueryResponseTime] = useState<number[]>([]);
  const [clientRequests, addClientRequests] = useState(data);
  // changes tab - defaults to query
  const [tabName, setActiveTab] = useState<string>('cache');

  // COMMENT OUT IF WORKING FROM DEV SERVER
  // useEffect(() => {
  //   chrome.devtools.network.onRequestFinished.addListener(function (request) {
  //     if (request.request.url === `${clientAddress}${graphQLRoute.toLowerCase()}`) {
  //       addClientRequests(prev => prev.concat([request]));
  //     }
  //   });
  // }, []);

  const handleTabChange = (clickedTab:string) => {
    setActiveTab(clickedTab);
    console.log('clicked',clickedTab);
  };

  // grabbing the time to query results and rounding to two digits
  const logNewTime = (recordedTime:number) => {
    setQueryResponseTime(
      queryResponseTime.concat(Number(recordedTime.toFixed(2)))
    );
  };

  // 
  useEffect(() => {
    const introspectionQuery = getIntrospectionQuery();
    const address = `${serverAddress}${graphQLRoute}`;
    fetch(address, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: introspectionQuery,
        operationName: 'IntrospectionQuery',
        variables: null,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        const schema = buildClientSchema(data.data);
        setSchema(schema);
      })
      .catch((err) => console.log(err));
  }, [clientAddress, serverAddress, graphQLRoute]);

  return (
    <div className="devtools">
      <div id="navbar">
        <img id="logo-img" src={Logo} alt="quell logo" />

        <button 
          id="queryButton" 
          className="navbutton"
          style={tabName==='query' ? {backgroundColor:"#333"} : {}} 
          onClick={() => handleTabChange('query')}>
          Query
        </button>
        
        <button 
          id="networkButton" 
          className="navbutton" 
          style={tabName==='network' ? {backgroundColor:"#333"} : {}} 
          onClick={() => handleTabChange('network')}>
          Network
        </button>
        
        <button 
          id="cacheButton" 
          className="navbutton" 
          style={tabName==='cache' ? {backgroundColor:"#333"} : {}} 
          onClick={() => handleTabChange('cache')}>
          Cache
        </button>

        <button 
          id="settingsButton" 
          className="navbutton" 
          style={tabName==='settings' ? {backgroundColor:"#333"} : {}} 
          onClick={() => handleTabChange('settings')}>
          Settings
        </button>
      </div>

      <div className='extensionTabs'>
        {tabName === 'query' && 
          <div className="queryTab">
            <div id='queryLeft'>
              <SplitPane style={{maxWidth:'75%'}} split="vertical" minSize={300} defaultSize={400}>
                  <div className='queryInput resizable'>
                    <Editor
                      clientAddress={clientAddress}
                      serverAddress={serverAddress}
                      graphQLRoute={graphQLRoute}
                      queryString={queryString}
                      setQueryString={setQueryString}
                      setResults={setResults}
                      schema={schema}
                      logNewTime={logNewTime}
                      clearCacheRoute={clearCacheRoute}
                    />
                  </div>
                
                  <div className='queryResult resizable'>
                    <Output results={results} />
                  </div> 
              </SplitPane>
            </div>
            <div id='metricsOutput' style={{maxHeight:'100px'}}>
              <Metrics
                fetchTime={queryResponseTime[queryResponseTime.length - 1]}
                cacheStatus={'Yes'}
                cacheClearStatus={'No'}
                fetchTimeInt={queryResponseTime}
              />
            </div>
          </div>
        }
          
        {tabName === 'network' && 
          <div className="networkTab">
            <Network
              graphQLRoute={graphQLRoute}
              clientAddress={clientAddress}
              clientRequests={clientRequests}
            />
          </div>
        }

        {tabName === 'cache' && 
          <div className="cacheTab">
            <CacheTable />
          </div>
        }

        {tabName === 'settings' &&  
          <div className="settingsTab">
            <Settings 
              graphQLRoute={graphQLRoute}
              setGraphQLRoute={setGraphQLRoute}
              clientAddress={clientAddress}
              setClientAddress={setClientAddress}
              serverAddress={serverAddress}
              setServerAddress={setServerAddress}
              redisAddress={redisAddress}
              setRedisAddress={setRedisAddress}
              schema={schema}
              setSchema={setSchema}
              clearCacheRoute={clearCacheRoute}
              setClearCacheRoute={setClearCacheRoute}
            />
          </div>
        }
      </div>

    </div>
  );
};

export default App;