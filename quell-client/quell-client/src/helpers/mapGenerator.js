const mapGenerator = async (endpoint) => {
  //for queryTypeMap

  console.log('in map generator');

  const mapGeneratorHelper = async (endpoint, query, type) => {
    const obj = {};

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: query }),
    };

    const serverResponse = await fetch(endpoint, fetchOptions);
    const parsedData = await serverResponse.json();

    let fieldsArray;
    let typesList;
    if (type === 'queryType') {
      fieldsArray = parsedData.data.__schema.queryType.fields;
    } else if (type === 'mutationType') {
      fieldsArray = parsedData.data.__schema.mutationType.fields;
    } else {
      typesList = parsedData.data.__schema.types;
    }

    if (type === 'queryType' || type === 'mutationType') {
      for (let types of fieldsArray) {
        let queryType = types.name;
        let queryTypeValue = types.type.name;
        if (queryTypeValue) {
          obj[queryType] = queryTypeValue;
        } else {
          queryTypeValue = types.type.ofType.ofType.ofType.name;
          obj[queryType] = queryTypeValue;
        }
      }

      return obj;
    }

    const builtInTypes = [
      'String',
      'Int',
      'Float',
      'Boolean',
      'ID',
      'Query',
      'Mutation',
      '__Type',
      '__Field',
      '__EnumValue',
      '__DirectiveLocation',
      '__Schema',
      '__TypeKind',
      '__InputValue',
      '__Directive',
    ];

    // exclude built-in types
    const customTypes = typesList.filter(
      (type) => !builtInTypes.includes(type.name)
    );

    for (let types of customTypes) {
      let queryType = types.name;
      let queryTypeValue = types.name;
      obj[queryType] = queryTypeValue;
    }

    return obj;
  };

  const queryForQueryType = `{
__schema{
  queryType{
    fields{
        name
        type{
          name
          ofType{
            ofType{
              ofType{
                name
              }
            }
          }
        }
      }
    }
  }
}`;

  const queryForMutationMap = `{
__schema{
  mutationType{
    fields{
        name
        type {
          name
        }
      }
    }
  }
}`;

  const queryforMap = `
{
 __schema{
  types {
    name

  }
}
}

`;

  const queryTypeMap = await mapGeneratorHelper(
    endpoint,
    queryForQueryType,
    'queryType'
  );

  const mutationMap = await mapGeneratorHelper(
    endpoint,
    queryForMutationMap,
    'mutationType'
  );

  const map = await mapGeneratorHelper(endpoint, queryforMap, 'map');

  return { map, mutationMap, queryTypeMap };
};

module.exports = mapGenerator;
