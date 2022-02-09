import React, { useState, useEffect, useRef } from 'react';
import Query from './Query';
import DropdownItem from '../components/DropdownItem.jsx';
import DemoButton from '../components/DemoButton';
import QueryResults from '../components/QueryResults';
import Metrics from '../components/Metrics';
import Graph from '../components/Graph';
import {
  CreateQueryStr,
  CreateMutationStr,
  updateProtoWithFragment,
} from '../helper-functions/HelperFunctions.js';
import Header from '../images/headers/QUELL-headers-demo w lines.svg';
import DropDown from '../images/buttons/dropdown-button.svg';
import DropDownHover from '../images/buttons/dropdown-button-hover.svg';

import {
  Quellify as QuellModule,
  lokiClientCache as lokiClientCacheModule,
  mapGenerator as mapGeneratorModule,
} from '@quell/client';
import {
  Quellify as QuellDev,
  lokiClientCache as lokiClientCacheDev,
  mapGenerator as mapGeneratorDev,
} from '../../../../test-app/client/message-board/src/quell-client/src/Quellify.js';

const Quell = process.env.NODE_ENV === 'development' ? QuellDev : QuellModule;

const lokiClientCache =
  process.env.NODE_ENV === 'development'
    ? lokiClientCacheDev
    : lokiClientCacheModule;

/*
  Container that renders the whole demo dashboard
*/

