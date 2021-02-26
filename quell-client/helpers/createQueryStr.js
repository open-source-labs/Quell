/**
 createQueryStr converts the query object into a formal GCL query string.
 */

function createQueryStr(queryObject, QuellStore) {
  console.log('QuellStore in createQueryStr ===> ', QuellStore);
  console.log('queryObject ===> ', queryObject);
  const openCurly = '{';
  const closeCurly = '}';
  const openParen = '(';
  const closeParen = ')';

  let mainStr = '';

  for (let key in queryObject) {
    mainStr += `${key} ${getArgs(key) || ''} ${openCurly} ${stringify(
      queryObject[key]
    )}  ${closeCurly}`;
  }

  function stringify(fieldsArray) {
    let innerStr = '';
    for (let i = 0; i < fieldsArray.length; i++) {
      if (typeof fieldsArray[i] === 'string') {
        innerStr += fieldsArray[i] + ' ';
      }
      if (typeof fieldsArray[i] === 'object') {
        for (let key in fieldsArray[i]) {
          innerStr += `${key} ${getArgs(key) || ''} ${openCurly} ${stringify(
            fieldsArray[i][key]
          )} ${closeCurly}`;
        }
      }
    }
    return innerStr;
  }

  function getArgs(key) {
    let argString = '';

    if (QuellStore.arguments[key]) {
      QuellStore.arguments[key].forEach((arg) => {
        argString
          ? (argString += `, ${Object.keys(arg)[0]} : ${
              Object.values(arg)[0]
            } `)
          : (argString += `${Object.keys(arg)[0]} : ${Object.values(arg)[0]} `);
      });
    }

    return argString ? `${openParen} ${argString} ${closeParen}` : null;
  }

  return openCurly + mainStr + closeCurly;
}

module.exports = createQueryStr;
