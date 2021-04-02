const db = require('../models/countriesModel');

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

let _id = 0;
const books = [];

// =========================== //
// ===== TYPE DEFINITIONS ==== //
// =========================== //

/*
  Generally corresponds with table we're pulling from
*/

// definition for mutation purposes, doesn't exist in database
const BookType = new GraphQLObjectType({
  name: 'Book',
  fields: () => ({
    id: {type: GraphQLID},
    name: {type: GraphQLString},
    author: {type: GraphQLString},
  }),
});

const CountryType = new GraphQLObjectType({
  name: 'Country',
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    capital: { type: GraphQLString },
    cities: {
      type: new GraphQLList(CityType),
      async resolve(parent, args) {
        
        const citiesList = await db.query(
          `
          SELECT * FROM cities WHERE country_id = $1`,
          [Number(parent.id)]
        );

        return citiesList.rows;
      },
    },
  }),
});

const CityType = new GraphQLObjectType({
  name: 'City',
  fields: () => ({
    country_id: { type: GraphQLString },
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    population: { type: GraphQLInt },
  }),
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
        const country = await db.query(
          `
          SELECT * FROM countries WHERE id = $1`,
          [Number(args.id)]
        );

        return country.rows[0];
      },
    },
    // GET ALL COUNTRIES
    countries: {
      type: new GraphQLList(CountryType),
      async resolve(parent, args) {
        const countriesFromDB = await db.query(`
          SELECT * FROM countries
          `);

        return countriesFromDB.rows;
      },
    },
    // GET ALL CITIES IN A COUNTRY
    citiesByCountry: {
      type: new GraphQLList(CityType),
      args: { country_id: { type: GraphQLID } },
      async resolve(parent, args) {
        const citiesList = await db.query(
          `
          SELECT * FROM cities WHERE country_id = $1`,
          [Number(args.country_id)]
        ); // need to dynamically resolve this

        return citiesList.rows;
      },
    },
    // GET ALL CITIES
    cities: {
      type: new GraphQLList(CityType),
      async resolve(parent, args) {
        const citiesList = await db.query(`
          SELECT * FROM cities`);

        return citiesList.rows;
      },
    },
    // GET ALL BOOKS
    books: {
      type: new GraphQLList(BookType),
      resolve(args) {
        return books;
      }
    },
    // GET BOOK BY ID
    book: {
      type: BookType,
      args: { id: { type: GraphQLID } },
      resolve(parent, args) {
        console.log('books -->', books);

        return books.find(book => Number(args.id) === book.id);
      }
    }
  },
});

// ================== //
// ===== MUTATIONS ==== //
// ================== //

const RootMutation = new GraphQLObjectType({
  name: 'RootMutationType',
  fields: {
    // add book
    addBook: {
      type: BookType,
      args: {
        name: {type: new GraphQLNonNull(GraphQLString)},
        author: {type: GraphQLString}
      },
      resolve(parent, args) {
        console.log('ARGS --->', args);
        let newBook = {
          id: _id++,
          ...args
        }
        books.push(newBook);
        console.log('BOOKS --->', books);
        return newBook;
      }
    },
    // change book
    changeBook: {
      type: BookType,
      args: {
        id: { type: GraphQLID },
        author: { type: GraphQLString}
      },
      resolve(parent, args) {
        let updatedBook = {
          id: args.id,
          author: args.author
        }
        books.forEach(book => {
          if(book.id === Number(updatedBook.id)) {
            book.author = updatedBook.author;
            updatedBook.name = book.name;
          }
        });
        return updatedBook;
      }
    }
  }
});

// imported into server.js
module.exports = new GraphQLSchema({
  query: RootQuery,
  mutation: RootMutation,
  types: [CountryType, CityType],
});
