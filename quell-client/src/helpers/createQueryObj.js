/**
 createQueryObj takes in a map of field(keys) and true/false(values) creating an query object containing the fields (false) missing from cache. 
 This will then be converted into a GQL query string in the next step.
 */

function createQueryObj(map) {
  // console.log('prototype within createQuery Obj is ', map);
  const output = {};
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

  // filter fields object to contain only values needed from server
  function reducer(fields) {
    // filter stores values needed from server
    const filter = {};
    // propsFilter for properties such as args, aliases, etc.
    const propsFilter = {};

    for (let key in fields) {
      // if value is false, place directly on filter
      if (fields[key] === false) {
        // add key & value to filter
        filter[key] = false;
      }
      // if key ncludes id, then set the property to true
      // TO DO add support for unique id
      if (key === 'id' || key === '_id' || key === 'ID' || key === 'Id') {
        filter[key] = false;
      }
      
      // if value is an object, recurse to determine nested values
      if (typeof fields[key] === 'object' && !key.includes('__')) {
        // check keys of object to see if those values are false via recursion
        const reduced = reducer(fields[key]);
        // if reduced object has any values to pass, place on filter
        if (Object.keys(reduced).length > 1) {
          filter[key] = reduced;
        }
      }

      // if reserved property such as args or alias, place on propsFilter
      if (key.includes('__')) {
        propsFilter[key] = fields[key];
      }
    }

    const numFields = Object.keys(fields).length;

    // if the filter has any values to pass, return filter & propsFilter, otherwise return empty object
    return Object.keys(filter).length > 1 && numFields > 5
      ? { ...filter, ...propsFilter }
      : {};
  }

  return output;
}

module.exports = createQueryObj;
