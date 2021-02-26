const quel = require("../quell.buildCollection");
/**
 * buildItem iterates through keys -- defined on pass-in prototype object, which is always a fragment of the
 * prototype, assigning to nodeObject the data at matching keys in the passed-in item. If a key on the prototype
 * has an object as its value, build array is recursively called.
 * If item does not have a key corresponding to prototype, that field is toggled to false on prototype object. Data
 * for that field will need to be queried.
 * @param {Object} proto
 * @param {Object} fieldsMap
 * @param {Object} item
 */
async function buildItem(proto, item) {
  console.log("we are inside build item", proto, item);
  const nodeObject = {};
  for (const key in proto) {
    console.log("key -->", key);
    console.log("type of ", key, typeof proto[key]);
    if (typeof proto[key] === "object") {
      // if field is an object, recursively call buildFromCache
      console.log("we have object for ", key);
      const protoAtKey = { [key]: proto[key] };
      console.log("protoAtKey", protoAtKey);
      nodeObject[key] = await this.buildCollection(protoAtKey, item[key]);
    } else if (proto[key]) {
      // if current key has not been toggled to false because it needs to be queried
      if (item[key] !== undefined) nodeObject[key] = item[key];
      else proto[key] = false; // toggle proto key to false if cached item does not contain queried data
    }
  }
  return nodeObject;
}
module.exports = buildItem;
