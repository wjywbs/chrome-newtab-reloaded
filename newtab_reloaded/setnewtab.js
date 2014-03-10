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
    case "appInstalled":
    case "appUninstalled":
    case "appEnabled":
    case "appDisabled":
      window.postMessage({ method: response.method, result: response.result }, "*");
      break;
    }
  });

  var xhr = new XMLHttpRequest();
  xhr.open("GET", chrome.extension.getURL("newtab.htm"), false);
  xhr.send();

  if (xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200 && !loaded) {
    loaded = true;

    var scriptUrl = chrome.extension.getURL("allscripts.js") + "?" + chrome.i18n.getMessage("folderName");
    var htmlText = xhr.responseText.replace(new RegExp("\\$EXTENSION_SCRIPT_URL", "g"), scriptUrl);
    htmlText = htmlText.replace(new RegExp("\\$EXTENSION_URL", "g"), chrome.extension.getURL(""));
    document.write(htmlText);

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
      case "launchApp":
      case "uninstallApp":
        port.postMessage({ method: event.data.method, id: event.data.id });
        break;
      }
    }, false);
  }
