import React, { useState, useEffect } from 'react';
import Settings from './Settings';
import Button from '@mui/material/Button';

const Management = (props) => {
  // toggles whether IP/Port Number/Cache Life field is hidden or not
  // true = hidden, false = show
  const [settingsToggle, setSettings] = useState(true);
  const [ip, setIP] = useState('');
  const [portNum, setPort] = useState('');
  const [cacheLife, setLife] = useState('');

  const serverInfo = (_ip, _portNum, _cacheLife) => {
    setIP(_ip);
    setPort(_portNum);
    setLife(_cacheLife);
  };

  return (
    <div>
      <center><h4>Manage</h4></center>
      <div className="button_grid">
        <Button id="browseCache" onClick={() => console.log()}>Browse Cache</Button>
        <Button id="deleteCache" onClick={() => console.log()}>Delete Cache</Button>
        <Button id="garbageCollect" onClick={() => console.log()}>Garbage Collect</Button>
        <Button id="settings" onClick={()=> setSettings(!settingsToggle)}>Settings</Button>
        {settingsToggle ? <div></div> : <Settings serverInfo={serverInfo}/>}
      </div>
    </div>
  );
};

export default Management;