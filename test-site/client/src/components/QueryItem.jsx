import React, { useState, useEffect } from "react";

// component to get ALL data from our created DB
const QueryItem = (props) => {
  const { item, deleteItem, sub } = props;
  const [itemIsNotId, setItemIsNotId] = useState(true)

  useEffect(() => {
    if (item === 'id') setItemIsNotId(false)
  }, [itemIsNotId])

  const tab = <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>,
    space = <span>&nbsp;</span>
  return (
    <>
      <div className="queryLine">
        {tab}
        {tab}
        {sub && <>{tab}</>}
        {itemIsNotId && <button
          className="minus-button"
          onClick={() => deleteItem(item)}
        >
          <div className="plus-minus-icons">
            <img src="../images/buttons/minus-button.svg" />
            <img src="../images/buttons/minus-button-hover.svg" className="hover-button"/>
          </div>
        </button>}
        {space}
        {item}
      </div>
    </>
  );
};

export default QueryItem;
