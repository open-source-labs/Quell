import React, { useState, useEffect } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';

const Output = (props) => {
  const results = props.results;
  
  return(
    <CodeMirror
      value={results}
      height='auto'
      options={{
        theme: 'material',
        lineNumbers: true,
        lint:true,
        mode:'graphql'
      }}  
      onBeforeChange={(editor, data, value) => {
        console.log(value);
      }}

    />
  );
};

export default Output;