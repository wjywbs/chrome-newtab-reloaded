
var languages;
chrome.i18n.getAcceptLanguages(function(data) {
  languages = data;
});

var webstoreApp;
if (chrome.management) {
  chrome.management.get("ahfgeienlihckogmohjhadlkjgocpleb", function(app) {
    webstoreApp = app;
  });
}

chrome.runtime.onConnect.addListener(function(port) {
  if (port.name != "newtabreloaded") {
    port.disconnect();
    return;
  }

  port.onMessage.addListener(function(request) {
    switch (request.method) {
    case "topSites":
      chrome.topSites.get(function(data) {
        port.postMessage({ method: "topSitesResult", result: data});
        console.log("Sent topSites response");
      });
      break;

    case "dominantColor":
      RGBaster.colors(request.url, function(colorResult) {
        port.postMessage({
          method: "dominantColorResult",
          result: { dominantColor: colorResult.dominant, id: request.id }
        });
        console.log("Sent dominantColor response");
      });
      break;

    case "getRecentlyClosed":
      chrome.sessions.getRecentlyClosed(function(data) {
        port.postMessage({ method: "recentlyClosedResult", result: data});
      });
      console.log("Sent recentlyClosed response");
      break;

    case "reopenTab":
    case "openForeignSession":
      chrome.sessions.restore(request.id);
      break;

    case "_getFaviconImage":
      getImageDataFromUrl(request.url, function(data) {
        port.postMessage({
          method: "_setFaviconImage",
          result: { data: data, id: request.id }
        });
      });
      console.log("Sent _getFaviconImage response");
      break;

    case "_getAppImage":
      getImageDataFromUrl(request.url, function(data) {
        port.postMessage({
          method: "_setAppImage",
          result: { data: data, id: request.id }
        });
      });
      console.log("Sent _getAppImage response");
      break;

    case "getForeignSessions":
      chrome.sessions.getDevices(function(data) {
        port.postMessage({
          method: "foreignSessionsResult",
          result: { data: data, languages: languages }
        });
      });
      break;

    case "getApps":
      chrome.management.getAll(function(data) {
        if (webstoreApp)
          data.splice(0, 0, webstoreApp);
        port.postMessage({ method: "appsResult", result: data});
        console.log("Sent getApps response");
      });
      break;

    case "launchApp":
      chrome.management.setEnabled(request.id, true, function() {
        chrome.management.launchApp(request.id);
      });
      break;

    case "uninstallApp":
      // There's a change in chrome rev 245457 that needs a user gesture to
      // uninstall apps after 34.0.1790.0. The bug is that user gesture can
      // not be passed with postMessage, so the confirmation dialog will not
      // appear, and the app will not be removed.
      // chrome.test is removed since rev 257262.
      // This bug was fixed in blink rev 170079 and 170243 after 35.0.1915.0.
      chrome.management.uninstall(request.id, {showConfirmDialog: true});
      break;

    case "_getSettings":
      port.postMessage({ method: "_setSettings", result: getSettings()});
      console.log("Sent _getSettings response");
      break;

    case "createAppShortcut":
      chrome.management.createAppShortcut(request.id);
      break;

    case "generateAppForLink":
      chrome.management.generateAppForLink(request.url, request.id);
      break;

    case "setLaunchType":
      chrome.management.setLaunchType(request.id, request.type);
      break;
    }
  });

  var makeHandler = function(method) {
    return function(data) {
      port.postMessage({ method: method, result: data});
      console.log("Sent " + method + " response");
    };
  };

  var appInstalledHandler = makeHandler("appInstalled"),
      appUninstalledHandler = makeHandler("appUninstalled"),
      appEnabledHandler = makeHandler("appEnabled"),
      appDisabledHandler = makeHandler("appDisabled");

  chrome.management.onInstalled.addListener(appInstalledHandler);
  chrome.management.onUninstalled.addListener(appUninstalledHandler);
  chrome.management.onEnabled.addListener(appEnabledHandler);
  chrome.management.onDisabled.addListener(appDisabledHandler);

  var recentlyClosedHandler = makeHandler("onRecentlyClosed");
  if (chrome.sessions.onChanged)
    chrome.sessions.onChanged.addListener(recentlyClosedHandler);

  port.onDisconnect.addListener(function() {
    chrome.management.onInstalled.removeListener(appInstalledHandler);
    chrome.management.onUninstalled.removeListener(appUninstalledHandler);
    chrome.management.onEnabled.removeListener(appEnabledHandler);
    chrome.management.onDisabled.removeListener(appDisabledHandler);

    if (chrome.sessions.onChanged)
      chrome.sessions.onChanged.removeListener(recentlyClosedHandler);
  });
});

