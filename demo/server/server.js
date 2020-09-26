const express = require('express');
const path = require('path');
const schema = require('./schema/schema');
const {graphqlHTTP} = require('express-graphql')
// const { quell } = require('./controllers/quellController');
const QuellCache = require('../../quell-server/src/quell')
const app = express();
// const PORT = process.env.PORT || 3000;
const PORT = 3000;

const quellCache = new QuellCache(schema, 6379, 600);


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

// access to the graphiql playground
app.use('/g', graphqlHTTP({
  schema: schema,
  graphiql: true
}));


// route that triggers the flushall function to clear the Redis cache
app.get('/clearCache', quellCache.clearCache, (req, res) => {
  return res.status(200).send('Redis cache successfully cleared');
})

// GraphQL route
// app.use('/graphql', quell(schema), (req, res) => {
//   res.status(200).send(res.locals.value);
// });
app.use('/graphql', 
  quellCache.query,
  (req, res) => {
    return res
      .status(200)
      .send(res.locals.queryResponse);
  });

// catch-all endpoint handler
app.use((req, res) => {
  return res.status(400).send('Page not found.');
});

// global error handler
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
