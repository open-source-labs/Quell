import React, { useState, useEffect, useRef, useCallback } from "react";
import QueryDisplay from "../components/QueryDisplay.jsx";
import DropdownItem from "../components/DropdownItem.jsx";
import { ResultsHelper } from "../helper-functions/HelperFunctions.js";

const DemoInput = (props) => {
  const { output, setOutput } = props

  // const [count, setCount] = useState(0) // purely for testing
  const [query, setQuery] = useState("countries"); // set the kind of query you want
  const [type, setType] = useState("Country"); // is it a 'Country' or a 'City'?
  const [initialField, setInitialField] = useState(["id"]); // initial field
  const [queryDropdown, toggleDropdown] = useState(false); // toggle query dropdown
  const [idDropdown, setIdDropdown] = useState(false); // show an id dropdown
  const [selectedId, setSelectedId] = useState(1); // display id
  const [idDropdownMenu, toggleIdDropdownMenu] = useState(false); // toggle id dropdown menu
  
  // Below makes the PLUS dropdown go away when you cick it:
  const ref = useRef(null);
  const handleClickOutside = (event) => {
    if (ref.current && !ref.current.contains(event.target)) {
      toggleDropdown(false);
      toggleIdDropdownMenu(false);
    }
  };
  useEffect(() => {
    // triggers listener for clicks outside
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [])
  //

  // All changes to final query are routed here
  const outputFunction = (newList, sub, query, id) => {
    const newOutput = ResultsHelper(newList, sub, query, id, output);
    setOutput(newOutput);
  };

  // Change Query Selection - fires from DropdownItem child - comes in like ('Countries')
  const selectQuery = (selection) => {
    setQuery(selection);
    outputFunction(0, 0, selection)

    if (selection === 'countries' || selection === 'country by id') {
      setType('Country');
    };
    if (selection === 'cities' || selection === 'cities by country id') {
      setType('City');
    };
    if (selection === 'country by id' || selection === 'cities by country id') {
      setIdDropdown(true)
    } else setIdDropdown(false)
    toggleDropdown(false)
  }

  const selectDropdownId = (item) => {
    // item comes in as number (2)
    setSelectedId(item);
    toggleIdDropdownMenu(false);
    outputFunction(0, 0, 0, item);
  };

  // Array of queries to choose from
  // const dropdownList = ["countries", "country by id", "cities", "cities by country id"];
  const dropdownList = ["countries", "cities"];
  // Creates dropdown menu from the above array ^^
  const dropdownMenu = dropdownList.map((item, i) => {
    return (
      <DropdownItem func={selectQuery} item={item} key={"QueryDropdown" + i} />
    );
  });

  // choose how many id numbers to choose from and generate list
  const idDropMenu = [];
  for (let i = 1; i <= 5; i++) {
    idDropMenu.push(
      <DropdownItem func={selectDropdownId} item={i} key={"ID" + i} />
    );
  }

  const ob = "{",
    cb = "}",
    tab = <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>,
    space = <span>&nbsp;</span>;
  return (
    <div className="query-div">
      <div className="queryLine">{ob}</div>
      <div className="queryLine">
        {space}
        {/* Dropdown appears on click */}
        <span>
          <button
            className="dropdown-button"
            onClick={() => toggleDropdown(!queryDropdown)}
          >
            <div className="plus-minus-icons dropdown-icon">
              <img src="../images/buttons/dropdown-button.svg" />
              <img src="../images/buttons/dropdown-button-hover.svg" className="hover-button"/>
            </div>
            {/* Query Dropdown Menu */}
            {queryDropdown && <div className="dropdown-menu" ref={ref}>{dropdownMenu}</div>}
          </button>
        </span>
        {tab}
        {query}

        {/* Id Dropdown (conditional) */}
        {idDropdown && (
          <span>{space}
            <button
              className="dropdown-button display-id"
              onClick={() => toggleIdDropdownMenu(!idDropdownMenu)}
            >
              <div className="plus-minus-icons dropdown-icon">
                <img src="../images/buttons/dropdown-button.svg" />
                <img src="../images/buttons/dropdown-button-hover.svg" className="hover-button"/>
              </div>
              
              {/* Id Dropdown Menu */}
              {idDropdownMenu && <div className="dropdown-menu" ref={ref}>{idDropMenu}</div>}
            </button>
            {idDropdown && selectedId}
          </span>
        )}
        {space}
        {ob}
      </div>

      <div className="the-rest-of-the-lines">
        <QueryDisplay
          initialQuery={initialField}
          type={type}
          outputFunction={outputFunction}
          key={type}
        />
        {space}
        {/* Interestingly, the above key prop makes it so that when type changes, this component completely reloads */}
      </div>
      <div className="queryLine">
        {tab} {cb}
      </div>
      <div className="queryLine">{cb}</div>

      {/* JUST FOR TEST */}
      {/* <h1>testing text</h1>
        <div data-testid="count" >{count}</div>
        <button data-testid="countFunc" onClick={() => setCount(count+1)}></button> */}
    </div>
  );
};

export default DemoInput;