function getImageDataFromUrl(url, callback) {
  var img = new Image();
  img.src = url;
  img.crossOrigin = "Anonymous";
  img.onload = function() {
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    var context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    callback(canvas.toDataURL("image/png"));
  };
}

function getSettings() {
  var loadOption = function(option) {
    var value = localStorage.getItem(option.key);

    if (value == null) {
      option.value = option.defaultValue;
      return;
    }

    switch (typeof(option.defaultValue)) {
    case "number":
      if (isNaN(value))
        option.value = option.defaultValue;
      else
        option.value = Number(value);
      break;

    default:
      option.value = value;
    }
  };

  loadOption(options.mTilesPerRow);
  loadOption(options.mNumberOfTiles);
  return options;
}

// Merged RGBaster from: https://github.com/briangonzalez/rgbaster.js
  var getContext = function(){
    return document.createElement("canvas").getContext('2d');
  };

  var getImageData = function(img, loaded){
    var imgObj = new Image();
    var imgSrc = img.src || img;

    // Can't set cross origin to be anonymous for data url's
    // https://github.com/mrdoob/three.js/issues/1305
    if ( imgSrc.substring(0,5) !== 'data:' )
      imgObj.crossOrigin = "Anonymous";

    imgObj.onload = function(){  
      var context = getContext();
      context.drawImage(imgObj, 0, 0);

      var imageData = context.getImageData(0, 0, imgObj.width, imgObj.height);
      loaded && loaded(imageData.data);
    };
    
    imgObj.src = imgSrc;
  };

  var makeRGB = function(name){
    return ['rgb(', name, ')'].join('');
  };

  var mapPalette = function(palette){
    return palette.map(function(c){ return makeRGB(c.name) })
  }

  var BLOCKSIZE = 5; 
  var PALETTESIZE = 10; 

  var RGBaster = {};

  RGBaster.colors = function(img, success, paletteSize){
    getImageData(img, function(data){
      var length        = data.length,
          colorCounts   = {},
          rgbString     = '',
          rgb           = [],
          colors        = {
            dominant: { name: '', count: 0 },
            palette:  Array.apply(null, Array(paletteSize || PALETTESIZE)).map(Boolean).map(function(a){ return { name: '0,0,0', count: 0 } }) 
          };

      // Loop over all pixels, in BLOCKSIZE iterations.
      var i = 0;
      while ( i < length ) {
        rgb[0] = data[i];
        rgb[1] = data[i+1];
        rgb[2] = data[i+2];
        rgbString = rgb.join(",");

        // Keep track of counts.
        if ( rgbString in colorCounts ) {
          colorCounts[rgbString] = colorCounts[rgbString] + 1;
        }
        else{
          colorCounts[rgbString] = 1;
        }

        // Find dominant and palette, ignoring black/white pixels.
        if ( rgbString !== "0,0,0" && rgbString !== "255,255,255" ) {
          var colorCount = colorCounts[rgbString]
          if ( colorCount > colors.dominant.count ){
            colors.dominant.name = rgbString;
            colors.dominant.count = colorCount;
          } else {
            colors.palette.some(function(c){
              if ( colorCount > c.count ) {
                c.name = rgbString;
                c.count = colorCount;
                return true;
              }
            });
          }
        }

        // Increment!
        i += BLOCKSIZE * 4;
      }

      success && success({
        dominant: makeRGB(colors.dominant.name),
        palette:  mapPalette(colors.palette)
      });
    });
  }
// end RGBster merge
