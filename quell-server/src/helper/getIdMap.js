function getIdMap() {
  const idMap = {};
  for (const type in this.fieldsMap) {
    const userDefinedIds = [];
    const fieldsAtType = this.fieldsMap[type];
    for (const key in fieldsAtType) {
      if (fieldsAtType[key] === "ID") userDefinedIds.push(key);
    }
    idMap[type] = userDefinedIds;
  }
  return idMap;
}

module.exports = getIdMap;
