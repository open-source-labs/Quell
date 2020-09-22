const db = require('../../test-site/server/models/countriesModel');

const { 
  GraphQLSchema, 
  GraphQLObjectType, 
  GraphQLList, 
  GraphQLID, 
  GraphQLString, 
  GraphQLInt, 
  buildSchema,
  GraphQLFloat} = require('graphql');

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
    population: { type: GraphQLInt },
    // longlat: { type: CoordinatesType },
  })
});

// const CoordinatesType = new GraphQLObjectType({
//   name: 'Coordinates',
//   fields: () => ({
//     latitude: { type: GraphQLFloat },
//     longitude: { type: GraphQLFloat },
//   })
// });

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

// const mapQueries = (rootQuery) => {
//   const queryMap = {};
  
//   rootQuery = (typeof rootQuery === 'string') ? buildSchema(rootQuery)._queryType : rootQuery;

//   const rootQueryObject = (typeof rootQuery._fields === 'function') ? rootQuery._fields() : rootQuery._fields; 
//   // console.log(rootQueryObject)
//   for (const query in rootQueryObject) {
//     const mappedValue = rootQueryObject[query].type.name || rootQueryObject[query].type.ofType.name;
//     queryMap[query] = { objectType: mappedValue.toString() };
//   }
  
//   return queryMap;
// }

// // mapQueries(RootQuery);

// const mapFields = (typeDefs) => {
  
//   const fieldMap = {}

//   for (const type of typeDefs) {
//     const fieldsObject = {};
//     const fieldDetails = (typeof type._fields === 'function') ? type._fields() : type._fields;
//     for (const field in fieldDetails) {
//       const key = fieldDetails[field].name;
//       fieldsObject[key] = fieldDetails[field].type.ofType || fieldDetails[field].type;
//     }
    
//     fieldMap[type.name] = fieldsObject;
//   }

//   console.log(typeof fieldMap.Country.cities);
//   return fieldMap;
// }

// mapFields([CountryType, CityType]);



const sdl = `
  type Country {
    id: ID
    name: String
    capital: String
    cities: [City]
  }
  type City {
    id: ID
    country_id: String
    name: String
    population: Int
  }
  type Query {
    country(id: String): Country
    countries: [Country]
    citiesByCountry(country_id: String): [City]
    cities: [City]
  }`;

  // const schemaFromSDL = buildSchema(sdl);
  // console.log(Object.keys(schemaFromSDL._typeMap.Country._fields.name.type));
  // // console.log(schemaFromSDL._queryType._fields)

// console.log(mapQueries(sdl));
// console.log(mapQueries(RootQuery));

// 

module.exports = new GraphQLSchema({
  query: RootQuery,
  types: [CountryType, CityType],
});