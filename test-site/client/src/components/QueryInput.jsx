import React from "react";

const QueryInput = (props) => {
  const { forwardRef, handleChange } = props;

  // query-div is the class where the whole component can be rendered
  return (
    <div className="query-div">
      <div className="query-div-title">Query</div>
      <div className="text-area">
        <label htmlFor="custom-query">Query Input:</label>
        <br />
        <textarea
          id="custom-query"
          defaultValue={
            "{countries{id name capital cities{country_id id name population }}}"
          } // Remove for original structure if queryInput should apply off the bat.
          ref={forwardRef} // Remove for original structure if queryInput should apply off the bat.
          placeholder="Enter query..."
          onChange={handleChange}
        />
        <br />
      </div>
    </div>
  );
};

export default QueryInput;
