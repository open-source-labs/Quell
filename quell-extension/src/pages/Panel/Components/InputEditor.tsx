/* eslint-disable react/prop-types */
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

const InputEditor = (props) => {
  const [defaultText, setText] = useState<string>(
    '# Enter GraphQL query here\n'
  );
  const [queryTimes, setQueryTimes] = useState<number[]>([0]);

  const handleClickSubmit = () => {
    let startT = performance.now();
    const query = props.queryString;
    const address = `${props.serverAddress}${props.graphQLRoute}`;
    fetch(address, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        operationName: undefined,
        variables: null,
      }),
    })
      .then((response) => response.json())
      .then((data) => props.setResults(data))
      .then(() => props.logNewTime(performance.now() - startT))
      .catch((err) => props.setResults(err));
  };

  return (
    <div className="query_input_editor">
      <CodeMirror
        value={defaultText}
        options={{
          theme: 'material-darker',
          lineNumbers: true,
          mode: 'graphql',
          // ### DELETE ###
          // linting does not seem to work, and breaks app if no schema retrieved
          // lint: props.schema === {} ? false : { schema: props.schema },
          // hintOptions: props.schema === {} ? false : { schema: props.schema }
        }}
        onBeforeChange={(editor, data, value) => {
          setText(value);
        }}
        // sends Query to parent componet to be processed by
        onChange={(editor, data, value) => {
          props.setQueryString(value);
        }}
      />
      <div
        style={{
          border: '1px solid #555',
          borderTop: '0px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <button className="editorButtons" onClick={handleClickSubmit}>
          Submit Query
        </button>
        <button className="editorButtons" onClick={props.handleClearCache}>
          Clear Cache
        </button>
      </div>
    </div>
  );
};

export default InputEditor;
