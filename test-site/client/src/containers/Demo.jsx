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
import { ResultsParser, CreateQueryStr } from '../helper-functions/HelperFunctions.js';
import Header from '../images/headers/QUELL-headers-demo w lines.svg';

const Demo = () => {
  const [queryInput, setQueryInput] = useState(""); // COMMENT OUT TO REVERT!!!!
  const [queryResponse, setQueryResponse] = useState({});
  const [fetchTime, setFetchTime] = useState('0.00 ms');
  const [fetchTimeIntegers, setFetchTimeIntegers] = useState([0, 0]);
  const [cacheStatus, setCacheStatus] = useState('');
  const refInput = useRef(''); // Remove useRef to remove default // COMMENT OUT TO REVERT!!!!
  const [output, setOutput] = useState({ countries: ['id'] });
  const [resetComponent, setResetComponent] = useState(false)

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
      refInput.current.value, // COMMENT OUT and UNCOMMENT BELOW TO REVERT!!!!
      // parsedResult,
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
    // Cache/FetchTime
    setFetchTime('0.00 ms');
    // Clear sessionStorage
    sessionStorage.clear();    
    // Time cleared
    let date = new Date();
    setCacheStatus(date.toLocaleTimeString());
    // Zero-out line graph
    setFetchTimeIntegers([0, 0]);
  };

  const handleZeroOutClick = () => {
    // Query default
    setResetComponent(!resetComponent);
    // Reset output
    setOutput({ countries: ['id'] });
    // Zero-out results
    setQueryResponse({});
    // Zero-out cache/FetchTime
    setFetchTime('0.00 ms');
    // Clear sessionStorage
    sessionStorage.clear();    
    // Time cleared
    setCacheStatus('');
    // Zero-out line graph
    setFetchTimeIntegers([0, 0]);
  };

  return (
    <div id='demo'>
      <div id='demo-header-container'>
        <img id='demo-header' src={Header}></img>
      </div>
      <div className='dashboard-grid'>
        <QueryInput // COMMENT OUT and UNCOMMENT DemoInput TO REVERT!!!!
          forwardRef={refInput} // Remove useRef to remove default
          handleChange={handleChange}
        />
        <div className="button-grid">
          <DemoButton text={'Run Query'} func={handleRunQueryClick} classname={'button-query button-query-primary'} />
          <DemoButton text={'Clear Session Cache'} func={handleClearCacheClick} classname={'button-query button-query-secondary'}/>
          <DemoButton text={'Clear Server Cache'} func={handleClearCacheClick} classname={'button-query button-query-secondary'}/>
          <DemoButton text={'Reset All'} func={handleZeroOutClick} classname={'button-query button-query-secondary'}/>
        </div>
        {/* <DemoInput output={output} key={resetComponent} setOutput={setOutput} /> */}
        <Metrics fetchTime={fetchTime} cacheStatus={cacheStatus} />
        <QueryResults queryResponse={queryResponse} />
        <Graph fetchTimeIntegers={fetchTimeIntegers} />
      </div>
    </div>
  );
};

export default Demo;
