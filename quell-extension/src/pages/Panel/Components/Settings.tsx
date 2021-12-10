import React, { useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material-darker.css';
import 'codemirror/theme/xq-light.css';
import 'codemirror';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/hint/show-hint';
import 'codemirror-graphql/lint';
import 'codemirror-graphql/hint';
import 'codemirror-graphql/mode';
import beautify from 'json-beautify';

const Settings = ({
  graphQLRoute,
  setGraphQLRoute,
  clientAddress,
  setClientAddress,
  serverAddress,
  setServerAddress,
  redisAddress,
  setRedisAddress,
  schema,
  setSchema,
  clearCacheRoute,
  setClearCacheRoute
} = props) => {
  const [editorText, setEditorText] = useState(beautify(schema, null, 2, 80));

  const inputArea = (_id, func, defaultVal) => {
    return (
      <div id={`${_id.toLowerCase().split(' ').join('_')}`}>
        {`${_id}`}
        <br/>
        <input 
          className="settingInputs"
          onChange={(e) => func(e.target.value)}
          value={`${defaultVal}`}
        />
      </div>
    )
  };

  return (
    <React.Fragment>
      <div className="settingsInput" 
        style={{paddingLeft:"10px"}}>
          <h3>Basic Configuration</h3>
          <form className="configSettings">
            {inputArea('GraphQL Route', setGraphQLRoute, graphQLRoute)}
            <div className="settingInputsDesc">Endpoint where GraphQL schema will be retrieved and queries sent</div>            
            {inputArea('Client Address', setClientAddress, clientAddress)}
            <div className="settingInputsDesc">HTTP address of client from which Quell makes GraphQL queries</div>
            {inputArea('Server Address', setServerAddress, serverAddress)}
            <div className="settingInputsDesc">HTTP address of server from which Quell makes GraphQL queries</div>
            {inputArea('Redis DB Address', setRedisAddress, redisAddress)}
            <div className="settingInputsDesc">HTTP address of Redis DB for server-side Quell caching</div>
            {inputArea('Clear Cache Router', setClearCacheRoute, clearCacheRoute)}
            <div className="settingInputsDesc">Endpoint for clearing server-side cache</div>
          </form>
      </div>

      <div className="retrievedSchema"
        style={{}}>
        <h3>Retrieved GraphQL Schema</h3>
        <CodeMirror
          value={editorText}
          options={{
            theme: 'material-darker',
            mode: 'json',
          }}
        />
      </div>
    </React.Fragment>
  );
};

export default Settings;
