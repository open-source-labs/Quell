/**
 * createQueryStr converts the query object constructed in createQueryObj into a properly-formed GraphQL query,
 * requesting just those fields not found in cache.
 * @param {Object} queryObject - object representing queried fields not found in cache
 */
function createQueryStr(queryObject, queryArgsObject) {
  console.log(queryArgsObject, "query args object in create query string");
  const openCurl = " { ";
  const closedCurl = " } ";
  let queryString = "";
  for (const key in queryObject) {
    if (queryArgsObject && queryArgsObject[key]) {
      let argString = "";

      const openBrackets = " (";
      const closeBrackets = " )";
      argString += openBrackets;
      for (const item in queryArgsObject[key]) {
        argString += item + ": " + queryArgsObject[key][item];
      }
      argString += closeBrackets;
      queryString +=
        key +
        argString +
        openCurl +
        this.queryStringify(queryObject[key]) +
        closedCurl;
    } else {
      queryString +=
        key + openCurl + this.queryStringify(queryObject[key]) + closedCurl;
    }
  }
  return openCurl + queryString + closedCurl;
}
/**
 * queryStringify is a helper function called from within createQueryStr. It iterates through an
 * array of field names, concatenating them into a fragment of the query string being constructed
 * in createQueryStr.
 * @param {Array} fieldsArray - array listing fields to be added to GraphQL query
 */
function queryStringify(fieldsArray) {
  const openCurl = " { ";
  const closedCurl = " } ";
  let innerStr = "";
  for (let i = 0; i < fieldsArray.length; i += 1) {
    if (typeof fieldsArray[i] === "string") {
      innerStr += fieldsArray[i] + " ";
    }
    if (typeof fieldsArray[i] === "object") {
      for (const key in fieldsArray[i]) {
        innerStr +=
          key +
          openCurl +
          this.queryStringify(fieldsArray[i][key]) +
          closedCurl;
      }
    }
  }
  return innerStr;
}

module.exports = createQueryStr;
