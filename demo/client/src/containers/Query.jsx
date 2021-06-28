import React from 'react';


const Query = (props) => {
  let { theQuery } = props;

  const ob = '{';
  const cb = '}';
  const tab = <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>;
  const eighted = <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>;
  const space = <span>&nbsp;</span>;


  if (theQuery === "blank") {
    return (
      <>
        <div className="query-div">
        </div>
      </>
    );
    }

  if (theQuery === "simple query") {
    
  return (
    <>
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
    
        {/* Close out the query  */}
        <div className="queryLine">
          {tab} {cb}
          </div>
    </>
  );
  }

  if (theQuery === "simple query with argument") {
    return (
      <>
      {/* {dropDown} */}
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
    {/* {dropDown}  */}
      <div className="query-div">
        <div className="queryLine">{ob}</div>
        <div className="queryLine">
          {tab}{"countries"} {ob}
        </div>
        <div className="queryLine">
          {eighted}{"id"} 
        </div>
        <div className="queryLine">
          {eighted}{"name"} 
        </div>
        <div className="queryLine">
          {tab}{cb}
        </div>
        <div className="queryLine">
          {tab}{"books"} {ob}
        </div>
        <div className="queryLine">
          {eighted}{"id"} 
        </div>
        <div className="queryLine">
          {eighted}{"name"} 
        </div>
        <div className="queryLine">
          {tab}{cb}
        </div>
        <div className="queryLine">{cb}</div>
      </div>
    </>
    );
  }

  if (theQuery === "nested query") {
    return (
      <>
        <div className="query-div">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
  }

};


export default Query;
