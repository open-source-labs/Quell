/**
 createQueryObj takes in a map of field(keys) and true/false(values) creating an query object containing the fields (false) missing from cache. 
 This will then be converted into a GQL query string in the next step.
 */

function createQueryObj(map) {
  const output = {};
  // !! assumes there is only ONE main query, and not multiples !!

  // iterate over every key in map
  // send fields object to reducer to filter out trues
  // place all false categories on output object
  for (let key in map) {
    const reduced = reducer(map[key]);
    // greater than args & alias
    if (Object.keys(reduced).length > 0) {
      output[key] = reduced;
    }
  }

  // go through fields object
  // if value is false, place on return object
  // if value is true, ignore it
  // if value is object, recurse
  // if object is all true, do not pass through
  function reducer(fields) {
    const filter = {};
    const propsFilter = {};

    for (let key in fields) {
      // For each property, determine if the property is a false value...
      if (fields[key] === false) {
        // add key to filter
        filter[key] = false;
      }

      // if args or alias put them in propsFilter
      if (key === '__args' || key === '__alias') {
        propsFilter[key] = fields[key];
      }

      // ...or another object type
      if (typeof fields[key] === 'object' && !key.includes('__')) {
        // check keys of that object to see if those values are false
        // via RECURSION
        const reduced = reducer(fields[key]);
        if (Object.keys(reduced).length > 0) {
          filter[key] = reduced;
        }
      }
    }

    return Object.keys(filter).length > 0
      ? { ...filter, ...propsFilter }
      : {};
  }

  return output;
}

module.exports = createQueryObj;
