import React, { useState, useEffect, useRef } from 'react';
import QueryFields from '../components/QueryFields.jsx';
import DropdownItem from '../components/DropdownItem.jsx';
import DemoButton from '../components/DemoButton';
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
  let { output, setOutput } = props;

  const [theQuery, setTheQuery] = useState("blank"); 

  //TBD for removal
  const [query, setQuery] = useState(''); // set the kind of query you want
  const [type, setType] = useState('Country'); // is it a 'Country' or a 'City'?
  const [queryDropdown, toggleDropdown] = useState(false); // toggle query dropdown
  const [idDropdown, setIdDropdown] = useState(false); // show id dropdown (only applies to queries by id)
  const [selectedId, setSelectedId] = useState(1); // display id dropdown (only applies to queries by id)
  const [idDropdownMenu, toggleIdDropdownMenu] = useState(false); // toggle id dropdown menu (only applies to queries by id)

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
    All changes to the query go through outputFunction
    It needs to be formatted essentially for when you run query, so this is a "behind the scenes" function
    See ResultsHelper function in HelperFunctions.js
    It makes a change to the state in the parent component, Demo
  */
  const outputFunction = () => {
    // if (theQuery === 'simple query') {
    //   setOutput({countries: ["id", "name"]}); 
    // }
    // if (theQuery === 'simple query with argument') {
    //   setOutput({'country (id:1)': ["id", "name"]}); 
    // }
  };

  // Change Query Selection - fires from DropdownItem child - comes in like ('Countries')
  const selectQuery = (selection) => {
    setQuery(selection);
    if (selection === 'Simple Query') {
      displaySimpleQuery();
    }
    if (selection === 'Simple Query With Argument') {
      displaySimpleQueryWithArg(); 
    }
    if (selection === 'Multiple Queries') {
      displayMultipleQueries(); 
    } 
    if (selection === 'Nested Query') {
      displayNestedQuery(); 
    } else {
      setIdDropdown(false);
    }

    // Close dropdown
    toggleDropdown(false);
    // Update state in Demo
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
  */
  const dropdownList = [
    'Simple Query',
    'Simple Query With Argument',
    'Multiple Queries',
    'Nested Query',
    'Multiple Nested Query'

  ];

  // Creates dropdown menu from the above array
  const dropdownMenu = dropdownList.map((item, i) => {
    return (
      <DropdownItem func={selectQuery} item={item} key={'QueryDropdown' + i} />
    );
  });

  // // Creates id dropdown (change the i <= # to customize)
  // const idDropMenu = [];
  // for (let i = 1; i <= 5; i++) {
  //   idDropMenu.push(
  //     <DropdownItem func={selectDropdownId} item={i} key={'ID' + i} />
  //   );
  // }

  const displaySimpleQuery = () => {
    setTheQuery("simple query");
    output = setOutput({
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
      }
    });
  }

  const displaySimpleQueryWithArg = () => {
    setTheQuery("simple query with argument");
    output = setOutput({
      country: {
        __id: '1',
        __type: 'country',
        __alias: null,
        __args: { id: '1' },
        id: false,
        name: false,
      }
    });
  }

  const displayMultipleQueries = () => {
    setTheQuery("multiple queries");
    output = setOutput({
      country: {
        __id: '1',
        __type: 'country',
        __args: { id: '1' },
        __alias: null,
        id: false,
        name: false,
        cities: {
          __id: null,
          __type: 'cities',
          __args: {},
          __alias: null,
          id: false,
          name: false,
        },
      },
      book: {
        __id: '2',
        __type: 'book',
        __args: { id: '2' },
        __alias: null,
        id: false,
        name: false,
      },
    })
}

  const displayNestedQuery = () => {
    setTheQuery("nested query");
    output = setOutput({
      countries: {
        id: true,
        __type: 'countries',
        __alias: null,
        __args: {},
        __id: null,
        cities: {
          id: true,
          __type: 'cities',
          __alias: null,
          __args: {},
          __id: null,
          attractions: {
            id: true,
            __type: 'attractions',
            __alias: null,
            __args: {},
            __id: null,
            location: {
              id: true,
              __type: 'location',
              __alias: null,
              __args: {},
              __id: null,
            }
          }
        }
      }
    });
  }

  const dropDown = 
  <span>
  {/* Query Dropdown button */}
    <button
      className="dropdown-button"
      onClick={() => toggleDropdown(!queryDropdown)}
    >
      <div className="plus-minus-icons dropdown-icon">
        <img src={DropDown}/>
        {/* <h3>SELECT YOUR QUERY</h3> */}
        <img src={DropDownHover} className="hover-button" />
      </div>
      {/* Query Dropdown Menu */}
      {queryDropdown && (
        <div className="dropdown-menu" ref={ref}>
          {dropdownMenu}
        </div>
      )}
    <b>SELECT YOUR QUERY</b></button>
