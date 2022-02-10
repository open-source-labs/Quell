const { Pool } = require('pg');
require('dotenv').config();
// uncomment this URI to access the Database if you are working in dev mode and want to use the current database
// const PG_URI_BOOKS =
//   'postgres://aluyeqyw:CITZQvnJk5AbL38kO8szRpxn4Gaeaptz@chunee.db.elephantsql.com/aluyeqyw';

const URI = process.env.PG_URI_BOOKS;
console.log('PG_URI_BOOKS: ', URI);


const pool = new Pool({
  connectionString: URI
    
});

module.exports = {
  query: (text, params, callback) => {
    return pool.query(text, params, callback);
  },
};
