function createQueryObj(map) {
  const output = {};
  // !! assumes there is only ONE main query, and not multiples !!
  for (let key in map) {
    const reduced = reducer(map[key]);
    if (reduced.length > 0) {
      output[key] = reduced;
    }
  }

  function reducer(obj) {
    const fields = [];

    for (let key in obj) {
      // For each property, determine if the property is a false value...
      if (obj[key] === false) fields.push(key);
      // ...or another object type
      if (typeof obj[key] === 'object') {
        let newObjType = {};
        let reduced = reducer(obj[key]);
        if (reduced.length > 0) {
          newObjType[key] = reduced;
          fields.push(newObjType);
        }
      }
    }

    return fields;
  }
  return output;
};

export default createQueryObj