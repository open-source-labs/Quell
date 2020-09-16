import React from 'react';

const ButtonClearCache = (props) => {
  const { handleClearCacheClick } = props;
  return(
    <div className="button-cache-div">
        <button 
          className="button-cache" 
          onClick={handleClearCacheClick}
        >Clear Cache</button>
    </div>
  )
}

export default ButtonClearCache;