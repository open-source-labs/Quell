/* eslint-disable react/react-in-jsx-scope */
import { useState, useEffect } from 'react';
import { Controlled as CodeMirror } from "react-codemirror2-react-17";
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material-darker.css';
import 'codemirror/theme/xq-light.css';

const OutputEditor = ({results}) => {
  const [output, setOutput] = useState<string>('# GraphQL query results')

  useEffect(() => {
    if (Object.keys(results).length > 0) {
      setOutput(JSON.stringify(results, null, 2));
    }
  }, [results])

  return(
    <CodeMirror
      className='query_output_editor'
      value={output}
      options={{
        theme: 'material-darker',
        mode:'json',
        scrollbarStyle: 'null'
      }}
    />
  );
};

export default OutputEditor;