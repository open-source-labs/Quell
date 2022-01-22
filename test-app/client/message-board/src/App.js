import { Quellify, lokiClientCache } from './quell-client/src/Quellify';
import { useRef, useState } from 'react';
import './App.css';

function App() {
  const fetchInfo = useRef(null);
  const createInfo = useRef(null);
  const deleteInfo = useRef(null);

  const queryMap = { getCharacter: 'Character' };
  const mutationMap = {
    createCharacter: 'Character',
    deleteCharacter: 'Character',
  };
  const map = {
    Character: 'Character',
  };

  const [cache, setCache] = useState([]);

  const handleFetchClick = async () => {
    let startTime = new Date();
    console.log(lokiClientCache.data);

    const _id = fetchInfo.current.value;
    console.log(_id);
    // const results = await fetch('http://localhost:3434/graphql', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     query: `{
    //     getCharacter(_id: ${_id}){
    //       _id
    //       name
    //     }
    //   }`,
    //   }),
    // });

    const query = `query {
      getCharacter(_id: ${_id}){
        _id
       name
      }
     }`;

    const parsedResponse = await Quellify(
      'http://localhost:3434/graphql',
      query,
      mutationMap,
      map,
      queryMap
    );

    let endTime = new Date();
    let diff = endTime - startTime;
    const characterData = parsedResponse.data.data.getCharacter;
    const li = createLi(characterData, diff);
    const characterBoard = document.getElementById('character-list');
    characterBoard.appendChild(li);

    //update messageboard after creating new message
  };

  const clearCache = () => {
    lokiClientCache.clear();
    console.log(lokiClientCache);
  };

  const handleCreateClick = async () => {
    const name = createInfo.current.value;
    console.log(name);
    const results = await fetch('http://localhost:3434/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `mutation {
        createCharacter(name: "${name}"){
          _id
          name
        }
      }`,
      }),
    });
    const parsedResponse = await results.json();
    const characterData = parsedResponse.data.createCharacter;
    const li = createLi(characterData);
    const characterBoard = document.getElementById('character-list');
    characterBoard.appendChild(li);
  };

  const createLi = (character, time) => {
    //create button
    const name = character.name;
    const _id = character._id;
    let idAndName = `id: ${_id} \n name: ${name} \n timeElapsed:${time} ms`;
    //create new Li and append button to it
    const newLi = document.createElement('li');
    newLi.innerText = idAndName;
    return newLi;
  };

  const handleDeleteClick = async () => {
    const _id = deleteInfo.current.value;
    console.log(_id);
    const results = await fetch('http://localhost:3434/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `mutation{
        deleteCharacter(_id: ${_id}){
          _id
          name
        }
      }`,
      }),
    });
    const parsedResponse = await results.json();
    const characterData = parsedResponse.data.deleteCharacter;
    const li = createLi(characterData);
    let innerText = `(DELETED)\n`;
    innerText += li.innerText;
    li.innerText = innerText;
    const characterBoard = document.getElementById('character-list');
    characterBoard.appendChild(li);
  };

  const handleClearClick = () => {
    const characterBoard = document.getElementById('character-list');
    characterBoard.innerHTML = '';
  };

  return (
    <div id='container'>
      <h1>GET STARWARS CHARACTER</h1>
      <div className='row'>
        <input id='id' ref={fetchInfo} placeholder='id' type='text' />
        <button onClick={handleFetchClick} id='fetch'>
          FETCH
        </button>
        <input
          id='createName'
          ref={createInfo}
          placeholder='name'
          type='text'
        />
        <button onClick={handleCreateClick} id='create'>
          CREATE
        </button>
        <input
          id='deleteid'
          ref={deleteInfo}
          placeholder='delete'
          type='text'
        />
        <button onClick={handleDeleteClick} id='delete'>
          DELETE
        </button>
      </div>
      <ul id='character-list'></ul>
      <div id='clear-btn-container'>
        <button onClick={handleClearClick} id='clear'>
          Clear Board
        </button>
      </div>
      <button onClick={clearCache}>Clear Cache</button>
      <div>
        Cache
        {lokiClientCache.data.forEach((el) => {
          return (
            <li>
              id: {el.id} -- cacheID: {el.cacheID} -- queryType: {el.queryType}
              -- $loki: {el.$loki}
            </li>
          );
        })}
      </div>
    </div>
  );
}

export default App;
