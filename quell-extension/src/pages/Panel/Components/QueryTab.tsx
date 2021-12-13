import { useState, useEffect } from 'react';
import InputEditor from './InputEditor';
import OutputEditor from './OutputEditor';
import Metrics from './Metrics';
import SplitPane from 'react-split-pane';


const QueryTab = ({ 
  clientAddress,
  serverAddress,
  graphQLRoute,
  queryString,
  setQueryString,
  setResults,
  schema,
  results,
  handleClearCache
  } = props) => {

  // storing response times for each query as an array
  const [queryResponseTime, setQueryResponseTime] = useState<number[]>([]);

  // grabbing the time to query results and rounding to two digits
  const logNewTime = (recordedTime: number) => {
    setQueryResponseTime(
      queryResponseTime.concat(Number(recordedTime.toFixed(2)))
    );
  };

  return (
    <div className="queryTab">
      <div id='queryLeft'>
        <SplitPane 
        split="vertical" 
        minSize={ 300 } 
        maxSize={ -300 }
        defaultSize={ 400 }>
          <div className='queryInput resizable'>
            <InputEditor
              clientAddress={ clientAddress }
              serverAddress={ serverAddress }
              graphQLRoute={ graphQLRoute }
              queryString={ queryString }
              setQueryString={ setQueryString }
              setResults={ setResults }
              logNewTime={ logNewTime }
              schema={ schema }
              handleClearCache={ handleClearCache }
            />
          </div>

          <div className='queryResult resizable'>
            <OutputEditor results={ results } />
          </div>
        </SplitPane>
      </div>
      <div id='metricsOutput'>
        <Metrics
          fetchTime={ queryResponseTime[queryResponseTime.length - 1] }
          fetchTimeInt={ queryResponseTime }
        />
      </div>
    </div>
  )
}

export default QueryTab;