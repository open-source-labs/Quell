import React, { useState } from 'react';

const Settings = (props) => {
  const [ip, setIP] = useState('');
  const [portNum, setPort] = useState('');
  const [cacheLife, setLife] = useState('');

  return (
    <form>
      <div id="ip">IP:<input onChange={e => setIP(e.target.value)}/></div>
      <div id="portNum">Port:<input onChange={e => setPort(e.target.value)}/></div>
      <div id="cacheLife">Cache life:<input onChange={e => setPort(e.target.value)}/></div>
    </form>
  );
};

export default Settings;