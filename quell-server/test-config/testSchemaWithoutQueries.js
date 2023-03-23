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
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    books: {
      type: new GraphQLList(BookType),
      async resolve(parent, args) {
        const booksList = await dbBooks.query(
          `
          SELECT * FROM books WHERE shelf_id = $1`,
          [Number(parent.id)]
        );

        return booksList.rows;
      }
    }
  })
});

const BookType = new GraphQLObjectType({
  name: 'Book',
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    author: { type: GraphQLString },
    shelf_id: { type: GraphQLString }
  })
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
          `SELECT * FROM cities WHERE country_id = $1`,
          [Number(parent.id)]
        );

        return citiesList.rows;
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

// ADD LANGUAGES TYPE HERE
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
        name: { type: new GraphQLNonNull(GraphQLString) },
        author: { type: GraphQLString },
        shelf_id: { type: new GraphQLNonNull(GraphQLString) }
      },
      async resolve(parent, args) {
        const author = args.author || '';

        const newBook = await dbBooks.query(
          `INSERT INTO books (name, author, shelf_id) VALUES ($1, $2, $3) RETURNING *`,
          [args.name, author, Number(args.shelf_id)]
        );
        return newBook.rows[0];
      }
    },
    // change book
    changeBook: {
      type: BookType,
      args: {
        id: { type: GraphQLID },
        author: { type: GraphQLString }
      },
      async resolve(parent, args) {
        const updatedBook = await dbBooks.query(
          `UPDATE books SET author = $2 WHERE id = $1 RETURNING *`,
          [args.id, args.author]
        );
        return updatedBook.rows[0];
      }
    },
    // ADD SHELF
    addBookShelf: {
      type: BookShelfType,
      args: {
        name: { type: new GraphQLNonNull(GraphQLString) }
      },
      async resolve(parent, args) {
        const newBookShelf = await dbBooks.query(
          `INSERT INTO bookShelves (name) VALUES ($1) RETURNING *`,
          [args.name]
        );
        return newBookShelf.rows[0];
      }
    },
    // ADD COUNTRY
    addCountry: {
      type: CountryType,
      args: { name: { type: GraphQLString } },
      async resolve(parent, args) {
        const country = await db.create({ name: args.name });
        return country;
      }
    },
    deleteCity: {
      type: CityType,
      args: { name: { type: GraphQLString } },
      async resolve(parent, args) {
        const findCity = await db.findOne({ name: args.name });
        if (findCity) {
          await db.deleteOne({ name: args.name });
        }
      }
    }
  }
});

// imported into server.js
module.exports = new GraphQLSchema({
  mutation: RootMutation,
  types: [CountryType, CityType, BookType, BookShelfType]
});
