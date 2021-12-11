import gql from 'graphql-tag';

/** Get query (if any) from HAR request's postData key
 * @param {Object} req - HAR log entry
 */
export const getQueryString = (req: object) => {
  if (!req.request.postData?.text) return null;
  return JSON.parse(req.request.postData.text).query;
};

export const parseGqlQuery = (
  request: chrome.devtools.network.Request
): object | null => {
  try {
    const queryString = getQueryString(request);
    const parsedQuery = gql`
      ${queryString}
    `
    return parsedQuery;
  } catch (err) {
    console.log('Request does not contain a valid GraphQL query');
    return null;
  }
};

export const getOperationNames = (
  request: chrome.devtools.network.Request
): string => {
  const parsedQuery = parseGqlQuery(request);
  const operationNames = parsedQuery.definitions
    .filter(definition => definition.kind === 'OperationDefinition')
    .map(operationType => operationType.operation)
  return operationNames.join(', ');
};
