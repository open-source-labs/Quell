const db = require('./models/countriesModel');

// ================================= //
// ====== QUERYING FUNCTIONS ======= //
// ================================= //

// ====== ALL COUNTRIES ======= //
async function getAllCountries(root, args, context, info) {
  const countriesFromDB = await db.query(`
    SELECT * FROM countries
  `);
  
  return countriesFromDB.rows;
}

// ====== CITIES BY COUNTRY ID ======= //
function getCitiesByCountryID(root, args, context, info) {
  const cityData = [
    {
      country_id: '1',
      id: '1-001',
      name: 'New York City',
      population: 8756824,
    },
    {
      country_id: '1',
      id: '1-002',
      name: 'Los Angeles',
      population: 6782134,
    },
    {
      country_id: '2',
      id: '2-001',
      name: 'Toronto',
      population: 5627817,
    }
  ];
  
  return cityData;
}

// ======================== //
// ====== RESOLVERS ======= //
// ======================== //

const resolvers = {
  countries: getAllCountries,
  cities: getCitiesByCountryID,
};


module.exports = resolvers;

/*

const resolvers = {
  // RETURNS ALL COUNTRIES
  countries() {
    return await db.query(`
      SELECT * FROM countries
    `).rows
  },
  async cities(parent, args, context, info) {
    // RETURNS CITY BY NAME
      if (args.name) {
        return await db.query(`
          SELECT * FROM cities
          WHERE id = ${args.name}
        `).rows
      }
    // RETURNS CITY BY NAME
      if (args.name) {
        return await db.query(`
          SELECT * FROM cities
          WHERE name = ${args.name}
        `).rows
      }
    // RETURNS ALL CITIES
      return await db.query(`
        SELECT * FROM cities
      `).rows
  },
}


*/