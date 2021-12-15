import { parseGqlQuery } from "./parseQuery";

/** Returns true iff HAR entry request property has 
 * requestBody containing GraphQL operations 
 * @param{Object} req - HAR log entry
*/
const isGQLQuery = (req): boolean => {
  return parseGqlQuery(req) ? true : false;
}

export default isGQLQuery;