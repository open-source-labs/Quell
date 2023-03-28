const db = require('./countriesModel');
const dbBooks = require('./booksModel');

const graphqlNodeModule =
  process.env.NODE_ENV === 'development'
    ? '../../../quell-server/node_modules/graphql'
    : 'graphql';

const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLID,
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull
} = require(graphqlNodeModule);

// =========================== //
// ===== TYPE DEFINITIONS ==== //
// =========================== //

/*
  Generally corresponds with table we're pulling from
*/

const BookShelfType = new GraphQLObjectType({
  name: 'BookShelf',
  fields: () => ({})
});

const BookType = new GraphQLObjectType({
  name: 'Book',
  fields: () => ({})
});

const CountryType = new GraphQLObjectType({
  name: 'Country',
  fields: () => ({})
});

const CityType = new GraphQLObjectType({
  name: 'City',
  fields: () => ({})
});

// ADD LANGUAGES TYPE HERE

// ================== //
// ===== QUERIES ==== //
// ================== //

const RootQuery = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {}
});

// ================== //
// ===== MUTATIONS ==== //
// ================== //

const RootMutation = new GraphQLObjectType({
  name: 'RootMutationType',
  fields: {}
});

// imported into server.js
module.exports = new GraphQLSchema({
  query: RootQuery,
  mutation: RootMutation,
  types: [CountryType, CityType, BookType, BookShelfType]
});
