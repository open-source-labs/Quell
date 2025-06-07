export const packageScriptsAdditions = {
  "dev": "nodemon --watch src --exec node --experimental-specifier-resolution=node --loader ts-node/esm src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "clear-cache": "curl http://localhost:4000/clear-cache"
};

export const packageDependencies = [
  'express',
  'graphql',
  'redis',     
  'dotenv'
];

export const packageDevDependencies = [
  'nodemon',
  'typescript',
  'ts-node',
  '@types/express',
  '@types/node'
];