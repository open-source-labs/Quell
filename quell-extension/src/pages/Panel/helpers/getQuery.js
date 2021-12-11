/** Get query (if any) from HAR request's postData key
* @param {Object} req - HAR log entry
*/
const getQuery = (req) => {
  if (!req.request.postData?.text) return null
  return Object.keys(JSON.parse(req.request.postData.text))
}

export default getQuery;