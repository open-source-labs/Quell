import React, { useState, useEffect, useRef } from 'react';
import QueryField from './QueryField.jsx';
import DropdownItem from './DropdownItem.jsx';
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

// I don't know where in the file to set queryingCities equal to true so that it doesn't render ID after that
// maybe just set a timer?? so that it runs after the first time we build the recursive queryFields component

const CitiesFields = (props) => {

    const { citiesFields, type, sub, outputFunction, modifyCitiesFields } = props; // import props

    const [queryList, setQueryList] = useState(citiesFields);
    const [availableList, setAvailableList] = useState([]);
    const [plusDropdown, togglePlusDropdown] = useState(false);
    const [subQuery, setSubQuery] = useState(sub); // is true when we render this recursively for the "cities" field inside "countries" query

    // ====================================================================== //
    // ======= Functionality to close dropdowns when clicking outside ======= //
    // ====================================================================== //

    // attach "ref = {ref}" to the dropdown
    const ref = useRef(null);

    // makes it so when you click outside of a dropdown it goes away
    const handleClickOutside = (event) => {
        if (ref.current && !ref.current.contains(event.target)) {
            togglePlusDropdown(false);
        };
    };

    // listens for clicks on the body of the dom
    useEffect(() => {
        document.addEventListener('click', handleClickOutside, true);
        return () => {
            document.removeEventListener('click', handleClickOutside, true);
        };
    }, [])

    // =================================== //
    // ======= Other functionality ======= //
    // =================================== //

    // initializes the available fields list based on the initialField prop
    useEffect(() => {
        setAvailableList(convertIntoList(cityFields));
    }, []);

    const cityFields = [
        { country_id: "string" },
        // { id: "string" }, // commented out because we're making it an immutable field
        { name: "string" },
        { population: "string" },
    ];

    // Takes the items list and returns something like: [ id, name, capital, cities ]
    const convertIntoList = (itemList) => {
        const output = itemList.map((obj) => { // creates array based on keys of objects in fields array
            let key = Object.keys(obj)[0];
            return key;
        });
        const noDuplicates = []; // get rid of potential duplicates
        output.forEach((el) => {
            if (!queryList.includes(el)) noDuplicates.push(el)
        });
        return noDuplicates;
    };

    // ==================================== //
    // ======= Buttons Functionality ====== //
    // ==================================== //

    //======= Minus button ========//
    function deleteItem(item) {

        // execute a function back in query fields to update list, which in turn will update this component
        modifyCitiesFields(item, 'delete');

        // remove item from queryList
        const newList = [...queryList];
        const index = newList.indexOf(item);
        newList.splice(index, 1);
        setQueryList(newList);
        // add item to availableList
        const newAvailableList = [...availableList];
        newAvailableList.push(item);
        setAvailableList(newAvailableList);
        // calls a function that prepares the query for actually being sent
        if (sub) {
            outputFunction(0, newList, 0);
        } else {
            outputFunction(newList, 0, 0);
        }
    }

    //======= Plus button ========//
    function addItem(item) {

        modifyCitiesFields(item, 'add');

        // add item to queryList
        const newList = [...queryList];
        newList.push(item);
        setQueryList(newList);
        // remove item from availableList
        const newAvailablelist = [...availableList];
        const index = newAvailablelist.indexOf(item);
        newAvailablelist.splice(index, 1);
        setAvailableList(newAvailablelist);
        // close the plus dropdown
        togglePlusDropdown(false);
        // call a function that prepares the query for actually being sent
        if (sub) {
            outputFunction(0, newList, 0);
        } else {
            outputFunction(newList, 0, 0);
        }
    }

    // Fires when you click plus -- only show plus dropdown if there's something in the list
    const dropPlus = () => {
        if (availableList.length > 0) {
            togglePlusDropdown(!plusDropdown)
        }
    };

    // =========================== //
    // ===== RENDER / RETURN ===== //
    // =========================== //

    // prepare some characters
    const ob = '{',
        cb = '}',
        tab = <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>,
        space = <span>&nbsp;</span>;

    // Render the query list to the DOM
    const queriedItems = queryList.map((item, i) => {
        return (
            <QueryField
                item={item}
                key={`${type}Field${i}`}
                deleteItem={deleteItem}
                sub={sub}
            />
        );
    });

    // Render dropdown menu from the available list
    const dropdown = availableList.map((item, i) => {
        return (
            <DropdownItem func={addItem} item={item} key={`Available${type}${i}`} />
        );
    });

    // note: the "sub" tags are conditionally rendered only when we're in the cities field INSIDE the countries query
    return (
        <>
            {/* List all the chosen query fields */}
            <div className='queryLinesContainer'>{queriedItems}</div>

            {tab}
            {tab}
            {sub && <>{tab}</>}
            {/* Render plus sign, which opens a dropdown */}
            <button
                className='plus-button'
                onClick={dropPlus}
            >
                <div className='plus-minus-icons'>
                    <img src={Plus} />
                    <img src={PlusHover} className='hover-button' />
                </div>
                {plusDropdown && <div className='dropdown-menu' ref={ref}>{dropdown}</div>}
            </button>
        </>
    );
};

export default CitiesFields;