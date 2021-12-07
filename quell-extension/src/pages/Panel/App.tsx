import React, { useState, useEffect, useRef } from 'react';
import * as fs from 'fs';
// Components for extension
import Client from './Input/Client';
import Output from './Components/Output';
<<<<<<< HEAD
import CacheTable from './Components/CacheTable';
=======
import Server from './Input/Server';
>>>>>>> origin/dev
import Metrics from './Components/Metrics';
import Management from './Management/Management';
import Editor from './Components/Editor';
import Network from './Components/Network';
import styles from './App.scss';
<<<<<<< HEAD
import Logo from './assets/Quell_full_size.png';
import SplitPane from 'react-split-pane';
=======
// Material UI
import Button from '@mui/material/Button';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Box from '@mui/material/Box';
import { Tabs, Tab } from '@mui/material';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ThemeProvider } from '@emotion/react';
import theme from './theme';
import Logo from './assets/Quell_full_size.png';
>>>>>>> origin/dev

// GraphQL
import { getIntrospectionQuery, buildClientSchema } from 'graphql';
import Settings from './Components/Settings';
<<<<<<< HEAD

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
=======

const App = () => {
  // controls active tab
  const [activeTab, setActiveTab] = useState(0);
  // queried data results
  const [results, setResults] = useState({});
  const [schema, setSchema] = useState({});
  const [queryString, setQueryString] = useState('');
  const [graphQLRoute, setGraphQLRoute] = useState('/graphQL');
  const [clientAddress, setClientAddress] = useState('http://localhost:8080');
  const [serverAddress, setServerAddress] = useState('http://localhost:3000');
  const [redisAddress, setRedisAddress] = useState('http://localhost:6379');
  const [clearCacheRoute, setClearCacheRoute] = useState('/clearCache');
  const [queryResponseTime, setQueryResponseTime] = useState<number[]>([]);
  const [clientRequests, addClientRequests] = useState([{name: 'one'}, {name: 'two'}, {name: 'three'}]);

  // useEffect(() => {
  //   chrome.devtools.network.onRequestFinished.addListener(function (request) {
  //     if (request.request.url === `${clientAddress}${graphQLRoute.toLowerCase()}`) {
  //       // addClientRequests((prev) => {
  //       //   [...prev].concat([request])
  //       // })
  //       addClientRequests(prev => prev.concat([request]));
  //       // chrome.devtools.inspectedWindow.eval(
  //       //   'console.log("GraphQL request: " + unescape("' +
  //       //     escape(request.request.url) +
  //       //     '"))'
  //       // )
>>>>>>> origin/dev
  //     }
  //   });
  // }, []);

<<<<<<< HEAD
  const handleTabChange = (clickedTab:string) => {
    setActiveTab(clickedTab);
    console.log('clicked',clickedTab);
=======
  const logNewTime = (recordedTime: number) => {
    setQueryResponseTime(
      queryResponseTime.concat(Number(recordedTime.toFixed(2)))
    );
  };

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

  const handleTabChange = (event, clickedTab) => {
    setActiveTab(clickedTab);
>>>>>>> origin/dev
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
<<<<<<< HEAD
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

=======
    <ThemeProvider theme={theme}>
      <div className="panel">
        <Box id="navbar">
          <div id="logo">
            <img id="logo-img" src={Logo} alt="quell logo" />
          </div>
          <Tabs centered={true} value={activeTab} onChange={handleTabChange}>
            <Tab label="Query" />
            <Tab label="Network" />
            <Tab label="Cache" />
            <Tab label="Settings" />
          </Tabs>
        </Box>
        <TabPanel value={activeTab} index={0}>
          <div className="main_container">
            <div className="query_input segmented_wrapper">
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
            <div className="query_output segmented_wrapper">
              <Box px={2}>
                <Output results={results} />
              </Box>
            </div>
            <div className="query_stats segmented_wrapper">
              <Metrics
                fetchTime={queryResponseTime[queryResponseTime.length - 1]}
                cacheStatus={'Yes'}
                cacheClearStatus={'No'}
                fetchTimeInt={queryResponseTime}
              />
            </div>
          </div>
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          <Network
            graphQLRoute={graphQLRoute}
            clientAddress={clientAddress}
            clientRequests={clientRequests}
          />
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          Cache
        </TabPanel>
        <TabPanel value={activeTab} index={3}>
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
        </TabPanel>
      </div>
    </ThemeProvider>
  );
};

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
>>>>>>> origin/dev
    </div>
  );
};

export default App;
