import React from 'react';

/*
  Container that renders Query in the Query box in Demo 
*/

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

    if (theQuery === "error") {
      return (
        <>
          <div className="query-div">
          <div className="queryLine">{"Error: please select a query to run."}</div>
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
          {space}{space}{'countries'} {ob}
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
        <div className="query-div">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'book(id: "1")'} {ob}
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
  
    if (theQuery === "simple query with argument and alias") {
      return (
        <>
          <div className="query-div">
            <div className="queryLine">{ob}</div>
            <div className="queryLine">
              {space}{space}{'Aruba: country(id: "5")'} {ob}
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
        <div className="query-div" id="smaller-text">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'Andorra: country(id: "1")'} {ob}
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
            {space}{space}{'Aruba: country(id: "5")'} {ob}
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
        <div className="query-div" id="smaller-text">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
          {space}{space}{'countries'} {ob}
        </div>
        <div className="queryLine">
          {tab}{"id"} 
        </div>
        <div className="queryLine">
          {tab}{"name"} 
        </div>
        <div className="queryLine">
        {tab}{'cities'} {ob}
        </div>
        <div className="queryLine">
        {tab}{tab}{"id"} 
        </div>
        <div className="queryLine">
        {tab}{tab}{"name"} 
        </div>
        <div className="queryLine">
        {tab}{tab}{'attractions'} {ob}
        </div>
        <div className="queryLine">
        {tab}{tab}{tab}{"id"} 
        </div>
        <div className="queryLine">
        {tab}{tab}{tab}{"name"} 
        </div>
        <div className="queryLine">
        {tab}{tab}{cb}
        </div>
        <div className="queryLine">
        {tab}{cb}
        </div>
          <div className="queryLine">{cb}</div>
        </div>
        <div className="queryLine">{cb}</div>
      </>
    );
  }
  
  if (theQuery === "fragment") {
    return (
      <>
        <div className="query-div" id="smaller-text">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'Bolivia: country(id: "2")'} {ob}
          </div>
          <div className="queryLine">
            {tab}{"...fields"} 
          </div>
          <div className="queryLine">
            {space}{space}{cb}
          </div>
          <div className="queryLine">{cb}</div>
          <div className="queryLine">{tab}</div>
          <div className="queryLine">
          {'fragment fields on Country'} {ob}
          </div>
          <div className="queryLine">
            {tab}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{"name"} 
          </div>
          <div className="queryLine">
            {tab}{"capital"} 
          </div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
    } 
};


export default Query;
