
import { Pool } from 'pg'
import dotenv from 'dotenv'
dotenv.config()


const URI = process.env.PG_URI_BOOKS;

const pool = new Pool({
  connectionString: URI
});


export default {
  query: (text: string, params?: (number | string)[]) => {
    return pool.query(text, params);
  }
};