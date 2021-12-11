import getQuery from "./getQuery";

/** Returns true iff HAR entry request property has 
 * requestBody containing GraphQL operations 
 * @param{Object} req - HAR log entry
*/
const isGQLQuery = (req) => {
  const operations = getQuery(req);
  console.log('request operations: ', operations)
  if (!operations) return false;
  return operations.includes('query') ? true : false; 
}

export default isGQLQuery;