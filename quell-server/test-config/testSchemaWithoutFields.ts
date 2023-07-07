import db from './countriesModel';
import dbBooks from './booksModel';

const graphqlNodeModule =
  process.env.NODE_ENV === 'development'
    ? '../../../quell-server/node_modules/graphql'
    : 'graphql';

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLID,
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull
} from 'graphql'

// =========================== //
// ===== TYPE DEFINITIONS ==== //
// =========================== //

/*
  Generally corresponds with table we're pulling from
*/

const BookShelfType = new GraphQLObjectType<undefined, undefined>({
  name: 'BookShelf',
  fields: () => ({})
});

const BookType = new GraphQLObjectType<undefined, undefined>({
  name: 'Book',
  fields: () => ({})
});

const CountryType = new GraphQLObjectType<undefined, undefined>({
  name: 'Country',
  fields: () => ({})
});

const CityType = new GraphQLObjectType<undefined, undefined>({
  name: 'City',
  fields: () => ({})
});

// ADD LANGUAGES TYPE HERE

// ================== //
// ===== QUERIES ==== //
// ================== //

const RootQuery = new GraphQLObjectType<undefined, undefined>({
  name: 'RootQueryType',
  fields: {}
});

// ================== //
// ===== MUTATIONS ==== //
// ================== //

const RootMutation = new GraphQLObjectType<undefined, undefined>({
  name: 'RootMutationType',
  fields: {}
});

// imported into server.js
export default new GraphQLSchema({
  query: RootQuery,
  mutation: RootMutation,
  types: [CountryType, CityType, BookType, BookShelfType]
});
