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
  case "_setNewTabResources":
    handleNewTabHtml(response.result);
    break;
  }
});

var handleNewTabHtml = function(responseText) {
  loaded = true;

  var localePath = "_locales/" + chrome.i18n.getMessage("folderName") + "/loadTimeData.js";
  var htmlText = responseText.replace("$EXTENSION_LOCALE_URL", chrome.extension.getURL(localePath));
  htmlText = htmlText.replace(new RegExp("\\$EXTENSION_URL", "g"), chrome.extension.getURL(""));
  document.write(htmlText);
  document.close();

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
};

var xhr = new XMLHttpRequest();
xhr.open("GET", chrome.extension.getURL("newtab.htm"));

xhr.onreadystatechange = function() {
  if (xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200 && !loaded) {
    handleNewTabHtml(xhr.responseText);
  }
};
xhr.onerror = function() {
  console.log('xhr error: using fallback method');
  port.postMessage({ method: '_getNewTabResources' });
};
xhr.send();
