import React, { useState, useEffect } from 'react';
import { Client } from './Client/Client.jsx';
import { Output } from './Output/Output.jsx';
import { Server } from './Server/Server.jsx';
import { Stats } from './Stats/Stats.jsx';

const App = () =>  {
  // saving state to see if operating on client side or server side
  // 'client' for client-side and 'server' for server-side... DUH!
  const [client_server, setOrigin] = useState('client');

  // switches the origin of the data from client to server or vise-versa
  const switchOrigin = (origin) => {
    setOrigin(origin);
    console.log({'setting origin': origin});
  };



  return (
    <div className="panel">
      <div className="main_container">
        test
      </div>
    </div>
  );
};

export default App;