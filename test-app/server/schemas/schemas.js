const { buildSchema } = require('graphql');

module.exports = buildSchema(`

type Character{
  _id: ID!
  name: String!
  mass: String!
  hair_color: String!
  skin_color: String!
  eye_color: String!
  birth_year: String!
  gender: String!
  fetchTime: String!
}


type Mutation{
  createCharacter(name: String!): Character
  deleteCharacter(_id: ID!): Character
  updateCharacter(name: String!): Character
}
type Query {
  getCharacter(_id: ID!): Character
}



schema {
  query: Query
  mutation: Mutation
}
`);

//old schema
// `

// type Character{
//   _id: ID!
//   name: String!
//   mass: String!
//   hair_color: String!
//   skin_color: String!
//   eye_color: String!
//   birth_year: String!
//   gender: String!
// }

// input MessageInput {
//   message: String!
//   password: String!
// }

// type Query {
//   messages: [Message!]
//   getCharacter(id: ID!): Character
// }

// type Mutation {
//     createMessage(message: MessageInput): Message
//     deleteMessage(id: ID!): Message

// }

// schema {
//   query: Query
//   mutation: Mutation
// }
// `
