import React, { useState, useEffect } from "react";
import QueryDisplay from "../components/QueryDisplay.jsx";
import DropdownItem from "../components/DropdownItem.jsx";
import { ResultsHelper } from "../helper-functions/HelperFunctions.js";

const DemoInput = () => {
  // const [count, setCount] = useState(0) // purely for testing
  const [query, setQuery] = useState("countries"); // set the kind of query you want
  const [type, setType] = useState("Country"); // is it a 'Country' or a 'City'?
  const [initialField, setInitialField] = useState(["id"]); // initial field
  const [queryDropdown, toggleDropdown] = useState(false); // toggle query dropdown
  const [idDropdown, setIdDropdown] = useState(false); // show an id dropdown
  const [selectedId, setSelectedId] = useState(1); // display id
  const [idDropdownMenu, toggleIdDropdownMenu] = useState(false); // toggle id dropdown menu
  const [output, setOutput] = useState({ Country: ["id"] }); // looks like: { QUERY: ['item1', 'item2', {'cities': ['item1', 'item2']}] }
  console.log("RESULT:", output);

  // All changes to final query are routed here
  const outputFunction = (newList, sub, query, id) => {
    const newOutput = ResultsHelper(newList, sub, query, id, output);
    setOutput[newOutput];
  };

  // Change Query Selection - fires from DropdownItem child - comes in like ('Countries')
  const selectQuery = (selection) => {
    setQuery(selection);
    outputFunction(0, 0, selection);

    if (selection === "countries" || selection === "country by id") {
      setType("Country");
    }
    if (selection === "cities" || selection === "city by id") {
      setType("City");
    }
    if (selection === "country by id" || selection === "city by id") {
      setIdDropdown(true);
      outputFunction(0, 0, 0, 1);
    } else setIdDropdown(false);
    toggleDropdown(false);
  };

  const selectDropdownId = (item) => {
    // item comes in as number (2)
    setSelectedId(item);
    toggleIdDropdownMenu(false);
    outputFunction(0, 0, 0, item);
  };

  // Array of queries to choose from
  const dropdownList = ["countries", "country by id", "cities", "city by id"];
  // Creates dropdown menu from the above array ^^
  const dropdownMenu = dropdownList.map((item, i) => {
    return (
      <DropdownItem func={selectQuery} item={item} key={"QueryDropdown" + i} />
    );
  });

  // choose how many id numbers to choose from and generate list
  const idMenuSelection = type === "Country" ? 5 : 10;
  const idDropMenu = [];
  for (let i = 1; i <= idMenuSelection; i++) {
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
        {tab}
        {/* Dropdown appears on click */}
        <button
          className="dropdown-button"
          onClick={() => toggleDropdown(!queryDropdown)}
        >
          ▾
        </button>
        {query}
        {/* Id Dropdown (conditional) */}
        {idDropdown && (
          <button
            className="dropdown-button"
            onClick={() => toggleIdDropdownMenu(!idDropdownMenu)}
          >
            ▾{idDropdown && selectedId}
          </button>
        )}
        {space}
        {ob}
      </div>

      {/* Where the id dropdown appears */}
      {idDropdownMenu && <div className="dropdown-menu">{idDropMenu}</div>}

      {/* Where the dropdown appears */}
      {queryDropdown && <div className="dropdown-menu">{dropdownMenu}</div>}

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
