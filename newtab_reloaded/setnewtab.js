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

    document.write(xhr.responseText.replace(new RegExp("\\$EXTENSION_URL", "g"), chrome.extension.getURL("")));

    window.addEventListener("message", function(event) {
      if (event.data.method == "topSites") {
        port.postMessage({ method: "topSites" });
      } else if (event.data.method == "dominantColor") {
        port.postMessage({ method: "dominantColor", url: event.data.url, id: event.data.id });
      }
    }, false);
  }
