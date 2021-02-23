import React, { useState, useEffect, useRef } from 'react';
import QueryField from './QueryField';
import DropdownItem from './DropdownItem';
import CitiesFields from './CitiesFields';
// imported images
import Minus from '../images/buttons/minus-button.svg';
import MinusHover from '../images/buttons/minus-button-hover.svg';
import Plus from '../images/buttons/plus-button.svg';
import PlusHover from '../images/buttons/plus-button-hover.svg';

/*
  - This component renders each field in your query
  - It is called from DemoInput in the container folder
  - It is recursively called when you add the "cities" field in the "countries" query
*/

const QueryFields = (props) => {
  const { type, outputFunction } = props; // import props

  const [queryList, setQueryList] = useState(['id']);
  const [availableList, setAvailableList] = useState([]);
  const [plusDropdown, togglePlusDropdown] = useState(false);
  const [citiesFields, setCitiesFields] = useState(['id']);

  // ====================================================================== //
  // ======= Functionality to close dropdowns when clicking outside ======= //
  // ====================================================================== //

  // Attach "ref = {ref}" to the dropdown
  const ref = useRef(null);

  // Makes it so when you click outside of a dropdown it goes away
  const handleClickOutside = (event) => {
    if (ref.current && !ref.current.contains(event.target)) {
      togglePlusDropdown(false);
    }
  };

  // Listens for clicks on the body of the dom
  useEffect(() => {
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, []);

  // ========================================================== //
  // ======= Functionality to initialize dropdowns, etc ======= //
  // ========================================================== //

  // Initializes the available fields list
  useEffect(() => {
    setAvailableList(initialAvailableList());
  }, []);

  // ====== Lists of Fields ====== //

  const cityFields = [
    { country_id: 'string' },
    // { id: "string" }, // commented out because we're making it an immutable field
    { name: 'string' },
    { population: 'string' },
  ];

  const countryFields = [
    // { id: "string" },
    { name: 'string' },
    { capital: 'string' },
    { cities: cityFields }, // if field is array, point to the list of fields
  ];

  // Decides whether to populate dropdowns with Country or City fields, based on type prop
  const initialAvailableList = () => {
    if (type === 'Country') return convertIntoList(countryFields);
    if (type === 'City') return convertIntoList(cityFields);
  };

  // Takes the items list and returns something like: [ id, name, capital, cities ]
  const convertIntoList = (itemList) => {
    const output = itemList.map((obj) => Object.keys(obj)[0]);
    return output;
  };

  // ==================================== //
  // ======= Buttons Functionality ====== //
  // ==================================== //

  //======= Minus button ========//
  function deleteItem(item) {
    // Remove item from queryList
    const newList = [...queryList];
    const index = newList.indexOf(item);
    newList.splice(index, 1);
    setQueryList(newList);
    // Add item to availableList
    const newAvailableList = [...availableList];
    newAvailableList.push(item);
    setAvailableList(newAvailableList);
    // Calls a function that prepares the query for actually being sent
    outputFunction(newList, 0, 0);
  }

  //======= Plus button ========//
  function addItem(item) {
    // Add item to queryList
    const newList = [...queryList];
    newList.push(item);
    setQueryList(newList);
    // Remove item from availableList
    const newAvailablelist = [...availableList];
    const index = newAvailablelist.indexOf(item);
    newAvailablelist.splice(index, 1);
    setAvailableList(newAvailablelist);
    // Close the plus dropdown
    togglePlusDropdown(false);
    // Call a function that prepares the query for actually being sent
    outputFunction(newList, 0, 0);
  }

  // Add item to cities field
  // Delete item from cities field
  const modifyCitiesFields = (item, addOrDelete) => {
    const newFields = [...citiesFields];
    if (addOrDelete === 'add') {
      newFields.push(item);
    }
    if (addOrDelete === 'delete') {
      const index = newFields.indexOf(item);
      newFields.splice(index, 1);
    }
    setCitiesFields(newFields);
  };

  // Fires when you click plus -- only show plus dropdown if there's something in the list
  const dropPlus = () => {
    if (availableList.length > 0) {
      togglePlusDropdown(!plusDropdown);
    }
  };

  // =========================== //
  // ===== RENDER / RETURN ===== //
  // =========================== //

  // Prepare some characters
  const ob = '{',
    cb = '}',
    tab = <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>,
    space = <span>&nbsp;</span>;

  // Render the query list to the DOM
  const queriedItems = queryList.map((item, i) => {
    // If querying "cities", need to open up a new pair of brackets and recursively call QueryFields to generate cities fields
    if (item === 'cities') {
      return (
        <div key={i}>
          <div className="queryLine">
            {tab}
            {tab}
            <button className="minus-button" onClick={() => deleteItem(item)}>
              <div className="plus-minus-icons">
                <img src={Minus} />
                <img src={MinusHover} className="hover-button" />
              </div>
            </button>
            {space}cities{space}
            {ob}
          </div>
          <div className="queryLine">
            <CitiesFields
              citiesFields={citiesFields}
              type={'City'}
              outputFunction={outputFunction}
              modifyCitiesFields={modifyCitiesFields}
            />
          </div>
          <div className="queryLine">
            {tab}
            {tab}
            {cb}
          </div>
        </div>
      );
    }
    // Else (what normally happens)
    return (
      <QueryField
        item={item}
        key={`${type}Field${i}`}
        deleteItem={deleteItem}
        subQuery={false}
      />
    );
  });

  // Render dropdown menu from the available list
  const dropdown = availableList.map((item, i) => {
    return (
      <DropdownItem func={addItem} item={item} key={`Available${type}${i}`} />
    );
  });

  return (
    <>
      {/* List all the chosen query fields */}
      <div className="queryLinesContainer">{queriedItems}</div>
      {tab}
      {tab}
      {/* Render plus sign, which opens a dropdown */}
      {/* Added {!!availableList.length &&} so that when the availableList's length is 0, it corroses from zero to false so it doesn't render the plus sign */}
      {!!availableList.length && (
        <button className="plus-button" onClick={dropPlus}>
          <div className="plus-minus-icons">
            <img src={Plus} />
            <img src={PlusHover} className="hover-button" />
          </div>
          {plusDropdown && (
            <div className="dropdown-menu" ref={ref}>
              {dropdown}
            </div>
          )}
        </button>
      )}
    </>
  );
};

export default QueryFields;
