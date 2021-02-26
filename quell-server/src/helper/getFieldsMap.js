/**
 * getFieldsMap generates of map of fields to GraphQL types. This mapping is used to identify
 * and create references to cached data.
 */
function getFieldsMap(schema) {
  const fieldsMap = {};
  const typesList = schema._typeMap;
  const builtInTypes = [
    "String",
    "Int",
    "Float",
    "Boolean",
    "ID",
    "Query",
    "__Type",
    "__Field",
    "__EnumValue",
    "__DirectiveLocation",
    "__Schema",
    "__TypeKind",
    "__InputValue",
    "__Directive",
  ];
  // exclude built-in types
  const customTypes = Object.keys(typesList).filter(
    (type) => !builtInTypes.includes(type) && type !== schema._queryType.name
  );
  for (const type of customTypes) {
    const fieldsObj = {};
    let fields = typesList[type]._fields;
    if (typeof fields === "function") fields = fields();
    for (const field in fields) {
      const key = fields[field].name;
      const value = fields[field].type.ofType
        ? fields[field].type.ofType.name
        : fields[field].type.name;
      fieldsObj[key] = value;
    }
    fieldsMap[type] = fieldsObj;
  }
  return fieldsMap;
}

module.exports = getFieldsMap;
