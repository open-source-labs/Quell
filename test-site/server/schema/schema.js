const { 
  GraphQLSchema, 
  GraphQLObjectType, 
  GraphQLList, 
  GraphQLID, 
  GraphQLString, 
  GraphQLInt } = require('graphql');
const db = require('../models/countriesModel');


// ===== TYPE DEFINITIONS ==== 
/*
  - basically tells it what to expect from the db
  - resolvers.js is going to match what's in here w/ database calls
*/

const CountryType = new GraphQLObjectType({
  name: 'Country',
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    capital: { type: GraphQLString },
    cities: {
      type: new GraphQLList(CityType),
      async resolve(parent, args) {
        const citiesList = await db.query(`
          SELECT * FROM cities WHERE country_id = $1`, [Number(parent.id)])
        
        return citiesList.rows
      }
    }
  })
});

const CityType = new GraphQLObjectType({
  name: 'City',
  fields: () => ({
    country_id: { type: GraphQLString },
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    population: { type: GraphQLInt }
  })
});

const RootQuery = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    country: {
      type: CountryType,
      args: { id: { type: GraphQLID } },
      async resolve(parent, args) {
        const country = await db.query(`
          SELECT * FROM countries WHERE id = $1`, [Number(args.id)]);
        
        return country.rows[0];
      }
    },
    countries: {
      type: new GraphQLList(CountryType),
      async resolve(parent, args) {
        const countriesFromDB = await db.query(`
          SELECT * FROM countries
          `);
  
        return countriesFromDB.rows;
      }
    },
    citiesByCountry: {
      type: new GraphQLList(CityType),
      args: { country_id: { type: GraphQLID } },
      async resolve(parent, args) {
        const citiesList = await db.query(`
          SELECT * FROM cities WHERE country_id = $1`, [Number(args.country_id)]);

        return citiesList.rows;
      }
    },
    cities: {
      type: new GraphQLList(CityType),
      async resolve(parent, args) {
        const citiesList = await db.query(`
          SELECT * FROM cities`);
        
        return citiesList.rows;
      }
    }
  }
});

// imported into server.js
module.exports = new GraphQLSchema({
  query: RootQuery
});