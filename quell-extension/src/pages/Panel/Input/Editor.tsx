import React, { useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror'

const Editor = (props) => {

  const[defaultText, setText] = useState("Enter GraphQL query here\n\n\n\n");

  return(
    <CodeMirror
      value={defaultText}
      options={{
        theme: 'material',
        lineNumbers: true,
        lint:true,
        mode:'graphql'
      }}  
      onBeforeChange={(editor, data, value) => {
        setText({value}); console.log(value);
      }}
      // sends Query to parent componet to be processed by 
      onChange={(editor, data, value) => {
        props.queriedText(value);
      }}
    />
  );
};

export default Editor;