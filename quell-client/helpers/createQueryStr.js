/**
 createQueryStr converts the query object into a formal GCL query string.
 */

function createQueryStr(queryObject, QuellStore) {
  console.log('QuellStore in createQueryStr ===> ', QuellStore);
  let argString = '';
  if (QuellStore.arguments) {
    const openParen = ' (';
    const closeParen = ' )';
    argString += openParen;
    for (let field in QuellStore.arguments) {
      for (let key in QuellStore.arguments[field]) {
        argString += key + ': ' + QuellStore.arguments[field][key];
      }
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
        innerStr += fieldsArray[i] + ' ';
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
