const express = require('express');
const graphqlHTTP = require('express-graphql');
const bodyParser = require('body-parser');

// import Schema from './server/schema.js';

const app = express();

app.use(bodyParser());
app.use(express.static(__dirname + '/src'));

// app.use('/graphql', graphqlHTTP ((req) => ({
//   schema: Schema,
//   rootValue: 'rootValue',
//   graphiql: true
// })));

const PORT = 3000;

app.listen(PORT, () => {
  console.log('graphql listening on ' + PORT);
});