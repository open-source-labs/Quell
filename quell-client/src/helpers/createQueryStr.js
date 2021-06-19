/**
 createQueryStr converts the query object into a formal GQL query string.
 */

// TO-DO: add support for operation definitions input at the front ie "query" "mutation" "subscription"

// inputting a comment here to test git commits
function createQueryStr(queryObject, operationType) {
  if (Object.keys(queryObject).length === 0) return ''
  const openCurly = '{';
  const closeCurly = '}';
  const openParen = '(';
  const closeParen = ')';

  let mainStr = '';

  // iterate over every key in queryObject
  // place key into query object
  for (let key in queryObject) {
    mainStr += `${makeTypeKey(queryObject[key], key)}${getArgs
      (queryObject[key])} ${openCurly} ${stringify(
        queryObject[key])}${closeCurly} `;
  }

  // recurse to build nested query strings
  // ignore all __values (ie __alias and __args)
  function stringify(fields) {
    // initialize inner string
    let innerStr = '';
    // iterate over KEYS in OBJECT
    for (const key in fields) {
      // is fields[key] string? concat with inner string & empty space
      if (typeof fields[key] === "boolean") {
        innerStr += key + ' ';
      }
      // is key object? && !key.includes('__'), recurse stringify
      if (typeof fields[key] === 'object' && !key.includes('__')) {
        innerStr += `${makeTypeKey(fields[key], key)}${getArgs(
          fields[key])} ${openCurly} ${stringify(
            fields[key])}${closeCurly} `;
      }
    }

    // experimental code for user-defined unique IDs
    // if (!innerStr.includes(idStyle)) {
    //   innerStr += idStyle + ' '
    // };

    return innerStr;
  }

  // iterates through arguments object for current field and creates arg string to attach to query string
  function getArgs(fields) {
    let argString = '';
    if (!fields.__args) return '';

    Object.keys(fields.__args).forEach((key) => {
      argString
        ? (argString += `, ${key}: ${fields.__args[key]}`)
        : (argString += `${key}: ${fields.__args[key]}`);
    });

    // return arg string in parentheses, or if no arguments, return an empty string
    return argString ? `${openParen}${argString}${closeParen}` : '';
  }

  // makeKey takes in the fields object and cache key,
  // produces the appropriate graphQL key, and pairs it with any existing Alias
  function makeTypeKey(fields, key) {
    // find the index of the - character String.indexOf(--) and store it
    const index = key.indexOf("--");
    // if index -1 ('--' not found), return key 
    if (index === -1) return key;
    // store slice from 0 to index as key 
    const newKey = key.slice(0, index);
    // if there is an alias, include it, otherwise pass back the new key
    return fields.__alias ? `${fields.__alias}: ${newKey}` : newKey;
  }

  // create final query string
  const queryStr = openCurly + mainStr + closeCurly;
  // if operation type supplied, place in front of queryString, otherwise just pass queryStr
  return operationType ? operationType + ' ' + queryStr : queryStr;
};

module.exports = createQueryStr;
