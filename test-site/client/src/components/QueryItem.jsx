import React from 'react';

// component to get ALL data from our created DB
const QueryItem = (props) => {
  const { item, deleteItem, sub } = props

  const tab = <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>
  return(
    <>
      <div className="queryLine">
      {tab}{tab}{sub && <>{tab}</>}
        <button className="minusButton"
          onClick={() => deleteItem(item)}
        >-</button>
        {item}
      </div>
    </>
  )
}

export default QueryItem;