let schemaIntrospection = {"__schema":{"queryType":{"fields":[{"name":"country","type":{"kind":"OBJECT","ofType":null}},{"name":"countries","type":{"kind":"LIST","ofType":{"kind":"OBJECT","name":"Country"}}},{"name":"citiesByCountry","type":{"kind":"LIST","ofType":{"kind":"OBJECT","name":"City"}}},{"name":"cities","type":{"kind":"LIST","ofType":{"kind":"OBJECT","name":"City"}}}]}}}

const listOfQueries = schemaIntrospection.__schema.queryType.fields;
const queryObjectTypes = listOfQueries.map((query) => {
  let name = query.name;
  let objectType = query.type.ofType ? query.type.ofType.name : null;
  return { name, objectType }
});

console.log(queryObjectTypes);