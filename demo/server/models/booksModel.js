const { Pool } = require('pg');
require('dotenv').config();

const PG_URI_BOOKS =
  'postgres://aluyeqyw:CITZQvnJk5AbL38kO8szRpxn4Gaeaptz@chunee.db.elephantsql.com/aluyeqyw';
const URI = process.env.PG_URI_BOOKS;
console.log('PG_URI_BOOKS: ', URI);
// postgres://aluyeqyw:CITZQvnJk5AbL38kO8szRpxn4Gaeaptz@chunee.db.elephantsql.com/aluyeqyw

const pool = new Pool({
  connectionString:
    'postgres://aluyeqyw:CITZQvnJk5AbL38kO8szRpxn4Gaeaptz@chunee.db.elephantsql.com/aluyeqyw',
});

module.exports = {
  query: (text, params, callback) => {
    return pool.query(text, params, callback);
  },
};
