const { buildSchema } = require('graphql');

// ===== TYPE DEFINITIONS ==== 
/*
  - basically tells it what to expect from the db
  - resolvers.js is going to match what's in here w/ database calls
*/
const schema = buildSchema(`
  type Query {
    countries: [Country!]!
    cities: [City!]!
  }

  type Country {
    id: ID!
    name: String!
    capital: String!
    cities: [City!]!
  }

  type City {
    country_id: String!
    id: ID!
    name: String!
    population: Int!
  }
`);


// is later imported in resolvers.
module.exports = schema;