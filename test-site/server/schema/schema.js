const db = require('../models/countriesModel');

const { 
  GraphQLSchema, 
  GraphQLObjectType, 
  GraphQLList, 
  GraphQLID, 
  GraphQLString, 
  GraphQLInt } = require('graphql');

// =========================== //
// ===== TYPE DEFINITIONS ==== //
// =========================== //

/*
  Generally corresponds with table we're pulling from
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
          SELECT * FROM cities WHERE country_id = $1`, [Number(parent.id)]) // need to dynamically resolve this
        
        return citiesList.rows
      }
    }
    // add languages query here
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

// ADD LANGUAGES TYPE HERE

// ================== //
// ===== QUERIES ==== //
// ================== //

const RootQuery = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    // GET COUNTRY BY ID
    country: {
      type: CountryType,
      args: { id: { type: GraphQLID } },
      async resolve(parent, args) {
        const country = await db.query(`
          SELECT * FROM countries WHERE id = $1`, [Number(args.id)]); // need to dynamically resolve this
        
        return country.rows[0];
      }
    },
    // GET ALL COUNTRIES
    countries: {
      type: new GraphQLList(CountryType),
      async resolve(parent, args) {
        const countriesFromDB = await db.query(`
          SELECT * FROM countries
          `);
  
        return countriesFromDB.rows;
      }
    },
    // GET ALL CITIES IN A COUNTRY
    citiesByCountry: {
      type: new GraphQLList(CityType),
      args: { country_id: { type: GraphQLID } },
      async resolve(parent, args) {
        const citiesList = await db.query(`
          SELECT * FROM cities WHERE country_id = $1`, [Number(args.country_id)]); // need to dynamically resolve this

        return citiesList.rows;
      }
    },
    // GET ALL CITIES
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