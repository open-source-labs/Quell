const express = require("express");
const path = require("path");
const schema = require("./schema/schema");
const graphqlNodeModule =
  process.env.NODE_ENV === "development"
    ? "../../quell-server/src/quell"
    : "@quell/server";
const QuellCache = require(graphqlNodeModule);

// Express instance
const app = express();
const PORT = 3000;

// Instantiate cache GraphQL middleware
const redisPort =
  process.env.NODE_ENV === "production" ? process.env.REDIS_URL : 6379;
const quellCache = new QuellCache(schema, redisPort, 600);

// JSON parser:
app.use(express.json());

if (process.env.NODE_ENV === "production") {
  // statically serve everything in the dist folder on the route
  app.use("/dist", express.static(path.resolve(__dirname, "../dist")));
  // serve index.html on the route '/'
  app.get("/", (req, res) => {
    console.log("get request");
    return res
      .status(200)
      .sendFile(path.resolve(__dirname, "../client/src/index.html"));
  });
}

// Route that triggers the flushall function to clear the Redis cache
app.get("/clearCache", quellCache.clearCache, (req, res) => {
  return res.status(200).send("Redis cache successfully cleared");
});

// GraphQL route
app.use("/graphql", quellCache.query, (req, res) => {
  return res.status(200).send(res.locals.queryResponse);
});

// Catch-all endpoint handler
app.use((req, res) => {
  return res.status(400).send("Page not found.");
});

// Global error handler
app.use((err, req, res, next) => {
  const defaultErr = {
    log: "Express error handler caught unknown middleware error!",
    status: 500,
    message: { err: "An error occurred!" },
  };
  const errorObj = Object.assign(defaultErr, err);
  return res.status(errorObj.status).json(errorObj.message);
});

app.listen(PORT, () => {
  console.log("Magic happening on " + PORT);
});

module.exports = app;
