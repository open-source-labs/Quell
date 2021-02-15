/**
 createQueryStr converts the query object into a formal GCL query string.
 */

function createQueryStr(queryObject, queryArgsObject) {
  console.log(queryArgsObject, 'query args object in create query string');
  let argString = '';
  if (queryArgsObject !== null) {
    const openBrackets = ' (';
    const closeBrackets = ' )';
    argString += openBrackets;
    for (const key in queryArgsObject) {
      argString += key + ': ' + queryArgsObject[key];
    }
    argString += closeBrackets;
  }

  const openCurl = ' { ';
  const closedCurl = ' } ';

  let mainStr = '';

  for (let key in queryObject) {
    mainStr +=
      key + argString + openCurl + stringify(queryObject[key]) + closedCurl;
  }

  function stringify(fieldsArray) {
    let innerStr = '';
    for (let i = 0; i < fieldsArray.length; i++) {
      if (typeof fieldsArray[i] === 'string') {
        innerStr += fieldsArray[i] + ' ';
      }
      if (typeof fieldsArray[i] === 'object') {
        for (let key in fieldsArray[i]) {
          innerStr += key + openCurl + stringify(fieldsArray[i][key]);
          innerStr += closedCurl;
        }
      }
    }
    return innerStr;
  }
  return openCurl + mainStr + closedCurl;
}

module.exports = createQueryStr;
