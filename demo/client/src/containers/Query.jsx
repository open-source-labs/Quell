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

  if (theQuery === 'blank') {
    return (
      <>
        <div className='query-div'></div>
      </>
    );
  }

  if (theQuery === 'error') {
    return (
      <>
        <div className='query-div'>
          <div className='queryLine'>
            {'Error: please select a query to run.'}
          </div>
        </div>
      </>
    );
  }

  if (theQuery === 'Simple Query For Characters') {
    return (
      <>
        <div className='query-div'>
          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'getCharacters'} {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {'name'}
          </div>
          <div className='queryLine'>
            {tab}
            {'_id'}
          </div>
          <div className='queryLine'>
            {space}
            {space}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>
        </div>
      </>
    );
  }

  if (theQuery === 'Simple Query For Planets') {
    return (
      <>
        <div className='query-div'>
          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'getPlanets'} {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {'name'}
          </div>
          <div className='queryLine'>
            {tab}
            {'_id'}
          </div>
          <div className='queryLine'>
            {tab}
            {'diameter'}
          </div>
          <div className='queryLine'>
            {tab}
            {'climate'}
          </div>
          <div className='queryLine'>
            {space}
            {space}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>
        </div>
      </>
    );
  }

  if (theQuery === 'Simple Query For Species') {
    return (
      <>
        <div className='query-div'>
          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'getSpecies'} {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {'name'}
          </div>
          <div className='queryLine'>
            {tab}
            {'_id'}
          </div>
          <div className='queryLine'>
            {tab}
            {'classification'}
          </div>
          <div className='queryLine'>
            {tab}
            {'average_height'}
          </div>
          <div className='queryLine'>
            {tab}
            {'average_lifespan'}
          </div>
          <div className='queryLine'>
            {space}
            {space}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>
        </div>
      </>
    );
  }

  if (theQuery === 'Simple Query For Vessels') {
    return (
      <>
        <div className='query-div'>
          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'getVessels'} {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {'name'}
          </div>
          <div className='queryLine'>
            {tab}
            {'_id'}
          </div>
          <div className='queryLine'>
            {tab}
            {'manufacturer'}
          </div>
          <div className='queryLine'>
            {tab}
            {'model'}
          </div>
          <div className='queryLine'>
            {tab}
            {'vessel_type'}
          </div>
          <div className='queryLine'>
            {space}
            {space}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>
        </div>
      </>
    );
  }

  //book;
  if (theQuery === 'simple query with argument') {
    return (
      <>
        <div className='query-div'>
          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'getCharacter(id: "1")'} {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {'name'}
          </div>
          <div className='queryLine'>
            {tab}
            {'_id'}
          </div>
          <div className='queryLine'>
            {tab}
            {'gender'}
          </div>
          <div className='queryLine'>
            {space}
            {space}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>
        </div>
      </>
    );
  }
  //attractions;
  if (theQuery === 'simple query with argument and alias') {
    return (
      <>
        <div className='query-div'>
          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'LeiaOrgana:getCharacter(_id:"5")'} {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {'name'}
          </div>
          <div className='queryLine'>
            {tab}
            {'gender'}
          </div>
          <div className='queryLine'>
            {tab}
            {'birth_year'}
          </div>
          <div className='queryLine'>
            {space}
            {space}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>
        </div>
      </>
    );
  }
  //cities;
  if (theQuery === 'multiple queries') {
    return (
      <>
        <div className='query-div' id='smaller-text'>
          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'LukeSkywalker:getCharacter(_id:"1")'} {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {'name'}
          </div>
          <div className='queryLine'>
            {tab}
            {'gender'}
          </div>
          <div className='queryLine'>
            {space}
            {space}
            {cb}
          </div>
          <div className='queryLine'>
            {space}
            {space}
            {'LeiaOrgana:getCharacter(_id:"5")'} {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {'name'}
          </div>
          <div className='queryLine'>
            {tab}
            {'gender'}
          </div>

          <div className='queryLine'>
            {space}
            {space}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>
        </div>
      </>
    );
  }

  //characters;
  if (theQuery === 'fragment') {
    return (
      <>
        <div className='query-div' id='smaller-text'>
          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'LukeSkywalker:getCharacter(_id:"1")'} {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {'...phenoTypes'}
          </div>
          <div className='queryLine'>
            {space}
            {space}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>

          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'LeiaOrgana:getCharacter(_id:"5")'} {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {'...phenoTypes'}
          </div>
          <div className='queryLine'>
            {space}
            {space}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>

          <div className='queryLine'>{tab}</div>
          <div className='queryLine'>
            {'fragment phenoTypes on Character'} {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {'hair_color'}
          </div>
          <div className='queryLine'>
            {tab}
            {'skin_color'}
          </div>
          <div className='queryLine'>
            {tab}
            {'eye_color'}
          </div>
          <div className='queryLine'>{cb}</div>
        </div>
      </>
    );
  }

  if (theQuery === 'add mutation') {
    return (
      <>
        <div className='query-div'>
          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'createCharacter'}
          </div>
          <div>
            {tab}
            {op}
          </div>
          <div className='queryLine'>
            {tab}
            {space}
            {space}
            {'name: "Blade The Daywalker"'}
          </div>
          <div className='queryLine'>
            {tab}
            {cp}
          </div>
          <div>
            {tab}
            {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {space}
            {space}
            {'_id'}
          </div>
          <div className='queryLine'>
            {tab}
            {space}
            {space}
            {'name'}
          </div>
          <div className='queryLine'>
            {tab}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>
        </div>
      </>
    );
  }

  if (theQuery === 'update mutation') {
    return (
      <>
        <div className='query-div'>
          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'updateCharacter'}
          </div>
          <div>
            {tab}
            {op}
          </div>
          <div className='queryLine'>
            {tab}
            {space}
            {space}
            {'_id: 241'}
          </div>
          <div className='queryLine'>
            {tab}
            {space}
            {space}
            {'name: "Max Payne"'}
          </div>
          <div className='queryLine'>
            {tab}
            {cp}
          </div>
          <div>
            {tab}
            {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {space}
            {space}
            {'_id'}
          </div>
          <div className='queryLine'>
            {tab}
            {space}
            {space}
            {'name'}
          </div>

          <div className='queryLine'>
            {tab}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>
        </div>
      </>
    );
  }

  if (theQuery === 'delete mutation') {
    return (
      <>
        <div className='query-div'>
          <div className='queryLine'>{ob}</div>
          <div className='queryLine'>
            {space}
            {space}
            {'deleteCharacter'}
          </div>
          <div>
            {tab}
            {op}
          </div>
          <div className='queryLine'>
            {tab}
            {space}
            {space}
            {'_id: "241"'}
          </div>
          <div className='queryLine'>
            {tab}
            {cp}
          </div>
          <div>
            {tab}
            {ob}
          </div>
          <div className='queryLine'>
            {tab}
            {space}
            {space}
            {'_id'}
          </div>
          <div className='queryLine'>
            {tab}
            {space}
            {space}
            {'name'}
          </div>
          <div className='queryLine'>
            {tab}
            {cb}
          </div>
          <div className='queryLine'>{cb}</div>
        </div>
      </>
    );
  }
};

export default Query;
