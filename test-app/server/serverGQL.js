const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { graphqlHTTP } = require('express-graphql');
const {GraphQLSchema} = require('graphql');
const graphqlSchema = require('./schemas/schemas');
const graphqlResolvers = require('./resolvers/message');
const QuellCache = require('../../quell-server/src/quell');
const schema = require('./schemas/quellSchemas')

const app = express();
const redisPort = 6379
const PORT = 3434;
const quellCache = new QuellCache(schema, redisPort, 1200);

app.use(express.json());
app.use(express.static(path.join(__dirname,'../assets')));
app.use(cookieParser());




// app.use('/graphql', quellCache.query, (req, res) => {
//   return res.status(200).send(res.locals.queryResponse);
// });



app.use('/graphql', graphqlHTTP({
  schema: graphqlSchema,
  rootValue: graphqlResolvers,
  graphiql: true
}));






//send html
app.get('/' , (req,res) => {
  res.status(200).sendFile(path.join(__dirname,'../views/index.html'));
});
//global catch
app.use('*', (req,res) => res.sendStatus(404));
//global error handler 
app.use((err,req,res,next)=>{
  const defaultErr = {
    log: 'Express error handler caught unknown middleware error',
    status: 400,
    message: { err: 'An error occurred' }, 
  };
  const errorObj = Object.assign(defaultErr,err);
  console.log(errorObj.log);
  res.status(500).send(JSON.stringify(errorObj.message));
});


app.listen(PORT, () => {
  console.log(`Server listening on port: ${PORT}`);
});

module.exports = app;
