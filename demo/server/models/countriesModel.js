const { Pool } = require('pg');
require('dotenv').config();

// Use this URI if you want to use the demo
// const PG_URI =
//   'postgres://aluyeqyw:CITZQvnJk5AbL38kO8szRpxn4Gaeaptz@chunee.db.elephantsql.com/aluyeqyw';

const URI = process.env.PG_URI;
console.log('PG_URI: ', URI);

const pool = new Pool({
  connectionString: URI,
});

module.exports = {
  query: (text, params, callback) => {
    return pool.query(text, params, callback);
  },
};
