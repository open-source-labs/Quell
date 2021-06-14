/**
 createQueryStr converts the query object into a formal GCL query string.
 */

//  const queryObject = {
//   countries: {
//     id: false,
//     name: false,
//     capitol: false,
//     __alias: null,
//     __args: {}
//   }
//  };

// `{countries  { id name capitol   }}`

// TO-DO: add support for operation definitions input at the front

function createQueryStr(queryObject) {
  const openCurly = '{';
  const closeCurly = '}';
  const openParen = '(';
  const closeParen = ')';

  let mainStr = '';

  // iterate over every key in queryObject
  // place key into query object
  for (let key in queryObject) {
    mainStr += `${makeKey(queryObject[key], key)} ${getArgs
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
        innerStr += `${makeKey(fields[key], key)} ${getArgs(
          fields[key])} ${openCurly} ${stringify(
            fields[key])}${closeCurly} `;
        }
      }
    return innerStr;
  }

  function getArgs(fields) {
    let argString = '';
    if (!fields.__args) return '';

    if (Object.keys(fields.__args) !== 0) {
      Object.keys(fields.__args).forEach((key) => {
        argString
          ? (argString += `, ${key} : ${fields.__args[key]} `)
          : (argString += `${key} : ${fields.__args[key]} `);
      });
    }

    // return arg string in parentheses, or an empty string
    return argString ? `${openParen} ${argString} ${closeParen}` : '';
  }

  // makeKey takes in the fields object and cache key,
  // produces the appropriate graphQL key, and pairs it with any existing Alias
  function makeKey(fields, key) {
    // find the index of the - character String.indexOf(--) and store it
    const index = key.indexOf("--");
    // if index -1 ('--' not found), return key 
    if (index === -1) return key;
    // store slice from 0 to index as key 
    const newKey = key.slice(0, index);
    // if there is an alias, include it, otherwise pass back the new key
    return fields.__alias ? `${fields.__alias}: ${newKey}` : newKey;
  }

  return openCurly + mainStr + closeCurly;
};

module.exports = createQueryStr;
