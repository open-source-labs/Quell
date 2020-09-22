import React from 'react';

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