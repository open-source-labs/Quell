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
import { validateSchema } from 'webpack';
import Button from '@mui/material/Button';

const Editor = (props) => {
  const [defaultText, setText] = useState('# Enter GraphQL query here\n');
  const [queryTimes, setQueryTimes] = useState([0]);

  const handleClickSubmit = () => {
    let startT = performance.now();
    const query = props.queryString;
    const address = `${props.serverAddress}${props.graphQLRoute}`;
    fetch(address, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
              query: query,
              operationName: undefined,
              variables: null
            })
    })
      .then(response => response.json())
      .then(data => props.setResults(data))
      .then(() => props.logNewTime(performance.now()-startT))
      .catch(err => props.setResults(err));
  }

  const handleClearCache = () => {
    const address=`${props.serverAddress}${props.clearCacheRoute}`
    fetch(address)
      .then(data => console.log(data))
      .catch(err => console.log(err));
  }

  return (
    <React.Fragment>
      <CodeMirror
        value={defaultText}
        options={{ 
          height: '285px',
          theme: 'material-darker',
          lineNumbers: true,
          mode: 'graphql',
          lint: {
            schema: props.schema,
          },
          hintOptions: {
            schema: props.schema,
          },
        }}
        onBeforeChange={(editor, data, value) => {
          setText(value);
        }}
        // sends Query to parent componet to be processed by
        onChange={(editor, data, value) => {
          props.setQueryString(value);
        }}
      />
      <div style={{display:'flex', justifyContent: 'space-between',}}>
        <button className="editorButtons" onClick={handleClickSubmit}>Submit Query</button>
        <button className="editorButtons" onClick={handleClearCache}>Clear Cache</button>
      </div>
    </React.Fragment>
  );
};

export default Editor;
