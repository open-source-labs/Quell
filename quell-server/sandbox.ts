import { normalizeNode } from "./src/helpers/cacheNormalizer";

const result = normalizeNode(
  "User",
  { id: 1, name: "Naruto", __typename: "User" },
  { __type: "User", __id: "1", name: true },
  "User",
  { User: "User" }
);

console.log(result);
