import React, { useState, useEffect } from 'react';
import Client from './Client/Client.jsx';
import Output from './Output/Output.jsx';
import Server from './Server/Server.jsx';
import Stats from './Stats/Stats.jsx';

const App = () =>  {
  // saving state to see if operating on client side or server side
  // 'true' for client-side and 'false' for server-side...
  const [dataOrigin, setOrigin] = useState(true);

  return (
    <div className="panel">
      <button id="client-side" onClick={() => setOrigin(!dataOrigin)}>Client</button>
      <button id="server-side" onClick={() => setOrigin(!dataOrigin)}>Server</button>
      <div className="main_container">
        <div className="query_input">
          {dataOrigin ? <Client /> : <Server />}
        </div>
        <div className="query_output">
          <Output />
        </div>
      </div>


    </div>
  );
};

export default App;