export const serverTemplate = `import express, { Request, Response, NextFunction } from 'express';
import { quellCache } from '../../quell-config';
import { schema, resolvers } from './schema/example-schema';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

const PORT = process.env.PORT || 4000;

// Apply Quell caching middleware
app.use(
  "/graphql",
  // clearElapsedTime,
  // quellCache.rateLimiter as any,
  // quellCache.costLimit as any,
  // quellCache.depthLimit as any,
  quellCache.query as any,
  (_req: Request, res: Response): void => {
    try {
      res.status(200).json({ queryResponse: res.locals });
    } catch (error) {
      console.error("Error in GraphQL endpoint:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
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