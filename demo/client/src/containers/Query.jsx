import React from 'react';

/*
  Container that renders Query in the Query box in Demo 
*/

const Query = (props) => {
  let { theQuery } = props;

  const ob = '{';
  const cb = '}';
  const op = '(';
  const cp = ')';
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

  if (theQuery === "simple query for books") {
  return (
    <>
      <div className="query-div">
        <div className="queryLine">{ob}</div>
        <div className="queryLine">
          {space}{space}{'books'} {ob}
        </div>
        <div className="queryLine">
          {tab}{"id"} 
        </div>
        <div className="queryLine">
          {tab}{"name"} 
        </div>
        <div className="queryLine">
          {tab}{"author"} 
        </div>
        <div className="queryLine">
          {tab}{"shelf_id"} 
        </div>
        <div className="queryLine">
          {space}{space}{cb}
        </div>
        <div className="queryLine">{cb}</div>
      </div>
    </>
  );
  }

  if (theQuery === "simple query for cities") {
    return (
      <>
        <div className="query-div">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'cities'} {ob}
          </div>
          <div className="queryLine">
            {tab}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{"name"} 
          </div>
          <div className="queryLine">
            {tab}{"population"} 
          </div>
          <div className="queryLine">
            {tab}{"country_id"} 
          </div>
          <div className="queryLine">
            {space}{space}{cb}
          </div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
    }  

    if (theQuery === "simple query for attractions") {
  return (
    <>
      <div className="query-div">
        <div className="queryLine">{ob}</div>
        <div className="queryLine">
          {space}{space}{'attractions'} {ob}
        </div>
        <div className="queryLine">
          {tab}{"id"} 
        </div>
        <div className="queryLine">
          {tab}{"name"} 
        </div>
        <div className="queryLine">
          {tab}{"city_id"} 
        </div>
        <div className="queryLine">
          {space}{space}{cb}
        </div>
        <div className="queryLine">{cb}</div>
      </div>
    </>
  );
  }

  if (theQuery === "simple query for countries") {
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

  //book;
  if (theQuery === "simple query with argument") {
    return (
      <>
        <div className="query-div">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'book(id: "5")'} {ob}
          </div>
          <div className="queryLine">
            {tab}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{"name"} 
          </div>
          <div className="queryLine">
            {tab}{"author"} 
          </div>
          <div className="queryLine">
            {space}{space}{cb}
          </div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
    }
    //attractions;
    if (theQuery === "simple query with argument and alias") {
      return (
        <>
          <div className="query-div">
            <div className="queryLine">{ob}</div>
            <div className="queryLine">
              {space}{space}{'SevenMileBeach: attraction(id: "29")'} {ob}
            </div>
            <div className="queryLine">
              {tab}{"id"} 
            </div>
            <div className="queryLine">
              {tab}{"name"} 
            </div>
            <div className="queryLine">
              {tab}{"city_id"} 
            </div>
            <div className="queryLine">
              {space}{space}{cb}
            </div>
            <div className="queryLine">{cb}</div>
          </div>
        </>
      );
      } 
    //cities;
  if (theQuery === "multiple queries") {
    return (
      <>
        <div className="query-div" id="smaller-text">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'Metsaven: city(id: "15")'} {ob}
          </div>
          <div className="queryLine">
            {tab}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{"name"} 
          </div>
          <div className="queryLine">
            {tab}{"population"} 
          </div>
          <div className="queryLine">
            {space}{space}{cb}
          </div>
          <div className="queryLine">
            {space}{space}{'Capitona: city(id: "9")'} {ob}
          </div>
          <div className="queryLine">
            {tab}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{"name"} 
          </div>
          <div className="queryLine">
            {tab}{"population"} 
          </div>
          <div className="queryLine">
            {space}{space}{cb}
          </div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
  }

  //cities;
  if (theQuery === "fragment") {
    return (
      <>
        <div className="query-div" id="smaller-text">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'Seoul: city(id: "24")'} {ob}
          </div>
          <div className="queryLine">
            {tab}{"...fields"} 
          </div>
          <div className="queryLine">
            {space}{space}{cb}
          </div>
          <div className="queryLine">{cb}</div>

          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'Uiwang: city(id: "25")'} {ob}
          </div>
          <div className="queryLine">
            {tab}{"...fields"} 
          </div>
          <div className="queryLine">
            {space}{space}{cb}
          </div>
          <div className="queryLine">{cb}</div>

          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'Incheon: city(id: "26")'} {ob}
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
          {'fragment fields on Cities'} {ob}
          </div>
          <div className="queryLine">
            {tab}{"name"} 
          </div>
          <div className="queryLine">
            {tab}{"population"} 
          </div>
          <div className="queryLine">
            {tab}{"country_id"} 
          </div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
    }
    
    
  if (theQuery === "add mutation") {
    return (
      <>
        <div className="query-div">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'addbook'}
          </div>
          <div>
            {tab}{op}
          </div>
          <div className="queryLine">
            {tab}{space}{space}{'name: "Jinhee is cooler than Tim"'}
          </div>
          <div className="queryLine">
            {tab}{space}{space}{'author: "Jinhee Choi"'}
          </div>
          <div className="queryLine">
            {tab}{space}{space}{'shelf_id: "1"'}
          </div>
          <div className="queryLine">
            {tab}{cp}
          </div>
          <div>
            {tab}{ob}
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"name"} 
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"author"} 
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"shelf_id"} 
          </div>
          <div className="queryLine">
            {tab}{cb}
          </div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
  }

  if (theQuery === "update mutation") {
    return (
      <>
        <div className="query-div">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'changeBooksByAuthor'}
          </div>
          <div>
            {tab}{op}
          </div>
          <div className="queryLine">
            {tab}{space}{space}{'name: "No, Tim is cooler than Jinhee"'}
          </div>
          <div className="queryLine">
            {tab}{space}{space}{'author: "Jinhee Choi"'}
          </div>
          <div className="queryLine">
            {tab}{cp}
          </div>
          <div>
            {tab}{ob}
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"name"} 
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"author"} 
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"shelf_id"} 
          </div>
          <div className="queryLine">
            {tab}{cb}
          </div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
  }

  if (theQuery === "delete mutation") {
    return (
      <>
        <div className="query-div">
          <div className="queryLine">{ob}</div>
          <div className="queryLine">
            {space}{space}{'deleteBooksByName'}
          </div>
          <div>
            {tab}{op}
          </div>
          <div className="queryLine">
            {tab}{space}{space}{'name: "No, Tim is cooler than Jinhee"'}
          </div>
          <div className="queryLine">
            {tab}{cp}
          </div>
          <div>
            {tab}{ob}
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"id"} 
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"name"} 
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"author"} 
          </div>
          <div className="queryLine">
            {tab}{space}{space}{"shelf_id"} 
          </div>
          <div className="queryLine">
            {tab}{cb}
          </div>
          <div className="queryLine">{cb}</div>
        </div>
      </>
    );
  }
};


export default Query;
