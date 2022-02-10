const express = require('express');
const schema = require('./schema/schema');
const { graphqlHTTP } = require('express-graphql');
const { graphql } = require('../../quell-server/node_modules/graphql');

const path = require('path');
const graphqlNodeModule =
  process.env.NODE_ENV === 'development'
    ? '../../quell-server/src/quell'
    : '@quell/server';
const QuellCache = require(graphqlNodeModule);
const cors = require('cors');

// Express instance
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Instantiate cache GraphQL middleware
const redisPort =
  process.env.NODE_ENV === 'production' ? process.env.REDIS_URL : 6379;
const quellCache = new QuellCache(schema, redisPort, 1200);

// middleware that adds quellCache to request/response object?

// JSON parser:
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  // statically serve everything in the dist folder on the route
  app.use('/dist', express.static(path.resolve(__dirname, '../dist')));
  // serve index.html on the route '/'
  app.get('/', (req, res) => {
    return res
      .status(200)
      .sendFile(path.resolve(__dirname, '../client/src/index.html'));
  });
}

// Route that triggers the flushall function to clear the Redis cache
app.get('/clearCache', quellCache.clearCache, (req, res) => {
  return res.status(200).send('Redis cache successfully cleared');
});

// Graphql with server side caching
app.use('/graphql', quellCache.query, (req, res) => {
  console.log('in quellql');
  return res.status(200).send(res.locals.queryResponse);
});

// GraphQL client route
// app.use('/graphql', (req, res) => {
//   const queryString = req.body.query;
//   console.log('line 54: ', queryString);
//   graphql(schema, queryString)
//     .then((result) => {
//       res.json(result);
//     })
//     .catch((error) => {
//       console.log(error);
//     });
// });

// app.use('/graphql', (req, res) => {
//   console.log('line 50:', res.locals.queryResponse);
//   return res.status(200).send(res.locals.queryResponse);
// });

// Catch-all endpoint handler
app.use((req, res) => {
  return res.status(400).send('Page not found.');
});

// Global error handler
app.use((err, req, res, next) => {
  const defaultErr = {
    log: 'Express error handler caught unknown middleware error!',
    status: 500,
    message: { err: 'An error occurred!' },
  };
  const errorObj = Object.assign(defaultErr, err);
  return res.status(errorObj.status).json(errorObj.message);
});

app.listen(PORT, () => {
  console.log('Magic happening on ' + PORT);
});

module.exports = app;
