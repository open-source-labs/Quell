import React, { useState, useEffect } from 'react';
import QueryItem from './QueryItem.jsx'
import DropdownItem from './DropdownItem.jsx'

// component to get ALL data from our created DB
const QueryDisplay = (props) => {
  const { initialQuery: initialField, type, sub, outputFunction } = props // passed in from QueryContainer

  const [queryList, setQueryList] = useState(initialField);
  const [availableList, setAvailableList] = useState([]);
  const [plusDropdown, togglePlusDropdown] = useState(false)
  const [subQuery, setSubQuery] = useState(sub) // if this is true, indicates we're in a sub query

  // functions to run upon update
  useEffect(() => {
    setAvailableList(initialAvailableList())
    console.log('availableList',availableList)
  }, [])

  const cityItems = [
    {country_id: 'string'},
    {id: 'string'},
    {name: 'string'},
    {population: 'string'}
  ]

  const countryItems = [
    {id: 'string'},
    {name: 'string'},
    {capital: 'string'},
    {cities: cityItems} // the name of the City type
  ]

  // returns an array equal to whichever item list corresponds with the query type
  const initialAvailableList = () => {
    if (type === 'Country') return convertIntoList(countryItems)
    if (type === 'City') return convertIntoList(cityItems)
  }

  const convertIntoList = (itemList) => {
    // Takes the items list and returns something like: [ id, name, capital, cities ]
    const output = itemList.map(obj => {
      let key = Object.keys(obj)[0]
      return key
    })

    const noDuplicates = []; // get rid of potential duplicates
    output.forEach(el => { 
      queryList.forEach(qEl => { 
        if (el !== qEl) noDuplicates.push(el) 
      }) 
    })

    return noDuplicates
  }

  function deleteItem(item) {
    console.log('DELETE ITEM FIRED')

    // removes item from queryList
    const newList = [...queryList]
    const index = newList.indexOf(item)
    newList.splice(index, 1)
    setQueryList(newList) // change query list
    
    // modify output
    // if (sub) outputFunction(0, newList, 0)
    // else outputFunction(newList, 0, 0)

    // // adds item to availableList
    const newAvailableList = [...availableList]
    newAvailableList.push(item)
    setAvailableList(newAvailableList) // change available list
  }

  function addItem(item) {
    console.log('ADD ITEM FIRED')

    // adds item to queryList
    const newList = [...queryList]
    newList.push(item)
    setQueryList(newList)

    // modify output
    // if (sub) outputFunction(0, newList, 0)
    // else outputFunction(newList, 0, 0)

    // removes item from availableList
    const newAvailablelist = [...availableList]
    const index = newAvailablelist.indexOf(item)
    newAvailablelist.splice(index, 1)
    setAvailableList(newAvailablelist)

    // un-toggles the plus dropdown
    togglePlusDropdown(false)
  }

  const ob = '{', cb = '}', tab = <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>

  // Create the query list that gets rendered
  const queriedItems = queryList.map((item, i) => {
    // if querying "cities"
    if (item === 'cities') {
      return (<>
        <div className="queryLine">{tab}{tab}
          <button className="minusButton" onClick={() => deleteItem(item)}>-</button>
          {ob} cities
        </div>
        <div className="queryLine">
          <QueryDisplay 
            initialQuery = {['name']}
            type = {"City"}
            key = {type}
            sub = {true}
          />
        </div>
        <div className="queryLine">{tab}{tab}{cb}</div>
      </>)
    }
    // else
    return <QueryItem 
      item = {item}
      key = {`${type}Field${i}`}
      deleteItem = {deleteItem}
      sub = {sub}
    />
  });

  // Creates dropdown menu from the available list
  const dropdown = availableList.map((item, i) => {
    return <DropdownItem 
      func = {addItem}
      item = {item}
      key = {`Available${type}${i}`}
    />
  });

  return(
    <>
    {/* List all the items we've already added */}
    <div className="queryLinesContainer">{ queriedItems }</div>

    {/* Plus sign, which opens a dropdown */}
    {tab}{tab}{sub && <>{tab}</>}<button className="plusButton" 
      onClick={() => togglePlusDropdown(!plusDropdown)}
    >+</button>
    {/* Where the plus dropdown appears on click */}
    {plusDropdown && (<div id="dropdown-menu">{ dropdown }</div>)}
    </>
  )
}

export default QueryDisplay;