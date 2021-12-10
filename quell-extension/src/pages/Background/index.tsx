chrome.devtools.network.onRequestFinished.addListener(request => {
  if (
    request.request.url === `localhost:8080/graphql`
  ) {
    request.getContent(body => {
      const responseData = JSON.parse(body);
      request.responseData = responseData;
      console.log(request);
      
    })
  }
});