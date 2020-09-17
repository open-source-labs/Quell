import React, { useState, useRef } from 'react'; // Remove useRef to remove default
import QueryInput from '../components/QueryInput';
import ButtonRunQuery from '../components/ButtonRunQuery';
import QueryResults from '../components/QueryResults';
import Metrics from '../components/Metrics';
import ButtonClearCache from '../components/ButtonClearCache';
import Graph from '../components/Graph';
import Quell from '../../../../quell-client/quell';

const Demo = () => {
  const [queryInput, setQueryInput] = useState('');
  const [queryResponse, setQueryResponse] = useState({});
  const [fetchTime, setFetchTime] = useState('0.00 ms');
  const [fetchTimeIntegers, setFetchTimeIntegers] = useState([0, 0]);
  const [cacheStatus, setCacheStatus] = useState('');
  const refInput = useRef(''); // Remove useRef to remove default
  // const [queryResponseError, setQueryResponseError] = useState('');
  // const [storageSpace, setStorageSpace] = useState('0 KB');

  const handleChange = (e) => {
    setQueryInput(e.target.value)
  }

  const formatTimer = (time) => {
    return time.toFixed(2) + ' ms'
  }

  const handleRunQueryClick = () => {
    let startTime, endTime;
    startTime = performance.now();

    Quell('/graphql', refInput.current.value, { // Replace refInput.current.value with queryInput to remove default
      countries: 'Country',
      country: 'Country',
      citiesByCountryId: 'City',
      cities: 'City'
    }, { cities: 'City' })
      .then(res => {
        endTime = performance.now();
        const time = endTime - startTime;
        
        // Query Response state
        setQueryResponse(res.data);
        
        // // storage state
        // setStorageSpace(quell.calculateSessionStorage());

        // Timer State
        const rawTime = time;
        const fTime = formatTimer(rawTime);
        setFetchTime(fTime);

        // Line Graph
        const newTime = Number(rawTime.toFixed(3));
        setFetchTimeIntegers([...fetchTimeIntegers, newTime])
      })
      .catch(err => console.log(err))
  }

  const handleClearCacheClick = () => {
    sessionStorage.clear();
    // setStorageSpace('0 KB');
    setFetchTime('0.00 ms');
    let date = new Date();
    setCacheStatus(date.toString());

    // Zero-out line graph
    setFetchTimeIntegers([0,0]);
  }

  return (
    <div className="dashboard-grid">
      <QueryInput 
        forwardRef={refInput} // Remove useRef to remove default
        handleChange={handleChange}
      />
      <ButtonRunQuery
        handleRunQueryClick={handleRunQueryClick}
      />
      <QueryResults 
        queryResponse={queryResponse}
      />
      <Metrics 
        fetchTime={fetchTime}
        cacheStatus={cacheStatus}
      />
      <ButtonClearCache
        handleClearCacheClick={handleClearCacheClick}
      />
      <Graph 
        fetchTimeIntegers={fetchTimeIntegers}
      />
    </div>
  )
}

export default Demo;