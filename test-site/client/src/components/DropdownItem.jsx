import React from 'react';

const DropdownItem = (props) => {

  const { func, item } = props

  // Render each dropdown item
  // onClick will trigger whatever func was passed into props with "item" passed in
  return(
    <>
      <button className="dropdownItem" onClick={() => func(item)} >{item}</button>
    </>
  )
}

export default DropdownItem;