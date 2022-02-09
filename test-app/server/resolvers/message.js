const db = require('../models/db');

module.exports = {
  getCharacter: async (args) => {
    console.log('in getCharacter query ASYNC');
    console.log(args);
    try {
      query = 'SELECT * FROM PEOPLE WHERE _id = $1;';
      const response = await db.query(query, [args._id]);
      console.log('id response:', response);
      return response.rows[0];
    } catch (error) {
      console.log(error);
      return error;
    }
  },
  getCharacters: async (args) => {
    try {
      query = 'SELECT * FROM PEOPLE';
      const response = await db.query(query);
      console.log(response.rows);
      return response.rows;
    } catch (error) {
      console.log(error);
      return error;
    }
  },
  getPlanets: async (args) => {
    try {
      query = 'SELECT * FROM PLANETS';
      const response = await db.query(query);
      console.log(response.rows);
      return response.rows;
    } catch (error) {
      console.log(error);
      return error;
    }
  },
  getSpecies: async (args) => {
    try {
      query = 'SELECT * FROM SPECIES';
      const response = await db.query(query);
      console.log(response.rows);
      return response.rows;
    } catch (error) {
      console.log(error);
      return error;
    }
  },
  getVessels: async (args) => {
    try {
      query = 'SELECT * FROM VESSELS';
      const response = await db.query(query);
      console.log(response.rows);
      return response.rows;
    } catch (error) {
      console.log(error);
      return error;
    }
  },
  createCharacter: async (args) => {
    console.log('in createCharacter');
    const query = `
      INSERT INTO people (name, mass,hair_color,eye_color,birth_year,gender,species_id, homeworld_id, height)
      VALUES ($1,100,'black','green',1900,'male',1,1,200)
      RETURNING *
      `;
    try {
      const response = await db.query(query, [args.name]);
      return response.rows[0];
    } catch (error) {
      console.log(error);
      return error;
    }
  },
  deleteCharacter: async (args) => {
    console.log('in deleteCharacter');
    const query = `
      DELETE FROM people
      WHERE _id = $1
      RETURNING *
      `;
    try {
      const response = await db.query(query, [args._id]);
      return response.rows[0];
    } catch (error) {
      console.log(error);
      return error;
    }
  },
  updateCharacter: async (args) => {
    console.log('in updateCharacter');
    console.log(args.name);
    console.log(args._id);

    const query = `
          UPDATE people
          SET name=$1
          WHERE _id = $2
          RETURNING *
          `;
    try {
      const response = await db.query(query, [args.name, args._id]);
      return response.rows[0];
    } catch (error) {
      console.log(error);
      return error;
    }
  },
};
