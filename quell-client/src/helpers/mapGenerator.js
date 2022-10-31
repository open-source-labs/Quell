/// this is the code used to take in the clients endpoint and generate the mutationMap,Map and queryTypeMap
// it takes advantage of GraphQl's built in introspection.

/**
 *  @param {string} endpoint - The address to where requests are sent and processed. E.g. '/graphql'
*/

const mapGenerator = async (endpoint) => {
  console.log('inside mapGenerator');

  const mapGeneratorHelper = async (endpoint, query, type) => {
    // console.log('Inside mapGeneratorHelper');
    const obj = {};

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: query }),
    };
    // console.log('Before fetch, fetchOptions and endPoint:', fetchOptions, endpoint);
    const serverResponse = await fetch(endpoint, fetchOptions);
    const parsedData = await serverResponse.json();
    console.log('parsing data from response');
    console.log('parsedData:', parsedData);

//get fieldsArray by fetching introspection query which are queryType or mutationType or map
    let fieldsArray;
    let typesList;
    if (type === 'queryType') {
      fieldsArray = parsedData.data.__schema.queryType.fields;
    } else if (type === 'mutationType') {
      fieldsArray = parsedData.data.__schema.mutationType.fields;
    } else {
      typesList = parsedData.data.__schema.types;
    }

//for queryTypeMap

    if (type === 'queryType') {
      console.log('if type === queryType', fieldsArray);
      for (let types of fieldsArray) {
        console.log("checking types:", types);
        let queryType = types.name; 
        let queryTypeValue = types.type.ofType.name;
        obj[queryType] = queryTypeValue;
      }
      // console.log('query type obj:', obj);
      return obj;
    }

//for mutationTypeMap

    if (type === 'mutationType') {
      for (let types of fieldsArray) {
        console.log(fieldsArray);
        let queryType = types.name;
        let queryTypeValue = types.type.name;
        obj[queryType] = queryTypeValue;
      }
      return obj;
    }


//for map
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

    // exclude built-in types and filter the only custom types
    const customTypes = typesList.filter(
      (type) => !builtInTypes.includes(type.name)
    );
   
    // generate the object includes key-value pairs for map
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
  console.log("queryMap ok")
  const mutationMap = await mapGeneratorHelper(
    endpoint,
    queryForMutationMap,
    'mutationType'
  );
  console.log("mutationMap ok")
  const map = await mapGeneratorHelper(endpoint, queryforMap, 'map');


  return { map, mutationMap, queryTypeMap };
};

module.exports = mapGenerator;
