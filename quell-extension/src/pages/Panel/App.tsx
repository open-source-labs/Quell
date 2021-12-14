import { useState, useEffect, useRef } from 'react';
import PrimaryNavBar from './Components/PrimaryNavBar';
import ServerTab from './Components/ServerTab';
import CacheTab from './Components/CacheTab';
import ClientTab from './Components/ClientTab';
import Logo from './assets/Quell_full_size.png';
import isGQLQuery from './helpers/isGQLQuery';
import { handleNavigate, handleRequestFinished } from './helpers/listeners';

// GraphQL
import { getIntrospectionQuery, buildClientSchema } from 'graphql';
import Settings from './Components/Settings';

// Sample clientRequest data for building Network component
import data from './data/sampleClientRequests';
import { IgnorePlugin } from 'webpack';

const App = () => {
  // queried data results
  const [activeTab, setActiveTab] = useState<string>('client');
  const [results, setResults] = useState({});
  const [schema, setSchema] = useState({});
  const [queryString, setQueryString] = useState<string>('');
  const [graphQLRoute, setGraphQLRoute] = useState<string>('/graphQL');  
  const [clientAddress, setClientAddress] = useState<string>(
    'http://localhost:8080'
  );
  const [serverAddress, setServerAddress] = useState<string>(
    'http://localhost:3000'
  );
  const [redisRoute, setRedisRoute] = useState<string>(
    '/redis'
  );
  const [clearCacheRoute, setClearCacheRoute] = useState<string>('/clearCache');
  // changes tab - defaults to query
  const [clientRequests, setClientRequests] = useState([]);

  const handleClearCache = () => {
    const address=`${props.serverAddress}${props.clearCacheRoute}`
    fetch(address)
      .then(data => console.log(data))
      .catch(err => console.log(err));
  }

  const gqlListener = (request: chrome.devtools.network.Request): void => {
    if (isGQLQuery(request)) {
      request.getContent((body) => {
        const responseData = JSON.parse(body);
        request.responseData = responseData;
        setClientRequests((prev) => prev.concat([request]));
      });
    }
  };

  // COMMENT OUT IF WORKING FROM DEV SERVER
  useEffect(() => {
    handleRequestFinished(gqlListener);
    handleNavigate(gqlListener);
  }, []);

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
        console.log('data: ', data);
        console.log('schema: ', schema);
        setSchema(schema || 'No schema retreived');
      })
      .catch((err) => console.log(err));
  }, [clientAddress, serverAddress, graphQLRoute]);

  return (
    <div className="devtools">
      <PrimaryNavBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        Logo={Logo}
        graphQL_field={graphQLRoute !== ''}
        server_field={serverAddress !== ''}
        redis_field={redisRoute !== ''}
        />

      <div className="extensionTabs">

        {activeTab === 'client' && (
          <ClientTab
            graphQLRoute={graphQLRoute}
            clientAddress={clientAddress}
            clientRequests={clientRequests}
          />
        )}

        {activeTab === 'server' && (
          <>
            <div className='title_bar'>
              Query Quell Server
            </div>
            < ServerTab
              clientAddress={ clientAddress }
              serverAddress={ serverAddress }
              graphQLRoute={ graphQLRoute }
              queryString={ queryString }
              setQueryString={ setQueryString }
              setResults={ setResults }
              schema={ schema }
              clearCacheRoute={ clearCacheRoute }
              results={ results }
              handleClearCache={handleClearCache}
            />
          </>
        )}


        {activeTab === 'cache' && (
          <div className="cacheTab">
            <CacheTab 
              serverAddress={serverAddress}
              redisRoute={redisRoute}
              handleClearCache={handleClearCache}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settingsTab">
            <Settings
              graphQLRoute={graphQLRoute}
              setGraphQLRoute={setGraphQLRoute}
              serverAddress={serverAddress}
              setServerAddress={setServerAddress}
              redisRoute={redisRoute}
              schema={schema}
              setRedisRoute={setRedisRoute}
              clearCacheRoute={clearCacheRoute}
              setClearCacheRoute={setClearCacheRoute}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
