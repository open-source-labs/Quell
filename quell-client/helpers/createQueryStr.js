/**
 createQueryStr converts the query object into a formal GCL query string.
 */

function createQueryStr(queryObject, QuellStore) {
  console.log('QuellStore in createQueryStr ===> ', QuellStore);
  console.log('queryObject ===> ', queryObject);
  let argString = '';
  if (QuellStore.arguments) {
    const openParen = ' (';
    const closeParen = ' )';
    argString += openParen;
    for (let field in QuellStore.arguments) {
      for (let arg of QuellStore.arguments[field]) {
        argString += Object.keys(arg)[0] + ': ' + arg[Object.keys(arg)[0]];
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
