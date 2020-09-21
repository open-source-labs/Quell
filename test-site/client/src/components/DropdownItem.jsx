import React from "react";

const DropdownItem = (props) => {
  const { func, item } = props;

  // Render each dropdown item
  // onClick will trigger whatever func was passed into props with "item" passed in
  return (
    <>
      <div className="dropdown-items" onClick={() => func(item)}>
        {item}
      </div>
    </>
  );
};

export default DropdownItem;
