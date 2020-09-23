import React from 'react';

/* 
  A reusable component for all buttons in the demo
*/

const DemoButton = (props) => {
  const { func, classname, text } = props;
  return(
    <button 
      className={classname}
      onClick={func}
    >{text}</button>
  )
}

export default DemoButton;