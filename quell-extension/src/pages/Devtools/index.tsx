// Leave this alone - simply to create a tab in Chrome DevTools

chrome.devtools.panels.create(
  'Quell', //input dev tool name
  null, //icon for the dev tool if any - may use null
  'panel.html' //panel code
);
