import React, { useState, useEffect } from 'react';
import Client from './Client/Client.jsx';
import Output from './Output/Output.jsx';
import Server from './Server/Server.jsx';
import Stats from './Stats/Stats.jsx';
import Management from './Management/Management.jsx';

const App = () =>  {
  // saving state to see if operating on client side or server side
  // 'true' for client-side and 'false' for server-side...
  const [dataOrigin, setOrigin] = useState(true);

  return (
    <div className="panel">
      <button id="client-side" onClick={() => setOrigin(true)}>Client</button>
      <button id="server-side" onClick={() => setOrigin(false)}>Server</button>
      <div className="main_container">
        <div className="query_input segmented_wrapper">
          {dataOrigin ? <Client /> : <Server />}
          <Management />
        </div>
        <div className="query_output segmented_wrapper">
          <Output />
        </div>
        <div className="query_stats segmented_wrapper">
          <Stats />
        </div>
      </div>

    </div>
  );
};

export default App;