export interface ClientRequest extends chrome.devtools.network.Request {
  responseData?: object;
}