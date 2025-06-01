export const serverTemplate = `import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { quellCache } from './quell-config';
import { schema, resolvers } from './schema';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Apply rate limiter middleware (optional)
app.use('/graphql', quellCache.rateLimiter);

// Apply depth limit middleware (optional)
app.use('/graphql', quellCache.depthLimit);

// Apply cost limit middleware (optional)
app.use('/graphql', quellCache.costLimit);

// Apply Quell caching middleware
app.use('/graphql', quellCache.query);

// GraphQL endpoint
app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    rootValue: resolvers,
    graphiql: true,
  })
);

// Add an endpoint to clear the cache
app.get('/clear-cache', quellCache.clearCache, (req, res) => {
  res.send('Cache cleared successfully');
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running on http://localhost:\${PORT}/graphql\`);
  console.log(\`📊 GraphiQL available at http://localhost:\${PORT}/graphql\`);
  console.log(\`🗑️  Clear cache at http://localhost:\${PORT}/clear-cache\`);
});
`;