import React, { useState, useRef } from 'react'; // Remove useRef to remove default
import QueryInput from '../components/QueryInput';
import DemoInput from './DemoInput';
// import ButtonRunQuery from '../components/ButtonRunQuery';
// import ButtonClearCache from '../components/ButtonClearCache';
import DemoButton from '../components/DemoButton';
import QueryResults from '../components/QueryResults';
import Metrics from '../components/Metrics';
import Graph from '../components/Graph';
import Quell from '../../../../quell-client/Quellify';
import {
  ResultsParser,
  CreateQueryStr,
} from '../helper-functions/HelperFunctions.js';
import Header from '../images/headers/QUELL-headers-demo w lines.svg';

const Demo = () => {
  // const [queryInput, setQueryInput] = useState("");
  const [queryResponse, setQueryResponse] = useState({});
  const [fetchTime, setFetchTime] = useState('0.00 ms');
  const [fetchTimeIntegers, setFetchTimeIntegers] = useState([0, 0]);
  const [cacheStatus, setCacheStatus] = useState('');
  const refInput = useRef(''); // Remove useRef to remove default

  const [output, setOutput] = useState({ countries: ['id'] });
  // const [queryResponseError, setQueryResponseError] = useState('');
  // const [storageSpace, setStorageSpace] = useState('0 KB');

  const handleChange = (e) => {
    setQueryInput(e.target.value);
  };

  const formatTimer = (time) => {
    return time.toFixed(2) + ' ms';
  };

  const handleRunQueryClick = () => {
    // run ResultsParser on output to get the query
    // console.log('NON-PARSED RESULT', output)
    const parsedResult = CreateQueryStr(output)
    console.log('Input when you "Run Query":', parsedResult)

    let startTime, endTime;
    startTime = performance.now();

    Quell(
      '/graphql',
      // refInput.current.value,
      parsedResult,
      {
        // Replace refInput.current.value with queryInput to remove default
        countries: 'Country',
        country: 'Country',
        citiesByCountryId: 'City',
        cities: 'City',
      },
      { cities: 'City' }
    )
      .then((res) => {
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
        setFetchTimeIntegers([...fetchTimeIntegers, newTime]);
      })
      .catch((err) => console.log(err));
  };

  const handleClearCacheClick = () => {
    sessionStorage.clear();
    // setStorageSpace('0 KB');
    setFetchTime('0.00 ms');
    let date = new Date();
    setCacheStatus(date.toString());

    // Zero-out line graph
    setFetchTimeIntegers([0, 0]);
  };

  return (
    <div id='demo'>
      <div id='demo-header-container'>
        <img id='demo-header' src={Header}></img>
      </div>

      <div className='dashboard-grid'>
        {/* <QueryInput
          forwardRef={refInput} // Remove useRef to remove default
          handleChange={handleChange}
        /> */}
        <div className="button-grid">
          <DemoButton text={'Run Query'} func={handleRunQueryClick} classname={'button-query button-query-primary'} />
          <DemoButton text={'Clear Session Cache'} func={handleClearCacheClick} classname={'button-query button-query-secondary'}/>
          <DemoButton text={'Clear Server Cache'} func={handleClearCacheClick} classname={'button-query button-query-secondary'}/>
          <DemoButton text={'Reset All'} func={handleClearCacheClick} classname={'button-query button-query-secondary'}/>
        </div>
        <DemoInput output={output} setOutput={setOutput} />
        <QueryResults queryResponse={queryResponse} />
        <Metrics fetchTime={fetchTime} cacheStatus={cacheStatus} />
        <Graph fetchTimeIntegers={fetchTimeIntegers} />
      </div>
    </div>
  );
};

export default Demo;
