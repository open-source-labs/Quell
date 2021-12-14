import { useState, useEffect } from 'react';

const CacheView = ({ redisKeys, redisValues, filteredVal } = props) => {
  const getFilteredCache = () => {
    const temp = [];
    let i = 0;
    if (redisValues.length > 0) {
      while (i < redisKeys.length && i < redisValues.length) {
        if (redisKeys[i].includes(filteredVal))
        temp.push(
          <details className="cache_entry" key={i}>
            <summary className="cache_entry_key">{redisKeys[i]}</summary>
            <span className="cache_entry_value">{redisValues[i]}</span>
          </details>
        )
        i++;
      }
    }
    else if (redisKeys.length > 0) {
     redisKeys.forEach((el, i) => {
      temp.push(
        <p className="cache_entry" key={i}>{el}</p>
      )
     }) 
    } else temp.push(
      <h4>No keys or values returned. Your Redis cache may be empty, or the specified endpoint may not be configured to return keys and/or values. See the <a href="https://github.com/open-source-labs/Quell" target="_blank">Quell docs</a> for configuration instructions.</h4>
    )
    return temp;
  }

  return (
    <>
    {getFilteredCache()}
    </>
  )  
}

export default CacheView