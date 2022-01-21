/**
 createMutationStr converts the query object into a formal GQL mutation string.
  *  @param {object} mutationObj - JavaScript object with missing fields from the cache (true)
 */

function createMutationStr(mutationObj) {
  //error case handling - if there is no key-value pair in mutationObj
  if (Object.keys(mutationObj).length === 0) return '';

  // declare variables that will be used to create mutation string
  const openCurly = '{', closeCurly = '}', openParen = '(', closeParen = ')';
  let mutationStr = 'mutation';
	      
  // iterate over every key in mutationObj and place key into query object
  for (let key in mutationObj) {
    mutationStr += ` ${openCurly}${key}${getArgs(mutationObj[key])} ${openCurly} ${stringify(mutationObj[key])} ${closeCurly} ${closeCurly}`;
  }
 
  // recurse to build nested query strings
  // ignore all __values (ie __alias and __args)
  function stringify(fields) {
    // initialize inner string
    let innerStr = '';
    // iterate over KEYS in OBJECT
    // is fields[key] string? concat with inner string & empty space
    for (const key in fields) { if (typeof fields[key] === "boolean") innerStr += key + ' '; }  
    return innerStr;
  }
	      
  // iterates through arguments object for current field and creates arg string to attach to query string
  function getArgs(fields) {
    let argString = '';
    if (!fields.__args) return '';
  
    Object.keys(fields.__args).forEach((key) => {
      argString
      ? (argString += `, ${key}: \"${fields.__args[key]}\" `)
      : (argString += `${key}: \"${fields.__args[key]}\" `);
    });
 
    // return arg string in parentheses, or if no arguments, return an empty string
    return argString ? `${openParen}${argString}${closeParen}` : '';
  }

  // create final query string
  return mutationStr;
};    

module.exports = createMutationStr;
      