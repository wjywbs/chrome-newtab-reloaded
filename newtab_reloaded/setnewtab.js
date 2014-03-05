var loaded = false;

  var port = chrome.runtime.connect({name: "newtabreloaded"});
  port.onMessage.addListener(function(response) {
    switch (response.method) {
    case "topSitesResult":
    case "dominantColorResult":
    case "recentlyClosedResult":
    case "_setFaviconImage":
    case "_setAppImage":
    case "foreignSessionsResult":
    case "appsResult":
      window.postMessage({ method: response.method, result: response.result }, "*");
      break;
    }
  });

  var xhr = new XMLHttpRequest();
  xhr.open("GET", chrome.extension.getURL("newtab.htm"), false);
  xhr.send();

  if (xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200 && !loaded) {
    loaded = true;

    document.write(xhr.responseText.replace(new RegExp("\\$EXTENSION_URL", "g"), chrome.extension.getURL("")));

    window.addEventListener("message", function(event) {
      switch (event.data.method) {
      case "topSites":
      case "getRecentlyClosed":
      case "getForeignSessions":
      case "getApps":
        port.postMessage({ method: event.data.method });
        break;
      case "dominantColor":
      case "_getFaviconImage":
      case "_getAppImage":
        port.postMessage({ method: event.data.method, url: event.data.url, id: event.data.id });
        break;
      case "reopenTab":
      case "openForeignSession":
        port.postMessage({ method: event.data.method, id: event.data.id });
        break;
      }
    }, false);
  }
