const { app, session } = require('electron');
app.whenReady().then(() => {
  app.userAgentFallback = app.userAgentFallback.replace(/Electron\/[\d\.]+\s/, '');
  console.log("after:", app.userAgentFallback);
  app.quit();
});
