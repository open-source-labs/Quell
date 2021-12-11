export const getResponseStatus = (request: chrome.devtools.network.Request):string => {
  const status = request.response.status;
  const statusText = request.response.statusText || null; 
  return statusText ? `${status} (${statusText})` : status;
}