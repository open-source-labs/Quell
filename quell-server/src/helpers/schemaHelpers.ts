import { 
    GraphQLSchema, 
    graphqlSync, 
    getIntrospectionQuery, 
    buildClientSchema, 
    GraphQLObjectType,
    GraphQLOutputType,
    GraphQLNamedType,
    GraphQLType,
    IntrospectionQuery
  } from 'graphql';
  import { FieldsMapType, FieldsObjectType, QueryMapType, MutationMapType } from '../types';
  
  /**
   * Converts any GraphQL schema to a standardized format that Quell can process
   * using GraphQL's introspection system.
   * 
   * @param schema - Any valid GraphQL schema
   * @returns A standardized GraphQL schema that Quell can work with
   */
  export function anySchemaToQuellSchema(schema: GraphQLSchema): GraphQLSchema {
    console.log('+++QUELL+++ Standardizing schema for Quell')
    // Step 1: Get standardized introspection result
    const introspectionResult = graphqlSync({
      schema,
      source: getIntrospectionQuery()
    });
    
    // Type assertion to handle the data property
    if (!introspectionResult.data) {
      throw new Error('Schema introspection failed');
    }
    
    // Step 2: Build a client schema from the introspection result
    const standardizedSchema = buildClientSchema(introspectionResult.data as unknown as IntrospectionQuery);

    // Step 3: Return the standardized schema
    return standardizedSchema;
  }
  
  /**
   * Gets the name of a GraphQL type, handling wrapped types like List and NonNull
   * 
   * @param type - Any GraphQL type
   * @returns The name of the type, or a string representation if no name is available
   */
  function getTypeName(type: GraphQLType): string {
    // Handle named types directly
    if ('name' in type && typeof type.name === 'string') {
      return type.name;
    }
    
    // Handle wrapped types (NonNull, List)
    if ('ofType' in type && type.ofType) {
      return getTypeName(type.ofType);
    }
    
    // Fallback for other cases
    return String(type);
  }
  
  /**
   * Safely checks if a type is a List type
   */
  function isList(type: GraphQLType): boolean {
    return type.toString().startsWith('[') && type.toString().endsWith(']');
  }
  
  /**
   * Generates a map of queries to GraphQL object types using the public GraphQL API.
   * This works with any GraphQL schema regardless of how it was created.
   *
   * @param schema - Any valid GraphQL schema
   * @returns Map of queries to their return types
   */
  export function getQueryMap(schema: GraphQLSchema): QueryMapType {
    const queryMap: QueryMapType = {};
    
    // Get the query type from the schema
    const queryType = schema.getQueryType();
    if (!queryType) return queryMap;
    
    // Get all fields from the query type
    const fields = queryType.getFields();
    
    // Process each query field
    for (const queryName in fields) {
      const field = fields[queryName];
      let returnType: string | string[] = '';
      
      // Check if field type is a list type
      if (isList(field.type)) {
        returnType = [getTypeName(field.type)];
      } else {
        returnType = getTypeName(field.type);
      }
      
      queryMap[queryName] = returnType;
    }
    
    return queryMap;
  }
  
  /**
   * Generates a map of mutations to GraphQL object types using the public GraphQL API.
   * This works with any GraphQL schema regardless of how it was created.
   *
   * @param schema - Any valid GraphQL schema
   * @returns Map of mutations to their affected types
   */
  export function getMutationMap(schema: GraphQLSchema): MutationMapType {
    const mutationMap: MutationMapType = {};
    
    // Get the mutation type from the schema
    const mutationType = schema.getMutationType();
    if (!mutationType) return mutationMap;
    
    // Get all fields from the mutation type
    const fields = mutationType.getFields();
    
    // Process each mutation field
    for (const mutationName in fields) {
      const field = fields[mutationName];
      let returnType: string | string[] = '';
      
      // Check if field type is a list type
      if (isList(field.type)) {
        returnType = [getTypeName(field.type)];
      } else {
        returnType = getTypeName(field.type);
      }
      
      mutationMap[mutationName] = returnType;
    }
    
    return mutationMap;
  }
  
  /**
   * Generates a map of fields to GraphQL types using the public GraphQL API.
   * This works with any GraphQL schema regardless of how it was created.
   *
   * @param schema - Any valid GraphQL schema
   * @returns Map of fields to their GraphQL types
   */
  export function getFieldsMap(schema: GraphQLSchema): FieldsMapType {
    const fieldsMap: FieldsMapType = {};
    
    // Get the type map from the schema using the public API
    const typeMap = schema.getTypeMap();
    
    // GraphQL built-in types to exclude
    const builtInTypes: string[] = [
      'String', 'Int', 'Float', 'Boolean', 'ID',
      'Query', '__Type', '__Field', '__EnumValue',
      '__DirectiveLocation', '__Schema', '__TypeKind',
      '__InputValue', '__Directive'
    ];
    
    // Get query type name to exclude
    const queryTypeName = schema.getQueryType()?.name || '';
    const mutationTypeName = schema.getMutationType()?.name || '';
    const subscriptionTypeName = schema.getSubscriptionType()?.name || '';
    
    // Filter out built-in types and root operation types
    const customTypes = Object.keys(typeMap).filter(
      type => 
        !builtInTypes.includes(type) && 
        type !== queryTypeName &&
        type !== mutationTypeName &&
        type !== subscriptionTypeName &&
        !type.startsWith('__')
    );
    
    // Process each custom type
    for (const typeName of customTypes) {
      const type = typeMap[typeName];
      
      // Skip if not an object type with fields
      if (!('getFields' in type) || typeof type.getFields !== 'function') continue;
      
      const fieldsObj: FieldsObjectType = {};
      const fields = type.getFields();
      
      // Process each field in the type
      for (const fieldName in fields) {
        const field = fields[fieldName];
        const key = field.name;
        
        // Get the field type name safely
        fieldsObj[key] = getTypeName(field.type);
      }
      
      // Only add types that have fields
      if (Object.keys(fieldsObj).length > 0) {
        fieldsMap[typeName] = fieldsObj;
      }
    }
    
    return fieldsMap;
  }
  
  /**
   * Determines which schema types are affected by a given mutation.
   * This is useful for intelligent cache invalidation.
   *
   * @param schema - Any valid GraphQL schema
   * @returns Map of mutations to the types they affect
   */
  export function generateMutationMap(schema: GraphQLSchema): Record<string, string[]> {
    const mutationMap: Record<string, string[]> = {};
    const mutationType = schema.getMutationType();
    
    if (!mutationType) return mutationMap;
    
    const mutationFields = mutationType.getFields();
    
    for (const mutationName in mutationFields) {
      const mutation = mutationFields[mutationName];
      
      // Get the return type name safely
      const typeName = getTypeName(mutation.type);
      
      // Start with the direct return type
      const affectedTypes = [typeName];
      
      // For more sophisticated mapping, we could analyze:
      // 1. Arguments that reference other types
      // 2. Related types based on schema structure
      // 3. Custom directives that specify cache dependencies
      
      mutationMap[mutationName] = affectedTypes;
    }
    
    return mutationMap;
  }