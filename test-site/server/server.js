const express = require('express');
const path = require('path');
const schema = require('./schema/schema');
const { quell } = require('./controllers/quellController')

const app = express();
// const PORT = process.env.PORT || 3000;
const PORT = 3000;

// JSON parser:
app.use(express.json());

// Webpack DevServer
if (process.env.NODE_ENV === 'production') {
  // statically serve everything in the dist folder on the route
  app.use('/dist', express.static(path.resolve(__dirname, '../dist')));
  // serve index.html on the route '/'
  app.get('/', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, '../client/src/index.html'));
  });
}

// GraphQL route
app.use('/graphql', 
  quell(schema),
  (req, res) => { res.status(200).send(res.locals.value) }
);

// catch-all endpoint handler
app.use((req, res) => {
  return res.status(400).send('Page not found.')
});

// global error handler
app.use((err, req, res, next) => {
  const defaultErr = {
    log: 'Express error handler caught unknown middleware error!',
    status: 500,
    message: { err: 'An error occurred!' }
  };
  const errorObj = Object.assign(defaultErr, err);
  console.log(errorObj.log);
  return res.status(errorObj.status).json(errorObj.message);
})

app.listen(PORT, () => {
  console.log('Magic happening on ' + PORT);
});

module.exports = app;