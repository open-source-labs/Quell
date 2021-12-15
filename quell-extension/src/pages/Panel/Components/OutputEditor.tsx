/* eslint-disable react/react-in-jsx-scope */
import { useState, useEffect } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material-darker.css';
import 'codemirror/theme/xq-light.css';
import beautify from 'json-beautify';

const OutputEditor = ({results}) => {
  const [output, setOutput] = useState<string>('# GraphQL query results')

  useEffect(() => {
    if (Object.keys(results).length > 0) {
      setOutput(beautify(results, null, 2, 80));
    }
  }, [results])

  return(
    <CodeMirror
      className='query_output_editor'
      value={output}
      options={{
        theme: 'material-darker',
        lineNumbers: false,
        mode:'json'
      }}  
      // onBeforeChange={(editor, data, value) => {
      //   console.log(value);
      // }}

    />
  );
};

export default OutputEditor;