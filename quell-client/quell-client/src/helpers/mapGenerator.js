/// this is the code used to take in the clients endpoint and generate the mutationMap,Map and queryTypeMap
// it takes advantage of GraphQl's built in introspection.

const mapGenerator = async (endpoint) => {
  //for queryTypeMap

  console.log('here in mapGenerator');
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
    console.log('line 20');
    console.log(serverResponse);
    const parsedData = await serverResponse.json();
    console.log('line 22', parsedData);

    let fieldsArray;
    let typesList;
    if (type === 'queryType') {
      fieldsArray = parsedData.data.__schema.queryType.fields;
      console.log('line 26:', fieldsArray);
    } else if (type === 'mutationType') {
      fieldsArray = parsedData.data.__schema.mutationType.fields;
      console.log(fieldsArray);
    } else {
      typesList = parsedData.data.__schema.types;
    }

    console.log('line 32');
    if (type === 'queryType') {
      for (let types of fieldsArray) {
        let queryType = types.name;
        let queryTypeValue = types.type.ofType.name;
        obj[queryType] = queryTypeValue;
      }

      return obj;
    }

    if (type === 'mutationType') {
      for (let types of fieldsArray) {
        let queryType = types.name;
        let queryTypeValue = types.type.name;
        obj[queryType] = queryTypeValue;
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
      'RootQueryType',
      'RootMutationType',
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

    console.log('line 74:', customTypes);
    for (let types of customTypes) {
      let queryType = types.name;
      let queryTypeValue = types.name;
      obj[queryType] = queryTypeValue;
    }

    return obj;
  };

  //   const queryForQueryType = `{
  // __schema{
  //   queryType{
  //     fields{
  //         name
  //         type{
  //           name
  //           ofType{
  //             ofType{
  //               ofType{
  //                 name
  //               }
  //             }
  //           }
  //         }
  //       }
  //     }
  //   }
  // }`;

  const queryForQueryType = `{
__schema{
  queryType{
    fields{
        name
        type {
          name
          ofType{
            name
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

  console.log(map);
  console.log(mutationMap);
  console.log(queryTypeMap);

  return { map, mutationMap, queryTypeMap };
};

module.exports = mapGenerator;
