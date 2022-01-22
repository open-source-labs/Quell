const db = require('../models/db');

const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLID,
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull,
} = require('graphql');


const CharacterType = new GraphQLObjectType({
    name: 'Character',
    fields: () => ({
        _id: { type: GraphQLID },
        mass: { type: GraphQLString },
        hair_color: { type: GraphQLString },
        skin_color: { type: GraphQLString },
        eye_color: { type: GraphQLString },
        birth_year: { type: GraphQLString },
        fetchTime: { type: GraphQLString },
    })
})

const RootQuery = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    // GET COUNTRY BY ID
    getCharacter: {
      type: CharacterType,
      args: { _id: { type: GraphQLID } },
      async resolve(parent, args) {
        console.log('in getCharacter query Root Definition');
        const query = 'SELECT * FROM PEOPLE WHERE _id = $1;';
        try{
          const response = await db.query(query,[args._id])
          return response.rows[0]
        }catch(error){
          console.log(error)
          return error
        }
      },
    }
}
});

// ================== //
// ===== MUTATIONS ==== //
// ================== //

const RootMutation = new GraphQLObjectType({
  name: 'RootMutationType',
  fields: {
    // add book
    createCharacter: {
      type: CharacterType,
      args: {
        name: { type: new GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args) {
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
    // update book name using author data
    deleteCharacter: {
      type: CharacterType,
      args: { _id: { type: GraphQLID } },
      async resolve(parent, args) {
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
      },
    },
}
});

// imported into server.js
module.exports = new GraphQLSchema({
  query: RootQuery,
  mutation: RootMutation,
  types: [CharacterType]
});
