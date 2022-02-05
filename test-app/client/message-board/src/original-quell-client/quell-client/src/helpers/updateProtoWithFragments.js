/**
 * updateProtoWithFragment takes collected fragments and integrates them onto the prototype where referenced
 * @param {object} protoObj - prototype before it has been updated with fragments
 * @param {object} frags - fragments object to update prototype with
   * RETURNS updated prototype
 */

function updateProtoWithFragment (protoObj, frags) {
  if (!protoObj) return; 
  // iterate over the typeKeys on proto
  for (const key in protoObj) {
    // if the current value is an object, then recruse through prototype 
    if (typeof protoObj[key] === 'object' && !key.includes('__')) {
      protoObj[key] = updateProtoWithFragment(protoObj[key], frags);
    }
    // else if the current key is the fragment key, then add all properties from frags onto prototype
    else if (frags.hasOwnProperty(key)) {
      protoObj = {...protoObj, ...frags[key]};
      // remove the fragment key from the prototype object
      delete protoObj[key];
    }
  }
  return protoObj;
}

module.exports = updateProtoWithFragment;