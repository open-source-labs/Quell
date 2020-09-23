const { Pool } = require('pg');

const URI = 'postgres://ciazdabk:b-BiZoFsMIhJS5xNzVlGPo3hhzdRYmvd@lallah.db.elephantsql.com:5432/ciazdabk'

const pool = new Pool({
  connectionString: URI
});

module.exports = {
  query: (text, params, callback) => {
    return pool.query(text, params, callback);
  }
};