const db = require('../models/db');




module.exports = {

  getCharacter: async (args) =>{
    console.time('get Character');

    const query = 'SELECT * FROM PEOPLE WHERE _id = $1;';
    try{
      const response = await db.query(query,[args._id])
      console.timeEnd('get Character');

      return response.rows[0]
    }catch(error){
      console.log(error)
      return error
    }
  },
  allCharacters: async (args) =>{
    console.time('get All');
    const query = 'SELECT * FROM PEOPLE;';
    try{
      const response = await db.query(query)
      console.timeEnd('get All');

      return response.rows
    }catch(error){
      console.log(error)
      return error
    }
  },
  createCharacter: async(args) => {
    console.log('in createCharacter')
    const query = `
      INSERT INTO people (name, mass,hair_color,eye_color,birth_year,gender,species_id, homeworld_id, height) 
      VALUES ($1,100,'black','green',1900,'male',1,1,200)
      RETURNING *
      `
    try{
      const response = await db.query(query,[args.name])
      return response.rows[0]
    }catch(error){
      console.log(error)
      return error
    }
  },
  deleteCharacter: async(args) => {
    console.log('in deleteCharacter')
    const query = `
      DELETE FROM people
      WHERE _id = $1
      RETURNING *
      `
    try{
      const response = await db.query(query,[args._id])
      return response.rows[0]
    }catch(error){
      console.log(error)
      return error
    }
  }
};