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
    case "onRecentlyClosed":
    case "_setSettings":
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

    window.addEventListener("extensionEvent", function(event) {
      switch (event.detail.method) {
      case "topSites":
      case "getRecentlyClosed":
      case "getForeignSessions":
      case "getApps":
      case "_getSettings":
        port.postMessage({ method: event.detail.method });
        break;
      case "dominantColor":
      case "_getFaviconImage":
      case "_getAppImage":
      case "generateAppForLink":
        port.postMessage({ method: event.detail.method, url: event.detail.url, id: event.detail.id });
        break;
      case "reopenTab":
      case "openForeignSession":
      case "launchApp":
      case "uninstallApp":
      case "createAppShortcut":
        port.postMessage({ method: event.detail.method, id: event.detail.id });
        break;
      case "setLaunchType":
        port.postMessage({ method: event.detail.method, id: event.detail.id, type: event.detail.type });
        break;
      }
    }, false);
  }
