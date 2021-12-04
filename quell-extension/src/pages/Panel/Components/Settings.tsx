import React, { useState } from 'react';
import {
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
} from '@mui/material';
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
import { TextField, Typography } from '@mui/material';
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

  return (
    <div
      id="settings"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
      }}
    >
      <div className="segmented_wrapper">
        {/* <Typography variant='h6'>UI Settings</Typography>
        <div style={{display: 'flex', justifyContent: 'space-around'}}>

        </div> */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          Basic Configuration
        </Typography>
        <TextField
          sx={{ mb: 1 }}
          fullWidth
          label="GraphQL Route"
          defaultValue={graphQLRoute}
          variant="standard"
          helperText="Endpoint where GraphQL schema will be retrieved and queries sent."
          onChange={(e) => setGraphQLRoute(e.target.value)}
        />
        <TextField
          sx={{ mb: 1 }}
          fullWidth
          label="Client Address"
          defaultValue={clientAddress}
          variant="standard"
          helperText="HTTP address of client from which Quell makes GraphQL queries"
          onChange={(e) => setClientAddress(e.target.value)}
        />
        <TextField
          sx={{ mb: 1 }}
          fullWidth
          label="Server Address"
          defaultValue={serverAddress}
          variant="standard"
          helperText="HTTP address of server from which Quell makes GraphQL queries"
          onChange={(e) => setServerAddress(e.target.value)}
        />
        <TextField
          sx={{ mb: 1 }}
          fullWidth
          label="Redis DB Address"
          defaultValue={redisAddress}
          variant="standard"
          helperText="HTTP address of Redis DB for server-side Quell caching"
          onChange={(e) => setRedisAddress(e.target.value)}
        />
        <TextField
          sx={{ mb: 1 }}
          fullWidth
          label="Clear Cache Route"
          defaultValue={clearCacheRoute}
          variant="standard"
          helperText="Endpoint for clearing server-side cache."
          onChange={(e) => setClearCacheRoute(e.target.value)}
        />
      </div>
      <div className="segmented_wrapper">
        <Typography variant="h6" sx={{ mb: 2 }}>
          Retrieved GraphQL Schema
        </Typography>
        <CodeMirror
          value={editorText}
          options={{
            theme: 'material-darker',
            mode: 'json',
          }}
          // onBeforeChange={(editor, data, value) => {
          //   setEditorText(value);
          // }}
        ></CodeMirror>
      </div>
    </div>
  );
};

export default Settings;
