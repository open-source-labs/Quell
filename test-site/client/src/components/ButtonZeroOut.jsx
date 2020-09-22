import React from 'react';

const ButtonZeroOut = (props) => {
  const { handleZeroOutClick } = props;
  return(
        <button 
          className="button-zero" 
          onClick={handleZeroOutClick}
        >Clear All</button>
  )
}

export default ButtonZeroOut;