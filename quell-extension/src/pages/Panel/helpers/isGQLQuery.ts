import { getQueryString } from "./parseQuery";

/** Returns true iff HAR entry request property has 
 * requestBody containing GraphQL operations 
 * @param{Object} req - HAR log entry
*/
const isGQLQuery = (req): boolean => {
  return getQueryString(req) ? true : false;
}

export default isGQLQuery;