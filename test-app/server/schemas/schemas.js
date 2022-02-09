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
}

type Planet{
 _id: ID!
  name: String
  rotation_period: Int!
  orbital_period: Int!
  diameter: Int
  climate: String
  gravity: String!
  terrain: String!
}

type Species{
 _id: ID!
  name: String!
  classification: String!
  average_height: String!
  average_lifespan: String!
  hair_colors: String!
  skin_colors: String!
  eye_colors: String!
}

type Vessel{
 _id: ID!
  name: String!
  manufacturer: String
  model: String!
  vessel_type: String!
  vessel_class: String!
  length: String!
  crew: Int!
}

type Mutation{
  createCharacter(name: String!): Character
  deleteCharacter(_id: ID!): Character
  updateCharacter(_id: ID!,name: String!): Character
}
type Query {
  getCharacter(_id: ID!): Character
  getCharacters:[Character!]!
  getPlanets:[Planet!]!
  getSpecies:[Species!]!
  getVessels:[Vessel!]!
}



schema {
  query: Query
  mutation: Mutation
}
`);

//old schema
// `
// getCharacter(_id: ID!): Character

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
