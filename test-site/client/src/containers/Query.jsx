import React, { useState, useEffect, useRef } from 'react';
import QueryFields from '../components/QueryFields.jsx';
import DropdownItem from '../components/DropdownItem.jsx';
import { ResultsHelper } from '../helper-functions/HelperFunctions.js';
import DropDown from '../images/buttons/dropdown-button.svg';
import DropDownHover from '../images/buttons/dropdown-button-hover.svg';

/*
  Container that renders the query input section
  Heirarchy is :
  - Query
    - QueryFields
      - QueryField
*/

const Query = (props) => {
  const { output, setOutput } = props;

  const [query, setQuery] = useState('countries'); // set the kind of query you want
  const [type, setType] = useState('Country'); // is it a 'Country' or a 'City'?
  const [initialField, setInitialField] = useState(['id']); // initial / default field for query
  const [queryDropdown, toggleDropdown] = useState(false); // toggle query dropdown
  const [idDropdown, setIdDropdown] = useState(false); // show id dropdown (only applies to queries by id)
  const [selectedId, setSelectedId] = useState(1); // display id dropwodn (only applies to queries by id)
  const [idDropdownMenu, toggleIdDropdownMenu] = useState(false); // toggle id dropdown menu (only applies to queries by id)
  
  // ====================================================================== //
  // ======= Functionality to close dropdowns when clicking outside ======= //
  // ====================================================================== //

  // attach "ref = {ref}" to the dropdown
  const ref = useRef(null);

  // makes it so when you click outside of a dropdown it goes away
  const handleClickOutside = (event) => {
    if (ref.current && !ref.current.contains(event.target)) {
      toggleDropdown(false);
      toggleIdDropdownMenu(false);
    }
  };

  // listens for clicks on the body of the dom
  useEffect(() => {
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [])

  // ================================================= //
  // ======= Functionality for changing query ======= //
  // ================================================ //

  /* 
    All changes to the query go through outputFunction
    It needs to be formatted essentially for when you run query, so this is a "behind the scenes" function
    See ResultsHelper function in HelperFunctions.js
    It makes a change to the state in the parent component, Demo
  */
  const outputFunction = (newList, sub, query, id) => {
    const newOutput = ResultsHelper(newList, sub, query, id, output);
    setOutput(newOutput);
  };

  // Change Query Selection - fires from DropdownItem child - comes in like ('Countries')
  const selectQuery = (selection) => {
    setQuery(selection);
    if (selection === 'countries' || selection === 'country by id') {
      setType('Country');
    }
    if (selection === 'cities' || selection === 'cities by country id') {
      setType('City');
    }
    if (selection === 'country by id' || selection === 'cities by country id') {
      setIdDropdown(true);
    } else setIdDropdown(false);

    // close dropdown
    toggleDropdown(false);
    // update state in Demo
    outputFunction(0, 0, selection);
  };

  // ====== //
  // ====== //
  // ====== //

  // Fires when you change the id (only when querying by ID)
  const selectDropdownId = (item) => {
    // item comes in as number (2), for example
    setSelectedId(item);
    toggleIdDropdownMenu(false);
    outputFunction(0, 0, 0, item);
  };

  // ========================= //
  // ==== RENDER / RETURN ==== //
  // ========================= //

  /* 
    - Array of queries to choose from
    - Used to look like this:
      // const dropdownList = ["countries", "country by id", "cities", "cities by country id"];
    - but we have not completed query-by-id functionality
  */
  const dropdownList = ["countries", "cities"];

  // Creates dropdown menu from the above array ^^
  const dropdownMenu = dropdownList.map((item, i) => {
    return (
      <DropdownItem func={selectQuery} item={item} key={'QueryDropdown' + i} />
    );
  });

  // creates id dropdown (change the i <= # to customize)
  const idDropMenu = [];
  for (let i = 1; i <= 5; i++) {
    idDropMenu.push(
      <DropdownItem func={selectDropdownId} item={i} key={'ID' + i} />
    );
  }

  const ob = '{',
    cb = '}',
    tab = <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>,
    space = <span>&nbsp;</span>;
  return (
    <>
    <h3 className='query-title'>Query:</h3>
    <div className='query-div'>
      <div className='queryLine'>{ob}</div>
      <div className='queryLine'>
        {space}
        {space}
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
            {queryDropdown && <div className="dropdown-menu" ref={ref}>{dropdownMenu}</div>}
          </button>
        </span>
        {query}

        {/* Id Dropdown (conditional) */}
        {idDropdown && (
          <span>
            {space}
            <button
              className='dropdown-button display-id'
              onClick={() => toggleIdDropdownMenu(!idDropdownMenu)}
            >
              {/* Id Dropdown Menu */}
            </button>
            {idDropdown && selectedId}
          </span>
        )}
        {space}
        {ob}
      </div>
      
      {/* Query fields are rendered here */}
      <div>
        <QueryFields
          initialQuery={initialField}
          type={type}
          outputFunction={outputFunction}
          key={type}
        />
        {/* The above key prop makes it so that when type changes, this component completely reloads */}
        {space}
   </div>

      {/* Close out the query */}
      <div className='queryLine'>
        {tab} {cb}
      </div>
      <div className='queryLine'>{cb}</div>

    </div>
    </>
  );
};

export default Query;