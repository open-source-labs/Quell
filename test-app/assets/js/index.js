
document.addEventListener('DOMContentLoaded',  () => {
  //set save onclick
  const fetchBtn = document.querySelector('#fetch');
  fetchBtn.onclick = () => handleFetchClick();
  const clearBtn = document.querySelector('#clear');
  clearBtn.onclick = () => handleClearClick();
  const createBtn = document.querySelector('#create')
  createBtn.onclick = () => handleCreateClick();
  const deleteBtn = document.querySelector('#delete')
  deleteBtn.onclick = () => handleDeleteClick();

});  
// const start = new Date().getTime();
// 
// for (i = 0; i < 50000; ++i) {
// // do something
// }

// const end = new Date().getTime();
// const time = end - start;
// alert('Execution time: ' + time);


//  document.getElementById("time").innerHTML = ''
// console.log("Hittin it")

const handleDeleteClick = async () => {
  const _id = document.querySelector('#deleteid').value;
  console.log(_id)
  const start = new Date().getTime();
  const results = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `mutation{
        deleteCharacter(_id: ${_id}){
          _id
          name
        }
      }`
    })
  });
  const end = new Date().getTime();
  const time = end - start;
  document.getElementById("time").innerHTML = "  Delete call in milliSeconds: " + time
  const parsedResponse = await results.json();
  const characterData = parsedResponse.data.deleteCharacter;
  const li = createLi(characterData)
  let innerText = `(DELETED)\n`
  innerText += li.innerText
  li.innerText = innerText
  const characterBoard = document.getElementById('character-list')
  characterBoard.appendChild(li)
}
const handleCreateClick = async () => {
  const name = document.querySelector('#createName').value;
  console.log(name)
  const start = new Date().getTime();

  const results = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `mutation {
        createCharacter(name: "${name}"){
          _id
          name
        }
      }`
    })
  });
  const end = new Date().getTime();
  const time = end - start;
  document.getElementById("time").innerHTML = "  Create call in milliSeconds: " + time
  const parsedResponse = await results.json();
  const characterData = parsedResponse.data.createCharacter
  const li = createLi(characterData)
  const characterBoard = document.getElementById('character-list')
  characterBoard.appendChild(li)
}
//fetches all messages from db
const handleClearClick = () => {
  const characterBoard = document.getElementById('character-list')
  characterBoard.innerHTML = ''
  document.getElementById("time").innerHTML = ''
 
}

//function that creates a new message element
const createLi = (character,time) => {
  //create button 
  const name = character.name;
  const _id = character._id
  let idAndName = `id: ${_id} \n name: ${name}`
  //create new Li and append button to it 
  const newLi = document.createElement('li');
  newLi.innerText = idAndName;
  return newLi;
};

//handle clicks
const handleFetchClick = async () => {
  const start = new Date().getTime();
  const _id = document.querySelector('#id').value;
  console.log(_id)
  const results = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `{
        getCharacter(_id: ${_id}){
          _id
          name
        }
      }`
    })
  });
  const end = new Date().getTime();
  const time = end - start;
  document.getElementById("time").innerHTML = "  Fetch call in milliSeconds: " + time
  const parsedResponse = await results.json();

  console.log("Time in milliSeconds: " + time)
  // alert('Execution time: ' + time);
  const characterData = parsedResponse.data.getCharacter;
  const li = createLi(characterData)
  const characterBoard = document.getElementById('character-list')
  characterBoard.appendChild(li)
  //update messageboard after creating new message
};

