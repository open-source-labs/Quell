import React, { useState, useEffect } from 'react';

const Output = (props) => {

  return (
    <div>
      <h4>Queried Results</h4>
      <input className='inputBox' id="server_input" type='text' />
    </div>
  );
};

export default Output;