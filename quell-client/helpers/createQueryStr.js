/**
 createQueryStr converts the query object into a formal GCL query string.
 */

function createQueryStr(queryObject, queryArgsObject) {
  console.log('queryArgsObject in createQueryStr ===> ', queryArgsObject);
  let argString = '';
  if (queryArgsObject) {
    const openParen = ' (';
    const closeParen = ' )';
    argString += openParen;
    for (const key in queryArgsObject) {
      argString += key + ': ' + queryArgsObject[key];
    }
    argString += closeParen;
  }

  const openCurly = ' { ';
  const closeCurly = ' } ';

  let mainStr = '';

  for (let key in queryObject) {
    mainStr +=
      key + argString + openCurly + stringify(queryObject[key]) + closeCurly;
  }

  function stringify(fieldsArray) {
    let innerStr = '';
    for (let i = 0; i < fieldsArray.length; i++) {
      if (typeof fieldsArray[i] === 'string') {
        innerStr += fieldsArray[i];
      }
      if (typeof fieldsArray[i] === 'object') {
        for (let key in fieldsArray[i]) {
          innerStr += key + openCurly + stringify(fieldsArray[i][key]);
          innerStr += closeCurly;
        }
      }
    }
    return innerStr;
  }

  console.log('createQueryStr ===> ', openCurly + mainStr + closeCurly);
  return openCurly + mainStr + closeCurly;
}

module.exports = createQueryStr;