const Demo = () => {
  const [queryResponse, setQueryResponse] = useState({});
  const [fetchTime, setFetchTime] = useState('0.00 ms');
  const [fetchTimeIntegers, setFetchTimeIntegers] = useState([0, 0]);
  const [cacheStatus, setCacheStatus] = useState(''); //can we delete?
  const [cacheAddStatus, setCacheAddStatus] = useState('No');
  const [cacheClearStatus, setCacheClearStatus] = useState('No');
  const [uncachedTime, setUncachedTime] = useState('0.00 ms');
  let [output, setOutput] = useState({});
  const [resetComponent, setResetComponent] = useState(false);
  const [queryDropdown, toggleDropdown] = useState(false);
  const [theQuery, setTheQuery] = useState('blank');
  const formatTimer = (time) => {
    return time.toFixed(2) + ' ms';
  };

  // ====================================================================== //
  // ======= Functionality to close dropdowns when clicking outside ======= //
  // ====================================================================== //

  // Attach "ref = {ref}" to the dropdown
  const ref = useRef(null);

  // Makes it so when you click outside of a dropdown it goes away
  const handleClickOutside = (event) => {
    if (ref.current && !ref.current.contains(event.target)) {
      toggleDropdown(false);
      toggleIdDropdownMenu(false);
    }
  };

  // Listens for clicks on the body of the dom
  useEffect(() => {
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, []);

  // ================================================= //
  // ======= Functionality for changing query ======= //
  // ================================================ //

  /*
    - Array of queries to choose from
  */
  const dropdownList = [
    'Simple Query For Characters',
    'Simple Query For Planets',
    'Simple Query For Species',
    'Simple Query For Vessels',
    'Simple Query With Argument',
    'Alias',
    'Multiple Queries',
    'Fragment',
    'Add Mutation',
    'Update Mutation',
    'Delete Mutation',
  ];

  const selectQuery = (selection) => {
    if (selection === 'Simple Query For Characters') {
      displaySimpleQueryForCharacters();
    }
    if (selection === 'Simple Query For Planets') {
      displaySimpleQueryForPlanets();
    }
    if (selection === 'Simple Query For Species') {
      displaySimpleQueryForSpecies();
    }
    if (selection === 'Simple Query For Vessels') {
      displaySimpleQueryForVessels();
    }
    if (selection === 'Simple Query With Argument') {
      displaySimpleQueryWithArg();
    }
    if (selection === 'Alias') {
      displaySimpleQueryWithArgAndAlias();
    }
    if (selection === 'Multiple Queries') {
      displayMultipleQueries();
    }
    if (selection === 'Fragment') {
      displayFragment();
    }
    if (selection === 'Add Mutation') {
      displayAddMutation();
    }
    if (selection === 'Update Mutation') {
      displayUpdateMutation();
    }
    if (selection === 'Delete Mutation') {
      displayDeleteMutation();
    }
    // Close dropdown
    toggleDropdown(false);
  };

  // Creates dropdown menu from the above array
  const dropdownMenu = dropdownList.map((item, i) => {
    return (
      <DropdownItem func={selectQuery} item={item} key={'QueryDropdown' + i} />
    );
  });

  // ============================================================== //
  // ===== Functionality to change output based on Query Type ===== //
  // ============================================================== //

  const displaySimpleQueryForCharacters = () => {
    setTheQuery('Simple Query For Characters');
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    output = setOutput({
      getCharacters: {
        name: true,
        __alias: null,
        __args: null,
        __id: null,
        __type: 'getcharacters',
        _id: true,
      },
    });
  };

  const displaySimpleQueryForPlanets = () => {
    setTheQuery('Simple Query For Planets');
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    output = setOutput({
      getPlanets: {
        name: true,
        __alias: null,
        __args: null,
        __id: null,
        __type: 'getplanets',
        _id: true,
        diameter: true,
        climate: true,
      },
    });
  };

  const displaySimpleQueryForSpecies = () => {
    setTheQuery('Simple Query For Species');
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    output = setOutput({
      getSpecies: {
        name: true,
        __alias: null,
        __args: null,
        __id: null,
        __type: 'getSpecies',
        _id: true,
        classification: true,
        average_height: true,
        average_lifespan: true,
      },
    });
  };

  const displaySimpleQueryForVessels = () => {
    setTheQuery('Simple Query For Vessels');
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    output = setOutput({
      getVessels: {
        name: true,
        __alias: null,
        __args: null,
        __id: null,
        __type: 'getVessels',
        _id: true,
        manufacturer: true,
        model: true,
        vessel_type: true,
      },
    });
  };

  //book;
  const displaySimpleQueryWithArg = () => {
    setTheQuery('simple query with argument');
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    output = setOutput({
      getCharacter: {
        name: true,
        __alias: null,
        __args: { _id: '1' },
        __id: null,
        __type: 'getcharacter',
        _id: true,
        gender: true,
      },
    });
  };
  // attractions;
  const displaySimpleQueryWithArgAndAlias = () => {
    setTheQuery('simple query with argument and alias');
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    output = setOutput({
      LeiaOrgana: {
        __id: null,
        __type: 'getCharacter',
        __args: { _id: '5' },
        __alias: 'Leia Organa',
        name: false,
        gender: false,
        birth_year: false,
      },
    });
  };
  // cities;
  const displayMultipleQueries = () => {
    setTheQuery('multiple queries');
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    output = setOutput({
      LukeSkywalker: {
        __id: '1',
        __type: 'getCharacter',
        __args: { _id: '1' },
        __alias: 'LukeSkywalker',
        name: false,
        gender: false,
      },
      LeiaOrgana: {
        __id: '5',
        __type: 'getCharacter',
        __args: { _id: '5' },
        __alias: 'LeiaOrgana',
        name: false,
        gender: false,
      },
    });
  };

  // cities;
  const displayFragment = () => {
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    setTheQuery('fragment');
    output = setOutput({
      LukeSkywalker: {
        __id: '1',
        __args: { _id: '1' },
        __alias: 'LukeSkywalker',
        __type: 'getCharacter',
        _id: false,
        theFields: true,
      },
      LeiaOrgana: {
        __id: '5',
        __args: { _id: '5' },
        __alias: 'LeiaOrgana',
        __type: 'getCharacter',
        _id: false,
        theFields: true,
      },
    });
  };

  const displayAddMutation = () => {
    setTheQuery('add mutation');
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    output = setOutput({
      createCharacter: {
        name: true,
        __alias: null,
        __args: { name: 'Blade The Daywalker' },
        __id: null,
        __type: 'character',
        _id: true,
      },
    });
  };

  const displayUpdateMutation = () => {
    setTheQuery('update mutation');
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    output = setOutput({
      updateCharacter: {
        name: true,
        __alias: null,
        __args: { _id: '241', name: 'Max Payne' },
        __id: '241',
        __type: 'character',
        _id: true,
      },
    });
  };

  const displayDeleteMutation = () => {
    setTheQuery('delete mutation');
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    output = setOutput({
      deleteCharacter: {
        __alias: null,
        __args: { _id: '241' },
        __id: '241',
        __type: 'character',
        _id: true,
      },
    });
  };

  // ============================================================== //
  // === Function that makes the fetch request to run the query === //
  // ============================================================== //

  const handleRunQueryClick = async () => {
    if (theQuery === 'blank') {
      setTheQuery('error');
    }
    // Run ResultsParser on output to get the query
    let parsedResult;
    if (theQuery === 'add mutation') {
      parsedResult = CreateMutationStr(output);
    } else if (theQuery === 'update mutation') {
      parsedResult = CreateMutationStr(output);
    } else if (theQuery === 'delete mutation') {
      parsedResult = CreateMutationStr(output);
    } else if (theQuery === 'fragment') {
      const fragment = {
        theFields: {
          hair_color: true,
          skin_color: true,
          eye_color: true,
        },
      };
      let protoFrag = updateProtoWithFragment(output, fragment);
      parsedResult = CreateQueryStr(protoFrag);
    } else {
      parsedResult = CreateQueryStr(output);
    }

    const queryTypeMap = {
      getCharacter: 'Character',
      getCharacters: 'Character',
    };

    const mutationMap = {
      createCharacter: 'Character',
      deleteCharacter: 'Character',
      updateCharacter: 'Character',
    };

    const map = {
      Character: 'Character',
    };

    const maps = await mapGenerator('http://localhost:3434/graphql');

    // start the timer (eventually displayed in Metrics)
    let startTime, endTime;
    startTime = performance.now();

    // Make the fetch request
    Quell(
      'http://localhost:3434/graphql', // our route
      parsedResult,
      maps // our input
      // mutationMap, //map used for mutation caching
      // map, //map used for query from database/server-cache
      // queryTypeMap, //map used for query from client-cache
      // {}
    )
      .then((res) => {
        endTime = performance.now(); // stop the timer
        const rawTime = endTime - startTime; // calculate how long it took
        if (uncachedTime === '0.00 ms') {
          const uncached = (endTime - startTime).toFixed(2) + ' ms';
          setUncachedTime(uncached);
        }

        console.log(res.data);

        // Set Query Response state
        setQueryResponse(res.data);
        // Set Timer State
        const fTime = formatTimer(rawTime);
        setFetchTime(fTime);

        setCacheAddStatus('Yes');
        setCacheClearStatus('No');

        // Set Line Graph
        const newTime = Number(rawTime.toFixed(3));
        setFetchTimeIntegers([...fetchTimeIntegers, newTime]);
      })

      .catch((err) => console.log(err));
  };

  // ============================================================== //
  // ==================== Misc event handlers ==================== //
  // ============================================================== //

  const handleClearClientCache = () => {
    // Clear sessionStorage - old storage for client cache
    // sessionStorage.clear();
    //lokiJS is the new storage for client cache storage
    lokiClientCache.clear();
    console.log(lokiClientCache.data);
    // Time cleared
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    setOutput({});
    setTheQuery('blank');

    setCacheClearStatus('Yes');
    setCacheAddStatus('No');

    let date = new Date();
    setCacheStatus(date.toLocaleTimeString());
  };

  const handleClearServerCache = () => {
    // GET request - Clear sever cache
    fetch('/clearCache').then((res) => console.log(res));
    // Time cleared
    let date = new Date();
    setCacheStatus(date.toLocaleTimeString());
  };

  // Runs when we click Reset All
  const handleResetAll = () => {
    // Query default
    setResetComponent(!resetComponent);
    // Reset output
    setOutput({});
    setTheQuery('blank');
    // Zero-out results
    setQueryResponse({});
    // Zero-out cache/FetchTime
    setFetchTime('0.00 ms');
    // Zero-out uncached/FetchTime
    const uncached = '0.00 ms';
    setUncachedTime(uncached);
    // Clear sessionStorage
    // sessionStorage.clear();
    lokiClientCache.clear();
    console.log(lokiClientCache.data);
    setCacheClearStatus('Yes');
    setCacheAddStatus('No');
    // Clear server cache:
    fetch('/clearCache').then((res) => console.log(res));
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
      <div className='demo-inst-container'>
        <p className='demo-inst'>It's time to take Quell for a spin!</p>
        <br></br>
        <p className='demo-inst'>
          Below is a sample GraphQL query and mutation that you can manipulate
          using the drop-down, plus, and minus buttons. Click{' '}
          <em>Run Query/mutation</em> to initiate the request/response cycle. To
          clear the client-side cache, click <em>Clear Client Cache</em> or
          alternatively clear the server-side cache by clicking{' '}
          <em>Clear Server Cache</em>. <em>Reset All</em> will take you back to
          square one.
        </p>
        <br></br>
        <p className='demo-inst'>
          <em>Suggestions:</em>
        </p>
        <ul>
          <li>
            Try running a query and take note of how long it takes (in
            milliseconds) for the fetched data to be returned from the server.
          </li>
          <li>
            Now, try running the same query again to see Quell client-side
            caching in action! You'll notice a dramatic reduction in the fetch
            time.
          </li>
          <li>
            Try clearing the Client Cache and run the same query again. You'll
            now only be seeing the effects of Quell server-side caching.
          </li>
          <li>
            Play around and try sending different queries to see Quell's partial
            query caching hard at work under the hood.
          </li>
        </ul>
      </div>

      <div className='dashboard-grid'>
        <div className='button-grid'>
          <DemoButton
            text={'Run Query/Mutation'}
            func={handleRunQueryClick}
            classname={'button-query button-query-primary'}
          />
          <DemoButton
            text={'Clear Client Cache'}
            func={handleClearClientCache}
            classname={'button-query button-query-secondary'}
          />
          <DemoButton
            text={'Clear Server Cache'}
            func={handleClearServerCache}
            classname={'button-query button-query-secondary'}
          />
          <DemoButton
            text={'Reset All'}
            func={handleResetAll}
            classname={'button-query button-query-secondary'}
          />
        </div>
        <div>
          <span>
            {/* Query Dropdown button */}
            <button
              className='dropdown-button'
              onClick={() => toggleDropdown(!queryDropdown)}
            >
              <div className='plus-minus-icons dropdown-icon'>
                <img src={DropDown} />
                <img src={DropDownHover} className='hover-button' />
              </div>
              {/* Query Dropdown Menu */}
              {queryDropdown && (
                <div className='dropdown-menu' ref={ref}>
                  {dropdownMenu}
                </div>
              )}
              <b>SELECT YOUR QUERY</b>
            </button>
          </span>
        </div>
        {/* The key prop makes it so that when component changes, it completely reloads -- useful when clicking "Reset All" */}
        <Query theQuery={theQuery} />
        <Metrics
          fetchTime={fetchTime}
          cacheStatus={cacheStatus}
          cacheAddStatus={cacheAddStatus}
          cacheClearStatus={cacheClearStatus}
          uncachedTime={uncachedTime}
        />
        <QueryResults queryResponse={queryResponse} />
        <Graph fetchTimeIntegers={fetchTimeIntegers} />
      </div>
    </div>
  );
};

export default Demo;
