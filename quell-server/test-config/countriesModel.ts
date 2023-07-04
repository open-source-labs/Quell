import { Pool } from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const URI = process.env.PG_URI;

const pool = new Pool({
  connectionString: URI
});

type Name = {
  name: string
}

export default {
  query: (text: string, params?: (number | string)[] ) => {
    return pool.query(text, params);
  },
  // Below are placeholders, need to research more into the Pool methods
  create: (text: Name, params?: (number | string)[] ) => {
    return pool.query(text.name, params);
  },
  findOne: (text: Name, params?: (number | string)[] ) => {
    return pool.query(text.name, params);
  },
  deleteOne: (text: Name, params?: (number | string)[] ) => {
    return pool.query(text.name, params);
  }
};