</span> 

  const ob = '{';
  const cb = '}';
  const tab = <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>;
  const eighted = <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>;
  const space = <span>&nbsp;</span>;

  // const dropdownState = (theState) => {
  //   theState = true; 
  //   if (theState) {
  //   return (
  //     <>
  //     {dropDown}
  //     </>
  //   );
  //   }
  // };


  if (theQuery === "blank") {
    return (
      <>
      {dropDown}
        <div className="query-div">
        </div>
      </>
    );
    }

  if (theQuery === "simple query") {
    // useEffect(() => {
    //   outputFunction();
    // });
  return (
    <>
    {dropDown}
      <div className="query-div">
        <div className="queryLine">{ob}</div>
        <div className="queryLine">
          {space}{space}{"countries"} {ob}
        </div>
        <div className="queryLine">
          {tab}{"id"} 
        </div>
        <div className="queryLine">
          {tab}{"name"} 
        </div>
        <div className="queryLine">
          {space}{space}{cb}
        </div>
        <div className="queryLine">{cb}</div>
      </div>
    </>
  );
  }

  if (theQuery === "simple query with argument") {
    return (
      <>
      {dropDown}
        <div className="query-div">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{"country (id: 1)"} {ob}
          </div>
          <div className="queryLine">
            {tab}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{"name"} 
          </div>
          <div className="queryLine">
            {space}{space}{cb}
          </div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
    }

  if (theQuery === "multiple queries") {
    return (
      <>
      {dropDown}
        <div className="query-div">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{"country (id: 1)"} {ob}
          </div>
          <div className="queryLine">
            {tab}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{"name"} 
          </div>
          <div className="queryLine">
            {space}{space}{cb}
          </div>
          <div className="queryLine">
            {space}{space}{"book (id: 2)"} {ob}
          </div>
          <div className="queryLine">
            {tab}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{"name"} 
          </div>
          <div className="queryLine">
            {space}{space}{cb}
          </div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
  }

  if (theQuery === "nested query") {
    return (
      <>
      {dropDown}
      {/* `{ countries { id cities { id attractions } } }` */}
        <div className="query-div">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{"countries"} {ob}
          </div>
          <div className="queryLine">
            {tab}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{"cities"} {ob}
          </div>
          <div className="queryLine">
            {tab}{"id"} 
          </div>
          <div className="queryLine">
            {space}{space}{ob}
          </div>
          <div className="queryLine">
            {tab}{"attractions"} {ob}
          </div>
          <div className="queryLine">
            {tab}{"id"} 
          </div>
          <div className="queryLine">{cb}</div>
          <div className="queryLine">{cb}</div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
  }

};

//pasted in code
// const ob = '{',
//     cb = '}',
//     tab = <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>,
//     space = <span>&nbsp;</span>;
//   return (
//     <>
//       <h3 className="query-title">Query:</h3>
//       <div className="query-div">
//         <div className="queryLine">{ob}</div>
//         <div className="queryLine">
//           {space}
//           {space}
//           <span>
//             {/* Query Dropdown button */}
//             <button
//               className="dropdown-button"
//               onClick={() => toggleDropdown(!queryDropdown)}
//             >
//               <div className="plus-minus-icons dropdown-icon">
//                 <img src={DropDown} />
//                 <img src={DropDownHover} className="hover-button" />
//               </div>
//               {/* Query Dropdown Menu */}
//               {queryDropdown && (
//                 <div className="dropdown-menu" ref={ref}>
//                   {dropdownMenu}
//                 </div>
//               )}
//             </button>
//           </span>
//           {query}

//           {/* Id Dropdown (conditional) */}
//           {idDropdown && (
//             <span>
//               {space}
//               {/* ID Dropdown button */}
//               <button
//                 className="dropdown-button display-id"
//                 onClick={() => toggleIdDropdownMenu(!idDropdownMenu)}
//               >
//                 <div className="plus-minus-icons dropdown-icon">
//                   <img src={DropDown} />
//                   <img src={DropDownHover} className="hover-button" />
//                 </div>
//                 {/* Id Dropdown Menu */}
//                 {idDropdownMenu && (
//                   <div className="dropdown-menu" ref={ref}>
//                     {idDropMenu}
//                   </div>
//                 )}
//               </button>
//               {idDropdown && selectedId}
//             </span>
//           )}
//           {space}
//           {ob}
//         </div>

//         {/* Query fields are rendered here */}
//         <div>
//           <QueryFields
//             type={type}
//             outputFunction={outputFunction}
//             key={query}
//           />
//           {/* The above key prop makes it so that when query changes, this component completely reloads */}
//         </div>

//         {/* Close out the query */}
//         <div className="queryLine">
//           {tab} {cb}
//         </div>
        
//         <div className="queryLine">{cb}</div>
//       </div>
//     </>
//   );


export default Query;
