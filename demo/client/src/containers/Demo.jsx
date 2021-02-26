import React, { useState } from "react";
import Query from "./Query";
import DemoButton from "../components/DemoButton";
import QueryResults from "../components/QueryResults";
import Metrics from "../components/Metrics";
import Graph from "../components/Graph";
import { CreateQueryStr } from "../helper-functions/HelperFunctions.js";
import Header from "../images/headers/QUELL-headers-demo w lines.svg";
import Quell from "../../../../quell-client/Quellify";
//import Quell from '@quell/client';
/*
  Container that renders the whole demo dashboard
*/

const Demo = () => {
  const [queryResponse, setQueryResponse] = useState({});
  const [fetchTime, setFetchTime] = useState("0.00 ms");
  const [fetchTimeIntegers, setFetchTimeIntegers] = useState([0, 0]);
  const [cacheStatus, setCacheStatus] = useState("");
  const [output, setOutput] = useState({ countries: ["id"] });
  const [resetComponent, setResetComponent] = useState(false);

  const formatTimer = (time) => {
    return time.toFixed(2) + " ms";
  };

  // ============================================================== //
  // === Function that makes the fetch request to run the query === //
  // ============================================================== //

  const handleRunQueryClick = () => {
    // Run ResultsParser on output to get the query
    let parsedResult = CreateQueryStr(output);

    // // Uncomment the code below to test alias
    //parsedResult = `{country (id: 2) { id capital cities { id, name, population }} citiesByCountry(country_id:1){name}}`;
    // '{ country (id: 2) { id name } cities { id name }}'
    // parsedResult =
    //   " {country1: country (id: 1) { id capital cities { id, name, population }} country2: country (id: 4) { id capital cities { id, name, population }}} ";

    // start the timer (eventually displayed in Metrics)
    let startTime, endTime;
    startTime = performance.now();

    // Make the fetch request
    Quell(
      "/graphql", // our route
      parsedResult, // our input
      {
        countries: "Country",
        country: "Country",
        citiesByCountry: "City",
        cities: "City",
      },
      { cities: "City" }
    )
      .then((res) => {
        endTime = performance.now(); // stop the timer
        const rawTime = endTime - startTime; // calculate how long it took

        // Set Query Response state
        setQueryResponse(res.data);

        // Set Timer State
        const fTime = formatTimer(rawTime);
        setFetchTime(fTime);

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
    // Clear sessionStorage
    sessionStorage.clear();
    // Time cleared
    let date = new Date();
    setCacheStatus(date.toLocaleTimeString());
  };

  const handleClearServerCache = () => {
    // GET request - Clear sever cache
    fetch("/clearCache").then((res) => console.log(res));
    // Time cleared
    let date = new Date();
    setCacheStatus(date.toLocaleTimeString());
  };

  // Runs when we click Reset All
  const handleResetAll = () => {
    // Query default
    setResetComponent(!resetComponent);
    // Reset output
    setOutput({ countries: ["id"] });
    // Zero-out results
    setQueryResponse({});
    // Zero-out cache/FetchTime
    setFetchTime("0.00 ms");
    // Clear sessionStorage
    sessionStorage.clear();
    // Clear server cache:
    fetch("/clearCache").then((res) => console.log(res));
    // Time cleared
    setCacheStatus("");
    // Zero-out line graph
    setFetchTimeIntegers([0, 0]);
  };

  return (
    <div id="demo">
      <div id="demo-header-container">
        <img id="demo-header" src={Header}></img>
      </div>
      <div className="demo-inst-container">
        <p className="demo-inst">It's time to take Quell for a spin!</p>
        <br></br>
        <p className="demo-inst">
          Below is a sample GraphQL query that you can manipulate using the
          drop-down, plus, and minus buttons. Click <em>Run Query</em> to
          initiate the request/response cycle. To clear the client-side cache,
          click <em>Clear Session Cache</em> or alternatively clear the
          server-side cache by clicking <em>Clear Server Cache</em>.{" "}
          <em>Reset All</em> will take you back to square one.
        </p>
        <br></br>
        <p className="demo-inst">
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
            Try clearing the Session Cache and run the same query again. You'll
            now only be seeing the effects of Quell server-side caching.
          </li>
          <li>
            Play around and try adding and removing fields to see Quell's
            partial query caching hard at work under the hood.
          </li>
        </ul>
      </div>

      <div className="dashboard-grid">
        <div className="button-grid">
          <DemoButton
            text={"Run Query"}
            func={handleRunQueryClick}
            classname={"button-query button-query-primary"}
          />
          <DemoButton
            text={"Clear Session Cache"}
            func={handleClearClientCache}
            classname={"button-query button-query-secondary"}
          />
          <DemoButton
            text={"Clear Server Cache"}
            func={handleClearServerCache}
            classname={"button-query button-query-secondary"}
          />
          <DemoButton
            text={"Reset All"}
            func={handleResetAll}
            classname={"button-query button-query-secondary"}
          />
        </div>
        {/* The key prop makes it so that when component changes, it completely reloads -- useful when clicking "Reset All" */}
        <Query output={output} key={resetComponent} setOutput={setOutput} />
        <Metrics fetchTime={fetchTime} cacheStatus={cacheStatus} />
        <QueryResults queryResponse={queryResponse} />
        <Graph fetchTimeIntegers={fetchTimeIntegers} />
      </div>
    </div>
  );
};

export default Demo;
