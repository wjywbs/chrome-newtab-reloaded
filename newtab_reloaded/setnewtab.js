var loaded = false;

  var port = chrome.runtime.connect({name: "newtabreloaded"});
  port.onMessage.addListener(function(response) {
    if (response.method == "topSitesResult" || response.method == "dominantColorResult")
      window.postMessage({ method: response.method, result: response.result }, "*");
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
      if (event.data.method == "topSites") {
        port.postMessage({ method: "topSites" });
      } else if (event.data.method == "dominantColor") {
        port.postMessage({ method: "dominantColor", url: event.data.url, id: event.data.id });
      }
    }, false);
  }
