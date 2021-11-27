import React, { useState, useEffect } from 'react';

const Client = (props) => {

  return (
    <div className='segmented_wrapper'>
      <center><input className='inputBox' id="client_input" type='text' /></center>
      <center><h4>Manage</h4></center>
      <div className="button_grid">
        <button className="managementbuttons" id="browseCache" onClick={() => console.log()}>Browse Cache</button>
        <button className="managementbuttons" id="deleteCache" onClick={() => console.log()}>Delete Cache</button>
        <button className="managementbuttons" id="garbageCollect" onClick={() => console.log()}>Garbage Collect</button>
        <button className="managementbuttons" id="settingsButton" onClick={() => console.log()}>Settings</button>
      </div>
    </div>
  );
};

export default Client;