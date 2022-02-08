document.addEventListener('DOMContentLoaded', () => {
  //set save onclick

  const fetchBtn = document.querySelector('#fetch');
  fetchBtn.onclick = () => handleFetchClick();
  const clearBtn = document.querySelector('#clear');
  clearBtn.onclick = () => handleClearClick();
  const createBtn = document.querySelector('#create');
  createBtn.onclick = () => handleCreateClick();
  const deleteBtn = document.querySelector('#delete');
  deleteBtn.onclick = () => handleDeleteClick();
});

const handleDeleteClick = async () => {
  const _id = document.querySelector('#deleteid').value;
  console.log(_id);
  const results = await fetch('/graphql', {
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
  const end = new Date().getTime();
  const time = end - start;
  document.getElementById("time").innerHTML = "  Delete call in milliSeconds: " + time
  const parsedResponse = await results.json();
  const characterData = parsedResponse.data.deleteCharacter;
  const li = createLi(characterData);
  let innerText = `(DELETED)\n`;
  innerText += li.innerText;
  li.innerText = innerText;
  const characterBoard = document.getElementById('character-list');
  characterBoard.appendChild(li);
};
const handleCreateClick = async () => {
  const name = document.querySelector('#createName').value;
  console.log(name);
  const results = await fetch('/graphql', {
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
  const end = new Date().getTime();
  const time = end - start;
  document.getElementById("time").innerHTML = "  Create call in milliSeconds: " + time
  const parsedResponse = await results.json();
  const characterData = parsedResponse.data.createCharacter;
  const li = createLi(characterData);
  const characterBoard = document.getElementById('character-list');
  characterBoard.appendChild(li);
};
//fetches all messages from db
const handleClearClick = () => {
  const characterBoard = document.getElementById('character-list');
  characterBoard.innerHTML = '';
};

//function that creates a new message element
const createLi = (character, time) => {
  //create button
  const name = character.name;
  const _id = character._id;
  let idAndName = `id: ${_id} \n name: ${name}`;
  //create new Li and append button to it
  const newLi = document.createElement('li');
  newLi.innerText = idAndName;
  return newLi;
};
const fetchAll = async () => {
  const start = new Date().getTime();
  const results = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `{
        allCharacters{
          name
        }
      }`,
    }),
  });
  const end = new Date().getTime();
  const time = end - start;
  document.getElementById("time").innerHTML = "  Fetch call in milliSeconds: " + time
  const parsedResponse = await results.json();

  console.log("Time in milliSeconds: " + time)
  // alert('Execution time: ' + time);
  const characterData = parsedResponse.data.allCharacters.length;
  const li = createLi({name: characterData, _id: 'all'});
  const characterBoard = document.getElementById('character-list');
  characterBoard.appendChild(li);
}
//handle clicks
const handleFetchClick = async () => {
  const start = new Date().getTime();
  const _id = document.querySelector('#id').value;
  if(_id == 'all'){
    fetchAll()
    return
  }
  const results = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `{
        getCharacter(_id: ${_id}){
          _id
          name
        }
      }`,
    }),
  });
  const end = new Date().getTime();
  const time = end - start;
  document.getElementById("time").innerHTML = "  Fetch call in milliSeconds: " + time
  const parsedResponse = await results.json();

  console.log("Time in milliSeconds: " + time)
  // alert('Execution time: ' + time);
  const characterData = parsedResponse.data.getCharacter;
  const li = createLi(characterData);
  const characterBoard = document.getElementById('character-list');
  characterBoard.appendChild(li);
  //update messageboard after creating new message
};
