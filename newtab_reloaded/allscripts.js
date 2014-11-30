
if (chrome.send == undefined) {
  var sendExtensionEvent = function(data) {
    var event = new CustomEvent("extensionEvent", { detail: data });
    window.dispatchEvent(event);
  };

  chrome.send = function(method, args) {
    switch (method) {
    case "getMostVisited":
      sendExtensionEvent({ method: "topSites" });
      method += " implemented!";
      break;
    case "getFaviconDominantColor":
    case "getAppIconDominantColor":
      // This page can't access chrome://favicon and can not load images from
      // "chrome-search://favicon/size/16@1x/1/1" into canvas due to CORS.
      // Have to send url and id all the way to background.js in extension.
      sendExtensionEvent({ method: "dominantColor", url: args[0], id: args[1] });
      method += " implemented!";
      break;
    case "navigateToUrl":
      // location = args[0] does not work because it will trigger "Not allowed
      // to load local resource" error
      chrome.embeddedSearch.newTabPage.navigateContentWindow(args[0]);
      // NOT REACHED
      break;
    case "blacklistURLFromMostVisited":
      chrome.embeddedSearch.newTabPage.deleteMostVisitedItem(args[0]);
      method += " implemented!";
      break;
    case "removeURLsFromMostVisitedBlacklist":
      chrome.embeddedSearch.newTabPage.undoMostVisitedDeletion(args[0]);
      method += " implemented!";
      break;
    case "clearMostVisitedURLsBlacklist":
      chrome.embeddedSearch.newTabPage.undoAllMostVisitedDeletions();
      method += " implemented!";
      break;
    case "getRecentlyClosedTabs":
      sendExtensionEvent({ method: "getRecentlyClosed" });
      method += " implemented!";
      break;
    case "reopenTab":
      sendExtensionEvent({ method: "reopenTab", id: args[0] });
      method += " implemented!";
      break;
    case "_getFaviconImage":
    case "_getAppImage":
    case "generateAppForLink":
      sendExtensionEvent({ method: method, url: args[0], id: args[1] });
      method += " implemented!";
      break;
    case "getForeignSessions":
    case "getApps":
    case "_getSettings":
      sendExtensionEvent({ method: method });
      method += " implemented!";
      break;
    case "openForeignSession":
      var idList = args[0];
      if (typeof(args[0]) == "string") {
        idList = new Array();
        idList.push(args[0]);
      }

      for (var i = 0; i < idList.length; i++) {
        sendExtensionEvent({ method: "openForeignSession", id: idList[i] });
      }
      method += " implemented!";
      break;
    case "launchApp":
      sendExtensionEvent({ method: method, id: args[0] });
      window.close();
      break;
    case "uninstallApp":
    case "createAppShortcut":
      sendExtensionEvent({ method: method, id: args[0] });
      method += " implemented!";
      break;
    case "pageSelected":
      localStorage.setItem("ntp_shown_page_type", args[0]);
      localStorage.setItem("ntp_shown_page_index", args[1]);
      method += " implemented!";
      break;
    case "setPageIndex":
      ntr.setPageIndex(args[1]);
      method += " implemented!";
      break;
    case "saveAppPageName":
      ntr.saveAppPageName(args[0], args[1]);
      method += " implemented!";
      break;
    case "reorderApps":
      ntr.reorderApps(args[1]);
      method += " implemented!";
      break;
    case "setLaunchType":
      sendExtensionEvent({ method: method, id: args[0], type: args[1] });
      method += " implemented!";
      break;
    }
    console.log("chrome.send stub: " + method);
  };
}

// Since the extension now loads earlier to avoid showing the search bar,
// navigating to most visited sites will reload this web page and rerun this
// script (don't know why). Running this script again will emit errors and
// produce noticeable differences (the spinning loading indicator, contents
// disappearing, etc). Preventing from reloading is a solution. The canary
// version doesn't have this bug.
// window.loaded is set at the end of this script.
if (window.loaded)
  throw new Error("Prevent from reloading this page.");

//<!-- It's important that this be the first script loaded. -->
// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 * Logging info for benchmarking purposes. Should be the first js file included.
 */

/* Stack of events that has been logged. */
var eventLog = [];
//window.eventLog = [];

/**
 * Logs an event.
 * @param {string} name The name of the event (can be any string).
 * @param {boolean} shouldLogTime If true, the event is used for benchmarking
 *     and the time is logged. Otherwise, just push the event on the event
 *     stack.
 */
function logEvent(name, shouldLogTime) {
//window.logEvent = function(name, shouldLogTime) {
  if (shouldLogTime)
    chrome.send('metricsHandler:logEventTime', [name]);
  eventLog.push([name, Date.now()]);
}

logEvent('Tab.NewTabScriptStart', true);
window.addEventListener('load', function(e) {
  logEvent('Tab.NewTabOnload', true);
});
document.addEventListener('DOMContentLoaded', function(e) {
  logEvent('Tab.NewTabDOMContentLoaded', true);
});


// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/** @fileoverview EventTracker is a simple class that manages the addition and
 *  removal of DOM event listeners. In particular, it keeps track of all
 *  listeners that have been added and makes it easy to remove some or all of
 *  them without requiring all the information again. This is particularly
 *  handy when the listener is a generated function such as a lambda or the
 *  result of calling Function.bind.
 */

// Use an anonymous function to enable strict mode just for this file (which
// will be concatenated with other files when embedded in Chrome)
var EventTracker = (function() {
  'use strict';

  /**
   *  Create an EventTracker to track a set of events.
   *  EventTracker instances are typically tied 1:1 with other objects or
   *  DOM elements whose listeners should be removed when the object is disposed
   *  or the corresponding elements are removed from the DOM.
   *  @constructor
   */
  function EventTracker() {
    /**
     *  @type {Array.<EventTracker.Entry>}
     *  @private
     */
    this.listeners_ = [];
  }

  /**
   * The type of the internal tracking entry.
   *  @typedef {{node: !Node,
   *            eventType: string,
   *            listener: Function,
   *            capture: boolean}}
   */
  EventTracker.Entry;

  EventTracker.prototype = {
    /**
     * Add an event listener - replacement for Node.addEventListener.
     * @param {!Node} node The DOM node to add a listener to.
     * @param {string} eventType The type of event to subscribe to.
     * @param {Function} listener The listener to add.
     * @param {boolean} capture Whether to invoke during the capture phase.
     */
    add: function(node, eventType, listener, capture) {
      var h = {
        node: node,
        eventType: eventType,
        listener: listener,
        capture: capture
      };
      this.listeners_.push(h);
      node.addEventListener(eventType, listener, capture);
    },

    /**
     * Remove any specified event listeners added with this EventTracker.
     * @param {!Node} node The DOM node to remove a listener from.
     * @param {?string} eventType The type of event to remove.
     */
    remove: function(node, eventType) {
      this.listeners_ = this.listeners_.filter(function(h) {
        if (h.node == node && (!eventType || (h.eventType == eventType))) {
          EventTracker.removeEventListener_(h);
          return false;
        }
        return true;
      });
    },

    /**
     * Remove all event listeners added with this EventTracker.
     */
    removeAll: function() {
      this.listeners_.forEach(EventTracker.removeEventListener_);
      this.listeners_ = [];
    }
  };

  /**
   * Remove a single event listener given it's tracker entry.  It's up to the
   * caller to ensure the entry is removed from listeners_.
   * @param {EventTracker.Entry} h The entry describing the listener to remove.
   * @private
   */
  EventTracker.removeEventListener_ = function(h) {
    h.node.removeEventListener(h.eventType, h.listener, h.capture);
  };

  return EventTracker;
})();


// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file defines a singleton which provides access to all data
 * that is available as soon as the page's resources are loaded (before DOM
 * content has finished loading). This data includes both localized strings and
 * any data that is important to have ready from a very early stage (e.g. things
 * that must be displayed right away).
 */

var loadTimeData;

(function() {
  'use strict';

  function LoadTimeData() {
  }

  LoadTimeData.prototype = {
    /**
     * Sets the backing object.
     * @param {Object} value The de-serialized page data.
     */
    set data(value) {
      expect(!this.data_, 'Re-setting data.');
      this.data_ = value;
    },

    /**
     * @return {boolean} True if |id| is a key in the dictionary.
     */
    valueExists: function(id) {
      return id in this.data_;
    },

    /**
     * Fetches a value, expecting that it exists.
     * @param {string} id The key that identifies the desired value.
     * @return {*} The corresponding value.
     */
    getValue: function(id) {
      expect(this.data_, 'No data. Did you remember to include strings.js?');
      var value = this.data_[id];
      expect(typeof value != 'undefined', 'Could not find value for ' + id);
      return value;
    },

    /**
     * As above, but also makes sure that the value is a string.
     * @param {string} id The key that identifies the desired string.
     * @return {string} The corresponding string value.
     */
    getString: function(id) {
      var value = this.getValue(id);
      expectIsType(id, value, 'string');
      return value;
    },

    /**
     * Returns a formatted localized string where $1 to $9 are replaced by the
     * second to the tenth argument.
     * @param {string} id The ID of the string we want.
     * @param {...string} The extra values to include in the formatted output.
     * @return {string} The formatted string.
     */
    getStringF: function(id) {
      var value = this.getString(id);
      if (!value)
        return;

      var varArgs = arguments;
      return value.replace(/\$[$1-9]/g, function(m) {
        return m == '$$' ? '$' : varArgs[m[1]];
      });
    },

    /**
     * As above, but also makes sure that the value is a boolean.
     * @param {string} id The key that identifies the desired boolean.
     * @return {boolean} The corresponding boolean value.
     */
    getBoolean: function(id) {
      var value = this.getValue(id);
      expectIsType(id, value, 'boolean');
      return value;
    },

    /**
     * As above, but also makes sure that the value is an integer.
     * @param {string} id The key that identifies the desired number.
     * @return {number} The corresponding number value.
     */
    getInteger: function(id) {
      var value = this.getValue(id);
      expectIsType(id, value, 'number');
      expect(value == Math.floor(value), 'Number isn\'t integer: ' + value);
      return value;
    },

    /**
     * Override values in loadTimeData with the values found in |replacements|.
     * @param {Object} replacements The dictionary object of keys to replace.
     */
    overrideValues: function(replacements) {
      expect(typeof replacements == 'object',
             'Replacements must be a dictionary object.');
      for (var key in replacements) {
        this.data_[key] = replacements[key];
      }
    }
  };

  /**
   * Checks condition, displays error message if expectation fails.
   * @param {*} condition The condition to check for truthiness.
   * @param {string} message The message to display if the check fails.
   */
  function expect(condition, message) {
    if (!condition)
      console.error(message);
  }

  /**
   * Checks that the given value has the given type.
   * @param {string} id The id of the value (only used for error message).
   * @param {*} value The value to check the type on.
   * @param {string} type The type we expect |value| to be.
   */
  function expectIsType(id, value, type) {
    expect(typeof value == type, '[' + value + '] (' + id +
                                 ') is not a ' + type);
  }

  expect(!loadTimeData, 'should only include this file once');
  loadTimeData = new LoadTimeData;
})();

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Parse a very small subset of HTML.  This ensures that insecure HTML /
 * javascript cannot be injected into the new tab page.
 * @param {string} s The string to parse.
 * @param {Array.<string>=} opt_extraTags Optional extra allowed tags.
 * @param {Object.<string, function(Node, string):boolean>=} opt_extraAttrs
 *     Optional extra allowed attributes (all tags are run through these).
 * @throws {Error} In case of non supported markup.
 * @return {DocumentFragment} A document fragment containing the DOM tree.
 */
var parseHtmlSubset = (function() {
  'use strict';

  var allowedAttributes = {
    'href': function(node, value) {
      // Only allow a[href] starting with chrome:// and https://
      return node.tagName == 'A' && (value.indexOf('chrome://') == 0 ||
          value.indexOf('https://') == 0);
    },
    'target': function(node, value) {
      // Allow a[target] but reset the value to "".
      if (node.tagName != 'A')
        return false;
      node.setAttribute('target', '');
      return true;
    }
  };

  /**
   * Whitelist of tag names allowed in parseHtmlSubset.
   * @type {!Array.<string>}
   * @const
   */
  var allowedTags = ['A', 'B', 'STRONG'];

  function merge() {
    var clone = {};
    for (var i = 0; i < arguments.length; ++i) {
      if (typeof arguments[i] == 'object') {
        for (var key in arguments[i]) {
          if (arguments[i].hasOwnProperty(key))
            clone[key] = arguments[i][key];
        }
      }
    }
    return clone;
  }

  function walk(n, f) {
    f(n);
    for (var i = 0; i < n.childNodes.length; i++) {
      walk(n.childNodes[i], f);
    }
  }

  function assertElement(tags, node) {
    if (tags.indexOf(node.tagName) == -1)
      throw Error(node.tagName + ' is not supported');
  }

  function assertAttribute(attrs, attrNode, node) {
    var n = attrNode.nodeName;
    var v = attrNode.nodeValue;
    if (!attrs.hasOwnProperty(n) || !attrs[n](node, v))
      throw Error(node.tagName + '[' + n + '="' + v + '"] is not supported');
  }

  return function(s, opt_extraTags, opt_extraAttrs) {
    var extraTags =
        (opt_extraTags || []).map(function(str) { return str.toUpperCase(); });
    var tags = allowedTags.concat(extraTags);
    var attrs = merge(allowedAttributes, opt_extraAttrs || {});

    var doc = document.implementation.createHTMLDocument('');
    var r = doc.createRange();
    r.selectNode(doc.body);
    // This does not execute any scripts because the document has no view.
    var df = r.createContextualFragment(s);
    walk(df, function(node) {
      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          assertElement(tags, node);
          var nodeAttrs = node.attributes;
          for (var i = 0; i < nodeAttrs.length; ++i) {
            assertAttribute(attrs, nodeAttrs[i], node);
          }
          break;

        case Node.COMMENT_NODE:
        case Node.DOCUMENT_FRAGMENT_NODE:
        case Node.TEXT_NODE:
          break;

        default:
          throw Error('Node type ' + node.nodeType + ' is not supported');
      }
    });
    return df;
  };
})();

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Copyright (c) 2013 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Assertion support.
 */

/**
 * Simple common assertion API
 * @param {*} condition The condition to test.  Note that this may be used to
 *     test whether a value is defined or not, and we don't want to force a
 *     cast to Boolean.
 * @param {string=} opt_message A message to use in any error.
 */
function assert(condition, opt_message) {
  'use strict';
  if (!condition) {
    var msg = 'Assertion failed';
    if (opt_message)
      msg = msg + ': ' + opt_message;
    throw new Error(msg);
  }
}


/**
 * The global object.
 * @type {!Object}
 * @const
 */
var global = this;

/**
 * Alias for document.getElementById.
 * @param {string} id The ID of the element to find.
 * @return {HTMLElement} The found element or null if not found.
 */
function $(id) {
  return document.getElementById(id);
}

/**
 * Calls chrome.send with a callback and restores the original afterwards.
 * @param {string} name The name of the message to send.
 * @param {!Array} params The parameters to send.
 * @param {string} callbackName The name of the function that the backend calls.
 * @param {!Function} callback The function to call.
 */
function chromeSend(name, params, callbackName, callback) {
  var old = global[callbackName];
  global[callbackName] = function() {
    // restore
    global[callbackName] = old;

    var args = Array.prototype.slice.call(arguments);
    return callback.apply(global, args);
  };
  chrome.send(name, params);
}

/**
 * Returns the scale factors supported by this platform.
 * @return {array} The supported scale factors.
 */
function getSupportedScaleFactors() {
  var supportedScaleFactors = [];
  if (cr.isMac || cr.isChromeOS) {
    supportedScaleFactors.push(1);
    supportedScaleFactors.push(2);
  } else {
    // Windows must be restarted to display at a different scale factor.
    supportedScaleFactors.push(window.devicePixelRatio);
  }
  return supportedScaleFactors;
}

/**
 * Generates a CSS url string.
 * @param {string} s The URL to generate the CSS url for.
 * @return {string} The CSS url string.
 */
function url(s) {
  // http://www.w3.org/TR/css3-values/#uris
  // Parentheses, commas, whitespace characters, single quotes (') and double
  // quotes (") appearing in a URI must be escaped with a backslash
  var s2 = s.replace(/(\(|\)|\,|\s|\'|\"|\\)/g, '\\$1');
  // WebKit has a bug when it comes to URLs that end with \
  // https://bugs.webkit.org/show_bug.cgi?id=28885
  if (/\\\\$/.test(s2)) {
    // Add a space to work around the WebKit bug.
    s2 += ' ';
  }
  return 'url("' + s2 + '")';
}

/**
 * Generates a CSS -webkit-image-set for a chrome:// url.
 * An entry in the image set is added for each of getSupportedScaleFactors().
 * The scale-factor-specific url is generated by replacing the first instance of
 * 'scalefactor' in |path| with the numeric scale factor.
 * @param {string} path The URL to generate an image set for.
 *     'scalefactor' should be a substring of |path|.
 * @return {string} The CSS -webkit-image-set.
 */
function imageset(path) {
  var supportedScaleFactors = getSupportedScaleFactors();

  var replaceStartIndex = path.indexOf('scalefactor');
  if (replaceStartIndex < 0)
    return url(path);

  var s = '';
  for (var i = 0; i < supportedScaleFactors.length; ++i) {
    var scaleFactor = supportedScaleFactors[i];
    var pathWithScaleFactor = path.substr(0, replaceStartIndex) + scaleFactor +
        path.substr(replaceStartIndex + 'scalefactor'.length);

    s += url(pathWithScaleFactor) + ' ' + scaleFactor + 'x';

    if (i != supportedScaleFactors.length - 1)
      s += ', ';
  }
  return '-webkit-image-set(' + s + ')';
}

/**
 * Parses query parameters from Location.
 * @param {string} location The URL to generate the CSS url for.
 * @return {object} Dictionary containing name value pairs for URL
 */
function parseQueryParams(location) {
  var params = {};
  var query = unescape(location.search.substring(1));
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    params[pair[0]] = pair[1];
  }
  return params;
}

function findAncestorByClass(el, className) {
  return findAncestor(el, function(el) {
    if (el.classList)
      return el.classList.contains(className);
    return null;
  });
}

/**
 * Return the first ancestor for which the {@code predicate} returns true.
 * @param {Node} node The node to check.
 * @param {function(Node) : boolean} predicate The function that tests the
 *     nodes.
 * @return {Node} The found ancestor or null if not found.
 */
function findAncestor(node, predicate) {
  var last = false;
  while (node != null && !(last = predicate(node))) {
    node = node.parentNode;
  }
  return last ? node : null;
}

function swapDomNodes(a, b) {
  var afterA = a.nextSibling;
  if (afterA == b) {
    swapDomNodes(b, a);
    return;
  }
  var aParent = a.parentNode;
  b.parentNode.replaceChild(a, b);
  aParent.insertBefore(b, afterA);
}

/**
 * Disables text selection and dragging, with optional whitelist callbacks.
 * @param {function(Event):boolean=} opt_allowSelectStart Unless this function
 *    is defined and returns true, the onselectionstart event will be
 *    surpressed.
 * @param {function(Event):boolean=} opt_allowDragStart Unless this function
 *    is defined and returns true, the ondragstart event will be surpressed.
 */
function disableTextSelectAndDrag(opt_allowSelectStart, opt_allowDragStart) {
  // Disable text selection.
  document.onselectstart = function(e) {
    if (!(opt_allowSelectStart && opt_allowSelectStart.call(this, e)))
      e.preventDefault();
  };

  // Disable dragging.
  document.ondragstart = function(e) {
    if (!(opt_allowDragStart && opt_allowDragStart.call(this, e)))
      e.preventDefault();
  };
}

/**
 * Call this to stop clicks on <a href="#"> links from scrolling to the top of
 * the page (and possibly showing a # in the link).
 */
function preventDefaultOnPoundLinkClicks() {
  document.addEventListener('click', function(e) {
    var anchor = findAncestor(e.target, function(el) {
      return el.tagName == 'A';
    });
    // Use getAttribute() to prevent URL normalization.
    if (anchor && anchor.getAttribute('href') == '#')
      e.preventDefault();
  });
}

/**
 * Check the directionality of the page.
 * @return {boolean} True if Chrome is running an RTL UI.
 */
function isRTL() {
  return document.documentElement.dir == 'rtl';
}

/**
 * Get an element that's known to exist by its ID. We use this instead of just
 * calling getElementById and not checking the result because this lets us
 * satisfy the JSCompiler type system.
 * @param {string} id The identifier name.
 * @return {!Element} the Element.
 */
function getRequiredElement(id) {
  var element = $(id);
  assert(element, 'Missing required element: ' + id);
  return element;
}

// Handle click on a link. If the link points to a chrome: or file: url, then
// call into the browser to do the navigation.
document.addEventListener('click', function(e) {
  if (e.defaultPrevented)
    return;

  var el = e.target;
  if (el.nodeType == Node.ELEMENT_NODE &&
      el.webkitMatchesSelector('A, A *')) {
    while (el.tagName != 'A') {
      el = el.parentElement;
    }

    if ((el.protocol == 'file:' || el.protocol == 'about:') &&
        (e.button == 0 || e.button == 1)) {
      chrome.send('navigateToUrl', [
        el.href,
        el.target,
        e.button,
        e.altKey,
        e.ctrlKey,
        e.metaKey,
        e.shiftKey
      ]);
      e.preventDefault();
    }
  }
});

/**
 * Creates a new URL which is the old URL with a GET param of key=value.
 * @param {string} url The base URL. There is not sanity checking on the URL so
 *     it must be passed in a proper format.
 * @param {string} key The key of the param.
 * @param {string} value The value of the param.
 * @return {string} The new URL.
 */
function appendParam(url, key, value) {
  var param = encodeURIComponent(key) + '=' + encodeURIComponent(value);

  if (url.indexOf('?') == -1)
    return url + '?' + param;
  return url + '&' + param;
}

/**
 * Creates a CSS -webkit-image-set for a favicon request.
 * @param {string} url The url for the favicon.
 * @param {number=} opt_size Optional preferred size of the favicon.
 * @param {string=} opt_type Optional type of favicon to request. Valid values
 *     are 'favicon' and 'touch-icon'. Default is 'favicon'.
 * @return {string} -webkit-image-set for the favicon.
 */
function getFaviconImageSet(url, opt_size, opt_type) {
  var size = opt_size || 16;
  var type = opt_type || 'favicon';
  return imageset(
      'chrome://' + type + '/size/' + size + '@scalefactorx/' + url);
}

/**
 * Creates a new URL for a favicon request for the current device pixel ratio.
 * The URL must be updated when the user moves the browser to a screen with a
 * different device pixel ratio. Use getFaviconImageSet() for the updating to
 * occur automatically.
 * @param {string} url The url for the favicon.
 * @param {number=} opt_size Optional preferred size of the favicon.
 * @param {string=} opt_type Optional type of favicon to request. Valid values
 *     are 'favicon' and 'touch-icon'. Default is 'favicon'.
 * @return {string} Updated URL for the favicon.
 */
function getFaviconUrlForCurrentDevicePixelRatio(url, opt_size, opt_type) {
  var size = opt_size || 16;
  var type = opt_type || 'favicon';
  return 'chrome://' + type + '/size/' + size + '@' +
      window.devicePixelRatio + 'x/' + url;
}

/**
 * Creates an element of a specified type with a specified class name.
 * @param {string} type The node type.
 * @param {string} className The class name to use.
 * @return {Element} The created element.
 */
function createElementWithClassName(type, className) {
  var elm = document.createElement(type);
  elm.className = className;
  return elm;
}

/**
 * webkitTransitionEnd does not always fire (e.g. when animation is aborted
 * or when no paint happens during the animation). This function sets up
 * a timer and emulate the event if it is not fired when the timer expires.
 * @param {!HTMLElement} el The element to watch for webkitTransitionEnd.
 * @param {number} timeOut The maximum wait time in milliseconds for the
 *     webkitTransitionEnd to happen.
 */
function ensureTransitionEndEvent(el, timeOut) {
  var fired = false;
  el.addEventListener('webkitTransitionEnd', function f(e) {
    el.removeEventListener('webkitTransitionEnd', f);
    fired = true;
  });
  window.setTimeout(function() {
    if (!fired)
      cr.dispatchSimpleEvent(el, 'webkitTransitionEnd');
  }, timeOut);
}


// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * The global object.
 * @type {!Object}
 * @const
 */
var global = this;

/** Platform, package, object property, and Event support. **/
this.cr = (function() {
  'use strict';

  /**
   * Builds an object structure for the provided namespace path,
   * ensuring that names that already exist are not overwritten. For
   * example:
   * "a.b.c" -> a = {};a.b={};a.b.c={};
   * @param {string} name Name of the object that this file defines.
   * @param {*=} opt_object The object to expose at the end of the path.
   * @param {Object=} opt_objectToExportTo The object to add the path to;
   *     default is {@code global}.
   * @private
   */
  function exportPath(name, opt_object, opt_objectToExportTo) {
    var parts = name.split('.');
    var cur = opt_objectToExportTo || global;

    for (var part; parts.length && (part = parts.shift());) {
      if (!parts.length && opt_object !== undefined) {
        // last part and we have an object; use it
        cur[part] = opt_object;
      } else if (part in cur) {
        cur = cur[part];
      } else {
        cur = cur[part] = {};
      }
    }
    return cur;
  };

  /**
   * Fires a property change event on the target.
   * @param {EventTarget} target The target to dispatch the event on.
   * @param {string} propertyName The name of the property that changed.
   * @param {*} newValue The new value for the property.
   * @param {*} oldValue The old value for the property.
   */
  function dispatchPropertyChange(target, propertyName, newValue, oldValue) {
    var e = new Event(propertyName + 'Change');
    e.propertyName = propertyName;
    e.newValue = newValue;
    e.oldValue = oldValue;
    target.dispatchEvent(e);
  }

  /**
   * Converts a camelCase javascript property name to a hyphenated-lower-case
   * attribute name.
   * @param {string} jsName The javascript camelCase property name.
   * @return {string} The equivalent hyphenated-lower-case attribute name.
   */
  function getAttributeName(jsName) {
    return jsName.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  /**
   * The kind of property to define in {@code defineProperty}.
   * @enum {number}
   * @const
   */
  var PropertyKind = {
    /**
     * Plain old JS property where the backing data is stored as a "private"
     * field on the object.
     */
    JS: 'js',

    /**
     * The property backing data is stored as an attribute on an element.
     */
    ATTR: 'attr',

    /**
     * The property backing data is stored as an attribute on an element. If the
     * element has the attribute then the value is true.
     */
    BOOL_ATTR: 'boolAttr'
  };

  /**
   * Helper function for defineProperty that returns the getter to use for the
   * property.
   * @param {string} name The name of the property.
   * @param {cr.PropertyKind} kind The kind of the property.
   * @return {function():*} The getter for the property.
   */
  function getGetter(name, kind) {
    switch (kind) {
      case PropertyKind.JS:
        var privateName = name + '_';
        return function() {
          return this[privateName];
        };
      case PropertyKind.ATTR:
        var attributeName = getAttributeName(name);
        return function() {
          return this.getAttribute(attributeName);
        };
      case PropertyKind.BOOL_ATTR:
        var attributeName = getAttributeName(name);
        return function() {
          return this.hasAttribute(attributeName);
        };
    }
  }

  /**
   * Helper function for defineProperty that returns the setter of the right
   * kind.
   * @param {string} name The name of the property we are defining the setter
   *     for.
   * @param {cr.PropertyKind} kind The kind of property we are getting the
   *     setter for.
   * @param {function(*):void} opt_setHook A function to run after the property
   *     is set, but before the propertyChange event is fired.
   * @return {function(*):void} The function to use as a setter.
   */
  function getSetter(name, kind, opt_setHook) {
    switch (kind) {
      case PropertyKind.JS:
        var privateName = name + '_';
        return function(value) {
          var oldValue = this[name];
          if (value !== oldValue) {
            this[privateName] = value;
            if (opt_setHook)
              opt_setHook.call(this, value, oldValue);
            dispatchPropertyChange(this, name, value, oldValue);
          }
        };

      case PropertyKind.ATTR:
        var attributeName = getAttributeName(name);
        return function(value) {
          var oldValue = this[name];
          if (value !== oldValue) {
            if (value == undefined)
              this.removeAttribute(attributeName);
            else
              this.setAttribute(attributeName, value);
            if (opt_setHook)
              opt_setHook.call(this, value, oldValue);
            dispatchPropertyChange(this, name, value, oldValue);
          }
        };

      case PropertyKind.BOOL_ATTR:
        var attributeName = getAttributeName(name);
        return function(value) {
          var oldValue = this[name];
          if (value !== oldValue) {
            if (value)
              this.setAttribute(attributeName, name);
            else
              this.removeAttribute(attributeName);
            if (opt_setHook)
              opt_setHook.call(this, value, oldValue);
            dispatchPropertyChange(this, name, value, oldValue);
          }
        };
    }
  }

  /**
   * Defines a property on an object. When the setter changes the value a
   * property change event with the type {@code name + 'Change'} is fired.
   * @param {!Object} obj The object to define the property for.
   * @param {string} name The name of the property.
   * @param {cr.PropertyKind=} opt_kind What kind of underlying storage to use.
   * @param {function(*):void} opt_setHook A function to run after the
   *     property is set, but before the propertyChange event is fired.
   */
  function defineProperty(obj, name, opt_kind, opt_setHook) {
    if (typeof obj == 'function')
      obj = obj.prototype;

    var kind = opt_kind || PropertyKind.JS;

    if (!obj.__lookupGetter__(name))
      obj.__defineGetter__(name, getGetter(name, kind));

    if (!obj.__lookupSetter__(name))
      obj.__defineSetter__(name, getSetter(name, kind, opt_setHook));
  }

  /**
   * Counter for use with createUid
   */
  var uidCounter = 1;

  /**
   * @return {number} A new unique ID.
   */
  function createUid() {
    return uidCounter++;
  }

  /**
   * Returns a unique ID for the item. This mutates the item so it needs to be
   * an object
   * @param {!Object} item The item to get the unique ID for.
   * @return {number} The unique ID for the item.
   */
  function getUid(item) {
    if (item.hasOwnProperty('uid'))
      return item.uid;
    return item.uid = createUid();
  }

  /**
   * Dispatches a simple event on an event target.
   * @param {!EventTarget} target The event target to dispatch the event on.
   * @param {string} type The type of the event.
   * @param {boolean=} opt_bubbles Whether the event bubbles or not.
   * @param {boolean=} opt_cancelable Whether the default action of the event
   *     can be prevented. Default is true.
   * @return {boolean} If any of the listeners called {@code preventDefault}
   *     during the dispatch this will return false.
   */
  function dispatchSimpleEvent(target, type, opt_bubbles, opt_cancelable) {
    var e = new Event(type, {
      bubbles: opt_bubbles,
      cancelable: opt_cancelable === undefined || opt_cancelable
    });
    return target.dispatchEvent(e);
  }

  /**
   * Calls |fun| and adds all the fields of the returned object to the object
   * named by |name|. For example, cr.define('cr.ui', function() {
   *   function List() {
   *     ...
   *   }
   *   function ListItem() {
   *     ...
   *   }
   *   return {
   *     List: List,
   *     ListItem: ListItem,
   *   };
   * });
   * defines the functions cr.ui.List and cr.ui.ListItem.
   * @param {string} name The name of the object that we are adding fields to.
   * @param {!Function} fun The function that will return an object containing
   *     the names and values of the new fields.
   */
  function define(name, fun) {
    var obj = exportPath(name);
    var exports = fun();
    for (var propertyName in exports) {
      // Maybe we should check the prototype chain here? The current usage
      // pattern is always using an object literal so we only care about own
      // properties.
      var propertyDescriptor = Object.getOwnPropertyDescriptor(exports,
                                                               propertyName);
      if (propertyDescriptor)
        Object.defineProperty(obj, propertyName, propertyDescriptor);
    }
  }

  /**
   * Adds a {@code getInstance} static method that always return the same
   * instance object.
   * @param {!Function} ctor The constructor for the class to add the static
   *     method to.
   */
  function addSingletonGetter(ctor) {
    ctor.getInstance = function() {
      return ctor.instance_ || (ctor.instance_ = new ctor());
    };
  }

  /**
   * Initialization which must be deferred until run-time.
   */
  function initialize() {
    // If 'document' isn't defined, then we must be being pre-compiled,
    // so set a trap so that we're initialized on first access at run-time.
    if (!global.document) {
      var originalCr = cr;

      Object.defineProperty(global, 'cr', {
        get: function() {
          Object.defineProperty(global, 'cr', {value: originalCr});
          originalCr.initialize();
          return originalCr;
        },
        configurable: true
      });

      return;
    }

    cr.doc = document;

    /**
     * Whether we are using a Mac or not.
     */
    cr.isMac = /Mac/.test(navigator.platform);

    /**
     * Whether this is on the Windows platform or not.
     */
    cr.isWindows = /Win/.test(navigator.platform);

    /**
     * Whether this is on chromeOS or not.
     */
    cr.isChromeOS = /CrOS/.test(navigator.userAgent);

    /**
     * Whether this is on vanilla Linux (not chromeOS).
     */
    cr.isLinux = /Linux/.test(navigator.userAgent);

    /**
     * Whether this uses GTK or not.
     */
    cr.isGTK = typeof chrome.getVariableValue == 'function' &&
        /GTK/.test(chrome.getVariableValue('toolkit'));

    /**
     * Whether this uses the views toolkit or not.
     */
    cr.isViews = typeof chrome.getVariableValue == 'function' &&
        /views/.test(chrome.getVariableValue('toolkit'));
  }

  return {
    addSingletonGetter: addSingletonGetter,
    createUid: createUid,
    define: define,
    defineProperty: defineProperty,
    dispatchPropertyChange: dispatchPropertyChange,
    dispatchSimpleEvent: dispatchSimpleEvent,
    getUid: getUid,
    initialize: initialize,
    PropertyKind: PropertyKind
  };
})();


/**
 * TODO(kgr): Move this to another file which is to be loaded last.
 * This will be done as part of future work to make this code pre-compilable.
 */
cr.initialize();

// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This contains an implementation of the EventTarget interface
 * as defined by DOM Level 2 Events.
 */

cr.define('cr', function() {

  /**
   * Creates a new EventTarget. This class implements the DOM level 2
   * EventTarget interface and can be used wherever those are used.
   * @constructor
   */
  function EventTarget() {
  }

  EventTarget.prototype = {

    /**
     * Adds an event listener to the target.
     * @param {string} type The name of the event.
     * @param {!Function|{handleEvent:Function}} handler The handler for the
     *     event. This is called when the event is dispatched.
     */
    addEventListener: function(type, handler) {
      if (!this.listeners_)
        this.listeners_ = Object.create(null);
      if (!(type in this.listeners_)) {
        this.listeners_[type] = [handler];
      } else {
        var handlers = this.listeners_[type];
        if (handlers.indexOf(handler) < 0)
          handlers.push(handler);
      }
    },

    /**
     * Removes an event listener from the target.
     * @param {string} type The name of the event.
     * @param {!Function|{handleEvent:Function}} handler The handler for the
     *     event.
     */
    removeEventListener: function(type, handler) {
      if (!this.listeners_)
        return;
      if (type in this.listeners_) {
        var handlers = this.listeners_[type];
        var index = handlers.indexOf(handler);
        if (index >= 0) {
          // Clean up if this was the last listener.
          if (handlers.length == 1)
            delete this.listeners_[type];
          else
            handlers.splice(index, 1);
        }
      }
    },

    /**
     * Dispatches an event and calls all the listeners that are listening to
     * the type of the event.
     * @param {!cr.event.Event} event The event to dispatch.
     * @return {boolean} Whether the default action was prevented. If someone
     *     calls preventDefault on the event object then this returns false.
     */
    dispatchEvent: function(event) {
      if (!this.listeners_)
        return true;

      // Since we are using DOM Event objects we need to override some of the
      // properties and methods so that we can emulate this correctly.
      var self = this;
      event.__defineGetter__('target', function() {
        return self;
      });

      var type = event.type;
      var prevented = 0;
      if (type in this.listeners_) {
        // Clone to prevent removal during dispatch
        var handlers = this.listeners_[type].concat();
        for (var i = 0, handler; handler = handlers[i]; i++) {
          if (handler.handleEvent)
            prevented |= handler.handleEvent.call(handler, event) === false;
          else
            prevented |= handler.call(this, event) === false;
        }
      }

      return !prevented && !event.defaultPrevented;
    }
  };

  // Export
  return {
    EventTarget: EventTarget
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('cr.ui', function() {

  /**
   * Decorates elements as an instance of a class.
   * @param {string|!Element} source The way to find the element(s) to decorate.
   *     If this is a string then {@code querySeletorAll} is used to find the
   *     elements to decorate.
   * @param {!Function} constr The constructor to decorate with. The constr
   *     needs to have a {@code decorate} function.
   */
  function decorate(source, constr) {
    var elements;
    if (typeof source == 'string')
      elements = cr.doc.querySelectorAll(source);
    else
      elements = [source];

    for (var i = 0, el; el = elements[i]; i++) {
      if (!(el instanceof constr))
        constr.decorate(el);
    }
  }

  /**
   * Helper function for creating new element for define.
   */
  function createElementHelper(tagName, opt_bag) {
    // Allow passing in ownerDocument to create in a different document.
    var doc;
    if (opt_bag && opt_bag.ownerDocument)
      doc = opt_bag.ownerDocument;
    else
      doc = cr.doc;
    return doc.createElement(tagName);
  }

  /**
   * Creates the constructor for a UI element class.
   *
   * Usage:
   * <pre>
   * var List = cr.ui.define('list');
   * List.prototype = {
   *   __proto__: HTMLUListElement.prototype,
   *   decorate: function() {
   *     ...
   *   },
   *   ...
   * };
   * </pre>
   *
   * @param {string|Function} tagNameOrFunction The tagName or
   *     function to use for newly created elements. If this is a function it
   *     needs to return a new element when called.
   * @return {function(Object=):Element} The constructor function which takes
   *     an optional property bag. The function also has a static
   *     {@code decorate} method added to it.
   */
  function define(tagNameOrFunction) {
    var createFunction, tagName;
    if (typeof tagNameOrFunction == 'function') {
      createFunction = tagNameOrFunction;
      tagName = '';
    } else {
      createFunction = createElementHelper;
      tagName = tagNameOrFunction;
    }

    /**
     * Creates a new UI element constructor.
     * @param {Object=} opt_propertyBag Optional bag of properties to set on the
     *     object after created. The property {@code ownerDocument} is special
     *     cased and it allows you to create the element in a different
     *     document than the default.
     * @constructor
     */
    function f(opt_propertyBag) {
      var el = createFunction(tagName, opt_propertyBag);
      f.decorate(el);
      for (var propertyName in opt_propertyBag) {
        el[propertyName] = opt_propertyBag[propertyName];
      }
      return el;
    }

    /**
     * Decorates an element as a UI element class.
     * @param {!Element} el The element to decorate.
     */
    f.decorate = function(el) {
      el.__proto__ = f.prototype;
      el.decorate();
    };

    return f;
  }

  /**
   * Input elements do not grow and shrink with their content. This is a simple
   * (and not very efficient) way of handling shrinking to content with support
   * for min width and limited by the width of the parent element.
   * @param {HTMLElement} el The element to limit the width for.
   * @param {number} parentEl The parent element that should limit the size.
   * @param {number} min The minimum width.
   * @param {number} opt_scale Optional scale factor to apply to the width.
   */
  function limitInputWidth(el, parentEl, min, opt_scale) {
    // Needs a size larger than borders
    el.style.width = '10px';
    var doc = el.ownerDocument;
    var win = doc.defaultView;
    var computedStyle = win.getComputedStyle(el);
    var parentComputedStyle = win.getComputedStyle(parentEl);
    var rtl = computedStyle.direction == 'rtl';

    // To get the max width we get the width of the treeItem minus the position
    // of the input.
    var inputRect = el.getBoundingClientRect();  // box-sizing
    var parentRect = parentEl.getBoundingClientRect();
    var startPos = rtl ? parentRect.right - inputRect.right :
        inputRect.left - parentRect.left;

    // Add up border and padding of the input.
    var inner = parseInt(computedStyle.borderLeftWidth, 10) +
        parseInt(computedStyle.paddingLeft, 10) +
        parseInt(computedStyle.paddingRight, 10) +
        parseInt(computedStyle.borderRightWidth, 10);

    // We also need to subtract the padding of parent to prevent it to overflow.
    var parentPadding = rtl ? parseInt(parentComputedStyle.paddingLeft, 10) :
        parseInt(parentComputedStyle.paddingRight, 10);

    var max = parentEl.clientWidth - startPos - inner - parentPadding;
    if (opt_scale)
      max *= opt_scale;

    function limit() {
      if (el.scrollWidth > max) {
        el.style.width = max + 'px';
      } else {
        el.style.width = 0;
        var sw = el.scrollWidth;
        if (sw < min) {
          el.style.width = min + 'px';
        } else {
          el.style.width = sw + 'px';
        }
      }
    }

    el.addEventListener('input', limit);
    limit();
  }

  /**
   * Takes a number and spits out a value CSS will be happy with. To avoid
   * subpixel layout issues, the value is rounded to the nearest integral value.
   * @param {number} pixels The number of pixels.
   * @return {string} e.g. '16px'.
   */
  function toCssPx(pixels) {
    if (!window.isFinite(pixels))
      console.error('Pixel value is not a number: ' + pixels);
    return Math.round(pixels) + 'px';
  }

  /**
   * Users complain they occasionaly use doubleclicks instead of clicks
   * (http://crbug.com/140364). To fix it we freeze click handling for
   * the doubleclick time interval.
   * @param {MouseEvent} e Initial click event.
   */
  function swallowDoubleClick(e) {
    var doc = e.target.ownerDocument;
    var counter = Math.min(1, e.detail);
    function swallow(e) {
      e.stopPropagation();
      e.preventDefault();
    }
    function onclick(e) {
      if (e.detail > counter) {
        counter = e.detail;
        // Swallow the click since it's a click inside the doubleclick timeout.
        swallow(e);
      } else {
        // Stop tracking clicks and let regular handling.
        doc.removeEventListener('dblclick', swallow, true);
        doc.removeEventListener('click', onclick, true);
      }
    }
    // The following 'click' event (if e.type == 'mouseup') mustn't be taken
    // into account (it mustn't stop tracking clicks). Start event listening
    // after zero timeout.
    setTimeout(function() {
      doc.addEventListener('click', onclick, true);
      doc.addEventListener('dblclick', swallow, true);
    }, 0);
  }

  return {
    decorate: decorate,
    define: define,
    limitInputWidth: limitInputWidth,
    toCssPx: toCssPx,
    swallowDoubleClick: swallowDoubleClick
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// require: event_tracker.js

cr.define('cr.ui', function() {

  /**
   * The arrow location specifies how the arrow and bubble are positioned in
   * relation to the anchor node.
   * @enum
   */
  var ArrowLocation = {
    // The arrow is positioned at the top and the start of the bubble. In left
    // to right mode this is the top left. The entire bubble is positioned below
    // the anchor node.
    TOP_START: 'top-start',
    // The arrow is positioned at the top and the end of the bubble. In left to
    // right mode this is the top right. The entire bubble is positioned below
    // the anchor node.
    TOP_END: 'top-end',
    // The arrow is positioned at the bottom and the start of the bubble. In
    // left to right mode this is the bottom left. The entire bubble is
    // positioned above the anchor node.
    BOTTOM_START: 'bottom-start',
    // The arrow is positioned at the bottom and the end of the bubble. In
    // left to right mode this is the bottom right. The entire bubble is
    // positioned above the anchor node.
    BOTTOM_END: 'bottom-end'
  };

  /**
   * The bubble alignment specifies the position of the bubble in relation to
   * the anchor node.
   * @enum
   */
  var BubbleAlignment = {
    // The bubble is positioned just above or below the anchor node (as
    // specified by the arrow location) so that the arrow points at the midpoint
    // of the anchor.
    ARROW_TO_MID_ANCHOR: 'arrow-to-mid-anchor',
    // The bubble is positioned just above or below the anchor node (as
    // specified by the arrow location) so that its reference edge lines up with
    // the edge of the anchor.
    BUBBLE_EDGE_TO_ANCHOR_EDGE: 'bubble-edge-anchor-edge',
    // The bubble is positioned so that it is entirely within view and does not
    // obstruct the anchor element, if possible. The specified arrow location is
    // taken into account as the preferred alignment but may be overruled if
    // there is insufficient space (see BubbleBase.reposition for the exact
    // placement algorithm).
    ENTIRELY_VISIBLE: 'entirely-visible'
  };

  /**
   * Abstract base class that provides common functionality for implementing
   * free-floating informational bubbles with a triangular arrow pointing at an
   * anchor node.
   */
  var BubbleBase = cr.ui.define('div');

  /**
   * The horizontal distance between the tip of the arrow and the reference edge
   * of the bubble (as specified by the arrow location). In pixels.
   * @type {number}
   * @const
   */
  BubbleBase.ARROW_OFFSET = 30;

  /**
   * Minimum horizontal spacing between edge of bubble and edge of viewport
   * (when using the ENTIRELY_VISIBLE alignment). In pixels.
   * @type {number}
   * @const
   */
  BubbleBase.MIN_VIEWPORT_EDGE_MARGIN = 2;

  BubbleBase.prototype = {
    // Set up the prototype chain.
    __proto__: HTMLDivElement.prototype,

    /**
     * Initialization function for the cr.ui framework.
     */
    decorate: function() {
      this.className = 'bubble';
      this.innerHTML =
          '<div class="bubble-content"></div>' +
          '<div class="bubble-shadow"></div>' +
          '<div class="bubble-arrow"></div>';
      this.hidden = true;
      this.bubbleAlignment = BubbleAlignment.ENTIRELY_VISIBLE;
    },

    /**
     * Set the anchor node, i.e. the node that this bubble points at. Only
     * available when the bubble is not being shown.
     * @param {HTMLElement} node The new anchor node.
     */
    set anchorNode(node) {
      if (!this.hidden)
        return;

      this.anchorNode_ = node;
    },

    /**
     * Set the conent of the bubble. Only available when the bubble is not being
     * shown.
     * @param {HTMLElement} node The root node of the new content.
     */
    set content(node) {
      if (!this.hidden)
        return;

      var bubbleContent = this.querySelector('.bubble-content');
      bubbleContent.innerHTML = '';
      bubbleContent.appendChild(node);
    },

    /**
     * Set the arrow location. Only available when the bubble is not being
     * shown.
     * @param {cr.ui.ArrowLocation} location The new arrow location.
     */
    set arrowLocation(location) {
      if (!this.hidden)
        return;

      this.arrowAtRight_ = location == ArrowLocation.TOP_END ||
                           location == ArrowLocation.BOTTOM_END;
      if (document.documentElement.dir == 'rtl')
        this.arrowAtRight_ = !this.arrowAtRight_;
      this.arrowAtTop_ = location == ArrowLocation.TOP_START ||
                         location == ArrowLocation.TOP_END;
    },

    /**
     * Set the bubble alignment. Only available when the bubble is not being
     * shown.
     * @param {cr.ui.BubbleAlignment} alignment The new bubble alignment.
     */
    set bubbleAlignment(alignment) {
      if (!this.hidden)
        return;

      this.bubbleAlignment_ = alignment;
    },

    /**
     * Update the position of the bubble. Whenever the layout may have changed,
     * the bubble should either be repositioned by calling this function or
     * hidden so that it does not point to a nonsensical location on the page.
     */
    reposition: function() {
      var documentWidth = document.documentElement.clientWidth;
      var documentHeight = document.documentElement.clientHeight;
      var anchor = this.anchorNode_.getBoundingClientRect();
      var anchorMid = (anchor.left + anchor.right) / 2;
      var bubble = this.getBoundingClientRect();
      var arrow = this.querySelector('.bubble-arrow').getBoundingClientRect();

      if (this.bubbleAlignment_ == BubbleAlignment.ENTIRELY_VISIBLE) {
        // Work out horizontal placement. The bubble is initially positioned so
        // that the arrow tip points toward the midpoint of the anchor and is
        // BubbleBase.ARROW_OFFSET pixels from the reference edge and (as
        // specified by the arrow location). If the bubble is not entirely
        // within view, it is then shifted, preserving the arrow tip position.
        var left = this.arrowAtRight_ ?
           anchorMid + BubbleBase.ARROW_OFFSET - bubble.width :
           anchorMid - BubbleBase.ARROW_OFFSET;
        var max_left_pos =
            documentWidth - bubble.width - BubbleBase.MIN_VIEWPORT_EDGE_MARGIN;
        var min_left_pos = BubbleBase.MIN_VIEWPORT_EDGE_MARGIN;
        if (document.documentElement.dir == 'rtl')
          left = Math.min(Math.max(left, min_left_pos), max_left_pos);
        else
          left = Math.max(Math.min(left, max_left_pos), min_left_pos);
        var arrowTip = Math.min(
            Math.max(arrow.width / 2,
                     this.arrowAtRight_ ? left + bubble.width - anchorMid :
                                          anchorMid - left),
            bubble.width - arrow.width / 2);

        // Work out the vertical placement, attempting to fit the bubble
        // entirely into view. The following placements are considered in
        // decreasing order of preference:
        // * Outside the anchor, arrow tip touching the anchor (arrow at
        //   top/bottom as specified by the arrow location).
        // * Outside the anchor, arrow tip touching the anchor (arrow at
        //   bottom/top, opposite the specified arrow location).
        // * Outside the anchor, arrow tip overlapping the anchor (arrow at
        //   top/bottom as specified by the arrow location).
        // * Outside the anchor, arrow tip overlapping the anchor (arrow at
        //   bottom/top, opposite the specified arrow location).
        // * Overlapping the anchor.
        var offsetTop = Math.min(documentHeight - anchor.bottom - bubble.height,
                                 arrow.height / 2);
        var offsetBottom = Math.min(anchor.top - bubble.height,
                                    arrow.height / 2);
        if (offsetTop < 0 && offsetBottom < 0) {
          var top = 0;
          this.updateArrowPosition_(false, false, arrowTip);
        } else if (offsetTop > offsetBottom ||
                   offsetTop == offsetBottom && this.arrowAtTop_) {
          var top = anchor.bottom + offsetTop;
          this.updateArrowPosition_(true, true, arrowTip);
        } else {
          var top = anchor.top - bubble.height - offsetBottom;
          this.updateArrowPosition_(true, false, arrowTip);
        }
      } else {
        if (this.bubbleAlignment_ ==
            BubbleAlignment.BUBBLE_EDGE_TO_ANCHOR_EDGE) {
          var left = this.arrowAtRight_ ? anchor.right - bubble.width :
              anchor.left;
        } else {
          var left = this.arrowAtRight_ ?
              anchorMid - this.clientWidth + BubbleBase.ARROW_OFFSET :
              anchorMid - BubbleBase.ARROW_OFFSET;
        }
        var top = this.arrowAtTop_ ? anchor.bottom + arrow.height / 2 :
            anchor.top - this.clientHeight - arrow.height / 2;
        this.updateArrowPosition_(true, this.arrowAtTop_,
                                  BubbleBase.ARROW_OFFSET);
      }

      this.style.left = left + 'px';
      this.style.top = top + 'px';
    },

    /**
     * Show the bubble.
     */
    show: function() {
      if (!this.hidden)
        return;

      this.attachToDOM_();
      this.hidden = false;
      this.reposition();

      var doc = this.ownerDocument;
      this.eventTracker_ = new EventTracker;
      this.eventTracker_.add(doc, 'keydown', this, true);
      this.eventTracker_.add(doc, 'mousedown', this, true);
    },

    /**
     * Hide the bubble.
     */
    hide: function() {
      if (this.hidden)
        return;

      this.eventTracker_.removeAll();
      this.hidden = true;
      this.parentNode.removeChild(this);
    },

    /**
     * Handle keyboard events, dismissing the bubble if necessary.
     * @param {Event} event The event.
     */
    handleEvent: function(event) {
      // Close the bubble when the user presses <Esc>.
      if (event.type == 'keydown' && event.keyCode == 27) {
        this.hide();
        event.preventDefault();
        event.stopPropagation();
      }
    },

    /**
     * Attach the bubble to the document's DOM.
     * @private
     */
    attachToDOM_: function() {
      document.body.appendChild(this);
    },

    /**
     * Update the arrow so that it appears at the correct position.
     * @param {boolean} visible Whether the arrow should be visible.
     * @param {boolean} atTop Whether the arrow should be at the top of the
     * bubble.
     * @param {number} tipOffset The horizontal distance between the tip of the
     * arrow and the reference edge of the bubble (as specified by the arrow
     * location).
     * @private
     */
    updateArrowPosition_: function(visible, atTop, tipOffset) {
      var bubbleArrow = this.querySelector('.bubble-arrow');
      bubbleArrow.hidden = !visible;
      if (!visible)
        return;

      var edgeOffset = (-bubbleArrow.clientHeight / 2) + 'px';
      bubbleArrow.style.top = atTop ? edgeOffset : 'auto';
      bubbleArrow.style.bottom = atTop ? 'auto' : edgeOffset;

      edgeOffset = (tipOffset - bubbleArrow.offsetWidth / 2) + 'px';
      bubbleArrow.style.left = this.arrowAtRight_ ? 'auto' : edgeOffset;
      bubbleArrow.style.right = this.arrowAtRight_ ? edgeOffset : 'auto';
    },
  };

  /**
   * A bubble that remains open until the user explicitly dismisses it or clicks
   * outside the bubble after it has been shown for at least the specified
   * amount of time (making it less likely that the user will unintentionally
   * dismiss the bubble). The bubble repositions itself on layout changes.
   */
  var Bubble = cr.ui.define('div');

  Bubble.prototype = {
    // Set up the prototype chain.
    __proto__: BubbleBase.prototype,

    /**
     * Initialization function for the cr.ui framework.
     */
    decorate: function() {
      BubbleBase.prototype.decorate.call(this);

      var close = document.createElement('div');
      close.className = 'bubble-close';
      this.insertBefore(close, this.querySelector('.bubble-content'));

      this.handleCloseEvent = this.hide;
      this.deactivateToDismissDelay_ = 0;
      this.bubbleAlignment = BubbleAlignment.ARROW_TO_MID_ANCHOR;
    },

    /**
     * Handler for close events triggered when the close button is clicked. By
     * default, set to this.hide. Only available when the bubble is not being
     * shown.
     * @param {function} handler The new handler, a function with no parameters.
     */
    set handleCloseEvent(handler) {
      if (!this.hidden)
        return;

      this.handleCloseEvent_ = handler;
    },

    /**
     * Set the delay before the user is allowed to click outside the bubble to
     * dismiss it. Using a delay makes it less likely that the user will
     * unintentionally dismiss the bubble.
     * @param {number} delay The delay in milliseconds.
     */
    set deactivateToDismissDelay(delay) {
      this.deactivateToDismissDelay_ = delay;
    },

    /**
     * Hide or show the close button.
     * @param {boolean} isVisible True if the close button should be visible.
     */
    set closeButtonVisible(isVisible) {
      this.querySelector('.bubble-close').hidden = !isVisible;
    },

    /**
     * Show the bubble.
     */
    show: function() {
      if (!this.hidden)
        return;

      BubbleBase.prototype.show.call(this);

      this.showTime_ = Date.now();
      this.eventTracker_.add(window, 'resize', this.reposition.bind(this));
    },

    /**
     * Handle keyboard and mouse events, dismissing the bubble if necessary.
     * @param {Event} event The event.
     */
    handleEvent: function(event) {
      BubbleBase.prototype.handleEvent.call(this, event);

      if (event.type == 'mousedown') {
        // Dismiss the bubble when the user clicks on the close button.
        if (event.target == this.querySelector('.bubble-close')) {
          this.handleCloseEvent_();
        // Dismiss the bubble when the user clicks outside it after the
        // specified delay has passed.
        } else if (!this.contains(event.target) &&
            Date.now() - this.showTime_ >= this.deactivateToDismissDelay_) {
          this.hide();
        }
      }
    },
  };

  /**
   * A bubble that closes automatically when the user clicks or moves the focus
   * outside the bubble and its target element, scrolls the underlying document
   * or resizes the window.
   */
  var AutoCloseBubble = cr.ui.define('div');

  AutoCloseBubble.prototype = {
    // Set up the prototype chain.
    __proto__: BubbleBase.prototype,

    /**
     * Initialization function for the cr.ui framework.
     */
    decorate: function() {
      BubbleBase.prototype.decorate.call(this);
      this.classList.add('auto-close-bubble');
    },

    /**
     * Set the DOM sibling node, i.e. the node as whose sibling the bubble
     * should join the DOM to ensure that focusable elements inside the bubble
     * follow the target element in the document's tab order. Only available
     * when the bubble is not being shown.
     * @param {HTMLElement} node The new DOM sibling node.
     */
    set domSibling(node) {
      if (!this.hidden)
        return;

      this.domSibling_ = node;
    },

    /**
     * Show the bubble.
     */
    show: function() {
      if (!this.hidden)
        return;

      BubbleBase.prototype.show.call(this);
      this.domSibling_.showingBubble = true;

      var doc = this.ownerDocument;
      this.eventTracker_.add(doc, 'mousewheel', this, true);
      this.eventTracker_.add(doc, 'scroll', this, true);
      this.eventTracker_.add(doc, 'elementFocused', this, true);
      this.eventTracker_.add(window, 'resize', this);
    },

    /**
     * Hide the bubble.
     */
    hide: function() {
      BubbleBase.prototype.hide.call(this);
      this.domSibling_.showingBubble = false;
    },

    /**
     * Handle events, closing the bubble when the user clicks or moves the focus
     * outside the bubble and its target element, scrolls the underlying
     * document or resizes the window.
     * @param {Event} event The event.
     */
    handleEvent: function(event) {
      BubbleBase.prototype.handleEvent.call(this, event);

      switch (event.type) {
        // Close the bubble when the user clicks outside it, except if it is a
        // left-click on the bubble's target element (allowing the target to
        // handle the event and close the bubble itself).
        case 'mousedown':
          if (event.button == 0 && this.anchorNode_.contains(event.target))
            break;
        // Close the bubble when the underlying document is scrolled.
        case 'mousewheel':
        case 'scroll':
          if (this.contains(event.target))
            break;
        // Close the bubble when the window is resized.
        case 'resize':
          this.hide();
          break;
        // Close the bubble when the focus moves to an element that is not the
        // bubble target and is not inside the bubble.
        case 'elementFocused':
          if (!this.anchorNode_.contains(event.target) &&
              !this.contains(event.target)) {
            this.hide();
          }
          break;
      }
    },

    /**
     * Attach the bubble to the document's DOM, making it a sibling of the
     * |domSibling_| so that focusable elements inside the bubble follow the
     * target element in the document's tab order.
     * @private
     */
    attachToDOM_: function() {
      var parent = this.domSibling_.parentNode;
      parent.insertBefore(this, this.domSibling_.nextSibling);
    },
  };


  return {
    ArrowLocation: ArrowLocation,
    BubbleAlignment: BubbleAlignment,
    BubbleBase: BubbleBase,
    Bubble: Bubble,
    AutoCloseBubble: AutoCloseBubble
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Card slider implementation. Allows you to create interactions
 * that have items that can slide left to right to reveal additional items.
 * Works by adding the necessary event handlers to a specific DOM structure
 * including a frame, container and cards.
 * - The frame defines the boundary of one item. Each card will be expanded to
 *   fill the width of the frame. This element is also overflow hidden so that
 *   the additional items left / right do not trigger horizontal scrolling.
 * - The container is what all the touch events are attached to. This element
 *   will be expanded to be the width of all cards.
 * - The cards are the individual viewable items. There should be one card for
 *   each item in the list. Only one card will be visible at a time. Two cards
 *   will be visible while you are transitioning between cards.
 *
 * This class is designed to work well on any hardware-accelerated touch device.
 * It should still work on pre-hardware accelerated devices it just won't feel
 * very good. It should also work well with a mouse.
 */

// Use an anonymous function to enable strict mode just for this file (which
// will be concatenated with other files when embedded in Chrome
cr.define('cr.ui', function() {
  'use strict';

  /**
   * @constructor
   * @param {!Element} frame The bounding rectangle that cards are visible in.
   * @param {!Element} container The surrounding element that will have event
   *     listeners attached to it.
   * @param {number} cardWidth The width of each card should have.
   */
  function CardSlider(frame, container, cardWidth) {
    /**
     * @type {!Element}
     * @private
     */
    this.frame_ = frame;

    /**
     * @type {!Element}
     * @private
     */
    this.container_ = container;

    /**
     * Array of card elements.
     * @type {!Array.<!Element>}
     * @private
     */
    this.cards_ = [];

    /**
     * Index of currently shown card.
     * @type {number}
     * @private
     */
    this.currentCard_ = -1;

    /**
     * @type {number}
     * @private
     */
    this.cardWidth_ = cardWidth;

    /**
     * @type {!cr.ui.TouchHandler}
     * @private
     */
    this.touchHandler_ = new cr.ui.TouchHandler(this.container_);
  }


  /**
   * The time to transition between cards when animating. Measured in ms.
   * @type {number}
   * @private
   * @const
   */
  CardSlider.TRANSITION_TIME_ = 200;


  /**
   * The minimum velocity required to transition cards if they did not drag past
   * the halfway point between cards. Measured in pixels / ms.
   * @type {number}
   * @private
   * @const
   */
  CardSlider.TRANSITION_VELOCITY_THRESHOLD_ = 0.2;


  CardSlider.prototype = {
    /**
     * The current left offset of the container relative to the frame. This
     * position does not include deltas from active drag operations, and
     * always aligns with a frame boundary.
     * @type {number}
     * @private
     */
    currentLeft_: 0,

    /**
     * Current offset relative to |currentLeft_| due to an active drag
     * operation.
     * @type {number}
     * @private
     */
    deltaX_: 0,

    /**
     * Initialize all elements and event handlers. Must call after construction
     * and before usage.
     * @param {boolean} ignoreMouseWheelEvents If true, horizontal mouse wheel
     *     events will be ignored, rather than flipping between pages.
     */
    initialize: function(ignoreMouseWheelEvents) {
      var view = this.container_.ownerDocument.defaultView;
      assert(view.getComputedStyle(this.container_).display == '-webkit-box',
          'Container should be display -webkit-box.');
      assert(view.getComputedStyle(this.frame_).overflow == 'hidden',
          'Frame should be overflow hidden.');
      assert(view.getComputedStyle(this.container_).position == 'static',
          'Container should be position static.');

      this.updateCardWidths_();

      this.mouseWheelScrollAmount_ = 0;
      this.mouseWheelCardSelected_ = false;
      this.mouseWheelIsContinuous_ = false;
      this.scrollClearTimeout_ = null;
      if (!ignoreMouseWheelEvents) {
        this.frame_.addEventListener('mousewheel',
                                     this.onMouseWheel_.bind(this));
      }
      this.container_.addEventListener(
          'webkitTransitionEnd', this.onWebkitTransitionEnd_.bind(this));

      // Also support touch events in case a touch screen happens to be
      // available.  Note that this has minimal impact in the common case of
      // no touch events (eg. we're mainly just adding listeners for events that
      // will never trigger).
      var TouchHandler = cr.ui.TouchHandler;
      this.container_.addEventListener(TouchHandler.EventType.TOUCH_START,
                                       this.onTouchStart_.bind(this));
      this.container_.addEventListener(TouchHandler.EventType.DRAG_START,
                                       this.onDragStart_.bind(this));
      this.container_.addEventListener(TouchHandler.EventType.DRAG_MOVE,
                                       this.onDragMove_.bind(this));
      this.container_.addEventListener(TouchHandler.EventType.DRAG_END,
                                       this.onDragEnd_.bind(this));

      this.touchHandler_.enable(/* opt_capture */ false);
    },

    /**
     * Use in cases where the width of the frame has changed in order to update
     * the width of cards. For example should be used when orientation changes
     * in full width sliders.
     * @param {number} newCardWidth Width all cards should have, in pixels.
     */
    resize: function(newCardWidth) {
      if (newCardWidth != this.cardWidth_) {
        this.cardWidth_ = newCardWidth;

        this.updateCardWidths_();

        // Must upate the transform on the container to show the correct card.
        this.transformToCurrentCard_();
      }
    },

    /**
     * Sets the cards used. Can be called more than once to switch card sets.
     * @param {!Array.<!Element>} cards The individual viewable cards.
     * @param {number} index Index of the card to in the new set of cards to
     *     navigate to.
     */
    setCards: function(cards, index) {
      assert(index >= 0 && index < cards.length,
          'Invalid index in CardSlider#setCards');
      this.cards_ = cards;

      this.updateCardWidths_();
      this.updateSelectedCardAttributes_();

      // Jump to the given card index.
      this.selectCard(index, false, false, true);
    },

    /**
     * Ensures that for all cards:
     * - if the card is the current card, then it has 'selected-card' in its
     *   classList, and is visible for accessibility
     * - if the card is not the selected card, then it does not have
     *   'selected-card' in its classList, and is invisible for accessibility.
     * @private
     */
    updateSelectedCardAttributes_: function() {
      for (var i = 0; i < this.cards_.length; i++) {
        if (i == this.currentCard_) {
          this.cards_[i].classList.add('selected-card');
          this.cards_[i].removeAttribute('aria-hidden');
        } else {
          this.cards_[i].classList.remove('selected-card');
          this.cards_[i].setAttribute('aria-hidden', true);
        }
      }
    },

    /**
     * Updates the width of each card.
     * @private
     */
    updateCardWidths_: function() {
      for (var i = 0, card; card = this.cards_[i]; i++)
        card.style.width = this.cardWidth_ + 'px';
    },

    /**
     * Returns the index of the current card.
     * @return {number} index of the current card.
     */
    get currentCard() {
      return this.currentCard_;
    },

    /**
     * Allows setting the current card index.
     * @param {number} index A new index to set the current index to.
     * @return {number} The new index after having been set.
     */
    set currentCard(index) {
      return (this.currentCard_ = index);
    },

    /**
     * Returns the number of cards.
     * @return {number} number of cards.
     */
    get cardCount() {
      return this.cards_.length;
    },

    /**
     * Returns the current card itself.
     * @return {!Element} the currently shown card.
     */
    get currentCardValue() {
      return this.cards_[this.currentCard_];
    },

    /**
     * Returns the frame holding the cards.
     * @return {Element} The frame used to position the cards.
     */
    get frame() {
      return this.frame_;
    },

    /**
     * Handle horizontal scrolls to flip between pages.
     * @private
     */
    onMouseWheel_: function(e) {
      if (e.wheelDeltaX == 0)
        return;

      // Continuous devices such as an Apple Touchpad or Apple MagicMouse will
      // send arbitrary delta values. Conversly, standard mousewheels will
      // send delta values in increments of 120.  (There is of course a small
      // chance we mistake a continuous device for a non-continuous device.
      // Unfortunately there isn't a better way to do this until real touch
      // events are available to desktop clients.)
      var DISCRETE_DELTA = 120;
      if (e.wheelDeltaX % DISCRETE_DELTA)
        this.mouseWheelIsContinuous_ = true;

      if (this.mouseWheelIsContinuous_) {
        // For continuous devices, detect a page swipe when the accumulated
        // delta matches a pre-defined threshhold.  After changing the page,
        // ignore wheel events for a short time before repeating this process.
        if (this.mouseWheelCardSelected_) return;
        this.mouseWheelScrollAmount_ += e.wheelDeltaX;
        if (Math.abs(this.mouseWheelScrollAmount_) >= 600) {
          var pagesToScroll = this.mouseWheelScrollAmount_ > 0 ? 1 : -1;
          if (!isRTL())
            pagesToScroll *= -1;
          var newCardIndex = this.currentCard + pagesToScroll;
          newCardIndex = Math.min(this.cards_.length - 1,
                                  Math.max(0, newCardIndex));
          this.selectCard(newCardIndex, true);
          this.mouseWheelCardSelected_ = true;
        }
      } else {
        // For discrete devices, consider each wheel tick a page change.
        var pagesToScroll = e.wheelDeltaX / DISCRETE_DELTA;
        if (!isRTL())
          pagesToScroll *= -1;
        var newCardIndex = this.currentCard + pagesToScroll;
        newCardIndex = Math.min(this.cards_.length - 1,
                                Math.max(0, newCardIndex));
        this.selectCard(newCardIndex, true);
      }

      // We got a mouse wheel event, so cancel any pending scroll wheel timeout.
      if (this.scrollClearTimeout_ != null)
        clearTimeout(this.scrollClearTimeout_);
      // If we didn't use up all the scroll, hold onto it for a little bit, but
      // drop it after a delay.
      if (this.mouseWheelScrollAmount_ != 0) {
        this.scrollClearTimeout_ =
            setTimeout(this.clearMouseWheelScroll_.bind(this), 500);
      }
    },

    /**
     * Resets the amount of horizontal scroll we've seen to 0. See
     * onMouseWheel_.
     * @private
     */
    clearMouseWheelScroll_: function() {
      this.mouseWheelScrollAmount_ = 0;
      this.mouseWheelCardSelected_ = false;
    },

    /**
     * Handles the ends of -webkit-transitions on -webkit-transform (animated
     * card switches).
     * @param {Event} e The webkitTransitionEnd event.
     * @private
     */
    onWebkitTransitionEnd_: function(e) {
      // Ignore irrelevant transitions that might bubble up.
      if (e.target !== this.container_ ||
          e.propertyName != '-webkit-transform') {
        return;
      }
      this.fireChangeEndedEvent_(true);
    },

    /**
     * Dispatches a simple event to tell subscribers we're done moving to the
     * newly selected card.
     * @param {boolean} wasAnimated whether or not the change was animated.
     * @private
     */
    fireChangeEndedEvent_: function(wasAnimated) {
      var e = document.createEvent('Event');
      e.initEvent('cardSlider:card_change_ended', true, true);
      e.cardSlider = this;
      e.changedTo = this.currentCard_;
      e.wasAnimated = wasAnimated;
      this.container_.dispatchEvent(e);
    },

    /**
     * Add a card to the card slider at a particular index. If the card being
     * added is inserted in front of the current card, cardSlider.currentCard
     * will be adjusted accordingly (to current card + 1).
     * @param {!Node} card A card that will be added to the card slider.
     * @param {number} index An index at which the given |card| should be
     *     inserted. Must be positive and less than the number of cards.
     */
    addCardAtIndex: function(card, index) {
      assert(card instanceof Node, '|card| isn\'t a Node');
      this.assertValidIndex_(index);
      this.cards_ = Array.prototype.concat.call(
          this.cards_.slice(0, index), card, this.cards_.slice(index));

      this.updateSelectedCardAttributes_();

      if (this.currentCard_ == -1)
        this.currentCard_ = 0;
      else if (index <= this.currentCard_)
        this.selectCard(this.currentCard_ + 1, false, true, true);

      this.fireAddedEvent_(card, index);
    },

    /**
     * Append a card to the end of the list.
     * @param {!Node} card A card to add at the end of the card slider.
     */
    appendCard: function(card) {
      assert(card instanceof Node, '|card| isn\'t a Node');
      this.cards_.push(card);
      this.fireAddedEvent_(card, this.cards_.length - 1);
    },

    /**
     * Dispatches a simple event to tell interested subscribers that a card was
     * added to this card slider.
     * @param {Node} card The recently added card.
     * @param {number} index The position of the newly added card.
     * @private
     */
    fireAddedEvent_: function(card, index) {
      this.assertValidIndex_(index);
      var e = document.createEvent('Event');
      e.initEvent('cardSlider:card_added', true, true);
      e.addedIndex = index;
      e.addedCard = card;
      this.container_.dispatchEvent(e);
    },

    /**
     * Returns the card at a particular index.
     * @param {number} index The index of the card to return.
     * @return {!Element} The card at the given index.
     */
    getCardAtIndex: function(index) {
      this.assertValidIndex_(index);
      return this.cards_[index];
    },

    /**
     * Removes a card by index from the card slider. If the card to be removed
     * is the current card or in front of the current card, the current card
     * will be updated (to current card - 1).
     * @param {!Node} card A card to be removed.
     */
    removeCard: function(card) {
      assert(card instanceof Node, '|card| isn\'t a Node');
      this.removeCardAtIndex(this.cards_.indexOf(card));
    },

    /**
     * Removes a card by index from the card slider. If the card to be removed
     * is the current card or in front of the current card, the current card
     * will be updated (to current card - 1).
     * @param {number} index The index of the tile that should be removed.
     */
    removeCardAtIndex: function(index) {
      this.assertValidIndex_(index);
      var removed = this.cards_.splice(index, 1).pop();

      if (this.cards_.length == 0)
        this.currentCard_ = -1;
      else if (index < this.currentCard_)
        this.selectCard(this.currentCard_ - 1, false, true);

      this.fireRemovedEvent_(removed, index);
    },

    /**
     * Dispatches a cardSlider:card_removed event so interested subscribers know
     * when a card was removed from this card slider.
     * @param {Node} card The recently removed card.
     * @param {number} index The index of the card before it was removed.
     * @private
     */
    fireRemovedEvent_: function(card, index) {
      var e = document.createEvent('Event');
      e.initEvent('cardSlider:card_removed', true, true);
      e.removedCard = card;
      e.removedIndex = index;
      this.container_.dispatchEvent(e);
    },

    /**
     * This re-syncs the -webkit-transform that's used to position the frame in
     * the likely event it needs to be updated by a card being inserted or
     * removed in the flow.
     */
    repositionFrame: function() {
      this.transformToCurrentCard_();
    },

    /**
     * Checks the the given |index| exists in this.cards_.
     * @param {number} index An index to check.
     * @private
     */
    assertValidIndex_: function(index) {
      assert(index >= 0 && index < this.cards_.length);
    },

    /**
     * Selects a new card, ensuring that it is a valid index, transforming the
     * view and possibly calling the change card callback.
     * @param {number} newCardIndex Index of card to show.
     * @param {boolean=} opt_animate If true will animate transition from
     *     current position to new position.
     * @param {boolean=} opt_dontNotify If true, don't tell subscribers that
     *     we've changed cards.
     * @param {boolean=} opt_forceChange If true, ignore if the card already
     *     selected.
     */
    selectCard: function(newCardIndex,
                         opt_animate,
                         opt_dontNotify,
                         opt_forceChange) {
      this.assertValidIndex_(newCardIndex);

      var previousCard = this.currentCardValue;
      var isChangingCard =
          !this.cards_[newCardIndex].classList.contains('selected-card');

      if (typeof opt_forceChange != 'undefined' && opt_forceChange)
        isChangingCard = true;

      if (isChangingCard) {
        this.currentCard_ = newCardIndex;
        this.updateSelectedCardAttributes_();
      }

      var willTransitionHappen = this.transformToCurrentCard_(opt_animate);

      if (isChangingCard && !opt_dontNotify) {
        var event = document.createEvent('Event');
        event.initEvent('cardSlider:card_changed', true, true);
        event.cardSlider = this;
        event.wasAnimated = !!opt_animate;
        this.container_.dispatchEvent(event);

        // We also dispatch an event on the cards themselves.
        if (previousCard) {
          cr.dispatchSimpleEvent(previousCard, 'carddeselected',
                                 true, true);
        }
        cr.dispatchSimpleEvent(this.currentCardValue, 'cardselected',
                               true, true);
      }

      // If we're not changing, animated, or transitioning, fire a
      // cardSlider:card_change_ended event right away.
      if ((!isChangingCard || !opt_animate || !willTransitionHappen) &&
          !opt_dontNotify) {
        this.fireChangeEndedEvent_(false);
      }
    },

    /**
     * Selects a card from the stack. Passes through to selectCard.
     * @param {Node} newCard The card that should be selected.
     * @param {boolean=} opt_animate Whether to animate.
     */
    selectCardByValue: function(newCard, opt_animate) {
      var i = this.cards_.indexOf(newCard);
      assert(i != -1);
      this.selectCard(i, opt_animate);
    },

    /**
     * Centers the view on the card denoted by this.currentCard. Can either
     * animate to that card or snap to it.
     * @param {boolean=} opt_animate If true will animate transition from
     *     current position to new position.
     * @return {boolean} Whether or not a transformation was necessary.
     * @private
     */
    transformToCurrentCard_: function(opt_animate) {
      var prevLeft = this.currentLeft_;
      this.currentLeft_ = -this.cardWidth_ *
          (isRTL() ? this.cards_.length - this.currentCard - 1 :
                     this.currentCard);

      // If there's no change, return something to let the caller know there
      // won't be a transition occuring.
      if (prevLeft == this.currentLeft_ && this.deltaX_ == 0)
        return false;

      // Animate to the current card, which will either transition if the
      // current card is new, or reset the existing card if we didn't drag
      // enough to change cards.
      var transition = '';
      if (opt_animate) {
        transition = '-webkit-transform ' + CardSlider.TRANSITION_TIME_ +
                     'ms ease-in-out';
      }
      this.container_.style.WebkitTransition = transition;
      this.translateTo_(this.currentLeft_);

      return true;
    },

    /**
     * Moves the view to the specified position.
     * @param {number} x Horizontal position to move to.
     * @private
     */
    translateTo_: function(x) {
      // We use a webkitTransform to slide because this is GPU accelerated on
      // Chrome and iOS.  Once Chrome does GPU acceleration on the position
      // fixed-layout elements we could simply set the element's position to
      // fixed and modify 'left' instead.
      this.deltaX_ = x - this.currentLeft_;
      this.container_.style.WebkitTransform = 'translate3d(' + x + 'px, 0, 0)';
    },

    /* Touch ******************************************************************/

    /**
     * Clear any transition that is in progress and enable dragging for the
     * touch.
     * @param {!cr.ui.TouchHandler.Event} e The TouchHandler event.
     * @private
     */
    onTouchStart_: function(e) {
      this.container_.style.WebkitTransition = '';
      e.enableDrag = true;
    },

    /**
     * Tell the TouchHandler that dragging is acceptable when the user begins by
     * scrolling horizontally and there is more than one card to slide.
     * @param {!cr.ui.TouchHandler.Event} e The TouchHandler event.
     * @private
     */
    onDragStart_: function(e) {
      e.enableDrag = this.cardCount > 1 && Math.abs(e.dragDeltaX) >
          Math.abs(e.dragDeltaY);
    },

    /**
     * On each drag move event reposition the container appropriately so the
     * cards look like they are sliding.
     * @param {!cr.ui.TouchHandler.Event} e The TouchHandler event.
     * @private
     */
    onDragMove_: function(e) {
      var deltaX = e.dragDeltaX;
      // If dragging beyond the first or last card then apply a backoff so the
      // dragging feels stickier than usual.
      if (!this.currentCard && deltaX > 0 ||
          this.currentCard == (this.cards_.length - 1) && deltaX < 0) {
        deltaX /= 2;
      }
      this.translateTo_(this.currentLeft_ + deltaX);
    },

    /**
     * On drag end events we may want to transition to another card, depending
     * on the ending position of the drag and the velocity of the drag.
     * @param {!cr.ui.TouchHandler.Event} e The TouchHandler event.
     * @private
     */
    onDragEnd_: function(e) {
      var deltaX = e.dragDeltaX;
      var velocity = this.touchHandler_.getEndVelocity().x;
      var newX = this.currentLeft_ + deltaX;
      var newCardIndex = Math.round(-newX / this.cardWidth_);

      if (newCardIndex == this.currentCard && Math.abs(velocity) >
          CardSlider.TRANSITION_VELOCITY_THRESHOLD_) {
        // The drag wasn't far enough to change cards but the velocity was
        // high enough to transition anyways. If the velocity is to the left
        // (negative) then the user wishes to go right (card + 1).
        newCardIndex += velocity > 0 ? -1 : 1;
      }
      // Ensure that the new card index is valid.  The new card index could be
      // invalid if a swipe suggests scrolling off the end of the list of
      // cards.
      if (newCardIndex < 0)
        newCardIndex = 0;
      else if (newCardIndex >= this.cardCount)
        newCardIndex = this.cardCount - 1;
      this.selectCard(newCardIndex, /* animate */ true);
    },

    /**
     * Cancel any current touch/slide as if we saw a touch end
     */
    cancelTouch: function() {
      // Stop listening to any current touch
      this.touchHandler_.cancelTouch();

      // Ensure we're at a card bounary
      this.transformToCurrentCard_(true);
    },
  };

  return {
    CardSlider: CardSlider
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// require: event_target.js

cr.define('cr.ui', function() {
  /** @const */ var EventTarget = cr.EventTarget;
  /** @const */ var Menu = cr.ui.Menu;

  /**
   * Handles context menus.
   * @constructor
   * @extends {EventTarget}
   */
  function ContextMenuHandler() {
    this.showingEvents_ = new EventTracker();
  }

  ContextMenuHandler.prototype = {
    __proto__: EventTarget.prototype,

    /**
     * The menu that we are currently showing.
     * @type {cr.ui.Menu}
     */
    menu_: null,
    get menu() {
      return this.menu_;
    },

    /**
     * Shows a menu as a context menu.
     * @param {!Event} e The event triggering the show (usually a contextmenu
     *     event).
     * @param {!cr.ui.Menu} menu The menu to show.
     */
    showMenu: function(e, menu) {
      menu.updateCommands(e.currentTarget);
      if (!menu.hasVisibleItems())
        return;

      this.menu_ = menu;
      menu.classList.remove('hide-delayed');
      menu.hidden = false;
      menu.contextElement = e.currentTarget;

      // When the menu is shown we steal a lot of events.
      var doc = menu.ownerDocument;
      var win = doc.defaultView;
      this.showingEvents_.add(doc, 'keydown', this, true);
      this.showingEvents_.add(doc, 'mousedown', this, true);
      this.showingEvents_.add(doc, 'focus', this);
      this.showingEvents_.add(win, 'popstate', this);
      this.showingEvents_.add(win, 'resize', this);
      this.showingEvents_.add(win, 'blur', this);
      this.showingEvents_.add(menu, 'contextmenu', this);
      this.showingEvents_.add(menu, 'activate', this);
      this.positionMenu_(e, menu);

      var ev = new Event('show');
      ev.element = menu.contextElement;
      ev.menu = menu;
      this.dispatchEvent(ev);
    },

    /**
     * Hide the currently shown menu.
     * @param {HideType=} opt_hideType Type of hide.
     *     default: cr.ui.HideType.INSTANT.
     */
    hideMenu: function(opt_hideType) {
      var menu = this.menu;
      if (!menu)
        return;

      if (opt_hideType == cr.ui.HideType.DELAYED)
        menu.classList.add('hide-delayed');
      else
        menu.classList.remove('hide-delayed');
      menu.hidden = true;
      var originalContextElement = menu.contextElement;
      menu.contextElement = null;
      this.showingEvents_.removeAll();
      menu.selectedIndex = -1;
      this.menu_ = null;

      // On windows we might hide the menu in a right mouse button up and if
      // that is the case we wait some short period before we allow the menu
      // to be shown again.
      this.hideTimestamp_ = cr.isWindows ? Date.now() : 0;

      var ev = new Event('hide');
      ev.element = menu.contextElement;
      ev.menu = menu;
      this.dispatchEvent(ev);
    },

    /**
     * Positions the menu
     * @param {!Event} e The event object triggering the showing.
     * @param {!cr.ui.Menu} menu The menu to position.
     * @private
     */
    positionMenu_: function(e, menu) {
      // TODO(arv): Handle scrolled documents when needed.

      var element = e.currentTarget;
      var x, y;
      // When the user presses the context menu key (on the keyboard) we need
      // to detect this.
      if (this.keyIsDown_) {
        var rect = element.getRectForContextMenu ?
                       element.getRectForContextMenu() :
                       element.getBoundingClientRect();
        var offset = Math.min(rect.width, rect.height) / 2;
        x = rect.left + offset;
        y = rect.top + offset;
      } else {
        x = e.clientX;
        y = e.clientY;
      }

      cr.ui.positionPopupAtPoint(x, y, menu);
    },

    /**
     * Handles event callbacks.
     * @param {!Event} e The event object.
     */
    handleEvent: function(e) {
      // Keep track of keydown state so that we can use that to determine the
      // reason for the contextmenu event.
      switch (e.type) {
        case 'keydown':
          this.keyIsDown_ = !e.ctrlKey && !e.altKey &&
              // context menu key or Shift-F10
              (e.keyCode == 93 && !e.shiftKey ||
               e.keyIdentifier == 'F10' && e.shiftKey);
          break;

        case 'keyup':
          this.keyIsDown_ = false;
          break;
      }

      // Context menu is handled even when we have no menu.
      if (e.type != 'contextmenu' && !this.menu)
        return;

      switch (e.type) {
        case 'mousedown':
          if (!this.menu.contains(e.target))
            this.hideMenu();
          else
            e.preventDefault();
          break;
        case 'keydown':
          // keyIdentifier does not report 'Esc' correctly
          if (e.keyCode == 27 /* Esc */) {
            this.hideMenu();
            e.stopPropagation();
            e.preventDefault();

          // If the menu is visible we let it handle all the keyboard events.
          } else if (this.menu) {
            this.menu.handleKeyDown(e);
            e.preventDefault();
            e.stopPropagation();
          }
          break;

        case 'activate':
          var hideDelayed = e.target instanceof cr.ui.MenuItem &&
              e.target.checkable;
          this.hideMenu(hideDelayed ? cr.ui.HideType.DELAYED :
                                      cr.ui.HideType.INSTANT);
          break;

        case 'focus':
          if (!this.menu.contains(e.target))
            this.hideMenu();
          break;

        case 'blur':
          this.hideMenu();
          break;

        case 'popstate':
        case 'resize':
          this.hideMenu();
          break;

        case 'contextmenu':
          if ((!this.menu || !this.menu.contains(e.target)) &&
              (!this.hideTimestamp_ || Date.now() - this.hideTimestamp_ > 50))
            this.showMenu(e, e.currentTarget.contextMenu);
          e.preventDefault();
          // Don't allow elements further up in the DOM to show their menus.
          e.stopPropagation();
          break;
      }
    },

    /**
     * Adds a contextMenu property to an element or element class.
     * @param {!Element|!Function} element The element or class to add the
     *     contextMenu property to.
     */
    addContextMenuProperty: function(element) {
      if (typeof element == 'function')
        element = element.prototype;

      element.__defineGetter__('contextMenu', function() {
        return this.contextMenu_;
      });
      element.__defineSetter__('contextMenu', function(menu) {
        var oldContextMenu = this.contextMenu;

        if (typeof menu == 'string' && menu[0] == '#') {
          menu = this.ownerDocument.getElementById(menu.slice(1));
          cr.ui.decorate(menu, Menu);
        }

        if (menu === oldContextMenu)
          return;

        if (oldContextMenu && !menu) {
          this.removeEventListener('contextmenu', contextMenuHandler);
          this.removeEventListener('keydown', contextMenuHandler);
          this.removeEventListener('keyup', contextMenuHandler);
        }
        if (menu && !oldContextMenu) {
          this.addEventListener('contextmenu', contextMenuHandler);
          this.addEventListener('keydown', contextMenuHandler);
          this.addEventListener('keyup', contextMenuHandler);
        }

        this.contextMenu_ = menu;

        if (menu && menu.id)
          this.setAttribute('contextmenu', '#' + menu.id);

        cr.dispatchPropertyChange(this, 'contextMenu', menu, oldContextMenu);
      });

      if (!element.getRectForContextMenu) {
        /**
         * @return {!ClientRect} The rect to use for positioning the context
         *     menu when the context menu is not opened using a mouse position.
         */
        element.getRectForContextMenu = function() {
          return this.getBoundingClientRect();
        };
      }
    },

    /**
     * Sets the given contextMenu to the given element. A contextMenu property
     * would be added if necessary.
     * @param {!Element} element The element or class to set the contextMenu to.
     * @param {!cr.ui.Menu} contextMenu The contextMenu property to be set.
     */
    setContextMenu: function(element, contextMenu) {
      if (!element.contextMenu)
        this.addContextMenuProperty(element);
      element.contextMenu = contextMenu;
    }
  };

  /**
   * The singleton context menu handler.
   * @type {!ContextMenuHandler}
   */
  var contextMenuHandler = new ContextMenuHandler;

  // Export
  return {
    contextMenuHandler: contextMenuHandler,
  };
});

// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview DragWrapper
 * A class for simplifying HTML5 drag and drop. Classes should use this to
 * handle the nitty gritty of nested drag enters and leaves.
 */
cr.define('cr.ui', function() {
  /**
   * Creates a DragWrapper which listens for drag target events on |target| and
   * delegates event handling to |handler|. The |handler| must implement:
   *   shouldAcceptDrag
   *   doDragEnter
   *   doDragLeave
   *   doDragOver
   *   doDrop
   */
  function DragWrapper(target, handler) {
    this.initialize(target, handler);
  }

  DragWrapper.prototype = {
    initialize: function(target, handler) {
      target.addEventListener('dragenter',
                              this.onDragEnter_.bind(this));
      target.addEventListener('dragover', this.onDragOver_.bind(this));
      target.addEventListener('drop', this.onDrop_.bind(this));
      target.addEventListener('dragleave', this.onDragLeave_.bind(this));

      this.target_ = target;
      this.handler_ = handler;
    },

    /**
     * The number of un-paired dragenter events that have fired on |this|. This
     * is incremented by |onDragEnter_| and decremented by |onDragLeave_|. This
     * is necessary because dragging over child widgets will fire additional
     * enter and leave events on |this|. A non-zero value does not necessarily
     * indicate that |isCurrentDragTarget()| is true.
     * @type {number}
     * @private
     */
    dragEnters_: 0,

    /**
     * Whether the tile page is currently being dragged over with data it can
     * accept.
     * @type {boolean}
     */
    get isCurrentDragTarget() {
      return this.target_.classList.contains('drag-target');
    },

    /**
     * Handler for dragenter events fired on |target_|.
     * @param {Event} e A MouseEvent for the drag.
     * @private
     */
    onDragEnter_: function(e) {
      if (++this.dragEnters_ == 1) {
        if (this.handler_.shouldAcceptDrag(e)) {
          this.target_.classList.add('drag-target');
          this.handler_.doDragEnter(e);
        }
      } else {
        // Sometimes we'll get an enter event over a child element without an
        // over event following it. In this case we have to still call the
        // drag over handler so that we make the necessary updates (one visible
        // symptom of not doing this is that the cursor's drag state will
        // flicker during drags).
        this.onDragOver_(e);
      }
    },

    /**
     * Thunk for dragover events fired on |target_|.
     * @param {Event} e A MouseEvent for the drag.
     * @private
     */
    onDragOver_: function(e) {
      if (!this.target_.classList.contains('drag-target'))
        return;
      this.handler_.doDragOver(e);
    },

    /**
     * Thunk for drop events fired on |target_|.
     * @param {Event} e A MouseEvent for the drag.
     * @private
     */
    onDrop_: function(e) {
      this.dragEnters_ = 0;
      if (!this.target_.classList.contains('drag-target'))
        return;
      this.target_.classList.remove('drag-target');
      this.handler_.doDrop(e);
    },

    /**
     * Thunk for dragleave events fired on |target_|.
     * @param {Event} e A MouseEvent for the drag.
     * @private
     */
    onDragLeave_: function(e) {
      if (--this.dragEnters_ > 0)
        return;

      this.target_.classList.remove('drag-target');
      this.handler_.doDragLeave(e);
    },
  };

  return {
    DragWrapper: DragWrapper
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// require: event_tracker.js

cr.define('cr.ui', function() {
  'use strict';

  /**
   * ExpandableBubble is a free-floating compact informational bubble with an
   * arrow that points at a place of interest on the page. When clicked, the
   * bubble expands to show more of its content. Width of the bubble is the
   * width of the node it is overlapping when unexpanded. Expanded, it is of a
   * fixed width, but variable height. Currently the arrow is always positioned
   * at the bottom right and points down.
   * @constructor
   * @extends {cr.ui.div}
   */
  var ExpandableBubble = cr.ui.define('div');

  ExpandableBubble.prototype = {
    __proto__: HTMLDivElement.prototype,

    /** @override */
    decorate: function() {
      this.className = 'expandable-bubble';
      this.innerHTML =
          '<div class="expandable-bubble-contents">' +
            '<div class="expandable-bubble-title"></div>' +
            '<div class="expandable-bubble-main" hidden></div>' +
          '</div>' +
          '<div class="expandable-bubble-close" hidden></div>';

      this.hidden = true;
      this.bubbleSuppressed = false;
      this.handleCloseEvent = this.hide;
    },

    /**
     * Sets the title of the bubble. The title is always visible when the
     * bubble is visible.
     * @type {Node} An HTML element to set as the title.
     */
    set contentTitle(node) {
      var bubbleTitle = this.querySelector('.expandable-bubble-title');
      bubbleTitle.textContent = '';
      bubbleTitle.appendChild(node);
    },

    /**
     * Sets the content node of the bubble. The content node is only visible
     * when the bubble is expanded.
     * @param {Node} An HTML element.
     */
    set content(node) {
      var bubbleMain = this.querySelector('.expandable-bubble-main');
      bubbleMain.textContent = '';
      bubbleMain.appendChild(node);
    },

    /**
     * Sets the anchor node, i.e. the node that this bubble points at and
     * partially overlaps.
     * @param {HTMLElement} node The new anchor node.
     */
    set anchorNode(node) {
      this.anchorNode_ = node;

      if (!this.hidden)
        this.resizeAndReposition();
    },

    /**
     * Handles the close event which is triggered when the close button
     * is clicked. By default is set to this.hide.
     * @param {function} A function with no parameters
     */
    set handleCloseEvent(func) {
      this.handleCloseEvent_ = func;
    },

    /**
     * Temporarily suppresses the bubble from view (and toggles it back).
     * 'Suppressed' and 'hidden' are two bubble states that both indicate that
     * the bubble should not be visible, but when you 'un-suppress' a bubble,
     * only a suppressed bubble becomes visible. This can be handy, for example,
     * if the user switches away from the app card (then we need to know which
     * bubbles to show (only the suppressed ones, not the hidden ones). Hiding
     * and un-hiding a bubble overrides the suppressed state (a bubble cannot
     * be suppressed but not hidden).
     */
    set suppressed(suppress) {
      if (suppress) {
        // If the bubble is already hidden, then we don't need to suppress it.
        if (this.hidden)
          return;

        this.hidden = true;
      } else if (this.bubbleSuppressed) {
        this.hidden = false;
      }
      this.bubbleSuppressed = suppress;
      this.resizeAndReposition(this);
    },

    /**
     * Updates the position of the bubble.
     * @private
     */
    reposition_: function() {
      var clientRect = this.anchorNode_.getBoundingClientRect();

      // Center bubble in collapsed mode (if it doesn't take up all the room we
      // have).
      var offset = 0;
      if (!this.expanded)
        offset = (clientRect.width - parseInt(this.style.width)) / 2;
      this.style.left = this.style.right = clientRect.left + offset + 'px';

      var top = Math.max(0, clientRect.top - 4);
      this.style.top = this.expanded ?
          (top - this.offsetHeight + this.unexpandedHeight) + 'px' :
          top + 'px';
    },

    /**
     * Resizes the bubble and then repositions it.
     * @private
     */
    resizeAndReposition: function() {
      var clientRect = this.anchorNode_.getBoundingClientRect();
      var width = clientRect.width;

      var bubbleTitle = this.querySelector('.expandable-bubble-title');
      var closeElement = this.querySelector('.expandable-bubble-close');
      var closeWidth = this.expanded ? closeElement.clientWidth : 0;
      var margin = 15;

      // Suppress the width style so we can get it to calculate its width.
      // We'll set the right width again when we are done.
      bubbleTitle.style.width = '';

      if (this.expanded) {
        // We always show the full title but never show less width than 250
        // pixels.
        var expandedWidth =
            Math.max(250, bubbleTitle.scrollWidth + closeWidth + margin);
        this.style.marginLeft = (width - expandedWidth) + 'px';
        width = expandedWidth;
      } else {
        var newWidth = Math.min(bubbleTitle.scrollWidth + margin, width);
        // If we've maxed out in width then apply the mask.
        this.masked = newWidth == width;
        width = newWidth;
        this.style.marginLeft = '0';
      }

      // Width is determined by the width of the title (when not expanded) but
      // capped to the width of the anchor node.
      this.style.width = width + 'px';
      bubbleTitle.style.width = Math.max(0, width - margin - closeWidth) + 'px';

      // Also reposition the bubble -- dimensions have potentially changed.
      this.reposition_();
    },

    /*
     * Expand the bubble (bringing the full content into view).
     * @private
     */
    expandBubble_: function() {
      this.querySelector('.expandable-bubble-main').hidden = false;
      this.querySelector('.expandable-bubble-close').hidden = false;
      this.expanded = true;
      this.resizeAndReposition();
    },

    /**
     * Collapse the bubble, hiding the main content and the close button.
     * This is automatically called when the window is resized.
     * @private
     */
    collapseBubble_: function() {
      this.querySelector('.expandable-bubble-main').hidden = true;
      this.querySelector('.expandable-bubble-close').hidden = true;
      this.expanded = false;
      this.resizeAndReposition();
    },

    /**
     * The onclick handler for the notification (expands the bubble).
     * @param {Event} e The event.
     * @private
     */
    onNotificationClick_: function(e) {
      if (!this.contains(e.target))
        return;

      if (!this.expanded) {
        // Save the height of the unexpanded bubble, so we can make sure to
        // position it correctly (arrow points in the same location) after
        // we expand it.
        this.unexpandedHeight = this.offsetHeight;
      }

      this.expandBubble_();
    },

    /**
     * Shows the bubble. The bubble will start collapsed and expand when
     * clicked.
     */
    show: function() {
      if (!this.hidden)
        return;

      document.body.appendChild(this);
      this.hidden = false;
      this.resizeAndReposition();

      this.eventTracker_ = new EventTracker;
      this.eventTracker_.add(window,
                             'load', this.resizeAndReposition.bind(this));
      this.eventTracker_.add(window,
                             'resize', this.resizeAndReposition.bind(this));
      this.eventTracker_.add(this, 'click', this.onNotificationClick_);

      var doc = this.ownerDocument;
      this.eventTracker_.add(doc, 'keydown', this, true);
      this.eventTracker_.add(doc, 'mousedown', this, true);
    },

    /**
     * Hides the bubble from view.
     */
    hide: function() {
      this.hidden = true;
      this.bubbleSuppressed = false;
      this.eventTracker_.removeAll();
      this.parentNode.removeChild(this);
    },

    /**
     * Handles keydown and mousedown events, dismissing the bubble if
     * necessary.
     * @param {Event} e The event.
     * @private
     */
    handleEvent: function(e) {
      var handled = false;
      switch (e.type) {
        case 'keydown':
          if (e.keyCode == 27) {  // Esc.
            if (this.expanded) {
              this.collapseBubble_();
              handled = true;
            }
          }
          break;

        case 'mousedown':
          if (e.target == this.querySelector('.expandable-bubble-close')) {
            this.handleCloseEvent_();
            handled = true;
          } else if (!this.contains(e.target)) {
            if (this.expanded) {
              this.collapseBubble_();
              handled = true;
            }
          }
          break;
      }

      if (handled) {
        // The bubble emulates a focus grab when expanded, so when we've
        // collapsed/hide the bubble we consider the event handles and don't
        // need to propagate it further.
        e.stopPropagation();
        e.preventDefault();
      }
    },
  };

  /**
   * Whether the bubble is expanded or not.
   * @type {boolean}
   */
  cr.defineProperty(ExpandableBubble, 'expanded', cr.PropertyKind.BOOL_ATTR);

  /**
   * Whether the title needs to be masked out towards the right, which indicates
   * to the user that part of the text is clipped. This is only used when the
   * bubble is collapsed and the title doesn't fit because it is maxed out in
   * width within the anchored node.
   * @type {boolean}
   */
  cr.defineProperty(ExpandableBubble, 'masked', cr.PropertyKind.BOOL_ATTR);

  return {
    ExpandableBubble: ExpandableBubble
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('cr.ui', function() {
  /**
   * Constructor for FocusManager singleton. Checks focus of elements to ensure
   * that elements in "background" pages (i.e., those in a dialog that is not
   * the topmost overlay) do not receive focus.
   * @constructor
   */
  function FocusManager() {
  }

  FocusManager.prototype = {
    /**
     * Whether focus is being transferred backward or forward through the DOM.
     * @type {boolean}
     * @private
     */
    focusDirBackwards_: false,

    /**
     * Determines whether the |child| is a descendant of |parent| in the page's
     * DOM.
     * @param {Element} parent The parent element to test.
     * @param {Element} child The child element to test.
     * @return {boolean} True if |child| is a descendant of |parent|.
     * @private
     */
    isDescendantOf_: function(parent, child) {
      var current = child;

      while (current) {
        current = current.parentNode;
        if (typeof(current) == 'undefined' ||
            typeof(current) == 'null' ||
            current === document.body) {
          return false;
        } else if (current === parent) {
          return true;
        }
      }

      return false;
    },

    /**
     * Returns the parent element containing all elements which should be
     * allowed to receive focus.
     * @return {Element} The element containing focusable elements.
     */
    getFocusParent: function() {
      return document.body;
    },

    /**
     * Returns the elements on the page capable of receiving focus.
     * @return {Array.Element} The focusable elements.
     */
    getFocusableElements_: function() {
      var focusableDiv = this.getFocusParent();

      // Create a TreeWalker object to traverse the DOM from |focusableDiv|.
      var treeWalker = document.createTreeWalker(
          focusableDiv,
          NodeFilter.SHOW_ELEMENT,
          { acceptNode: function(node) {
              var style = window.getComputedStyle(node);
              // Reject all hidden nodes. FILTER_REJECT also rejects these
              // nodes' children, so non-hidden elements that are descendants of
              // hidden <div>s will correctly be rejected.
              if (node.hidden || style.display == 'none' ||
                  style.visibility == 'hidden') {
                return NodeFilter.FILTER_REJECT;
              }

              // Skip nodes that cannot receive focus. FILTER_SKIP does not
              // cause this node's children also to be skipped.
              if (node.disabled || node.tabIndex < 0)
                return NodeFilter.FILTER_SKIP;

              // Accept nodes that are non-hidden and focusable.
              return NodeFilter.FILTER_ACCEPT;
            }
          },
          false);

      var focusable = [];
      while (treeWalker.nextNode())
        focusable.push(treeWalker.currentNode);

      return focusable;
    },

    /**
     * Dispatches an 'elementFocused' event to notify an element that it has
     * received focus. When focus wraps around within the a page, only the
     * element that has focus after the wrapping receives an 'elementFocused'
     * event. This differs from the native 'focus' event which is received by
     * an element outside the page first, followed by a 'focus' on an element
     * within the page after the FocusManager has intervened.
     * @param {Element} element The element that has received focus.
     * @private
     */
    dispatchFocusEvent_: function(element) {
      cr.dispatchSimpleEvent(element, 'elementFocused', true, false);
    },

    /**
     * Attempts to focus the appropriate element in the current dialog.
     * @private
     */
    setFocus_: function() {
      // If |this.focusDirBackwards_| is true, the user has pressed "Shift+Tab"
      // and has caused the focus to be transferred backward, outside of the
      // current dialog. In this case, loop around and try to focus the last
      // element of the dialog; otherwise, try to focus the first element of the
      // dialog.
      var focusableElements = this.getFocusableElements_();
      var element = this.focusDirBackwards_ ? focusableElements.pop() :
                                              focusableElements.shift();
      if (element) {
        element.focus();
        this.dispatchFocusEvent_(element);
      }
    },

    /**
     * Attempts to focus the first element in the current dialog.
     */
    focusFirstElement: function() {
      this.focusFirstElement_();
    },

    /**
     * Handler for focus events on the page.
     * @param {Event} event The focus event.
     * @private
     */
    onDocumentFocus_: function(event) {
      // If the element being focused is a descendant of the currently visible
      // page, focus is valid.
      if (this.isDescendantOf_(this.getFocusParent(), event.target)) {
        this.dispatchFocusEvent_(event.target);
        return;
      }

      // The target of the focus event is not in the topmost visible page and
      // should not be focused.
      event.target.blur();

      // Attempt to wrap around focus within the current page.
      this.setFocus_();
    },

    /**
     * Handler for keydown events on the page.
     * @param {Event} event The keydown event.
     * @private
     */
    onDocumentKeyDown_: function(event) {
      /** @const */ var tabKeyCode = 9;

      if (event.keyCode == tabKeyCode) {
        // If the "Shift" key is held, focus is being transferred backward in
        // the page.
        this.focusDirBackwards_ = event.shiftKey ? true : false;
      }
    },

    /**
     * Initializes the FocusManager by listening for events in the document.
     */
    initialize: function() {
      document.addEventListener('focus', this.onDocumentFocus_.bind(this),
          true);
      document.addEventListener('keydown', this.onDocumentKeyDown_.bind(this),
          true);
    },
  };

  /**
   * Disable mouse-focus for button controls.
   * Button form controls are mouse-focusable since Chromium 30.  We want the
   * old behavior in some WebUI pages.
   */
  FocusManager.disableMouseFocusOnButtons = function() {
    document.addEventListener('mousedown', function(event) {
      var node = event.target;
      var tagName = node.tagName;
      if (tagName != 'BUTTON' && tagName != 'INPUT') {
        do {
          node = node.parentNode;
          if (!node || node.nodeType != Node.ELEMENT_NODE)
            return;
        } while (node.tagName != 'BUTTON');
      }
      var type = node.type;
      if (type == 'button' || type == 'reset' || type == 'submit' ||
          type == 'radio' || type == 'checkbox') {
        if (document.activeElement != node)
          document.activeElement.blur();

        // Focus the current window so that if the active element is in another
        // window, it is deactivated.
        window.focus();
        event.preventDefault();
      }
    }, false);
  };

  return {
    FocusManager: FocusManager,
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('cr.ui', function() {

  /** @const */ var MenuItem = cr.ui.MenuItem;

  /**
   * Creates a new menu element. Menu dispatches all commands on the element it
   * was shown for.
   *
   * @param {Object=} opt_propertyBag Optional properties.
   * @constructor
   * @extends {HTMLMenuElement}
   */
  var Menu = cr.ui.define('menu');

  Menu.prototype = {
    __proto__: HTMLMenuElement.prototype,

    selectedIndex_: -1,

    /**
     * Element for which menu is being shown.
     */
    contextElement: null,

    /**
     * Selector for children which are menu items.
     */
    menuItemSelector: '*',

    /**
     * Initializes the menu element.
     */
    decorate: function() {
      this.addEventListener('mouseover', this.handleMouseOver_);
      this.addEventListener('mouseout', this.handleMouseOut_);

      this.classList.add('decorated');
      this.setAttribute('role', 'menu');
      this.hidden = true;  // Hide the menu by default.

      // Decorate the children as menu items.
      var menuItems = this.menuItems;
      for (var i = 0, menuItem; menuItem = menuItems[i]; i++) {
        cr.ui.decorate(menuItem, MenuItem);
      }
    },

    /**
     * Adds menu item at the end of the list.
     * @param {Object} item Menu item properties.
     * @return {cr.ui.MenuItem} The created menu item.
     */
    addMenuItem: function(item) {
      var menuItem = this.ownerDocument.createElement('menuitem');
      this.appendChild(menuItem);

      cr.ui.decorate(menuItem, MenuItem);

      if (item.label)
        menuItem.label = item.label;

      if (item.iconUrl)
        menuItem.iconUrl = item.iconUrl;

      return menuItem;
    },

    /**
     * Adds separator at the end of the list.
     */
    addSeparator: function() {
      var separator = this.ownerDocument.createElement('hr');
      cr.ui.decorate(separator, MenuItem);
      this.appendChild(separator);
    },

    /**
     * Clears menu.
     */
    clear: function() {
      this.textContent = '';
    },

    /**
     * Walks up the ancestors of |el| until a menu item belonging to this menu
     * is found.
     * @param {Element} el The element to start searching from.
     * @return {cr.ui.MenuItem} The found menu item or null.
     * @private
     */
    findMenuItem_: function(el) {
      while (el && el.parentNode != this) {
        el = el.parentNode;
      }
      return el;
    },

    /**
     * Handles mouseover events and selects the hovered item.
     * @param {Event} e The mouseover event.
     * @private
     */
    handleMouseOver_: function(e) {
      var overItem = this.findMenuItem_(e.target);
      this.selectedItem = overItem;
    },

    /**
     * Handles mouseout events and deselects any selected item.
     * @param {Event} e The mouseout event.
     * @private
     */
    handleMouseOut_: function(e) {
      this.selectedItem = null;
    },

    get menuItems() {
      return this.querySelectorAll(this.menuItemSelector);
    },

    /**
     * The selected menu item or null if none.
     * @type {cr.ui.MenuItem}
     */
    get selectedItem() {
      return this.menuItems[this.selectedIndex];
    },
    set selectedItem(item) {
      var index = Array.prototype.indexOf.call(this.menuItems, item);
      this.selectedIndex = index;
    },

    /**
     * Focuses the selected item. If selectedIndex is invalid, set it to 0
     * first.
     */
    focusSelectedItem: function() {
      if (this.selectedIndex < 0 ||
          this.selectedIndex > this.menuItems.length) {
        this.selectedIndex = 0;
      }

      if (this.selectedItem) {
        this.selectedItem.focus();
        this.setAttribute('aria-activedescendant', this.selectedItem.id);
      }
    },

    /**
     * Menu length
     */
    get length() {
      return this.menuItems.length;
    },

    /**
     * Returns if the menu has any visible item.
     * @return {boolean} True if the menu has visible item. Otherwise, false.
     */
    hasVisibleItems: function() {
      var menuItems = this.menuItems;  // Cache.
      for (var i = 0, menuItem; menuItem = menuItems[i]; i++) {
        if (!menuItem.hidden)
          return true;
      }
      return false;
    },

    /**
     * This is the function that handles keyboard navigation. This is usually
     * called by the element responsible for managing the menu.
     * @param {Event} e The keydown event object.
     * @return {boolean} Whether the event was handled be the menu.
     */
    handleKeyDown: function(e) {
      var item = this.selectedItem;

      var self = this;
      function selectNextAvailable(m) {
        var menuItems = self.menuItems;
        var len = menuItems.length;
        if (!len) {
          // Edge case when there are no items.
          return;
        }
        var i = self.selectedIndex;
        if (i == -1 && m == -1) {
          // Edge case when needed to go the last item first.
          i = 0;
        }

        // "i" may be negative(-1), so modulus operation and cycle below
        // wouldn't work as assumed. This trick makes startPosition positive
        // without altering it's modulo.
        var startPosition = (i + len) % len;

        while (true) {
          i = (i + m + len) % len;

          // Check not to enter into infinite loop if all items are hidden or
          // disabled.
          if (i == startPosition)
            break;

          item = menuItems[i];
          if (item && !item.isSeparator() && !item.hidden && !item.disabled)
            break;
        }
        if (item && !item.disabled)
          self.selectedIndex = i;
      }

      switch (e.keyIdentifier) {
        case 'Down':
          selectNextAvailable(1);
          this.focusSelectedItem();
          return true;
        case 'Up':
          selectNextAvailable(-1);
          this.focusSelectedItem();
          return true;
        case 'Enter':
        case 'U+0020': // Space
          if (item) {
            var activationEvent = cr.doc.createEvent('Event');
            activationEvent.initEvent('activate', true, true);
            activationEvent.originalEvent = e;
            if (item.dispatchEvent(activationEvent)) {
              if (item.command)
                item.command.execute();
            }
          }
          return true;
      }

      return false;
    },

    /**
     * Updates menu items command according to context.
     * @param {Node=} node Node for which to actuate commands state.
     */
    updateCommands: function(node) {
      var menuItems = this.menuItems;

      for (var i = 0, menuItem; menuItem = menuItems[i]; i++) {
        if (!menuItem.isSeparator())
          menuItem.updateCommand(node);
      }
    }
  };

  function selectedIndexChanged(selectedIndex, oldSelectedIndex) {
    var oldSelectedItem = this.menuItems[oldSelectedIndex];
    if (oldSelectedItem) {
      oldSelectedItem.selected = false;
      oldSelectedItem.blur();
    }
    var item = this.selectedItem;
    if (item)
      item.selected = true;
  }

  /**
   * The selected menu item.
   * @type {number}
   */
  cr.defineProperty(Menu, 'selectedIndex', cr.PropertyKind.JS,
      selectedIndexChanged);

  // Export
  return {
    Menu: Menu
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('cr.ui', function() {
  /** @const */ var Command = cr.ui.Command;

  /**
   * Creates a new menu item element.
   * @param {Object=} opt_propertyBag Optional properties.
   * @constructor
   * @extends {HTMLDivElement}
   */
  var MenuItem = cr.ui.define('div');

  /**
   * Creates a new menu separator element.
   * @return {cr.ui.MenuItem} The new separator element.
   */
  MenuItem.createSeparator = function() {
    var el = cr.doc.createElement('hr');
    MenuItem.decorate(el);
    return el;
  };

  MenuItem.prototype = {
    __proto__: HTMLButtonElement.prototype,

    /**
     * Initializes the menu item.
     */
    decorate: function() {
      var commandId;
      if ((commandId = this.getAttribute('command')))
        this.command = commandId;

      this.addEventListener('mouseup', this.handleMouseUp_);

      // Adding the 'custom-appearance' class prevents widgets.css from changing
      // the appearance of this element.
      this.classList.add('custom-appearance');

      // Enable Text to Speech on the menu. Additionaly, ID has to be set, since
      // it is used in element's aria-activedescendant attribute.
      if (!this.isSeparator())
        this.setAttribute('role', 'menuitem');

      var iconUrl;
      if ((iconUrl = this.getAttribute('icon')))
        this.iconUrl = iconUrl;
    },

    /**
     * The command associated with this menu item. If this is set to a string
     * of the form "#element-id" then the element is looked up in the document
     * of the command.
     * @type {cr.ui.Command}
     */
    command_: null,
    get command() {
      return this.command_;
    },
    set command(command) {
      if (this.command_) {
        this.command_.removeEventListener('labelChange', this);
        this.command_.removeEventListener('disabledChange', this);
        this.command_.removeEventListener('hiddenChange', this);
        this.command_.removeEventListener('checkedChange', this);
      }

      if (typeof command == 'string' && command[0] == '#') {
        command = this.ownerDocument.getElementById(command.slice(1));
        cr.ui.decorate(command, Command);
      }

      this.command_ = command;
      if (command) {
        if (command.id)
          this.setAttribute('command', '#' + command.id);

        if (typeof command.label === 'string')
          this.label = command.label;
        this.disabled = command.disabled;
        this.hidden = command.hidden;

        this.command_.addEventListener('labelChange', this);
        this.command_.addEventListener('disabledChange', this);
        this.command_.addEventListener('hiddenChange', this);
        this.command_.addEventListener('checkedChange', this);
      }

      this.updateShortcut_();
    },

    /**
     * The text label.
     * @type {string}
     */
    get label() {
      return this.textContent;
    },
    set label(label) {
      this.textContent = label;
    },

    /**
     * Menu icon.
     * @type {string}
     */
    get iconUrl() {
      return this.style.backgroundImage;
    },
    set iconUrl(url) {
      this.style.backgroundImage = 'url(' + url + ')';
    },

    /**
     * @return {boolean} Whether the menu item is a separator.
     */
    isSeparator: function() {
      return this.tagName == 'HR';
    },

    /**
     * Updates shortcut text according to associated command. If command has
     * multiple shortcuts, only first one is displayed.
     */
    updateShortcut_: function() {
      this.removeAttribute('shortcutText');

      if (!(this.command_ && this.command_.shortcut))
        return;

      var shortcuts = this.command_.shortcut.split(/\s+/);

      if (shortcuts.length == 0)
        return;

      var shortcut = shortcuts[0];
      var mods = {};
      var ident = '';
      shortcut.split('-').forEach(function(part) {
        var partUc = part.toUpperCase();
        switch (partUc) {
          case 'CTRL':
          case 'ALT':
          case 'SHIFT':
          case 'META':
            mods[partUc] = true;
            break;
          default:
            console.assert(!ident, 'Shortcut has two non-modifier keys');
            ident = part;
        }
      });

      var shortcutText = '';

      // TODO(zvorygin): if more cornercases appear - optimize following
      // code. Currently 'Enter' keystroke is passed as 'Enter', and 'Space'
      // is passed as 'U+0020'
      if (ident == 'U+0020')
        ident = 'Space';

      ['CTRL', 'ALT', 'SHIFT', 'META'].forEach(function(mod) {
        if (mods[mod])
          shortcutText += loadTimeData.getString('SHORTCUT_' + mod) + '+';
      });

      if (ident.indexOf('U+') != 0) {
        shortcutText +=
            loadTimeData.getString('SHORTCUT_' + ident.toUpperCase());
      } else {
        shortcutText +=
            String.fromCharCode(parseInt(ident.substring(2), 16));
      }

      this.setAttribute('shortcutText', shortcutText);
    },

    /**
     * Handles mouseup events. This dispatches an activate event; if there is an
     * associated command, that command is executed.
     * @param {Event} e The mouseup event object.
     * @private
     */
    handleMouseUp_: function(e) {
      // Only dispatch an activate event for left or middle click.
      if (e.button > 1)
        return;

      if (!this.disabled && !this.isSeparator() && this.selected) {
        // Store |contextElement| since it'll be removed by {Menu} on handling
        // 'activate' event.
        var contextElement = this.parentNode.contextElement;
        var activationEvent = cr.doc.createEvent('Event');
        activationEvent.initEvent('activate', true, true);
        activationEvent.originalEvent = e;
        // Dispatch command event followed by executing the command object.
        if (this.dispatchEvent(activationEvent)) {
          var command = this.command;
          if (command) {
            command.execute(contextElement);
            cr.ui.swallowDoubleClick(e);
          }
        }
      }
    },

    /**
     * Updates command according to the node on which this menu was invoked.
     * @param {Node=} opt_node Node on which menu was opened.
     */
    updateCommand: function(opt_node) {
      if (this.command_) {
        this.command_.canExecuteChange(opt_node);
      }
    },

    /**
     * Handles changes to the associated command.
     * @param {Event} e The event object.
     */
    handleEvent: function(e) {
      switch (e.type) {
        case 'disabledChange':
          this.disabled = this.command.disabled;
          break;
        case 'hiddenChange':
          this.hidden = this.command.hidden;
          break;
        case 'labelChange':
          this.label = this.command.label;
          break;
        case 'checkedChange':
          this.checked = this.command.checked;
          break;
      }
    }
  };

  /**
   * Whether the menu item is disabled or not.
   * @type {boolean}
   */
  cr.defineProperty(MenuItem, 'disabled', cr.PropertyKind.BOOL_ATTR);

  /**
   * Whether the menu item is hidden or not.
   * @type {boolean}
   */
  cr.defineProperty(MenuItem, 'hidden', cr.PropertyKind.BOOL_ATTR);

  /**
   * Whether the menu item is selected or not.
   * @type {boolean}
   */
  cr.defineProperty(MenuItem, 'selected', cr.PropertyKind.BOOL_ATTR);

  /**
   * Whether the menu item is checked or not.
   * @type {boolean}
   */
  cr.defineProperty(MenuItem, 'checked', cr.PropertyKind.BOOL_ATTR);

  /**
   * Whether the menu item is checkable or not.
   * @type {boolean}
   */
  cr.defineProperty(MenuItem, 'checkable', cr.PropertyKind.BOOL_ATTR);

  // Export
  return {
    MenuItem: MenuItem
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file provides utility functions for position popups.
 */

cr.define('cr.ui', function() {

  /**
   * Type def for rects as returned by getBoundingClientRect.
   * @typedef { {left: number, top: number, width: number, height: number,
   *             right: number, bottom: number}}
   */
  var Rect;

  /**
   * Enum for defining how to anchor a popup to an anchor element.
   * @enum {number}
   */
  var AnchorType = {
    /**
     * The popup's right edge is aligned with the left edge of the anchor.
     * The popup's top edge is aligned with the top edge of the anchor.
     */
    BEFORE: 1,  // p: right, a: left, p: top, a: top

    /**
     * The popop's left edge is aligned with the right edge of the anchor.
     * The popup's top edge is aligned with the top edge of the anchor.
     */
    AFTER: 2,  // p: left a: right, p: top, a: top

    /**
     * The popop's bottom edge is aligned with the top edge of the anchor.
     * The popup's left edge is aligned with the left edge of the anchor.
     */
    ABOVE: 3,  // p: bottom, a: top, p: left, a: left

    /**
     * The popop's top edge is aligned with the bottom edge of the anchor.
     * The popup's left edge is aligned with the left edge of the anchor.
     */
    BELOW: 4  // p: top, a: bottom, p: left, a: left
  };

  /**
   * Helper function for positionPopupAroundElement and positionPopupAroundRect.
   * @param {!Rect} anchorRect The rect for the anchor.
   * @param {!HTMLElement} popupElement The element used for the popup.
   * @param {AnchorType} type The type of anchoring to do.
   * @param {boolean} invertLeftRight Whether to invert the right/left
   *     alignment.
   */
  function positionPopupAroundRect(anchorRect, popupElement, type,
                                   invertLeftRight) {
    var popupRect = popupElement.getBoundingClientRect();
    var availRect;
    var ownerDoc = popupElement.ownerDocument;
    var cs = ownerDoc.defaultView.getComputedStyle(popupElement);
    var docElement = ownerDoc.documentElement;

    if (cs.position == 'fixed') {
      // For 'fixed' positioned popups, the available rectangle should be based
      // on the viewport rather than the document.
      availRect = {
        height: docElement.clientHeight,
        width: docElement.clientWidth,
        top: 0,
        bottom: docElement.clientHeight,
        left: 0,
        right: docElement.clientWidth
      };
    } else {
      availRect = popupElement.offsetParent.getBoundingClientRect();
    }

    if (cs.direction == 'rtl')
      invertLeftRight = !invertLeftRight;

    // Flip BEFORE, AFTER based on alignment.
    if (invertLeftRight) {
      if (type == AnchorType.BEFORE)
        type = AnchorType.AFTER;
      else if (type == AnchorType.AFTER)
        type = AnchorType.BEFORE;
    }

    // Flip type based on available size
    switch (type) {
      case AnchorType.BELOW:
        if (anchorRect.bottom + popupRect.height > availRect.height &&
            popupRect.height <= anchorRect.top) {
          type = AnchorType.ABOVE;
        }
        break;
      case AnchorType.ABOVE:
        if (popupRect.height > anchorRect.top &&
            anchorRect.bottom + popupRect.height <= availRect.height) {
          type = AnchorType.BELOW;
        }
        break;
      case AnchorType.AFTER:
        if (anchorRect.right + popupRect.width > availRect.width &&
            popupRect.width <= anchorRect.left) {
          type = AnchorType.BEFORE;
        }
        break;
      case AnchorType.BEFORE:
        if (popupRect.width > anchorRect.left &&
            anchorRect.right + popupRect.width <= availRect.width) {
          type = AnchorType.AFTER;
        }
        break;
    }
    // flipping done

    var style = popupElement.style;
    // Reset all directions.
    style.left = style.right = style.top = style.bottom = 'auto';

    // Primary direction
    switch (type) {
      case AnchorType.BELOW:
        if (anchorRect.bottom + popupRect.height <= availRect.height)
          style.top = anchorRect.bottom + 'px';
        else
          style.bottom = '0';
        break;
      case AnchorType.ABOVE:
        if (availRect.height - anchorRect.top >= 0)
          style.bottom = availRect.height - anchorRect.top + 'px';
        else
          style.top = '0';
        break;
      case AnchorType.AFTER:
        if (anchorRect.right + popupRect.width <= availRect.width)
          style.left = anchorRect.right + 'px';
        else
          style.right = '0';
        break;
      case AnchorType.BEFORE:
        if (availRect.width - anchorRect.left >= 0)
          style.right = availRect.width - anchorRect.left + 'px';
        else
          style.left = '0';
        break;
    }

    // Secondary direction
    switch (type) {
      case AnchorType.BELOW:
      case AnchorType.ABOVE:
        if (invertLeftRight) {
          // align right edges
          if (anchorRect.right - popupRect.width >= 0) {
            style.right = availRect.width - anchorRect.right + 'px';

          // align left edges
          } else if (anchorRect.left + popupRect.width <= availRect.width) {
            style.left = anchorRect.left + 'px';

          // not enough room on either side
          } else {
            style.right = '0';
          }
        } else {
          // align left edges
          if (anchorRect.left + popupRect.width <= availRect.width) {
            style.left = anchorRect.left + 'px';

          // align right edges
          } else if (anchorRect.right - popupRect.width >= 0) {
            style.right = availRect.width - anchorRect.right + 'px';

          // not enough room on either side
          } else {
            style.left = '0';
          }
        }
        break;

      case AnchorType.AFTER:
      case AnchorType.BEFORE:
        // align top edges
        if (anchorRect.top + popupRect.height <= availRect.height) {
          style.top = anchorRect.top + 'px';

        // align bottom edges
        } else if (anchorRect.bottom - popupRect.height >= 0) {
          style.bottom = availRect.height - anchorRect.bottom + 'px';

          // not enough room on either side
        } else {
          style.top = '0';
        }
        break;
    }
  }

  /**
   * Positions a popup element relative to an anchor element. The popup element
   * should have position set to absolute and it should be a child of the body
   * element.
   * @param {!HTMLElement} anchorElement The element that the popup is anchored
   *     to.
   * @param {!HTMLElement} popupElement The popup element we are positioning.
   * @param {AnchorType} type The type of anchoring we want.
   * @param {boolean} invertLeftRight Whether to invert the right/left
   *     alignment.
   */
  function positionPopupAroundElement(anchorElement, popupElement, type,
                                      invertLeftRight) {
    var anchorRect = anchorElement.getBoundingClientRect();
    positionPopupAroundRect(anchorRect, popupElement, type, invertLeftRight);
  }

  /**
   * Positions a popup around a point.
   * @param {number} x The client x position.
   * @param {number} y The client y position.
   * @param {!HTMLElement} popupElement The popup element we are positioning.
   */
  function positionPopupAtPoint(x, y, popupElement) {
    var rect = {
      left: x,
      top: y,
      width: 0,
      height: 0,
      right: x,
      bottom: y
    };
    positionPopupAroundRect(rect, popupElement, AnchorType.BELOW);
  }

  // Export
  return {
    AnchorType: AnchorType,
    positionPopupAroundElement: positionPopupAroundElement,
    positionPopupAtPoint: positionPopupAtPoint
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('cr.ui', function() {
  /** @const */
  var Menu = cr.ui.Menu;

  /** @const */
  var positionPopupAroundElement = cr.ui.positionPopupAroundElement;

   /**
    * Enum for type of hide. Delayed is used when called by clicking on a
    * checkable menu item.
    * @enum {number}
    */
   var HideType = {
     INSTANT: 0,
     DELAYED: 1
   };

  /**
   * Creates a new menu button element.
   * @param {Object=} opt_propertyBag Optional properties.
   * @constructor
   * @extends {HTMLButtonElement}
   */
  var MenuButton = cr.ui.define('button');

  MenuButton.prototype = {
    __proto__: HTMLButtonElement.prototype,

    /**
     * Initializes the menu button.
     */
    decorate: function() {
      this.addEventListener('mousedown', this);
      this.addEventListener('keydown', this);

      // Adding the 'custom-appearance' class prevents widgets.css from changing
      // the appearance of this element.
      this.classList.add('custom-appearance');
      this.classList.add('menu-button');  // For styles in menu_button.css.

      var menu;
      if ((menu = this.getAttribute('menu')))
        this.menu = menu;

      // An event tracker for events we only connect to while the menu is
      // displayed.
      this.showingEvents_ = new EventTracker();

      this.anchorType = cr.ui.AnchorType.BELOW;
      this.invertLeftRight = false;
    },

    /**
     * The menu associated with the menu button.
     * @type {cr.ui.Menu}
     */
    get menu() {
      return this.menu_;
    },
    set menu(menu) {
      if (typeof menu == 'string' && menu[0] == '#') {
        menu = this.ownerDocument.getElementById(menu.slice(1));
        cr.ui.decorate(menu, Menu);
      }

      this.menu_ = menu;
      if (menu) {
        if (menu.id)
          this.setAttribute('menu', '#' + menu.id);
      }
    },

    /**
     * Handles event callbacks.
     * @param {Event} e The event object.
     */
    handleEvent: function(e) {
      if (!this.menu)
        return;

      switch (e.type) {
        case 'mousedown':
          if (e.currentTarget == this.ownerDocument) {
            if (!this.contains(e.target) && !this.menu.contains(e.target))
              this.hideMenu();
            else
              e.preventDefault();
          } else {
            if (this.isMenuShown()) {
              this.hideMenu();
            } else if (e.button == 0) {  // Only show the menu when using left
                                         // mouse button.
              this.showMenu(false);

              // Prevent the button from stealing focus on mousedown.
              e.preventDefault();
            }
          }

          // Hide the focus ring on mouse click.
          this.classList.add('using-mouse');
          break;
        case 'keydown':
          this.handleKeyDown(e);
          // If the menu is visible we let it handle all the keyboard events.
          if (this.isMenuShown() && e.currentTarget == this.ownerDocument) {
            if (this.menu.handleKeyDown(e)) {
              e.preventDefault();
              e.stopPropagation();
            }
          }

          // Show the focus ring on keypress.
          this.classList.remove('using-mouse');
          break;
        case 'focus':
          if (!this.contains(e.target) && !this.menu.contains(e.target)) {
            this.hideMenu();
            // Show the focus ring on focus - if it's come from a mouse event,
            // the focus ring will be hidden in the mousedown event handler,
            // executed after this.
            this.classList.remove('using-mouse');
          }
          break;
        case 'activate':
          var hideDelayed = e.target instanceof cr.ui.MenuItem &&
              e.target.checkable;
          this.hideMenu(hideDelayed ? HideType.DELAYED : HideType.INSTANT);
          break;
        case 'scroll':
          if (!(e.target == this.menu || this.menu.contains(e.target)))
            this.hideMenu();
          break;
        case 'popstate':
        case 'resize':
          this.hideMenu();
          break;
      }
    },

    /**
     * Shows the menu.
     * @param {boolean} shouldSetFocus Whether to set focus on the
     *     selected menu item.
     */
    showMenu: function(shouldSetFocus) {
      this.hideMenu();

      this.menu.updateCommands(this);

      var event = document.createEvent('UIEvents');
      event.initUIEvent('menushow', true, true, window, null);

      if (!this.dispatchEvent(event))
        return;

      this.menu.hidden = false;

      this.setAttribute('menu-shown', '');

      // When the menu is shown we steal all keyboard events.
      var doc = this.ownerDocument;
      var win = doc.defaultView;
      this.showingEvents_.add(doc, 'keydown', this, true);
      this.showingEvents_.add(doc, 'mousedown', this, true);
      this.showingEvents_.add(doc, 'focus', this, true);
      this.showingEvents_.add(doc, 'scroll', this, true);
      this.showingEvents_.add(win, 'popstate', this);
      this.showingEvents_.add(win, 'resize', this);
      this.showingEvents_.add(this.menu, 'activate', this);
      this.positionMenu_();

      if (shouldSetFocus)
        this.menu.focusSelectedItem();
    },

    /**
     * Hides the menu. If your menu can go out of scope, make sure to call this
     * first.
     * @param {HideType=} opt_hideType Type of hide.
     *     default: HideType.INSTANT.
     */
    hideMenu: function(opt_hideType) {
      if (!this.isMenuShown())
        return;

      this.removeAttribute('menu-shown');
      if (opt_hideType == HideType.DELAYED)
        this.menu.classList.add('hide-delayed');
      else
        this.menu.classList.remove('hide-delayed');
      this.menu.hidden = true;

      this.showingEvents_.removeAll();
      this.focus();
    },

    /**
     * Whether the menu is shown.
     */
    isMenuShown: function() {
      return this.hasAttribute('menu-shown');
    },

    /**
     * Positions the menu below the menu button. At this point we do not use any
     * advanced positioning logic to ensure the menu fits in the viewport.
     * @private
     */
    positionMenu_: function() {
      positionPopupAroundElement(this, this.menu, this.anchorType,
                                 this.invertLeftRight);
    },

    /**
     * Handles the keydown event for the menu button.
     */
    handleKeyDown: function(e) {
      switch (e.keyIdentifier) {
        case 'Down':
        case 'Up':
        case 'Enter':
        case 'U+0020': // Space
          if (!this.isMenuShown())
            this.showMenu(true);
          e.preventDefault();
          break;
        case 'Esc':
        case 'U+001B': // Maybe this is remote desktop playing a prank?
        case 'U+0009': // Tab
          this.hideMenu();
          break;
      }
    }
  };

  /**
   * Helper for styling a menu button with a drop-down arrow indicator.
   * Creates a new 2D canvas context and draws a downward-facing arrow into it.
   * @param {string} canvasName The name of the canvas. The canvas can be
   *     addressed from CSS using -webkit-canvas(<canvasName>).
   * @param {number} width The width of the canvas and the arrow.
   * @param {number} height The height of the canvas and the arrow.
   * @param {string} colorSpec The CSS color to use when drawing the arrow.
   */
  function createDropDownArrowCanvas(canvasName, width, height, colorSpec) {
    var ctx = document.getCSSCanvasContext('2d', canvasName, width, height);
    ctx.fillStyle = ctx.strokeStyle = colorSpec;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(height, height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  /** @const */ var ARROW_WIDTH = 6;
  /** @const */ var ARROW_HEIGHT = 3;

  /**
   * Create the images used to style drop-down-style MenuButtons.
   * This should be called before creating any MenuButtons that will have the
   * CSS class 'drop-down'. If no colors are specified, defaults will be used.
   * @param {=string} normalColor CSS color for the default button state.
   * @param {=string} hoverColor CSS color for the hover button state.
   * @param {=string} activeColor CSS color for the active button state.
   */
  MenuButton.createDropDownArrows = function(
      normalColor, hoverColor, activeColor) {
    normalColor = normalColor || 'rgb(192, 195, 198)';
    hoverColor = hoverColor || 'rgb(48, 57, 66)';
    activeColor = activeColor || 'white';

    createDropDownArrowCanvas(
        'drop-down-arrow', ARROW_WIDTH, ARROW_HEIGHT, normalColor);
    createDropDownArrowCanvas(
        'drop-down-arrow-hover', ARROW_WIDTH, ARROW_HEIGHT, hoverColor);
    createDropDownArrowCanvas(
        'drop-down-arrow-active', ARROW_WIDTH, ARROW_HEIGHT, activeColor);
  };

  // Export
  return {
    MenuButton: MenuButton,
    HideType: HideType
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This implements a special button that is useful for showing a
 * context menu.
 */

cr.define('cr.ui', function() {
  /** @const */ var MenuButton = cr.ui.MenuButton;

  /**
   * Helper function for ContextMenuButton to find the first ancestor of the
   * button that has a context menu.
   * @param {!MenuButton} el The button to start the search from.
   * @return {HTMLElement} The found element or null if not found.
   */
  function getContextMenuTarget(el) {
    do {
      el = el.parentNode;
    } while (el && !('contextMenu' in el));
    return el;
  }

  /**
   * Creates a new menu button which is used to show the context menu for an
   * ancestor that has a {@code contextMenu} property.
   * @param {Object=} opt_propertyBag Optional properties.
   * @constructor
   * @extends {MenuButton}
   */
  var ContextMenuButton = cr.ui.define('button');

  ContextMenuButton.prototype = {
    __proto__: MenuButton.prototype,

    /**
     * Override to return the contextMenu for the ancestor.
     * @override
     * @type {cr.ui.Menu}
     */
    get menu() {
      var target = getContextMenuTarget(this);
      return target && target.contextMenu;
    },

    /** @override */
    decorate: function() {
      this.tabIndex = -1;
      this.addEventListener('mouseup', this);
      MenuButton.prototype.decorate.call(this);
    },

    /** @override */
    handleEvent: function(e) {
      switch (e.type) {
        case 'mousedown':
          // Menu buttons prevent focus changes.
          var target = getContextMenuTarget(this);
          if (target)
            target.focus();
          break;
        case 'mouseup':
          // Stop mouseup to prevent selection changes.
          e.stopPropagation();
          break;
      }
      MenuButton.prototype.handleEvent.call(this, e);
    },

    /**
     * Override MenuButton showMenu to allow the mousedown to be fully handled
     * before the menu is shown. This is important in case the mousedown
     * triggers command changes.
     * @param {boolean} shouldSetFocus Whether the menu should be focused after
     *     the menu is shown.
     */
    showMenu: function(shouldSetFocus) {
      var self = this;
      window.setTimeout(function() {
        MenuButton.prototype.showMenu.call(self, shouldSetFocus);
      });
    }
  };

  // Export
  return {
    ContextMenuButton: ContextMenuButton
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Touch Handler. Class that handles all touch events and
 * uses them to interpret higher level gestures and behaviors. TouchEvent is a
 * built in mobile safari type:
 * http://developer.apple.com/safari/library/documentation/UserExperience/Reference/TouchEventClassReference/TouchEvent/TouchEvent.html.
 * This class is intended to work with all webkit browsers, tested on Chrome and
 * iOS.
 *
 * The following types of gestures are currently supported.  See the definition
 * of TouchHandler.EventType for details.
 *
 * Single Touch:
 *      This provides simple single-touch events.  Any secondary touch is
 *      ignored.
 *
 * Drag:
 *      A single touch followed by some movement. This behavior will handle all
 *      of the required events and report the properties of the drag to you
 *      while the touch is happening and at the end of the drag sequence. This
 *      behavior will NOT perform the actual dragging (redrawing the element)
 *      for you, this responsibility is left to the client code.
 *
 * Long press:
 *     When your element is touched and held without any drag occuring, the
 *     LONG_PRESS event will fire.
 */

// Use an anonymous function to enable strict mode just for this file (which
// will be concatenated with other files when embedded in Chrome)
cr.define('cr.ui', function() {
  'use strict';

  /**
   * A TouchHandler attaches to an Element, listents for low-level touch (or
   * mouse) events and dispatching higher-level events on the element.
   * @param {!Element} element The element to listen on and fire events
   * for.
   * @constructor
   */
  function TouchHandler(element) {
    /**
     * @type {!Element}
     * @private
     */
    this.element_ = element;

    /**
     * The absolute sum of all touch y deltas.
     * @type {number}
     * @private
     */
    this.totalMoveY_ = 0;

    /**
     * The absolute sum of all touch x deltas.
     * @type {number}
     * @private
     */
    this.totalMoveX_ = 0;

    /**
     * An array of tuples where the first item is the horizontal component of a
     * recent relevant touch and the second item is the touch's time stamp. Old
     * touches are removed based on the max tracking time and when direction
     * changes.
      * @type {!Array.<number>}
      * @private
      */
    this.recentTouchesX_ = [];

    /**
     * An array of tuples where the first item is the vertical component of a
     * recent relevant touch and the second item is the touch's time stamp. Old
     * touches are removed based on the max tracking time and when direction
     * changes.
     * @type {!Array.<number>}
     * @private
     */
    this.recentTouchesY_ = [];

    /**
     * Used to keep track of all events we subscribe to so we can easily clean
     * up
     * @type {EventTracker}
     * @private
     */
    this.events_ = new EventTracker();
  }


  /**
   * DOM Events that may be fired by the TouchHandler at the element
   */
  TouchHandler.EventType = {
    // Fired whenever the element is touched as the only touch to the device.
    // enableDrag defaults to false, set to true to permit dragging.
    TOUCH_START: 'touchHandler:touch_start',

    // Fired when an element is held for a period of time.  Prevents dragging
    // from occuring (even if enableDrag was set to true).
    LONG_PRESS: 'touchHandler:long_press',

    // If enableDrag was set to true at TOUCH_START, DRAG_START will fire when
    // the touch first moves sufficient distance.  enableDrag is set to true but
    // can be reset to false to cancel the drag.
    DRAG_START: 'touchHandler:drag_start',

    // If enableDrag was true after DRAG_START, DRAG_MOVE will fire whenever the
    // touch is moved.
    DRAG_MOVE: 'touchHandler:drag_move',

    // Fired just before TOUCH_END when a drag is released.  Correlates 1:1 with
    // a DRAG_START.
    DRAG_END: 'touchHandler:drag_end',

    // Fired whenever a touch that is being tracked has been released.
    // Correlates 1:1 with a TOUCH_START.
    TOUCH_END: 'touchHandler:touch_end',

    // Fired whenever the element is tapped in a short time and no dragging is
    // detected.
    TAP: 'touchHandler:tap'
  };


  /**
   * The type of event sent by TouchHandler
   * @constructor
   * @param {string} type The type of event (one of cr.ui.Grabber.EventType).
   * @param {boolean} bubbles Whether or not the event should bubble.
   * @param {number} clientX The X location of the touch.
   * @param {number} clientY The Y location of the touch.
   * @param {!Element} touchedElement The element at the current location of the
   *        touch.
   */
  TouchHandler.Event = function(type, bubbles, clientX, clientY,
      touchedElement) {
    var event = document.createEvent('Event');
    event.initEvent(type, bubbles, true);
    event.__proto__ = TouchHandler.Event.prototype;

    /**
     * The X location of the touch affected
     * @type {number}
     */
    event.clientX = clientX;

    /**
     * The Y location of the touch affected
     * @type {number}
     */
    event.clientY = clientY;

    /**
     * The element at the current location of the touch.
     * @type {!Element}
     */
    event.touchedElement = touchedElement;

    return event;
  };

  TouchHandler.Event.prototype = {
    __proto__: Event.prototype,

    /**
     * For TOUCH_START and DRAG START events, set to true to enable dragging or
     * false to disable dragging.
     * @type {boolean|undefined}
     */
    enableDrag: undefined,

    /**
     * For DRAG events, provides the horizontal component of the
     * drag delta. Drag delta is defined as the delta of the start touch
     * position and the current drag position.
     * @type {number|undefined}
     */
    dragDeltaX: undefined,

    /**
     * For DRAG events, provides the vertical component of the
     * drag delta.
     * @type {number|undefined}
     */
    dragDeltaY: undefined
  };

  /**
   * Maximum movement of touch required to be considered a tap.
   * @type {number}
   * @private
   */
  TouchHandler.MAX_TRACKING_FOR_TAP_ = 8;


  /**
   * The maximum number of ms to track a touch event. After an event is older
   * than this value, it will be ignored in velocity calculations.
   * @type {number}
   * @private
   */
  TouchHandler.MAX_TRACKING_TIME_ = 250;


  /**
   * The maximum number of touches to track.
   * @type {number}
   * @private
   */
  TouchHandler.MAX_TRACKING_TOUCHES_ = 5;


  /**
   * The maximum velocity to return, in pixels per millisecond, that is used
   * to guard against errors in calculating end velocity of a drag. This is a
   * very fast drag velocity.
   * @type {number}
   * @private
   */
  TouchHandler.MAXIMUM_VELOCITY_ = 5;


  /**
   * The velocity to return, in pixel per millisecond, when the time stamps on
   * the events are erroneous. The browser can return bad time stamps if the
   * thread is blocked for the duration of the drag. This is a low velocity to
   * prevent the content from moving quickly after a slow drag. It is less
   * jarring if the content moves slowly after a fast drag.
   * @type {number}
   * @private
   */
  TouchHandler.VELOCITY_FOR_INCORRECT_EVENTS_ = 1;

  /**
   * The time, in milliseconds, that a touch must be held to be considered
   * 'long'.
   * @type {number}
   * @private
   */
  TouchHandler.TIME_FOR_LONG_PRESS_ = 500;

  TouchHandler.prototype = {
    /**
     * If defined, the identifer of the single touch that is active.  Note that
     * 0 is a valid touch identifier - it should not be treated equivalently to
     * undefined.
     * @type {number|undefined}
     * @private
     */
    activeTouch_: undefined,

    /**
     * @type {boolean|undefined}
     * @private
     */
    tracking_: undefined,

    /**
     * @type {number|undefined}
     * @private
     */
    startTouchX_: undefined,

    /**
     * @type {number|undefined}
     * @private
     */
    startTouchY_: undefined,

    /**
     * @type {number|undefined}
     * @private
     */
    endTouchX_: undefined,

    /**
     * @type {number|undefined}
     * @private
     */
    endTouchY_: undefined,

    /**
     * Time of the touchstart event.
     * @type {number|undefined}
     * @private
     */
    startTime_: undefined,

    /**
     * The time of the touchend event.
     * @type {number|undefined}
     * @private
     */
    endTime_: undefined,

    /**
     * @type {number|undefined}
     * @private
     */
    lastTouchX_: undefined,

    /**
     * @type {number|undefined}
     * @private
     */
    lastTouchY_: undefined,

    /**
     * @type {number|undefined}
     * @private
     */
    lastMoveX_: undefined,

    /**
     * @type {number|undefined}
     * @private
     */
    lastMoveY_: undefined,

    /**
     * @type {number|undefined}
     * @private
     */
    longPressTimeout_: undefined,

    /**
     * If defined and true, the next click event should be swallowed
     * @type {boolean|undefined}
     * @private
     */
    swallowNextClick_: undefined,

    /**
     * @type {boolean}
     * @private
     */
    draggingEnabled_: false,

    /**
     * Start listenting for events.
     * @param {boolean=} opt_capture True if the TouchHandler should listen to
     *      during the capture phase.
     * @param {boolean=} opt_mouse True if the TouchHandler should generate
     *      events for mouse input (in addition to touch input).
     */
    enable: function(opt_capture, opt_mouse) {
      var capture = !!opt_capture;

      // Just listen to start events for now. When a touch is occuring we'll
      // want to be subscribed to move and end events on the document, but we
      // don't want to incur the cost of lots of no-op handlers on the document.
      this.events_.add(this.element_, 'touchstart', this.onStart_.bind(this),
                       capture);
      if (opt_mouse) {
        this.events_.add(this.element_, 'mousedown',
                         this.mouseToTouchCallback_(this.onStart_.bind(this)),
                         capture);
      }

      // If the element is long-pressed, we may need to swallow a click
      this.events_.add(this.element_, 'click', this.onClick_.bind(this), true);
    },

    /**
     * Stop listening to all events.
     */
    disable: function() {
      this.stopTouching_();
      this.events_.removeAll();
    },

    /**
     * Wraps a callback with translations of mouse events to touch events.
     * NOTE: These types really should be function(Event) but then we couldn't
     * use this with bind (which operates on any type of function).  Doesn't
     * JSDoc support some sort of polymorphic types?
     * @param {Function} callback The event callback.
     * @return {Function} The wrapping callback.
     * @private
     */
    mouseToTouchCallback_: function(callback) {
      return function(e) {
        // Note that there may be synthesizes mouse events caused by touch
        // events (a mouseDown after a touch-click).  We leave it up to the
        // client to worry about this if it matters to them (typically a short
        // mouseDown/mouseUp without a click is no big problem and it's not
        // obvious how we identify such synthesized events in a general way).
        var touch = {
          // any fixed value will do for the identifier - there will only
          // ever be a single active 'touch' when using the mouse.
          identifier: 0,
          clientX: e.clientX,
          clientY: e.clientY,
          target: e.target
        };
        e.touches = [];
        e.targetTouches = [];
        e.changedTouches = [touch];
        if (e.type != 'mouseup') {
          e.touches[0] = touch;
          e.targetTouches[0] = touch;
        }
        callback(e);
      };
    },

    /**
     * Begin tracking the touchable element, it is eligible for dragging.
     * @private
     */
    beginTracking_: function() {
      this.tracking_ = true;
    },

    /**
     * Stop tracking the touchable element, it is no longer dragging.
     * @private
     */
    endTracking_: function() {
      this.tracking_ = false;
      this.dragging_ = false;
      this.totalMoveY_ = 0;
      this.totalMoveX_ = 0;
    },

    /**
     * Reset the touchable element as if we never saw the touchStart
     * Doesn't dispatch any end events - be careful of existing listeners.
     */
    cancelTouch: function() {
      this.stopTouching_();
      this.endTracking_();
      // If clients needed to be aware of this, we could fire a cancel event
      // here.
    },

    /**
     * Record that touching has stopped
     * @private
     */
    stopTouching_: function() {
      // Mark as no longer being touched
      this.activeTouch_ = undefined;

      // If we're waiting for a long press, stop
      window.clearTimeout(this.longPressTimeout_);

      // Stop listening for move/end events until there's another touch.
      // We don't want to leave handlers piled up on the document.
      // Note that there's no harm in removing handlers that weren't added, so
      // rather than track whether we're using mouse or touch we do both.
      this.events_.remove(document, 'touchmove');
      this.events_.remove(document, 'touchend');
      this.events_.remove(document, 'touchcancel');
      this.events_.remove(document, 'mousemove');
      this.events_.remove(document, 'mouseup');
    },

    /**
     * Touch start handler.
     * @param {!TouchEvent} e The touchstart event.
     * @private
     */
    onStart_: function(e) {
      // Only process single touches.  If there is already a touch happening, or
      // two simultaneous touches then just ignore them.
      if (e.touches.length > 1)
        // Note that we could cancel an active touch here.  That would make
        // simultaneous touch behave similar to near-simultaneous. However, if
        // the user is dragging something, an accidental second touch could be
        // quite disruptive if it cancelled their drag.  Better to just ignore
        // it.
        return;

      // It's still possible there could be an active "touch" if the user is
      // simultaneously using a mouse and a touch input.
      if (this.activeTouch_ !== undefined)
        return;

      var touch = e.targetTouches[0];
      this.activeTouch_ = touch.identifier;

      // We've just started touching so shouldn't swallow any upcoming click
      if (this.swallowNextClick_)
        this.swallowNextClick_ = false;

      this.disableTap_ = false;

      // Sign up for end/cancel notifications for this touch.
      // Note that we do this on the document so that even if the user drags
      // their finger off the element, we'll still know what they're doing.
      if (e.type == 'mousedown') {
        this.events_.add(document, 'mouseup',
            this.mouseToTouchCallback_(this.onEnd_.bind(this)), false);
      } else {
        this.events_.add(document, 'touchend', this.onEnd_.bind(this), false);
        this.events_.add(document, 'touchcancel', this.onEnd_.bind(this),
            false);
      }

      // This timeout is cleared on touchEnd and onDrag
      // If we invoke the function then we have a real long press
      window.clearTimeout(this.longPressTimeout_);
      this.longPressTimeout_ = window.setTimeout(
          this.onLongPress_.bind(this),
          TouchHandler.TIME_FOR_LONG_PRESS_);

      // Dispatch the TOUCH_START event
      this.draggingEnabled_ =
          !!this.dispatchEvent_(TouchHandler.EventType.TOUCH_START, touch);

      // We want dragging notifications
      if (e.type == 'mousedown') {
        this.events_.add(document, 'mousemove',
            this.mouseToTouchCallback_(this.onMove_.bind(this)), false);
      } else {
        this.events_.add(document, 'touchmove', this.onMove_.bind(this), false);
      }

      this.startTouchX_ = this.lastTouchX_ = touch.clientX;
      this.startTouchY_ = this.lastTouchY_ = touch.clientY;
      this.startTime_ = e.timeStamp;

      this.recentTouchesX_ = [];
      this.recentTouchesY_ = [];
      this.recentTouchesX_.push(touch.clientX, e.timeStamp);
      this.recentTouchesY_.push(touch.clientY, e.timeStamp);

      this.beginTracking_();
    },

    /**
     * Given a list of Touches, find the one matching our activeTouch
     * identifier. Note that Chrome currently always uses 0 as the identifier.
     * In that case we'll end up always choosing the first element in the list.
     * @param {TouchList} touches The list of Touch objects to search.
     * @return {!Touch|undefined} The touch matching our active ID if any.
     * @private
     */
    findActiveTouch_: function(touches) {
      assert(this.activeTouch_ !== undefined, 'Expecting an active touch');
      // A TouchList isn't actually an array, so we shouldn't use
      // Array.prototype.filter/some, etc.
      for (var i = 0; i < touches.length; i++) {
        if (touches[i].identifier == this.activeTouch_)
          return touches[i];
      }
      return undefined;
    },

    /**
     * Touch move handler.
     * @param {!TouchEvent} e The touchmove event.
     * @private
     */
    onMove_: function(e) {
      if (!this.tracking_)
        return;

      // Our active touch should always be in the list of touches still active
      assert(this.findActiveTouch_(e.touches), 'Missing touchEnd');

      var that = this;
      var touch = this.findActiveTouch_(e.changedTouches);
      if (!touch)
        return;

      var clientX = touch.clientX;
      var clientY = touch.clientY;

      var moveX = this.lastTouchX_ - clientX;
      var moveY = this.lastTouchY_ - clientY;
      this.totalMoveX_ += Math.abs(moveX);
      this.totalMoveY_ += Math.abs(moveY);
      this.lastTouchX_ = clientX;
      this.lastTouchY_ = clientY;

      var couldBeTap =
          this.totalMoveY_ <= TouchHandler.MAX_TRACKING_FOR_TAP_ ||
          this.totalMoveX_ <= TouchHandler.MAX_TRACKING_FOR_TAP_;

      if (!couldBeTap)
        this.disableTap_ = true;

      if (this.draggingEnabled_ && !this.dragging_ && !couldBeTap) {
        // If we're waiting for a long press, stop
        window.clearTimeout(this.longPressTimeout_);

        // Dispatch the DRAG_START event and record whether dragging should be
        // allowed or not.  Note that this relies on the current value of
        // startTouchX/Y - handlers may use the initial drag delta to determine
        // if dragging should be permitted.
        this.dragging_ = this.dispatchEvent_(
            TouchHandler.EventType.DRAG_START, touch);

        if (this.dragging_) {
          // Update the start position here so that drag deltas have better
          // values but don't touch the recent positions so that velocity
          // calculations can still use touchstart position in the time and
          // distance delta.
          this.startTouchX_ = clientX;
          this.startTouchY_ = clientY;
          this.startTime_ = e.timeStamp;
        } else {
          this.endTracking_();
        }
      }

      if (this.dragging_) {
        this.dispatchEvent_(TouchHandler.EventType.DRAG_MOVE, touch);

        this.removeTouchesInWrongDirection_(this.recentTouchesX_,
            this.lastMoveX_, moveX);
        this.removeTouchesInWrongDirection_(this.recentTouchesY_,
            this.lastMoveY_, moveY);
        this.removeOldTouches_(this.recentTouchesX_, e.timeStamp);
        this.removeOldTouches_(this.recentTouchesY_, e.timeStamp);
        this.recentTouchesX_.push(clientX, e.timeStamp);
        this.recentTouchesY_.push(clientY, e.timeStamp);
      }

      this.lastMoveX_ = moveX;
      this.lastMoveY_ = moveY;
    },

    /**
     * Filters the provided recent touches array to remove all touches except
     * the last if the move direction has changed.
     * @param {!Array.<number>} recentTouches An array of tuples where the first
     *     item is the x or y component of the recent touch and the second item
     *     is the touch time stamp.
     * @param {number|undefined} lastMove The x or y component of the previous
     *     move.
     * @param {number} recentMove The x or y component of the most recent move.
     * @private
     */
    removeTouchesInWrongDirection_: function(recentTouches, lastMove,
        recentMove) {
      if (lastMove && recentMove && recentTouches.length > 2 &&
          (lastMove > 0 ^ recentMove > 0)) {
        recentTouches.splice(0, recentTouches.length - 2);
      }
    },

    /**
     * Filters the provided recent touches array to remove all touches older
     * than the max tracking time or the 5th most recent touch.
     * @param {!Array.<number>} recentTouches An array of tuples where the first
     *     item is the x or y component of the recent touch and the second item
     *     is the touch time stamp.
     * @param {number} recentTime The time of the most recent event.
     * @private
     */
    removeOldTouches_: function(recentTouches, recentTime) {
      while (recentTouches.length && recentTime - recentTouches[1] >
          TouchHandler.MAX_TRACKING_TIME_ ||
          recentTouches.length >
              TouchHandler.MAX_TRACKING_TOUCHES_ * 2) {
        recentTouches.splice(0, 2);
      }
    },

    /**
     * Touch end handler.
     * @param {!TouchEvent} e The touchend event.
     * @private
     */
    onEnd_: function(e) {
      var that = this;
      assert(this.activeTouch_ !== undefined, 'Expect to already be touching');

      // If the touch we're tracking isn't changing here, ignore this touch end.
      var touch = this.findActiveTouch_(e.changedTouches);
      if (!touch) {
        // In most cases, our active touch will be in the 'touches' collection,
        // but we can't assert that because occasionally two touchend events can
        // occur at almost the same time with both having empty 'touches' lists.
        // I.e., 'touches' seems like it can be a bit more up-to-date than the
        // current event.
        return;
      }

      // This is touchEnd for the touch we're monitoring
      assert(!this.findActiveTouch_(e.touches),
             'Touch ended also still active');

      // Indicate that touching has finished
      this.stopTouching_();

      if (this.tracking_) {
        var clientX = touch.clientX;
        var clientY = touch.clientY;

        if (this.dragging_) {
          this.endTime_ = e.timeStamp;
          this.endTouchX_ = clientX;
          this.endTouchY_ = clientY;

          this.removeOldTouches_(this.recentTouchesX_, e.timeStamp);
          this.removeOldTouches_(this.recentTouchesY_, e.timeStamp);

          this.dispatchEvent_(TouchHandler.EventType.DRAG_END, touch);

          // Note that in some situations we can get a click event here as well.
          // For now this isn't a problem, but we may want to consider having
          // some logic that hides clicks that appear to be caused by a touchEnd
          // used for dragging.
        }

        this.endTracking_();
      }
      this.draggingEnabled_ = false;

      // Note that we dispatch the touchEnd event last so that events at
      // different levels of semantics nest nicely (similar to how DOM
      // drag-and-drop events are nested inside of the mouse events that trigger
      // them).
      this.dispatchEvent_(TouchHandler.EventType.TOUCH_END, touch);
      if (!this.disableTap_)
        this.dispatchEvent_(TouchHandler.EventType.TAP, touch);
    },

    /**
     * Get end velocity of the drag. This method is specific to drag behavior,
     * so if touch behavior and drag behavior is split then this should go with
     * drag behavior. End velocity is defined as deltaXY / deltaTime where
     * deltaXY is the difference between endPosition and the oldest recent
     * position, and deltaTime is the difference between endTime and the oldest
     * recent time stamp.
     * @return {Object} The x and y velocity.
     */
    getEndVelocity: function() {
      // Note that we could move velocity to just be an end-event parameter.
      var velocityX = this.recentTouchesX_.length ?
          (this.endTouchX_ - this.recentTouchesX_[0]) /
          (this.endTime_ - this.recentTouchesX_[1]) : 0;
      var velocityY = this.recentTouchesY_.length ?
          (this.endTouchY_ - this.recentTouchesY_[0]) /
          (this.endTime_ - this.recentTouchesY_[1]) : 0;

      velocityX = this.correctVelocity_(velocityX);
      velocityY = this.correctVelocity_(velocityY);

      return {
        x: velocityX,
        y: velocityY
      };
    },

    /**
     * Correct erroneous velocities by capping the velocity if we think it's too
     * high, or setting it to a default velocity if know that the event data is
     * bad.
     * @param {number} velocity The x or y velocity component.
     * @return {number} The corrected velocity.
     * @private
     */
    correctVelocity_: function(velocity) {
      var absVelocity = Math.abs(velocity);

      // We add to recent touches for each touchstart and touchmove. If we have
      // fewer than 3 touches (6 entries), we assume that the thread was blocked
      // for the duration of the drag and we received events in quick succession
      // with the wrong time stamps.
      if (absVelocity > TouchHandler.MAXIMUM_VELOCITY_) {
        absVelocity = this.recentTouchesY_.length < 3 ?
            TouchHandler.VELOCITY_FOR_INCORRECT_EVENTS_ :
                TouchHandler.MAXIMUM_VELOCITY_;
      }
      return absVelocity * (velocity < 0 ? -1 : 1);
    },

    /**
     * Handler when an element has been pressed for a long time
     * @private
     */
    onLongPress_: function() {
      // Swallow any click that occurs on this element without an intervening
      // touch start event.  This simple click-busting technique should be
      // sufficient here since a real click should have a touchstart first.
      this.swallowNextClick_ = true;
      this.disableTap_ = true;

      // Dispatch to the LONG_PRESS
      this.dispatchEventXY_(TouchHandler.EventType.LONG_PRESS, this.element_,
          this.startTouchX_, this.startTouchY_);
    },

    /**
     * Click handler - used to swallow clicks after a long-press
     * @param {!Event} e The click event.
     * @private
     */
    onClick_: function(e) {
      if (this.swallowNextClick_) {
        e.preventDefault();
        e.stopPropagation();
        this.swallowNextClick_ = false;
      }
    },

    /**
     * Dispatch a TouchHandler event to the element
     * @param {string} eventType The event to dispatch.
     * @param {Touch} touch The touch triggering this event.
     * @return {boolean|undefined} The value of enableDrag after dispatching
     *         the event.
     * @private
     */
    dispatchEvent_: function(eventType, touch) {

      // Determine which element was touched.  For mouse events, this is always
      // the event/touch target.  But for touch events, the target is always the
      // target of the touchstart (and it's unlikely we can change this
      // since the common implementation of touch dragging relies on it). Since
      // touch is our primary scenario (which we want to emulate with mouse),
      // we'll treat both cases the same and not depend on the target.
      var touchedElement;
      if (eventType == TouchHandler.EventType.TOUCH_START) {
        touchedElement = touch.target;
      } else {
        touchedElement = this.element_.ownerDocument.
            elementFromPoint(touch.clientX, touch.clientY);
      }

      return this.dispatchEventXY_(eventType, touchedElement, touch.clientX,
          touch.clientY);
    },

    /**
     * Dispatch a TouchHandler event to the element
     * @param {string} eventType The event to dispatch.
       @param {number} clientX The X location for the event.
       @param {number} clientY The Y location for the event.
     * @return {boolean|undefined} The value of enableDrag after dispatching
     *         the event.
     * @private
     */
    dispatchEventXY_: function(eventType, touchedElement, clientX, clientY) {
      var isDrag = (eventType == TouchHandler.EventType.DRAG_START ||
          eventType == TouchHandler.EventType.DRAG_MOVE ||
          eventType == TouchHandler.EventType.DRAG_END);

      // Drag events don't bubble - we're really just dragging the element,
      // not affecting its parent at all.
      var bubbles = !isDrag;

      var event = new TouchHandler.Event(eventType, bubbles, clientX, clientY,
          touchedElement);

      // Set enableDrag when it can be overridden
      if (eventType == TouchHandler.EventType.TOUCH_START)
        event.enableDrag = false;
      else if (eventType == TouchHandler.EventType.DRAG_START)
        event.enableDrag = true;

      if (isDrag) {
        event.dragDeltaX = clientX - this.startTouchX_;
        event.dragDeltaY = clientY - this.startTouchY_;
      }

      this.element_.dispatchEvent(event);
      return event.enableDrag;
    }
  };

  return {
    TouchHandler: TouchHandler
  };
});


// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('ntp', function() {
  'use strict';

  // We can't pass the currently dragging tile via dataTransfer because of
  // http://crbug.com/31037
  var currentlyDraggingTile = null;
  function getCurrentlyDraggingTile() {
    return currentlyDraggingTile;
  }
  function setCurrentlyDraggingTile(tile) {
    currentlyDraggingTile = tile;
    if (tile)
      ntp.enterRearrangeMode();
    else
      ntp.leaveRearrangeMode();
  }

  /**
   * Changes the current dropEffect of a drag. This modifies the native cursor
   * and serves as an indicator of what we should do at the end of the drag as
   * well as give indication to the user if a drop would succeed if they let go.
   * @param {DataTransfer} dataTransfer A dataTransfer object from a drag event.
   * @param {string} effect A drop effect to change to (i.e. copy, move, none).
   */
  function setCurrentDropEffect(dataTransfer, effect) {
    dataTransfer.dropEffect = effect;
    if (currentlyDraggingTile)
      currentlyDraggingTile.lastDropEffect = dataTransfer.dropEffect;
  }

  /**
   * Creates a new Tile object. Tiles wrap content on a TilePage, providing
   * some styling and drag functionality.
   * @constructor
   * @extends {HTMLDivElement}
   */
  function Tile(contents) {
    var tile = cr.doc.createElement('div');
    tile.__proto__ = Tile.prototype;
    tile.initialize(contents);

    return tile;
  }

  Tile.prototype = {
    __proto__: HTMLDivElement.prototype,

    initialize: function(contents) {
      // 'real' as opposed to doppleganger.
      this.className = 'tile real';
      this.appendChild(contents);
      contents.tile = this;

      this.addEventListener('dragstart', this.onDragStart_);
      this.addEventListener('drag', this.onDragMove_);
      this.addEventListener('dragend', this.onDragEnd_);

      this.firstChild.addEventListener(
          'webkitAnimationEnd', this.onContentsAnimationEnd_.bind(this));

      this.eventTracker = new EventTracker();
    },

    get index() {
      return Array.prototype.indexOf.call(this.tilePage.tileElements_, this);
    },

    get tilePage() {
      return findAncestorByClass(this, 'tile-page');
    },

    /**
     * Position the tile at |x, y|, and store this as the grid location, i.e.
     * where the tile 'belongs' when it's not being dragged.
     * @param {number} x The x coordinate, in pixels.
     * @param {number} y The y coordinate, in pixels.
     */
    setGridPosition: function(x, y) {
      this.gridX = x;
      this.gridY = y;
      this.moveTo(x, y);
    },

    /**
     * Position the tile at |x, y|.
     * @param {number} x The x coordinate, in pixels.
     * @param {number} y The y coordinate, in pixels.
     */
    moveTo: function(x, y) {
      // left overrides right in LTR, and right takes precedence in RTL.
      this.style.left = toCssPx(x);
      this.style.right = toCssPx(x);
      this.style.top = toCssPx(y);
    },

    /**
     * The handler for dragstart events fired on |this|.
     * @param {Event} e The event for the drag.
     * @private
     */
    onDragStart_: function(e) {
      // The user may start dragging again during a previous drag's finishing
      // animation.
      if (this.classList.contains('dragging'))
        this.finalizeDrag_();

      setCurrentlyDraggingTile(this);

      e.dataTransfer.effectAllowed = 'copyMove';
      this.firstChild.setDragData(e.dataTransfer);

      // The drag clone is the node we use as a representation during the drag.
      // It's attached to the top level document element so that it floats above
      // image masks.
      this.dragClone = this.cloneNode(true);
      this.dragClone.style.right = '';
      this.dragClone.classList.add('drag-representation');
      $('card-slider-frame').appendChild(this.dragClone);
      this.eventTracker.add(this.dragClone, 'webkitTransitionEnd',
                            this.onDragCloneTransitionEnd_.bind(this));

      this.classList.add('dragging');
      // offsetLeft is mirrored in RTL. Un-mirror it.
      var offsetLeft = isRTL() ?
          this.parentNode.clientWidth - this.offsetLeft :
          this.offsetLeft;
      this.dragOffsetX = e.x - offsetLeft - this.parentNode.offsetLeft;
      this.dragOffsetY = e.y - this.offsetTop -
          // Unlike offsetTop, this value takes scroll position into account.
          this.parentNode.getBoundingClientRect().top;

      this.onDragMove_(e);
    },

    /**
     * The handler for drag events fired on |this|.
     * @param {Event} e The event for the drag.
     * @private
     */
    onDragMove_: function(e) {
      if (e.view != window || (e.x == 0 && e.y == 0)) {
        this.dragClone.hidden = true;
        return;
      }

      this.dragClone.hidden = false;
      this.dragClone.style.left = toCssPx(e.x - this.dragOffsetX);
      this.dragClone.style.top = toCssPx(e.y - this.dragOffsetY);
    },

    /**
     * The handler for dragend events fired on |this|.
     * @param {Event} e The event for the drag.
     * @private
     */
    onDragEnd_: function(e) {
      this.dragClone.hidden = false;
      this.dragClone.classList.add('placing');

      setCurrentlyDraggingTile(null);

      // tilePage will be null if we've already been removed.
      var tilePage = this.tilePage;
      if (tilePage)
        tilePage.positionTile_(this.index);

      // Take an appropriate action with the drag clone.
      if (this.landedOnTrash) {
        this.dragClone.classList.add('deleting');
      } else if (tilePage) {
        // TODO(dbeam): Until we fix dropEffect to the correct behavior it will
        // differ on windows - crbug.com/39399.  That's why we use the custom
        // this.lastDropEffect instead of e.dataTransfer.dropEffect.
        if (tilePage.selected && this.lastDropEffect != 'copy') {
          // The drag clone can still be hidden from the last drag move event.
          this.dragClone.hidden = false;
          // The tile's contents may have moved following the respositioning;
          // adjust for that.
          var contentDiffX = this.dragClone.firstChild.offsetLeft -
              this.firstChild.offsetLeft;
          var contentDiffY = this.dragClone.firstChild.offsetTop -
              this.firstChild.offsetTop;
          this.dragClone.style.left =
              toCssPx(this.gridX + this.parentNode.offsetLeft -
                         contentDiffX);
          this.dragClone.style.top =
              toCssPx(this.gridY +
                         this.parentNode.getBoundingClientRect().top -
                         contentDiffY);
        } else if (this.dragClone.hidden) {
          this.finalizeDrag_();
        } else {
          // The CSS3 transitions spec intentionally leaves it up to individual
          // user agents to determine when styles should be applied. On some
          // platforms (at the moment, Windows), when you apply both classes
          // immediately a transition may not occur correctly. That's why we're
          // using a setTimeout here to queue adding the class until the
          // previous class (currently: .placing) sets up a transition.
          // http://dev.w3.org/csswg/css3-transitions/#starting
          window.setTimeout(function() {
            if (this.dragClone)
              this.dragClone.classList.add('dropped-on-other-page');
          }.bind(this), 0);
        }
      }

      delete this.lastDropEffect;
      this.landedOnTrash = false;
    },

    /**
     * Creates a clone of this node offset by the coordinates. Used for the
     * dragging effect where a tile appears to float off one side of the grid
     * and re-appear on the other.
     * @param {number} x x-axis offset, in pixels.
     * @param {number} y y-axis offset, in pixels.
     */
    showDoppleganger: function(x, y) {
      // We always have to clear the previous doppleganger to make sure we get
      // style updates for the contents of this tile.
      this.clearDoppleganger();

      var clone = this.cloneNode(true);
      clone.classList.remove('real');
      clone.classList.add('doppleganger');
      var clonelets = clone.querySelectorAll('.real');
      for (var i = 0; i < clonelets.length; i++) {
        clonelets[i].classList.remove('real');
      }

      this.appendChild(clone);
      this.doppleganger_ = clone;

      if (isRTL())
        x *= -1;

      this.doppleganger_.style.WebkitTransform = 'translate(' + x + 'px, ' +
                                                                y + 'px)';
    },

    /**
     * Destroys the current doppleganger.
     */
    clearDoppleganger: function() {
      if (this.doppleganger_) {
        this.removeChild(this.doppleganger_);
        this.doppleganger_ = null;
      }
    },

    /**
     * Returns status of doppleganger.
     * @return {boolean} True if there is a doppleganger showing for |this|.
     */
    hasDoppleganger: function() {
      return !!this.doppleganger_;
    },

    /**
     * Cleans up after the drag is over. This is either called when the
     * drag representation finishes animating to the final position, or when
     * the next drag starts (if the user starts a 2nd drag very quickly).
     * @private
     */
    finalizeDrag_: function() {
      assert(this.classList.contains('dragging'));

      var clone = this.dragClone;
      this.dragClone = null;

      clone.parentNode.removeChild(clone);
      this.eventTracker.remove(clone, 'webkitTransitionEnd');
      this.classList.remove('dragging');
      if (this.firstChild.finalizeDrag)
        this.firstChild.finalizeDrag();
    },

    /**
     * Called when the drag representation node is done migrating to its final
     * resting spot.
     * @param {Event} e The transition end event.
     */
    onDragCloneTransitionEnd_: function(e) {
      if (this.classList.contains('dragging') &&
          (e.propertyName == 'left' || e.propertyName == 'top' ||
           e.propertyName == '-webkit-transform')) {
        this.finalizeDrag_();
      }
    },

    /**
     * Called when an app is removed from Chrome. Animates its disappearance.
     * @param {boolean=} opt_animate Whether the animation should be animated.
     */
    doRemove: function(opt_animate) {
      if (opt_animate)
        this.firstChild.classList.add('removing-tile-contents');
      else
        this.tilePage.removeTile(this, false);
    },

    /**
     * Callback for the webkitAnimationEnd event on the tile's contents.
     * @param {Event} e The event object.
     */
    onContentsAnimationEnd_: function(e) {
      if (this.firstChild.classList.contains('new-tile-contents'))
        this.firstChild.classList.remove('new-tile-contents');
      if (this.firstChild.classList.contains('removing-tile-contents'))
        this.tilePage.removeTile(this, true);
    },
  };

  /**
   * Gives the proportion of the row width that is devoted to a single icon.
   * @param {number} rowTileCount The number of tiles in a row.
   * @param {number} tileSpacingFraction The proportion of the tile width which
   *     will be used as spacing between tiles.
   * @return {number} The ratio between icon width and row width.
   */
  function tileWidthFraction(rowTileCount, tileSpacingFraction) {
    return rowTileCount + (rowTileCount - 1) * tileSpacingFraction;
  }

  /**
   * Calculates an assortment of tile-related values for a grid with the
   * given dimensions.
   * @param {number} width The pixel width of the grid.
   * @param {number} numRowTiles The number of tiles in a row.
   * @param {number} tileSpacingFraction The proportion of the tile width which
   *     will be used as spacing between tiles.
   * @return {Object} A mapping of pixel values.
   */
  function tileValuesForGrid(width, numRowTiles, tileSpacingFraction) {
    var tileWidth = width / tileWidthFraction(numRowTiles, tileSpacingFraction);
    var offsetX = tileWidth * (1 + tileSpacingFraction);
    var interTileSpacing = offsetX - tileWidth;

    return {
      tileWidth: tileWidth,
      offsetX: offsetX,
      interTileSpacing: interTileSpacing,
    };
  }

  // The smallest amount of horizontal blank space to display on the sides when
  // displaying a wide arrangement. There is an additional 26px of margin from
  // the tile page padding.
  var MIN_WIDE_MARGIN = 18;

  /**
   * Creates a new TilePage object. This object contains tiles and controls
   * their layout.
   * @param {Object} gridValues Pixel values that define the size and layout
   *     of the tile grid.
   * @constructor
   * @extends {HTMLDivElement}
   */
  function TilePage(gridValues) {
    var el = cr.doc.createElement('div');
    el.gridValues_ = gridValues;
    el.__proto__ = TilePage.prototype;
    el.initialize();

    return el;
  }

  /**
   * Takes a collection of grid layout pixel values and updates them with
   * additional tiling values that are calculated from TilePage constants.
   * @param {Object} grid The grid layout pixel values to update.
   */
  TilePage.initGridValues = function(grid) {
    // The amount of space we need to display a narrow grid (all narrow grids
    // are this size).
    grid.narrowWidth =
        grid.minTileWidth * tileWidthFraction(grid.minColCount,
                                              grid.tileSpacingFraction);
    // The minimum amount of space we need to display a wide grid.
    grid.minWideWidth =
        grid.minTileWidth * tileWidthFraction(grid.maxColCount,
                                              grid.tileSpacingFraction);
    // The largest we will ever display a wide grid.
    grid.maxWideWidth =
        grid.maxTileWidth * tileWidthFraction(grid.maxColCount,
                                              grid.tileSpacingFraction);
    // Tile-related pixel values for the narrow display.
    grid.narrowTileValues = tileValuesForGrid(grid.narrowWidth,
                                              grid.minColCount,
                                              grid.tileSpacingFraction);
    // Tile-related pixel values for the minimum narrow display.
    grid.wideTileValues = tileValuesForGrid(grid.minWideWidth,
                                            grid.maxColCount,
                                            grid.tileSpacingFraction);
  };

  TilePage.prototype = {
    __proto__: HTMLDivElement.prototype,

    initialize: function() {
      this.className = 'tile-page';

      // Div that acts as a custom scrollbar. The scrollbar has to live
      // outside the content div so it doesn't flicker when scrolling (due to
      // repainting after the scroll, then repainting again when moved in the
      // onScroll handler). |scrollbar_| is only aesthetic, and it only
      // represents the thumb. Actual events are still handled by the invisible
      // native scrollbars. This div gives us more flexibility with the visuals.
      this.scrollbar_ = this.ownerDocument.createElement('div');
      this.scrollbar_.className = 'tile-page-scrollbar';
      this.scrollbar_.hidden = true;
      this.appendChild(this.scrollbar_);

      // This contains everything but the scrollbar.
      this.content_ = this.ownerDocument.createElement('div');
      this.content_.className = 'tile-page-content';
      this.appendChild(this.content_);

      // Div that sets the vertical position of the tile grid.
      this.topMargin_ = this.ownerDocument.createElement('div');
      this.topMargin_.className = 'top-margin';
      this.content_.appendChild(this.topMargin_);

      // Div that holds the tiles.
      this.tileGrid_ = this.ownerDocument.createElement('div');
      this.tileGrid_.className = 'tile-grid';
      this.tileGrid_.style.minWidth = this.gridValues_.narrowWidth + 'px';
      this.tileGrid_.setAttribute('role', 'menu');
      this.tileGrid_.setAttribute('aria-label',
          loadTimeData.getString(
              'tile_grid_screenreader_accessible_description'));

      this.content_.appendChild(this.tileGrid_);

      // Ordered list of our tiles.
      this.tileElements_ = this.tileGrid_.getElementsByClassName('tile real');
      // Ordered list of the elements which want to accept keyboard focus. These
      // elements will not be a part of the normal tab order; the tile grid
      // initially gets focused and then these elements can be focused via the
      // arrow keys.
      this.focusableElements_ =
          this.tileGrid_.getElementsByClassName('focusable');

      // These are properties used in updateTopMargin.
      this.animatedTopMarginPx_ = 0;
      this.topMarginPx_ = 0;

      this.eventTracker = new EventTracker();
      this.eventTracker.add(window, 'resize', this.onResize_.bind(this));

      this.addEventListener('DOMNodeInsertedIntoDocument',
                            this.onNodeInsertedIntoDocument_);

      this.content_.addEventListener('scroll', this.onScroll_.bind(this));

      this.dragWrapper_ = new cr.ui.DragWrapper(this.tileGrid_, this);

      this.addEventListener('cardselected', this.handleCardSelection_);
      this.addEventListener('carddeselected', this.handleCardDeselection_);
      this.addEventListener('focus', this.handleFocus_);
      this.addEventListener('keydown', this.handleKeyDown_);
      this.addEventListener('mousedown', this.handleMouseDown_);

      this.focusElementIndex_ = -1;
    },

    get tiles() {
      return this.tileElements_;
    },

    get tileCount() {
      return this.tileElements_.length;
    },

    get selected() {
      return Array.prototype.indexOf.call(this.parentNode.children, this) ==
          ntp.getCardSlider().currentCard;
    },

    /**
     * The size of the margin (unused space) on the sides of the tile grid, in
     * pixels.
     * @type {number}
     */
    get sideMargin() {
      return this.layoutValues_.leftMargin;
    },

    /**
     * Returns the width of the scrollbar, in pixels, if it is active, or 0
     * otherwise.
     * @type {number}
     */
    get scrollbarWidth() {
      return this.scrollbar_.hidden ? 0 : 13;
    },

    /**
     * Returns any extra padding to insert to the bottom of a tile page.  By
     * default there is none, but subclasses can override.
     * @type {number}
     */
    get extraBottomPadding() {
      return 0;
    },

    /**
     * The notification content of this tile (if any, otherwise null).
     * @type {!HTMLElement}
     */
    get notification() {
      return this.topMargin_.nextElementSibling.id == 'notification-container' ?
          this.topMargin_.nextElementSibling : null;
    },
    /**
     * The notification content of this tile (if any, otherwise null).
     * @type {!HTMLElement}
     */
    set notification(node) {
      assert(node instanceof HTMLElement, '|node| isn\'t an HTMLElement!');
      // NOTE: Implicitly removes from DOM if |node| is inside it.
      this.content_.insertBefore(node, this.topMargin_.nextElementSibling);
      this.positionNotification_();
    },

    /**
     * Fetches the size, in pixels, of the padding-top of the tile contents.
     * @type {number}
     */
    get contentPadding() {
      if (typeof this.contentPadding_ == 'undefined') {
        this.contentPadding_ =
            parseInt(getComputedStyle(this.content_).paddingTop, 10);
      }
      return this.contentPadding_;
    },

    /**
     * Removes the tilePage from the DOM and cleans up event handlers.
     */
    remove: function() {
      // This checks arguments.length as most remove functions have a boolean
      // |opt_animate| argument, but that's not necesarilly applicable to
      // removing a tilePage. Selecting a different card in an animated way and
      // deleting the card afterward is probably a better choice.
      assert(typeof arguments[0] != 'boolean',
             'This function takes no |opt_animate| argument.');
      this.tearDown_();
      this.parentNode.removeChild(this);
    },

    /**
     * Cleans up resources that are no longer needed after this TilePage
     * instance is removed from the DOM.
     * @private
     */
    tearDown_: function() {
      this.eventTracker.removeAll();
    },

    /**
     * Appends a tile to the end of the tile grid.
     * @param {HTMLElement} tileElement The contents of the tile.
     * @param {boolean} animate If true, the append will be animated.
     * @protected
     */
    appendTile: function(tileElement, animate) {
      this.addTileAt(tileElement, this.tileElements_.length, animate);
    },

    /**
     * Adds the given element to the tile grid.
     * @param {Node} tileElement The tile object/node to insert.
     * @param {number} index The location in the tile grid to insert it at.
     * @param {boolean} animate If true, the tile in question will be
     *     animated (other tiles, if they must reposition, do not animate).
     * @protected
     */
    addTileAt: function(tileElement, index, animate) {
      this.classList.remove('animating-tile-page');
      if (animate)
        tileElement.classList.add('new-tile-contents');

      // Make sure the index is positive and either in the the bounds of
      // this.tileElements_ or at the end (meaning append).
      assert(index >= 0 && index <= this.tileElements_.length);

      var wrapperDiv = new Tile(tileElement);
      // If is out of the bounds of the tile element list, .insertBefore() will
      // act just like appendChild().
      this.tileGrid_.insertBefore(wrapperDiv, this.tileElements_[index]);
      this.calculateLayoutValues_();
      this.heightChanged_();

      this.repositionTiles_();

      // If this is the first tile being added, make it focusable after add.
      if (this.focusableElements_.length == 1)
        this.updateFocusableElement();
      this.fireAddedEvent(wrapperDiv, index, animate);
    },

    /**
     * Notify interested subscribers that a tile has been removed from this
     * page.
     * @param {Tile} tile The newly added tile.
     * @param {number} index The index of the tile that was added.
     * @param {boolean} wasAnimated Whether the removal was animated.
     */
    fireAddedEvent: function(tile, index, wasAnimated) {
      var e = document.createEvent('Event');
      e.initEvent('tilePage:tile_added', true, true);
      e.addedIndex = index;
      e.addedTile = tile;
      e.wasAnimated = wasAnimated;
      this.dispatchEvent(e);
    },

    /**
     * Removes the given tile and animates the repositioning of the other tiles.
     * @param {boolean=} opt_animate Whether the removal should be animated.
     * @param {boolean=} opt_dontNotify Whether a page should be removed if the
     *     last tile is removed from it.
     */
    removeTile: function(tile, opt_animate, opt_dontNotify) {
      if (opt_animate)
        this.classList.add('animating-tile-page');

      var index = tile.index;
      tile.parentNode.removeChild(tile);
      this.calculateLayoutValues_();
      this.cleanupDrag();
      this.updateFocusableElement();

      if (!opt_dontNotify)
        this.fireRemovedEvent(tile, index, !!opt_animate);
    },

    /**
     * Notify interested subscribers that a tile has been removed from this
     * page.
     * @param {Tile} tile The tile that was removed.
     * @param {number} oldIndex Where the tile was positioned before removal.
     * @param {boolean} wasAnimated Whether the removal was animated.
     */
    fireRemovedEvent: function(tile, oldIndex, wasAnimated) {
      var e = document.createEvent('Event');
      e.initEvent('tilePage:tile_removed', true, true);
      e.removedIndex = oldIndex;
      e.removedTile = tile;
      e.wasAnimated = wasAnimated;
      this.dispatchEvent(e);
    },

    /**
     * Removes all tiles from the page.
     */
    removeAllTiles: function() {
      this.tileGrid_.innerHTML = '';
    },

    /**
     * Called when the page is selected (in the card selector).
     * @param {Event} e A custom cardselected event.
     * @private
     */
    handleCardSelection_: function(e) {
      this.updateFocusableElement();

      // When we are selected, we re-calculate the layout values. (See comment
      // in doDrop.)
      this.calculateLayoutValues_();
    },

    /**
     * Called when the page loses selection (in the card selector).
     * @param {Event} e A custom carddeselected event.
     * @private
     */
    handleCardDeselection_: function(e) {
      if (this.currentFocusElement_)
        this.currentFocusElement_.tabIndex = -1;
    },

    /**
     * When we get focus, pass it on to the focus element.
     * @param {Event} e The focus event.
     * @private
     */
    handleFocus_: function(e) {
      if (this.focusableElements_.length == 0)
        return;

      this.updateFocusElement_();
    },

    /**
     * Since we are doing custom focus handling, we have to manually
     * set focusability on click (as well as keyboard nav above).
     * @param {Event} e The focus event.
     * @private
     */
    handleMouseDown_: function(e) {
      var focusable = findAncestorByClass(e.target, 'focusable');
      if (focusable) {
        this.focusElementIndex_ =
            Array.prototype.indexOf.call(this.focusableElements_,
                                         focusable);
        this.updateFocusElement_();
      } else {
        // This prevents the tile page from getting focus when the user clicks
        // inside the grid but outside of any tile.
        e.preventDefault();
      }
    },

    /**
     * Handle arrow key focus nav.
     * @param {Event} e The focus event.
     * @private
     */
    handleKeyDown_: function(e) {
      // We only handle up, down, left, right without control keys.
      if (e.metaKey || e.shiftKey || e.altKey || e.ctrlKey)
        return;

      // Wrap the given index to |this.focusableElements_|.
      var wrap = function(idx) {
        return (idx + this.focusableElements_.length) %
            this.focusableElements_.length;
      }.bind(this);

      switch (e.keyIdentifier) {
        case 'Right':
        case 'Left':
          var direction = e.keyIdentifier == 'Right' ? 1 : -1;
          this.focusElementIndex_ = wrap(this.focusElementIndex_ + direction);
          break;
        case 'Up':
        case 'Down':
          // Look through all focusable elements. Find the first one that is
          // in the same column.
          var direction = e.keyIdentifier == 'Up' ? -1 : 1;
          var currentIndex =
              Array.prototype.indexOf.call(this.focusableElements_,
                                           this.currentFocusElement_);
          var newFocusIdx = wrap(currentIndex + direction);
          var tile = this.currentFocusElement_.parentNode;
          for (;; newFocusIdx = wrap(newFocusIdx + direction)) {
            var newTile = this.focusableElements_[newFocusIdx].parentNode;
            var rowTiles = this.layoutValues_.numRowTiles;
            if ((newTile.index - tile.index) % rowTiles == 0)
              break;
          }

          this.focusElementIndex_ = newFocusIdx;
          break;

        default:
          return;
      }

      this.updateFocusElement_();

      e.preventDefault();
      e.stopPropagation();
    },

    /**
     * Ensure 0 <= this.focusElementIndex_ < this.focusableElements_.length,
     * make the focusable element at this.focusElementIndex_ (if any) eligible
     * for tab focus, and the previously-focused element not eligible.
     * @protected
     */
    updateFocusableElement: function() {
      if (this.focusableElements_.length == 0 || !this.selected) {
        this.focusElementIndex_ = -1;
        return;
      }

      this.focusElementIndex_ = Math.min(this.focusableElements_.length - 1,
                                         this.focusElementIndex_);
      this.focusElementIndex_ = Math.max(0, this.focusElementIndex_);

      var newFocusElement = this.focusableElements_[this.focusElementIndex_];
      var lastFocusElement = this.currentFocusElement_;
      if (lastFocusElement && lastFocusElement != newFocusElement)
        lastFocusElement.tabIndex = -1;

      newFocusElement.tabIndex = 1;
    },

    /**
     * Focuses the element at |this.focusElementIndex_|. Makes the previous
     * focus element, if any, no longer eligible for tab focus.
     * @private
     */
    updateFocusElement_: function() {
      this.updateFocusableElement();
      if (this.focusElementIndex_ >= 0)
        this.focusableElements_[this.focusElementIndex_].focus();
    },

    /**
     * The current focus element is that element which is eligible for focus.
     * @type {HTMLElement} The node.
     * @private
     */
    get currentFocusElement_() {
      return this.querySelector('.focusable[tabindex="1"]');
    },

    /**
     * Makes some calculations for tile layout. These change depending on
     * height, width, and the number of tiles.
     * TODO(estade): optimize calls to this function. Do nothing if the page is
     * hidden, but call before being shown.
     * @private
     */
    calculateLayoutValues_: function() {
      var grid = this.gridValues_;
      var availableSpace = this.tileGrid_.clientWidth - 2 * MIN_WIDE_MARGIN;
      var wide = availableSpace >= grid.minWideWidth;
      var numRowTiles = wide ? grid.maxColCount : grid.minColCount;

      var effectiveGridWidth = wide ?
          Math.min(Math.max(availableSpace, grid.minWideWidth),
                   grid.maxWideWidth) :
          grid.narrowWidth;
      var realTileValues = tileValuesForGrid(effectiveGridWidth, numRowTiles,
                                             grid.tileSpacingFraction);

      // leftMargin centers the grid within the avaiable space.
      var minMargin = wide ? MIN_WIDE_MARGIN : 0;
      var leftMargin =
          Math.max(minMargin,
                   (this.tileGrid_.clientWidth - effectiveGridWidth) / 2);

      var rowHeight = this.heightForWidth(realTileValues.tileWidth) +
          realTileValues.interTileSpacing;

      this.layoutValues_ = {
        colWidth: realTileValues.offsetX,
        gridWidth: effectiveGridWidth,
        leftMargin: leftMargin,
        numRowTiles: numRowTiles,
        rowHeight: rowHeight,
        tileWidth: realTileValues.tileWidth,
        wide: wide,
      };

      // We need to update the top margin as well.
      this.updateTopMargin_();

      this.firePageLayoutEvent_();
    },

    /**
     * Dispatches the custom pagelayout event.
     * @private
     */
    firePageLayoutEvent_: function() {
      cr.dispatchSimpleEvent(this, 'pagelayout', true, true);
    },

    /**
     * @return {number} The amount of margin that should be animated (in pixels)
     *     for the current grid layout.
     */
    getAnimatedLeftMargin_: function() {
      if (this.layoutValues_.wide)
        return 0;

      var grid = this.gridValues_;
      return (grid.minWideWidth - MIN_WIDE_MARGIN - grid.narrowWidth) / 2;
    },

    /**
     * Calculates the x/y coordinates for an element and moves it there.
     * @param {number} index The index of the element to be positioned.
     * @param {number} indexOffset If provided, this is added to |index| when
     *     positioning the tile. The effect is that the tile will be positioned
     *     in a non-default location.
     * @private
     */
    positionTile_: function(index, indexOffset) {
      var grid = this.gridValues_;
      var layout = this.layoutValues_;

      indexOffset = typeof indexOffset != 'undefined' ? indexOffset : 0;
      // Add the offset _after_ the modulus division. We might want to show the
      // tile off the side of the grid.
      var col = index % layout.numRowTiles + indexOffset;
      var row = Math.floor(index / layout.numRowTiles);
      // Calculate the final on-screen position for the tile.
      var realX = col * layout.colWidth + layout.leftMargin;
      var realY = row * layout.rowHeight;

      // Calculate the portion of the tile's position that should be animated.
      var animatedTileValues = layout.wide ?
          grid.wideTileValues : grid.narrowTileValues;
      // Animate the difference between three-wide and six-wide.
      var animatedLeftMargin = this.getAnimatedLeftMargin_();
      var animatedX = col * animatedTileValues.offsetX + animatedLeftMargin;
      var animatedY = row * (this.heightForWidth(animatedTileValues.tileWidth) +
                             animatedTileValues.interTileSpacing);

      var tile = this.tileElements_[index];
      tile.setGridPosition(animatedX, animatedY);
      tile.firstChild.setBounds(layout.tileWidth,
                                realX - animatedX,
                                realY - animatedY);

      // This code calculates whether the tile needs to show a clone of itself
      // wrapped around the other side of the tile grid.
      var offTheRight = col == layout.numRowTiles ||
          (col == layout.numRowTiles - 1 && tile.hasDoppleganger());
      var offTheLeft = col == -1 || (col == 0 && tile.hasDoppleganger());
      if (this.isCurrentDragTarget && (offTheRight || offTheLeft)) {
        var sign = offTheRight ? 1 : -1;
        tile.showDoppleganger(-layout.numRowTiles * layout.colWidth * sign,
                              layout.rowHeight * sign);
      } else {
        tile.clearDoppleganger();
      }

      if (index == this.tileElements_.length - 1) {
        this.tileGrid_.style.height = (realY + layout.rowHeight) + 'px';
        this.queueUpdateScrollbars_();
      }
    },

    /**
     * Gets the index of the tile that should occupy coordinate (x, y). Note
     * that this function doesn't care where the tiles actually are, and will
     * return an index even for the space between two tiles. This function is
     * effectively the inverse of |positionTile_|.
     * @param {number} x The x coordinate, in pixels, relative to the left of
     *     |this|.
     * @param {number} y The y coordinate, in pixels, relative to the top of
     *     |this|.
     * @private
     */
    getWouldBeIndexForPoint_: function(x, y) {
      var grid = this.gridValues_;
      var layout = this.layoutValues_;

      var gridClientRect = this.tileGrid_.getBoundingClientRect();
      var col = Math.floor((x - gridClientRect.left - layout.leftMargin) /
                           layout.colWidth);
      if (col < 0 || col >= layout.numRowTiles)
        return -1;

      if (isRTL())
        col = layout.numRowTiles - 1 - col;

      var row = Math.floor((y - gridClientRect.top) / layout.rowHeight);
      return row * layout.numRowTiles + col;
    },

    /**
     * Window resize event handler. Window resizes may trigger re-layouts.
     * @param {Object} e The resize event.
     */
    onResize_: function(e) {
      if (this.lastWidth_ == this.clientWidth &&
          this.lastHeight_ == this.clientHeight) {
        return;
      }

      this.calculateLayoutValues_();

      this.lastWidth_ = this.clientWidth;
      this.lastHeight_ = this.clientHeight;
      this.classList.add('animating-tile-page');
      this.heightChanged_();

      this.positionNotification_();
      this.repositionTiles_();
    },

    /**
     * The tile grid has an image mask which fades at the edges. We only show
     * the mask when there is an active drag; it obscures doppleganger tiles
     * as they enter or exit the grid.
     * @private
     */
    updateMask_: function() {
      if (!this.isCurrentDragTarget) {
        this.tileGrid_.style.WebkitMaskBoxImage = '';
        return;
      }

      var leftMargin = this.layoutValues_.leftMargin;
      // The fade distance is the space between tiles.
      var fadeDistance = (this.gridValues_.tileSpacingFraction *
          this.layoutValues_.tileWidth);
      fadeDistance = Math.min(leftMargin, fadeDistance);
      // On Skia we don't use any fade because it works very poorly. See
      // http://crbug.com/99373
      if (!cr.isMac)
        fadeDistance = 1;
      var gradient =
          '-webkit-linear-gradient(left,' +
              'transparent, ' +
              'transparent ' + (leftMargin - fadeDistance) + 'px, ' +
              'black ' + leftMargin + 'px, ' +
              'black ' + (this.tileGrid_.clientWidth - leftMargin) + 'px, ' +
              'transparent ' + (this.tileGrid_.clientWidth - leftMargin +
                                fadeDistance) + 'px, ' +
              'transparent)';
      this.tileGrid_.style.WebkitMaskBoxImage = gradient;
    },

    updateTopMargin_: function() {
      var layout = this.layoutValues_;

      // The top margin is set so that the vertical midpoint of the grid will
      // be 1/3 down the page.
      var numTiles = this.tileCount +
          (this.isCurrentDragTarget && !this.withinPageDrag_ ? 1 : 0);
      var numRows = Math.max(1, Math.ceil(numTiles / layout.numRowTiles));
      var usedHeight = layout.rowHeight * numRows;
      var newMargin = document.documentElement.clientHeight / 3 -
          usedHeight / 3 - this.contentPadding;
      // The 'height' style attribute of topMargin is non-zero to work around
      // webkit's collapsing margin behavior, so we have to factor that into
      // our calculations here.
      newMargin = Math.max(newMargin, 0) - this.topMargin_.offsetHeight;

      // |newMargin| is the final margin we actually want to show. However,
      // part of that should be animated and part should not (for the same
      // reason as with leftMargin). The approach is to consider differences
      // when the layout changes from wide to narrow or vice versa as
      // 'animatable'. These differences accumulate in animatedTopMarginPx_,
      // while topMarginPx_ caches the real (total) margin. Either of these
      // calculations may come out to be negative, so we use margins as the
      // css property.

      if (typeof this.topMarginIsForWide_ == 'undefined')
        this.topMarginIsForWide_ = layout.wide;
      if (this.topMarginIsForWide_ != layout.wide) {
        this.animatedTopMarginPx_ += newMargin - this.topMarginPx_;
        this.topMargin_.style.marginBottom = toCssPx(this.animatedTopMarginPx_);
      }

      this.topMarginIsForWide_ = layout.wide;
      this.topMarginPx_ = newMargin;
      this.topMargin_.style.marginTop =
          toCssPx(this.topMarginPx_ - this.animatedTopMarginPx_);
    },

    /**
     * Position the notification if there's one showing.
     */
    positionNotification_: function() {
      var notification = this.notification;
      if (!notification || notification.hidden)
        return;

      // Update the horizontal position.
      var animatedLeftMargin = this.getAnimatedLeftMargin_();
      notification.style.WebkitMarginStart = animatedLeftMargin + 'px';
      var leftOffset = (this.layoutValues_.leftMargin - animatedLeftMargin) *
                       (isRTL() ? -1 : 1);
      notification.style.WebkitTransform = 'translateX(' + leftOffset + 'px)';

      // Update the allowable widths of the text.
      var buttonWidth = notification.querySelector('button').offsetWidth + 8;
      notification.querySelector('span').style.maxWidth =
          this.layoutValues_.gridWidth - buttonWidth + 'px';

      // This makes sure the text doesn't condense smaller than the narrow size
      // of the grid (e.g. when a user makes the window really small).
      notification.style.minWidth =
          this.gridValues_.narrowWidth - buttonWidth + 'px';

      // Update the top position.
      notification.style.marginTop = -notification.offsetHeight + 'px';
    },

    /**
     * Handles final setup that can only happen after |this| is inserted into
     * the page.
     * @private
     */
    onNodeInsertedIntoDocument_: function(e) {
      this.calculateLayoutValues_();
      this.heightChanged_();
    },

    /**
     * Called when the height of |this| has changed: update the size of
     * tileGrid.
     * @private
     */
    heightChanged_: function() {
      // The tile grid will expand to the bottom footer, or enough to hold all
      // the tiles, whichever is greater. It would be nicer if tilePage were
      // a flex box, and the tile grid could be box-flex: 1, but this exposes a
      // bug where repositioning tiles will cause the scroll position to reset.
      this.tileGrid_.style.minHeight = (this.clientHeight -
          this.tileGrid_.offsetTop - this.content_.offsetTop -
          this.extraBottomPadding -
          (this.footerNode_ ? this.footerNode_.clientHeight : 0)) + 'px';
    },

     /**
      * Places an element at the bottom of the content div. Used in bare-minimum
      * mode to hold #footer.
      * @param {HTMLElement} footerNode The node to append to content.
      */
    appendFooter: function(footerNode) {
      this.footerNode_ = footerNode;
      this.content_.appendChild(footerNode);
    },

    /**
     * Scrolls the page in response to an mousewheel event, although the event
     * may have been triggered on a different element. Return true if the
     * event triggered scrolling, and false otherwise.
     * This is called explicitly, which allows a consistent experience whether
     * the user scrolls on the page or on the page switcher, because this
     * function provides a common conversion factor between wheel delta and
     * scroll delta.
     * @param {Event} e The mousewheel event.
     */
    handleMouseWheel: function(e) {
      if (e.wheelDeltaY == 0)
        return false;

      this.content_.scrollTop -= e.wheelDeltaY / 3;
      return true;
    },

    /**
     * Handler for the 'scroll' event on |content_|.
     * @param {Event} e The scroll event.
     * @private
     */
    onScroll_: function(e) {
      this.queueUpdateScrollbars_();
    },

    /**
     * ID of scrollbar update timer. If 0, there's no scrollbar re-calc queued.
     * @private
     */
    scrollbarUpdate_: 0,

    /**
     * Queues an update on the custom scrollbar. Used for two reasons: first,
     * coalescing of multiple updates, and second, because action like
     * repositioning a tile can require a delay before they affect values
     * like clientHeight.
     * @private
     */
    queueUpdateScrollbars_: function() {
      if (this.scrollbarUpdate_)
        return;

      this.scrollbarUpdate_ = window.setTimeout(
          this.doUpdateScrollbars_.bind(this), 0);
    },

    /**
     * Does the work of calculating the visibility, height and position of the
     * scrollbar thumb (there is no track or buttons).
     * @private
     */
    doUpdateScrollbars_: function() {
      this.scrollbarUpdate_ = 0;

      var content = this.content_;

      // Adjust scroll-height to account for possible header-bar.
      var adjustedScrollHeight = content.scrollHeight - content.offsetTop;

      if (adjustedScrollHeight <= content.clientHeight) {
        this.scrollbar_.hidden = true;
        return;
      } else {
        this.scrollbar_.hidden = false;
      }

      var thumbTop = content.offsetTop +
          content.scrollTop / adjustedScrollHeight * content.clientHeight;
      var thumbHeight = content.clientHeight / adjustedScrollHeight *
          this.clientHeight;

      this.scrollbar_.style.top = thumbTop + 'px';
      this.scrollbar_.style.height = thumbHeight + 'px';
      this.firePageLayoutEvent_();
    },

    /**
     * Get the height for a tile of a certain width. Override this function to
     * get non-square tiles.
     * @param {number} width The pixel width of a tile.
     * @return {number} The height for |width|.
     */
    heightForWidth: function(width) {
      return width;
    },

    /** Dragging **/

    get isCurrentDragTarget() {
      return this.dragWrapper_.isCurrentDragTarget;
    },

    /**
     * Thunk for dragleave events fired on |tileGrid_|.
     * @param {Event} e A MouseEvent for the drag.
     */
    doDragLeave: function(e) {
      this.cleanupDrag();
    },

    /**
     * Performs all actions necessary when a drag enters the tile page.
     * @param {Event} e A mouseover event for the drag enter.
     */
    doDragEnter: function(e) {
      // Applies the mask so doppleganger tiles disappear into the fog.
      this.updateMask_();

      this.classList.add('animating-tile-page');
      this.withinPageDrag_ = this.contains(currentlyDraggingTile);
      this.dragItemIndex_ = this.withinPageDrag_ ?
          currentlyDraggingTile.index : this.tileElements_.length;
      this.currentDropIndex_ = this.dragItemIndex_;

      // The new tile may change the number of rows, hence the top margin
      // will change.
      if (!this.withinPageDrag_)
        this.updateTopMargin_();

      this.doDragOver(e);
    },

    /**
     * Performs all actions necessary when the user moves the cursor during
     * a drag over the tile page.
     * @param {Event} e A mouseover event for the drag over.
     */
    doDragOver: function(e) {
      e.preventDefault();

      this.setDropEffect(e.dataTransfer);
      var newDragIndex = this.getWouldBeIndexForPoint_(e.pageX, e.pageY);
      if (newDragIndex < 0 || newDragIndex >= this.tileElements_.length)
        newDragIndex = this.dragItemIndex_;
      this.updateDropIndicator_(newDragIndex);
    },

    /**
     * Performs all actions necessary when the user completes a drop.
     * @param {Event} e A mouseover event for the drag drop.
     */
    doDrop: function(e) {
      e.stopPropagation();
      e.preventDefault();

      var index = this.currentDropIndex_;
      // Only change data if this was not a 'null drag'.
      if (!((index == this.dragItemIndex_) && this.withinPageDrag_)) {
        var adjustedIndex = this.currentDropIndex_ +
            (index > this.dragItemIndex_ ? 1 : 0);
        if (this.withinPageDrag_) {
          this.tileGrid_.insertBefore(
              currentlyDraggingTile,
              this.tileElements_[adjustedIndex]);
          this.tileMoved(currentlyDraggingTile, this.dragItemIndex_);
        } else {
          var originalPage = currentlyDraggingTile ?
              currentlyDraggingTile.tilePage : null;
          this.addDragData(e.dataTransfer, adjustedIndex);
          if (originalPage)
            originalPage.cleanupDrag();
        }

        // Dropping the icon may cause topMargin to change, but changing it
        // now would cause everything to move (annoying), so we leave it
        // alone. The top margin will be re-calculated next time the window is
        // resized or the page is selected.
      }

      this.classList.remove('animating-tile-page');
      this.cleanupDrag();
    },

    /**
     * Appends the currently dragged tile to the end of the page. Called
     * from outside the page, e.g. when dropping on a nav dot.
     */
    appendDraggingTile: function() {
      var originalPage = currentlyDraggingTile.tilePage;
      if (originalPage == this)
        return;

      this.addDragData(null, this.tileElements_.length);
      if (originalPage)
        originalPage.cleanupDrag();
    },

    /**
     * Makes sure all the tiles are in the right place after a drag is over.
     */
    cleanupDrag: function() {
      this.repositionTiles_(currentlyDraggingTile);
      // Remove the drag mask.
      this.updateMask_();
    },

    /**
     * Reposition all the tiles (possibly ignoring one).
     * @param {?Node} ignoreNode An optional node to ignore.
     * @private
     */
    repositionTiles_: function(ignoreNode) {
      for (var i = 0; i < this.tileElements_.length; i++) {
        if (!ignoreNode || ignoreNode !== this.tileElements_[i])
          this.positionTile_(i);
      }
    },

    /**
     * Updates the visual indicator for the drop location for the active drag.
     * @param {Event} e A MouseEvent for the drag.
     * @private
     */
    updateDropIndicator_: function(newDragIndex) {
      var oldDragIndex = this.currentDropIndex_;
      if (newDragIndex == oldDragIndex)
        return;

      var repositionStart = Math.min(newDragIndex, oldDragIndex);
      var repositionEnd = Math.max(newDragIndex, oldDragIndex);

      for (var i = repositionStart; i <= repositionEnd; i++) {
        if (i == this.dragItemIndex_)
          continue;
        else if (i > this.dragItemIndex_)
          var adjustment = i <= newDragIndex ? -1 : 0;
        else
          var adjustment = i >= newDragIndex ? 1 : 0;

        this.positionTile_(i, adjustment);
      }
      this.currentDropIndex_ = newDragIndex;
    },

    /**
     * Checks if a page can accept a drag with the given data.
     * @param {Event} e The drag event if the drag object. Implementations will
     *     likely want to check |e.dataTransfer|.
     * @return {boolean} True if this page can handle the drag.
     */
    shouldAcceptDrag: function(e) {
      return false;
    },

    /**
     * Called to accept a drag drop. Will not be called for in-page drops.
     * @param {Object} dataTransfer The data transfer object that holds the drop
     *     data. This should only be used if currentlyDraggingTile is null.
     * @param {number} index The tile index at which the drop occurred.
     */
    addDragData: function(dataTransfer, index) {
      assert(false);
    },

    /**
     * Called when a tile has been moved (via dragging). Override this to make
     * backend updates.
     * @param {Node} draggedTile The tile that was dropped.
     * @param {number} prevIndex The previous index of the tile.
     */
    tileMoved: function(draggedTile, prevIndex) {
    },

    /**
     * Sets the drop effect on |dataTransfer| to the desired value (e.g.
     * 'copy').
     * @param {Object} dataTransfer The drag event dataTransfer object.
     */
    setDropEffect: function(dataTransfer) {
      assert(false);
    },
  };

  return {
    getCurrentlyDraggingTile: getCurrentlyDraggingTile,
    setCurrentDropEffect: setCurrentDropEffect,
    TilePage: TilePage,
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('ntp', function() {
  'use strict';

  var APP_LAUNCH = {
    // The histogram buckets (keep in sync with extension_constants.h).
    NTP_APPS_MAXIMIZED: 0,
    NTP_APPS_COLLAPSED: 1,
    NTP_APPS_MENU: 2,
    NTP_MOST_VISITED: 3,
    NTP_RECENTLY_CLOSED: 4,
    NTP_APP_RE_ENABLE: 16,
    NTP_WEBSTORE_FOOTER: 18,
    NTP_WEBSTORE_PLUS_ICON: 19,
  };

  // Histogram buckets for UMA tracking of where a DnD drop came from.
  var DRAG_SOURCE = {
    SAME_APPS_PANE: 0,
    OTHER_APPS_PANE: 1,
    MOST_VISITED_PANE: 2,
    BOOKMARKS_PANE: 3,
    OUTSIDE_NTP: 4
  };
  var DRAG_SOURCE_LIMIT = DRAG_SOURCE.OUTSIDE_NTP + 1;

  /**
   * App context menu. The class is designed to be used as a singleton with
   * the app that is currently showing a context menu stored in this.app_.
   * @constructor
   */
  function AppContextMenu() {
    this.__proto__ = AppContextMenu.prototype;
    this.initialize();
  }
  cr.addSingletonGetter(AppContextMenu);

  AppContextMenu.prototype = {
    initialize: function() {
      var menu = new cr.ui.Menu;
      cr.ui.decorate(menu, cr.ui.Menu);
      menu.classList.add('app-context-menu');
      this.menu = menu;

      this.launch_ = this.appendMenuItem_();
      this.launch_.addEventListener('activate', this.onLaunch_.bind(this));

      menu.appendChild(cr.ui.MenuItem.createSeparator());
      this.launchRegularTab_ =
          this.appendMenuItem_('applaunchtyperegular', 'OPEN_AS_REGULAR_TAB');
      this.launchPinnedTab_ =
          this.appendMenuItem_('applaunchtypepinned', 'OPEN_AS_PINNED_TAB');
      this.launchNewWindow_ =
          this.appendMenuItem_('applaunchtypewindow', 'OPEN_AS_WINDOW');
      this.launchFullscreen_ =
          this.appendMenuItem_('applaunchtypefullscreen', 'OPEN_FULL_SCREEN');

      var self = this;
      this.forAllLaunchTypes_(function(launchTypeButton, name) {
        launchTypeButton.addEventListener('activate',
            self.onLaunchTypeChanged_.bind(self));
      });

      this.launchTypeMenuSeparator_ = cr.ui.MenuItem.createSeparator();
      menu.appendChild(this.launchTypeMenuSeparator_);
      this.options_ = this.appendMenuItem_('appoptions');
      this.details_ = this.appendMenuItem_('appdetails');
      this.uninstall_ = this.appendMenuItem_('appuninstall');
      this.options_.addEventListener('activate',
                                     this.onShowOptions_.bind(this));
      this.details_.addEventListener('activate',
                                     this.onShowDetails_.bind(this));
      this.uninstall_.addEventListener('activate',
                                       this.onUninstall_.bind(this));

      if (!cr.isChromeOS) {
        this.createShortcutSeparator_ =
            menu.appendChild(cr.ui.MenuItem.createSeparator());
        this.createShortcut_ = this.appendMenuItem_('appcreateshortcut');
        this.createShortcut_.addEventListener(
            'activate', this.onCreateShortcut_.bind(this));
      }

      document.body.appendChild(menu);
    },

    /**
     * Appends a menu item to |this.menu|.
     * @param {?string} textId If non-null, the ID for the localized string
     *     that acts as the item's label.
     * @param {?string} name If non-null, the name of the button.
     */
    appendMenuItem_: function(textId, name) {
      var button = cr.doc.createElement('button');
      this.menu.appendChild(button);
      cr.ui.decorate(button, cr.ui.MenuItem);
      if (textId)
        button.textContent = loadTimeData.getString(textId);
      if (name)
        button.name = name;
      return button;
    },

    /**
     * Iterates over all the launch type menu items.
     * @param {function(cr.ui.MenuItem, string)} f The function to call for each
     *     menu item. The parameters to the function include the menu item and
     *     the associated launch type name.
     */
    forAllLaunchTypes_: function(f) {
      // Order matters: index matches launchType id.
      var launchTypes = [this.launchPinnedTab_,
                         this.launchRegularTab_,
                         this.launchFullscreen_,
                         this.launchNewWindow_];

      for (var i = 0; i < launchTypes.length; ++i) {
        if (!launchTypes[i])
          continue;

        f(launchTypes[i], launchTypes[i].name);
      }
    },

    /**
     * Does all the necessary setup to show the menu for the given app.
     * @param {App} app The App object that will be showing a context menu.
     */
    setupForApp: function(app) {
      this.app_ = app;

      this.launch_.textContent = app.appData.title;

      var availableLaunchTypes = app.appData.availableLaunchTypes;
      if (availableLaunchTypes) {
        this.forAllLaunchTypes_(function(launchTypeButton, name) {
          launchTypeButton.hidden = true;
        });

        for (var i = 0; i < availableLaunchTypes.length; i++) {
          switch (availableLaunchTypes[i]) {
          case 'OPEN_AS_REGULAR_TAB':
            this.launchRegularTab_.hidden = false;
            break;
          case 'OPEN_AS_PINNED_TAB':
            this.launchPinnedTab_.hidden = false;
            break;
          case 'OPEN_AS_WINDOW':
            this.launchNewWindow_.hidden = false;
            break;
          case 'OPEN_FULL_SCREEN':
            this.launchFullscreen_.hidden = false;
            break;
          }
        }
      }

      this.forAllLaunchTypes_(function(launchTypeButton, name) {
        launchTypeButton.disabled = false;
        launchTypeButton.checked = app.appData.launch_type == name;
        if (availableLaunchTypes) {
          if (app.appData.packagedApp)
            launchTypeButton.hidden = true;
        } else {
          launchTypeButton.hidden = app.appData.packagedApp;
        }
      });

      this.launchTypeMenuSeparator_.hidden = app.appData.packagedApp;

      this.options_.disabled = !app.appData.optionsUrl || !app.appData.enabled;
      this.details_.disabled = !app.appData.detailsUrl;
      this.uninstall_.disabled = !app.appData.mayDisable;

      if (cr.isMac) {
        // On Windows and Linux, these should always be visible. On ChromeOS,
        // they are never created. On Mac, shortcuts can only be created for
        // new-style packaged apps, so hide the menu item. Also check if
        // loadTimeData explicitly disables this as the feature is not yet
        // enabled by default on Mac.
        this.createShortcutSeparator_.hidden = this.createShortcut_.hidden =
            !app.appData.packagedApp ||
            loadTimeData.getBoolean('disableCreateAppShortcut');
      }
    },

    /**
     * Handlers for menu item activation.
     * @param {Event} e The activation event.
     * @private
     */
    onLaunch_: function(e) {
      chrome.send('launchApp', [this.app_.appId, APP_LAUNCH.NTP_APPS_MENU]);
    },
    onLaunchTypeChanged_: function(e) {
      var pressed = e.currentTarget;
      var app = this.app_;
      var targetLaunchType = pressed;
      this.forAllLaunchTypes_(function(launchTypeButton, name) {
        if (launchTypeButton == targetLaunchType) {
          chrome.send('setLaunchType', [app.appId, name]);
          // Manually update the launch type. We will only get
          // appsPrefChangeCallback calls after changes to other NTP instances.
          app.appData.launch_type = name;
        }
      });
    },
    onShowOptions_: function(e) {
      window.location = this.app_.appData.optionsUrl;
    },
    onShowDetails_: function(e) {
      var url = this.app_.appData.detailsUrl;
      url = appendParam(url, 'utm_source', 'chrome-ntp-launcher');
      window.location = url;
    },
    onUninstall_: function(e) {
      chrome.send('uninstallApp', [this.app_.appData.id]);
    },
    onCreateShortcut_: function(e) {
      chrome.send('createAppShortcut', [this.app_.appData.id]);
    },
  };

  /**
   * Creates a new App object.
   * @param {Object} appData The data object that describes the app.
   * @constructor
   * @extends {HTMLDivElement}
   */
  function App(appData) {
    var el = cr.doc.createElement('div');
    el.__proto__ = App.prototype;
    el.initialize(appData);

    return el;
  }

  App.prototype = {
    __proto__: HTMLDivElement.prototype,

    /**
     * Initialize the app object.
     * @param {Object} appData The data object that describes the app.
     */
    initialize: function(appData) {
      this.appData = appData;
      assert(this.appData_.id, 'Got an app without an ID');
      this.id = this.appData_.id;
      this.setAttribute('role', 'menuitem');

      this.className = 'app focusable';

      if (!this.appData_.icon_big_exists && this.appData_.icon_small_exists)
        this.useSmallIcon_ = true;

      this.appContents_ = this.useSmallIcon_ ?
          $('app-small-icon-template').cloneNode(true) :
          $('app-large-icon-template').cloneNode(true);
      this.appContents_.id = '';
      this.appendChild(this.appContents_);

      this.appImgContainer_ = this.querySelector('.app-img-container');
      this.appImg_ = this.appImgContainer_.querySelector('img');
      this.setIcon();

      if (this.useSmallIcon_) {
        this.imgDiv_ = this.querySelector('.app-icon-div');
        this.addLaunchClickTarget_(this.imgDiv_);
        this.imgDiv_.title = this.appData_.full_name;
        chrome.send('getAppIconDominantColor', [this.appImgSrc_, this.id]);
      } else {
        this.addLaunchClickTarget_(this.appImgContainer_);
        this.appImgContainer_.title = this.appData_.full_name;
      }

      // The app's full name is shown in the tooltip, whereas the short name
      // is used for the label.
      var appSpan = this.appContents_.querySelector('.title');
      appSpan.textContent = this.appData_.title;
      appSpan.title = this.appData_.full_name;
      this.addLaunchClickTarget_(appSpan);

      this.addEventListener('keydown', cr.ui.contextMenuHandler);
      this.addEventListener('keyup', cr.ui.contextMenuHandler);

      // This hack is here so that appContents.contextMenu will be the same as
      // this.contextMenu.
      var self = this;
      this.appContents_.__defineGetter__('contextMenu', function() {
        return self.contextMenu;
      });
      this.appContents_.addEventListener('contextmenu',
                                         cr.ui.contextMenuHandler);

      this.addEventListener('mousedown', this.onMousedown_, true);
      this.addEventListener('keydown', this.onKeydown_);
      this.addEventListener('keyup', this.onKeyup_);
    },

    /**
     * Sets the color of the favicon dominant color bar.
     * @param {string} color The css-parsable value for the color.
     */
    set stripeColor(color) {
      this.querySelector('.color-stripe').style.backgroundColor = color;
    },

    /**
     * Removes the app tile from the page. Should be called after the app has
     * been uninstalled.
     */
    remove: function(opt_animate) {
      // Unset the ID immediately, because the app is already gone. But leave
      // the tile on the page as it animates out.
      this.id = '';
      this.tile.doRemove(opt_animate);
    },

    /**
     * Set the URL of the icon from |appData_|. This won't actually show the
     * icon until loadIcon() is called (for performance reasons; we don't want
     * to load icons until we have to).
     */
    setIcon: function() {
      var src = this.useSmallIcon_ ? this.appData_.icon_small :
                                     this.appData_.icon_big;
      if (!this.appData_.enabled ||
          (!this.appData_.offlineEnabled && !navigator.onLine)) {
        src += '?grayscale=true';
      }

      this.appImgSrc_ = src;
      this.classList.add('icon-loading');
    },

    /**
     * Shows the icon for the app. That is, it causes chrome to load the app
     * icon resource.
     */
    loadIcon: function() {
      if (this.appImgSrc_) {
        var imgId = "appimg-" + this.appData_.id
        this.appImg_.id = imgId;
        chrome.send("_getAppImage", [this.appImgSrc_ + "?" + new Date().getTime(), imgId]);
        this.appImg_.classList.remove('invisible');
        this.appImgSrc_ = null;
      }

      this.classList.remove('icon-loading');
    },

    /**
     * Set the size and position of the app tile.
     * @param {number} size The total size of |this|.
     * @param {number} x The x-position.
     * @param {number} y The y-position.
     *     animate.
     */
    setBounds: function(size, x, y) {
      var imgSize = size * APP_IMG_SIZE_FRACTION;
      this.appImgContainer_.style.width = this.appImgContainer_.style.height =
          toCssPx(this.useSmallIcon_ ? 16 : imgSize);
      if (this.useSmallIcon_) {
        // 3/4 is the ratio of 96px to 128px (the used height and full height
        // of icons in apps).
        var iconSize = imgSize * 3 / 4;
        // The -2 is for the div border to improve the visual alignment for the
        // icon div.
        this.imgDiv_.style.width = this.imgDiv_.style.height =
            toCssPx(iconSize - 2);
        // Margins set to get the icon placement right and the text to line up.
        this.imgDiv_.style.marginTop = this.imgDiv_.style.marginBottom =
            toCssPx((imgSize - iconSize) / 2);
      }

      this.style.width = this.style.height = toCssPx(size);
      this.style.left = toCssPx(x);
      this.style.right = toCssPx(x);
      this.style.top = toCssPx(y);
    },

    /**
     * Invoked when an app is clicked.
     * @param {Event} e The click event.
     * @private
     */
    onClick_: function(e) {
      var url = !this.appData_.is_webstore ? '' :
          appendParam(this.appData_.url,
                      'utm_source',
                      'chrome-ntp-icon');

      chrome.send('launchApp',
                  [this.appId, APP_LAUNCH.NTP_APPS_MAXIMIZED, url,
                   e.button, e.altKey, e.ctrlKey, e.metaKey, e.shiftKey]);

      // Don't allow the click to trigger a link or anything
      e.preventDefault();
    },

    /**
     * Invoked when the user presses a key while the app is focused.
     * @param {Event} e The key event.
     * @private
     */
    onKeydown_: function(e) {
      if (e.keyIdentifier == 'Enter') {
        chrome.send('launchApp',
                    [this.appId, APP_LAUNCH.NTP_APPS_MAXIMIZED, '',
                     0, e.altKey, e.ctrlKey, e.metaKey, e.shiftKey]);
        e.preventDefault();
        e.stopPropagation();
      }
      this.onKeyboardUsed_(e.keyCode);
    },

    /**
     * Invoked when the user releases a key while the app is focused.
     * @param {Event} e The key event.
     * @private
     */
    onKeyup_: function(e) {
      this.onKeyboardUsed_(e.keyCode);
    },

    /**
     * Called when the keyboard has been used (key down or up). The .click-focus
     * hack is removed if the user presses a key that can change focus.
     * @param {number} keyCode The key code of the keyboard event.
     * @private
     */
    onKeyboardUsed_: function(keyCode) {
      switch (keyCode) {
        case 9:  // Tab.
        case 37:  // Left arrow.
        case 38:  // Up arrow.
        case 39:  // Right arrow.
        case 40:  // Down arrow.
          this.classList.remove('click-focus');
      }
    },

    /**
     * Adds a node to the list of targets that will launch the app. This list
     * is also used in onMousedown to determine whether the app contents should
     * be shown as active (if we don't do this, then clicking anywhere in
     * appContents, even a part that is outside the ideally clickable region,
     * will cause the app icon to look active).
     * @param {HTMLElement} node The node that should be clickable.
     */
    addLaunchClickTarget_: function(node) {
      node.classList.add('launch-click-target');
      node.addEventListener('click', this.onClick_.bind(this));
    },

    /**
     * Handler for mousedown on the App. Adds a class that allows us to
     * not display as :active for right clicks (specifically, don't pulse on
     * these occasions). Also, we don't pulse for clicks that aren't within the
     * clickable regions.
     * @param {Event} e The mousedown event.
     */
    onMousedown_: function(e) {
      // If the current platform uses middle click to autoscroll and this
      // mousedown isn't handled, onClick_() will never fire. crbug.com/142939
      if (e.button == 1)
        e.preventDefault();

      if (e.button == 2 ||
          !findAncestorByClass(e.target, 'launch-click-target')) {
        this.appContents_.classList.add('suppress-active');
      } else {
        this.appContents_.classList.remove('suppress-active');
      }

      // This class is here so we don't show the focus state for apps that
      // gain keyboard focus via mouse clicking.
      this.classList.add('click-focus');
    },

    /**
     * Change the appData and update the appearance of the app.
     * @param {Object} appData The new data object that describes the app.
     */
    replaceAppData: function(appData) {
      this.appData_ = appData;
      this.setIcon();
      this.loadIcon();
    },

    /**
     * The data and preferences for this app.
     * @type {Object}
     */
    set appData(data) {
      this.appData_ = data;
    },
    get appData() {
      return this.appData_;
    },

    get appId() {
      return this.appData_.id;
    },

    /**
     * Returns a pointer to the context menu for this app. All apps share the
     * singleton AppContextMenu. This function is called by the
     * ContextMenuHandler in response to the 'contextmenu' event.
     * @type {cr.ui.Menu}
     */
    get contextMenu() {
      var menu = AppContextMenu.getInstance();
      menu.setupForApp(this);
      return menu.menu;
    },

    /**
     * Returns whether this element can be 'removed' from chrome (i.e. whether
     * the user can drag it onto the trash and expect something to happen).
     * @return {boolean} True if the app can be uninstalled.
     */
    canBeRemoved: function() {
      return this.appData_.mayDisable;
    },

    /**
     * Uninstalls the app after it's been dropped on the trash.
     */
    removeFromChrome: function() {
      chrome.send('uninstallApp', [this.appData_.id, true]);
    },

    /**
     * Called when a drag is starting on the tile. Updates dataTransfer with
     * data for this tile.
     */
    setDragData: function(dataTransfer) {
      dataTransfer.setData('Text', this.appData_.title);
      dataTransfer.setData('URL', this.appData_.url);
    },
  };

  var TilePage = ntp.TilePage;

  // The fraction of the app tile size that the icon uses.
  var APP_IMG_SIZE_FRACTION = 4 / 5;

  var appsPageGridValues = {
    // The fewest tiles we will show in a row.
    minColCount: 3,
    // The most tiles we will show in a row.
    maxColCount: 6,

    // The smallest a tile can be.
    minTileWidth: 64 / APP_IMG_SIZE_FRACTION,
    // The biggest a tile can be.
    maxTileWidth: 128 / APP_IMG_SIZE_FRACTION,

    // The padding between tiles, as a fraction of the tile width.
    tileSpacingFraction: 1 / 8,
  };
  TilePage.initGridValues(appsPageGridValues);

  /**
   * Changing the returned object will change the internal object as well.
   */
  function getAppsPageGridValues() {
    return appsPageGridValues;
  }

  function loadAppsPageSettings() {
    TilePage.initGridValues(appsPageGridValues);
  }

  /**
   * Creates a new AppsPage object.
   * @constructor
   * @extends {TilePage}
   */
  function AppsPage() {
    var el = new TilePage(appsPageGridValues);
    el.__proto__ = AppsPage.prototype;
    el.initialize();

    return el;
  }

  AppsPage.prototype = {
    __proto__: TilePage.prototype,

    initialize: function() {
      this.classList.add('apps-page');

      this.addEventListener('cardselected', this.onCardSelected_);

      this.addEventListener('tilePage:tile_added', this.onTileAdded_);

      this.content_.addEventListener('scroll', this.onScroll_.bind(this));
    },

    /**
     * Highlight a newly installed app as it's added to the NTP.
     * @param {Object} appData The data object that describes the app.
     */
    insertAndHighlightApp: function(appData) {
      ntp.getCardSlider().selectCardByValue(this);
      this.content_.scrollTop = this.content_.scrollHeight;
      this.insertApp(appData, true);
    },

    /**
     * Similar to appendApp, but it respects the app_launch_ordinal field of
     * |appData|.
     * @param {Object} appData The data that describes the app.
     * @param {boolean} animate Whether to animate the insertion.
     */
    insertApp: function(appData, animate) {
      var index = this.tileElements_.length;
      for (var i = 0; i < this.tileElements_.length; i++) {
        if (appData.app_launch_ordinal <
            this.tileElements_[i].firstChild.appData.app_launch_ordinal) {
          index = i;
          break;
        }
      }

      this.addTileAt(new App(appData), index, animate);
    },

    /**
     * Handler for 'cardselected' event, fired when |this| is selected. The
     * first time this is called, we load all the app icons.
     * @private
     */
    onCardSelected_: function(e) {
      var apps = this.querySelectorAll('.app.icon-loading');
      for (var i = 0; i < apps.length; i++) {
        apps[i].loadIcon();
      }
    },

    /**
     * Handler for tile additions to this page.
     * @param {Event} e The tilePage:tile_added event.
     */
    onTileAdded_: function(e) {
      assert(e.currentTarget == this);
      assert(e.addedTile.firstChild instanceof App);
      if (this.classList.contains('selected-card'))
        e.addedTile.firstChild.loadIcon();
    },

    /**
     * A handler for when the apps page is scrolled (then we need to reposition
     * the bubbles.
     * @private
     */
    onScroll_: function(e) {
      if (!this.selected)
        return;
      for (var i = 0; i < this.tileElements_.length; i++) {
        var app = this.tileElements_[i].firstChild;
        assert(app instanceof App);
      }
    },

    /** @override */
    doDragOver: function(e) {
      // Only animatedly re-arrange if the user is currently dragging an app.
      var tile = ntp.getCurrentlyDraggingTile();
      if (tile && tile.querySelector('.app')) {
        TilePage.prototype.doDragOver.call(this, e);
      } else {
        e.preventDefault();
        this.setDropEffect(e.dataTransfer);
      }
    },

    /** @override */
    shouldAcceptDrag: function(e) {
      if (ntp.getCurrentlyDraggingTile())
        return true;
      if (!e.dataTransfer || !e.dataTransfer.types)
        return false;
      return Array.prototype.indexOf.call(e.dataTransfer.types,
                                          'text/uri-list') != -1;
    },

    /** @override */
    addDragData: function(dataTransfer, index) {
      var sourceId = -1;
      var currentlyDraggingTile = ntp.getCurrentlyDraggingTile();
      if (currentlyDraggingTile) {
        var tileContents = currentlyDraggingTile.firstChild;
        if (tileContents.classList.contains('app')) {
          var originalPage = currentlyDraggingTile.tilePage;
          var samePageDrag = originalPage == this;
          sourceId = samePageDrag ? DRAG_SOURCE.SAME_APPS_PANE :
                                    DRAG_SOURCE.OTHER_APPS_PANE;
          this.tileGrid_.insertBefore(currentlyDraggingTile,
                                      this.tileElements_[index]);
          this.tileMoved(currentlyDraggingTile);
          if (!samePageDrag) {
            originalPage.fireRemovedEvent(currentlyDraggingTile, index, true);
            this.fireAddedEvent(currentlyDraggingTile, index, true);
          }
        } else if (currentlyDraggingTile.querySelector('.most-visited')) {
          this.generateAppForLink(tileContents.data);
          sourceId = DRAG_SOURCE.MOST_VISITED_PANE;
        }
      } else {
        this.addOutsideData_(dataTransfer);
        sourceId = DRAG_SOURCE.OUTSIDE_NTP;
      }

      assert(sourceId != -1);
      chrome.send('metricsHandler:recordInHistogram',
          ['NewTabPage.AppsPageDragSource', sourceId, DRAG_SOURCE_LIMIT]);
    },

    /**
     * Adds drag data that has been dropped from a source that is not a tile.
     * @param {Object} dataTransfer The data transfer object that holds drop
     *     data.
     * @private
     */
    addOutsideData_: function(dataTransfer) {
      var url = dataTransfer.getData('url');
      assert(url);

      // If the dataTransfer has html data, use that html's text contents as the
      // title of the new link.
      var html = dataTransfer.getData('text/html');
      var title;
      if (html) {
        // It's important that we don't attach this node to the document
        // because it might contain scripts.
        var node = this.ownerDocument.createElement('div');
        node.innerHTML = html;
        title = node.textContent;
      }

      // Make sure title is >=1 and <=45 characters for Chrome app limits.
      if (!title)
        title = url;
      if (title.length > 45)
        title = title.substring(0, 45);
      var data = {url: url, title: title};

      // Synthesize an app.
      this.generateAppForLink(data);
    },

    /**
     * Creates a new crx-less app manifest and installs it.
     * @param {Object} data The data object describing the link. Must have |url|
     *     and |title| members.
     */
    generateAppForLink: function(data) {
      assert(data.url != undefined);
      assert(data.title != undefined);
      var pageIndex = ntp.getAppsPageIndex(this);
      chrome.send('generateAppForLink', [data.url, data.title, pageIndex]);
    },

    /** @override */
    tileMoved: function(draggedTile) {
      if (!(draggedTile.firstChild instanceof App))
        return;

      var pageIndex = ntp.getAppsPageIndex(this);
      chrome.send('setPageIndex', [draggedTile.firstChild.appId, pageIndex]);

      var appIds = [];
      for (var i = 0; i < this.tileElements_.length; i++) {
        var tileContents = this.tileElements_[i].firstChild;
        if (tileContents instanceof App)
          appIds.push(tileContents.appId);
      }

      chrome.send('reorderApps', [draggedTile.firstChild.appId, appIds]);
    },

    /** @override */
    setDropEffect: function(dataTransfer) {
      var tile = ntp.getCurrentlyDraggingTile();
      if (tile && tile.querySelector('.app'))
        ntp.setCurrentDropEffect(dataTransfer, 'move');
      else
        ntp.setCurrentDropEffect(dataTransfer, 'copy');
    },
  };

  /**
   * Launches the specified app using the APP_LAUNCH_NTP_APP_RE_ENABLE
   * histogram. This should only be invoked from the AppLauncherHandler.
   * @param {string} appID The ID of the app.
   */
  function launchAppAfterEnable(appId) {
    chrome.send('launchApp', [appId, APP_LAUNCH.NTP_APP_RE_ENABLE]);
  }

  return {
    APP_LAUNCH: APP_LAUNCH,
    AppsPage: AppsPage,
    launchAppAfterEnable: launchAppAfterEnable,
    getAppsPageGridValues: getAppsPageGridValues,
    loadAppsPageSettings: loadAppsPageSettings
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview DotList implementation
 */

cr.define('ntp', function() {
  'use strict';

  /**
   * Live list of the navigation dots.
   * @type {!NodeList|undefined}
   */
  var navDots;

  /**
   * Creates a new DotList object.
   * @constructor
   * @extends {HTMLUListElement}
   */
  var DotList = cr.ui.define('ul');

  DotList.prototype = {
    __proto__: HTMLUListElement.prototype,

    /** @override */
    decorate: function() {
      this.addEventListener('keydown', this.onKeyDown_.bind(this));
      navDots = this.getElementsByClassName('dot');
    },

    /**
     * Live list of the navigation dots.
     * @type {!NodeList|undefined}
     */
    get dots() {
      return navDots;
    },

    /**
     * Handler for key events on the dot list. These keys will change the focus
     * element.
     * @param {Event} e The KeyboardEvent.
     */
    onKeyDown_: function(e) {
      if (e.metaKey || e.shiftKey || e.altKey || e.ctrlKey)
        return;

      var direction = 0;
      if (e.keyIdentifier == 'Left')
        direction = -1;
      else if (e.keyIdentifier == 'Right')
        direction = 1;
      else
        return;

      var focusDot = this.querySelector('.dot:focus');
      if (!focusDot)
        return;
      var focusIndex = Array.prototype.indexOf.call(navDots, focusDot);
      var newFocusIndex = focusIndex + direction;
      if (focusIndex == newFocusIndex)
        return;

      newFocusIndex = (newFocusIndex + navDots.length) % navDots.length;
      navDots[newFocusIndex].tabIndex = 3;
      navDots[newFocusIndex].focus();
      focusDot.tabIndex = -1;

      e.stopPropagation();
      e.preventDefault();
    }
  };

  return {
    DotList: DotList
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('ntp', function() {
  'use strict';

  var TilePage = ntp.TilePage;

  /**
   * A counter for generating unique tile IDs.
   */
  var tileID = 0;

  /**
   * Creates a new Most Visited object for tiling.
   * @constructor
   * @extends {HTMLAnchorElement}
   */
  function MostVisited() {
    var el = cr.doc.createElement('a');
    el.__proto__ = MostVisited.prototype;
    el.initialize();

    return el;
  }

  MostVisited.prototype = {
    __proto__: HTMLAnchorElement.prototype,

    initialize: function() {
      this.reset();

      this.addEventListener('click', this.handleClick_);
      this.addEventListener('keydown', this.handleKeyDown_);
      this.addEventListener('mouseover', this.handleMouseOver_);
    },

    get index() {
      assert(this.tile);
      return this.tile.index;
    },

    get data() {
      return this.data_;
    },

    /**
     * Clears the DOM hierarchy for this node, setting it back to the default
     * for a blank thumbnail.
     */
    reset: function() {
      this.className = 'most-visited filler real';
      this.innerHTML =
          '<span class="thumbnail-wrapper fills-parent">' +
            '<div class="close-button"></div>' +
            '<span class="thumbnail fills-parent">' +
              // thumbnail-shield provides a gradient fade effect.
              '<div class="thumbnail-shield fills-parent"></div>' +
            '</span>' +
            '<span class="favicon"></span>' +
          '</span>' +
          '<div class="color-stripe"></div>' +
          '<span class="title"></span>';

      this.querySelector('.close-button').title =
          loadTimeData.getString('removethumbnailtooltip');

      this.tabIndex = -1;
      this.data_ = null;
      this.removeAttribute('id');
      this.title = '';
    },

    /**
     * Update the appearance of this tile according to |data|.
     * @param {Object} data A dictionary of relevant data for the page.
     * @param {Object} ntpMostVisitedData Data from chrome.embeddedSearch.newTabPage.
     */
    updateForData: function(data, ntpMostVisitedData) {
      // Handle call from removeURLsFromMostVisitedBlacklist
      if (ntpMostVisitedData == undefined && data.ntpData != undefined)
        ntpMostVisitedData = data.ntpData;
      else
        data.ntpData = ntpMostVisitedData;

      if (this.classList.contains('blacklisted') && data) {
        // Animate appearance of new tile.
        this.classList.add('new-tile-contents');
      }
      this.classList.remove('blacklisted');

      if (!data || data.filler) {
        if (this.data_)
          this.reset();
        return;
      }

      var id = tileID++;
      this.id = 'most-visited-tile-' + id;
      data.restrictedId = ntpMostVisitedData.rid;
      this.data_ = data;
      this.classList.add('focusable');

      var faviconDiv = this.querySelector('.favicon');
      faviconDiv.style.backgroundImage = url(ntpMostVisitedData.faviconUrl);

      // The favicon should have the same dominant color regardless of the
      // device pixel ratio the favicon is requested for.
      chrome.send('getFaviconDominantColor',
                  [getFaviconUrlForCurrentDevicePixelRatio(data.url), this.id]);

      var title = this.querySelector('.title');
      title.textContent = data.title;
      title.dir = data.direction;

      // Sets the tooltip.
      this.title = data.title;

      var thumbnailUrl = ntpMostVisitedData.thumbnailUrl;
      this.querySelector('.thumbnail').style.backgroundImage =
          url(thumbnailUrl);

      this.href = data.url;

      this.classList.remove('filler');
    },

    /**
     * Sets the color of the favicon dominant color bar.
     * @param {string} color The css-parsable value for the color.
     */
    set stripeColor(color) {
      this.querySelector('.color-stripe').style.backgroundColor = color;
    },

    /**
     * Handles a click on the tile.
     * @param {Event} e The click event.
     */
    handleClick_: function(e) {
      if (e.target.classList.contains('close-button')) {
        this.blacklist_();
        e.preventDefault();
      } else {
        ntp.logTimeToClick('MostVisited');
        // Records an app launch from the most visited page (Chrome will decide
        // whether the url is an app). TODO(estade): this only works for clicks;
        // other actions like "open in new tab" from the context menu won't be
        // recorded. Can this be fixed?
        chrome.send('recordAppLaunchByURL',
                    [encodeURIComponent(this.href),
                     ntp.APP_LAUNCH.NTP_MOST_VISITED]);
        // Records the index of this tile.
        chrome.send('metricsHandler:recordInHistogram',
                    ['NewTabPage.MostVisited', this.index, 8]);
        // Records the action. This will be available as a time-stamped stream
        // server-side and can be used to compute time-to-long-dwell.
        chrome.send('metricsHandler:recordAction', ['MostVisited_Clicked']);
        chrome.send('mostVisitedAction',
                    [ntp.NtpFollowAction.CLICKED_TILE]);
      }
    },

    /**
     * Allow blacklisting most visited site using the keyboard.
     */
    handleKeyDown_: function(e) {
      if (!cr.isMac && e.keyCode == 46 || // Del
          cr.isMac && e.metaKey && e.keyCode == 8) { // Cmd + Backspace
        this.blacklist_();
      }
    },

    /**
     * The mouse has entered a Most Visited tile div. Only log the first
     * mouseover event. By doing this we solve the issue with the mouseover
     * event listener that bubbles up to the parent, which would cause it to
     * fire multiple times even if the mouse stays within one tile.
     */
    handleMouseOver_: function(e) {
      var self = this;
      var ancestor = findAncestor(e.relatedTarget, function(node) {
        return node == self;
      });
      // If ancestor is null, mouse is entering the parent element.
      if (ancestor == null)
        chrome.send('metricsHandler:logMouseover');
    },

    /**
     * Permanently removes a page from Most Visited.
     */
    blacklist_: function() {
      this.showUndoNotification_();
      chrome.send('blacklistURLFromMostVisited', [this.data_.restrictedId]);
      this.reset();
      chrome.send('getMostVisited');
      this.classList.add('blacklisted');
    },

    showUndoNotification_: function() {
      var data = this.data_;
      var self = this;
      var doUndo = function() {
        chrome.send('removeURLsFromMostVisitedBlacklist', [data.restrictedId]);
        self.updateForData(data);
      }

      var undo = {
        action: doUndo,
        text: loadTimeData.getString('undothumbnailremove'),
      };

      var undoAll = {
        action: function() {
          chrome.send('clearMostVisitedURLsBlacklist');
          self.reset();
          chrome.send('getMostVisited');
        },
        text: loadTimeData.getString('restoreThumbnailsShort'),
      };

      ntp.showNotification(
          loadTimeData.getString('thumbnailremovednotification'),
          [undo, undoAll]);
    },

    /**
     * Set the size and position of the most visited tile.
     * @param {number} size The total size of |this|.
     * @param {number} x The x-position.
     * @param {number} y The y-position.
     *     animate.
     */
    setBounds: function(size, x, y) {
      this.style.width = toCssPx(size);
      this.style.height = toCssPx(heightForWidth(size));

      this.style.left = toCssPx(x);
      this.style.right = toCssPx(x);
      this.style.top = toCssPx(y);
    },

    /**
     * Returns whether this element can be 'removed' from chrome (i.e. whether
     * the user can drag it onto the trash and expect something to happen).
     * @return {boolean} True, since most visited pages can always be
     *     blacklisted.
     */
    canBeRemoved: function() {
      return true;
    },

    /**
     * Removes this element from chrome, i.e. blacklists it.
     */
    removeFromChrome: function() {
      this.blacklist_();
      this.parentNode.classList.add('finishing-drag');
    },

    /**
     * Called when a drag of this tile has ended (after all animations have
     * finished).
     */
    finalizeDrag: function() {
      this.parentNode.classList.remove('finishing-drag');
    },

    /**
     * Called when a drag is starting on the tile. Updates dataTransfer with
     * data for this tile (for dragging outside of the NTP).
     */
    setDragData: function(dataTransfer) {
      dataTransfer.setData('Text', this.data_.title);
      dataTransfer.setData('URL', this.data_.url);
    },
  };

  var mostVisitedPageGridValues = {
    // The fewest tiles we will show in a row.
    minColCount: 2,
    // The most tiles we will show in a row.
    maxColCount: 4,

    // The smallest a tile can be.
    minTileWidth: 122,
    // The biggest a tile can be. 212 (max thumbnail width) + 2.
    maxTileWidth: 214,

    // The padding between tiles, as a fraction of the tile width.
    tileSpacingFraction: 1 / 8,
  };
  TilePage.initGridValues(mostVisitedPageGridValues);

  /**
   * Calculates the height for a Most Visited tile for a given width. The size
   * is based on the thumbnail, which should have a 212:132 ratio.
   * @return {number} The height.
   */
  function heightForWidth(width) {
    // The 2s are for borders, the 31 is for the title.
    return (width - 2) * 132 / 212 + 2 + 31;
  }

  var THUMBNAIL_COUNT = 8;

  /**
   * Changing the returned object will change the internal object as well.
   */
  function getMostVisitedPageGridValues() {
    return mostVisitedPageGridValues;
  }

  function loadMostVisitedPageSettings(thumbnailCount) {
    TilePage.initGridValues(mostVisitedPageGridValues);
    THUMBNAIL_COUNT = thumbnailCount;
  }

  /**
   * Creates a new MostVisitedPage object.
   * @constructor
   * @extends {TilePage}
   */
  function MostVisitedPage() {
    var el = new TilePage(mostVisitedPageGridValues);
    el.__proto__ = MostVisitedPage.prototype;
    el.initialize();

    return el;
  }

  MostVisitedPage.prototype = {
    __proto__: TilePage.prototype,

    initialize: function() {
      this.classList.add('most-visited-page');
      this.data_ = null;
      this.mostVisitedTiles_ = this.getElementsByClassName('most-visited real');

      this.addEventListener('carddeselected', this.handleCardDeselected_);
      this.addEventListener('cardselected', this.handleCardSelected_);
    },

    /**
     * Create blank (filler) tiles.
     * @private
     */
    createTiles_: function() {
      for (var i = 0; i < THUMBNAIL_COUNT; i++) {
        this.appendTile(new MostVisited());
      }
    },

    /**
     * Update the tiles after a change to |data_|.
     */
    updateTiles_: function() {
      var ntpMostVisited = chrome.embeddedSearch.newTabPage.mostVisited;

      for (var i = 0; i < THUMBNAIL_COUNT; i++) {
        var page = this.data_[i];
        var tile = this.mostVisitedTiles_[i];

        if (i >= this.data_.length)
          tile.reset();
        else
          tile.updateForData(page, ntpMostVisited[i]);
      }
    },

    /**
     * Handles the 'card deselected' event (i.e. the user clicked to another
     * pane).
     * @param {Event} e The CardChanged event.
     */
    handleCardDeselected_: function(e) {
      if (!document.documentElement.classList.contains('starting-up')) {
        chrome.send('mostVisitedAction',
                    [ntp.NtpFollowAction.CLICKED_OTHER_NTP_PANE]);
      }
    },

    /**
     * Handles the 'card selected' event (i.e. the user clicked to select the
     * Most Visited pane).
     * @param {Event} e The CardChanged event.
     */
    handleCardSelected_: function(e) {
      if (!document.documentElement.classList.contains('starting-up'))
        chrome.send('mostVisitedSelected');
    },

    /**
     * Array of most visited data objects.
     * @type {Array}
     */
    get data() {
      return this.data_;
    },
    set data(data) {
      var startTime = Date.now();

      // The first time data is set, create the tiles.
      if (!this.data_) {
        this.createTiles_();
        this.data_ = data.slice(0, THUMBNAIL_COUNT);
      } else {
        this.data_ = refreshData(this.data_, data);
      }

      this.updateTiles_();
      this.updateFocusableElement();
      logEvent('mostVisited.layout: ' + (Date.now() - startTime));
    },

    /** @override */
    shouldAcceptDrag: function(e) {
      return false;
    },

    /** @override */
    heightForWidth: heightForWidth,
  };

  /**
   * Executed once the NTP has loaded. Checks if the Most Visited pane is
   * shown or not. If it is shown, the 'mostVisitedSelected' message is sent
   * to the C++ code, to record the fact that the user has seen this pane.
   */
  MostVisitedPage.onLoaded = function() {
    if (ntp.getCardSlider() &&
        ntp.getCardSlider().currentCardValue &&
        ntp.getCardSlider().currentCardValue.classList
        .contains('most-visited-page')) {
      chrome.send('mostVisitedSelected');
    }
  }

  /**
   * We've gotten additional Most Visited data. Update our old data with the
   * new data. The ordering of the new data is not important, except when a
   * page is pinned. Thus we try to minimize re-ordering.
   * @param {Array} oldData The current Most Visited page list.
   * @param {Array} newData The new Most Visited page list.
   * @return {Array} The merged page list that should replace the current page
   *     list.
   */
  function refreshData(oldData, newData) {
    oldData = oldData.slice(0, THUMBNAIL_COUNT);
    newData = newData.slice(0, THUMBNAIL_COUNT);

    // Fix topSite and ntpMostVisited out of sync.
    return newData;

    // Copy over pinned sites directly.
    for (var j = 0; j < newData.length; j++) {
      if (newData[j].pinned) {
        oldData[j] = newData[j];
        // Mark the entry as 'updated' so we don't try to update again.
        oldData[j].updated = true;
        // Mark the newData page as 'used' so we don't try to re-use it.
        newData[j].used = true;
      }
    }

    // Look through old pages; if they exist in the newData list, keep them
    // where they are.
    for (var i = 0; i < oldData.length; i++) {
      if (!oldData[i] || oldData[i].updated)
        continue;

      for (var j = 0; j < newData.length; j++) {
        if (newData[j].used)
          continue;

        if (newData[j].url == oldData[i].url) {
          // The background image and other data may have changed.
          oldData[i] = newData[j];
          oldData[i].updated = true;
          newData[j].used = true;
          break;
        }
      }
    }

    // Look through old pages that haven't been updated yet; replace them.
    for (var i = 0; i < oldData.length; i++) {
      if (oldData[i] && oldData[i].updated)
        continue;

      for (var j = 0; j < newData.length; j++) {
        if (newData[j].used)
          continue;

        oldData[i] = newData[j];
        oldData[i].updated = true;
        newData[j].used = true;
        break;
      }

      if (oldData[i] && !oldData[i].updated)
        oldData[i] = null;
    }

    // Clear 'updated' flags so this function will work next time it's called.
    for (var i = 0; i < THUMBNAIL_COUNT; i++) {
      if (oldData[i])
        oldData[i].updated = false;
    }

    return oldData;
  };

  return {
    MostVisitedPage: MostVisitedPage,
    refreshData: refreshData,
    getMostVisitedPageGridValues: getMostVisitedPageGridValues,
    loadMostVisitedPageSettings: loadMostVisitedPageSettings
  };
});

document.addEventListener('ntpLoaded', ntp.MostVisitedPage.onLoaded);

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Trash
 * This is the class for the trash can that appears when dragging an app.
 */

cr.define('ntp', function() {
  'use strict';

  function Trash(trash) {
    trash.__proto__ = Trash.prototype;
    trash.initialize();
    return trash;
  }

  Trash.prototype = {
    __proto__: HTMLDivElement.prototype,

    initialize: function(element) {
      this.dragWrapper_ = new cr.ui.DragWrapper(this, this);
    },

    /**
     * Determines whether we are interested in the drag data for |e|.
     * @param {Event} e The event from drag enter.
     * @return {boolean} True if we are interested in the drag data for |e|.
     */
    shouldAcceptDrag: function(e) {
      var tile = ntp.getCurrentlyDraggingTile();
      if (!tile)
        return false;

      return tile.firstChild.canBeRemoved();
    },

    /**
     * Drag over handler.
     * @param {Event} e The drag event.
     */
    doDragOver: function(e) {
      ntp.getCurrentlyDraggingTile().dragClone.classList.add(
          'hovering-on-trash');
      ntp.setCurrentDropEffect(e.dataTransfer, 'move');
      e.preventDefault();
    },

    /**
     * Drag enter handler.
     * @param {Event} e The drag event.
     */
    doDragEnter: function(e) {
      this.doDragOver(e);
    },

    /**
     * Drop handler.
     * @param {Event} e The drag event.
     */
    doDrop: function(e) {
      e.preventDefault();

      var tile = ntp.getCurrentlyDraggingTile();
      tile.firstChild.removeFromChrome();
      tile.landedOnTrash = true;
    },

    /**
     * Drag leave handler.
     * @param {Event} e The drag event.
     */
    doDragLeave: function(e) {
      ntp.getCurrentlyDraggingTile().dragClone.classList.remove(
          'hovering-on-trash');
    },
  };

  return {
    Trash: Trash,
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview PageListView implementation.
 * PageListView manages page list, dot list, switcher buttons and handles apps
 * pages callbacks from backend.
 *
 * Note that you need to have AppLauncherHandler in your WebUI to use this code.
 */

cr.define('ntp', function() {
  'use strict';

  /**
   * Creates a PageListView object.
   * @constructor
   * @extends {Object}
   */
  function PageListView() {
  }

  PageListView.prototype = {
    /**
     * The CardSlider object to use for changing app pages.
     * @type {CardSlider|undefined}
     */
    cardSlider: undefined,

    /**
     * The frame div for this.cardSlider.
     * @type {!Element|undefined}
     */
    sliderFrame: undefined,

    /**
     * The 'page-list' element.
     * @type {!Element|undefined}
     */
    pageList: undefined,

    /**
     * A list of all 'tile-page' elements.
     * @type {!NodeList|undefined}
     */
    tilePages: undefined,

    /**
     * A list of all 'apps-page' elements.
     * @type {!NodeList|undefined}
     */
    appsPages: undefined,

    /**
     * The Suggestions page.
     * @type {!Element|undefined}
     */
    suggestionsPage: undefined,

    /**
     * The Most Visited page.
     * @type {!Element|undefined}
     */
    mostVisitedPage: undefined,

    /**
     * The 'dots-list' element.
     * @type {!Element|undefined}
     */
    dotList: undefined,

    /**
     * The left and right paging buttons.
     * @type {!Element|undefined}
     */
    pageSwitcherStart: undefined,
    pageSwitcherEnd: undefined,

    /**
     * The 'trash' element.  Note that technically this is unnecessary,
     * JavaScript creates the object for us based on the id.  But I don't want
     * to rely on the ID being the same, and JSCompiler doesn't know about it.
     * @type {!Element|undefined}
     */
    trash: undefined,

    /**
     * The type of page that is currently shown. The value is a numerical ID.
     * @type {number}
     */
    shownPage: 0,

    /**
     * The index of the page that is currently shown, within the page type.
     * For example if the third Apps page is showing, this will be 2.
     * @type {number}
     */
    shownPageIndex: 0,

    /**
     * EventTracker for managing event listeners for page events.
     * @type {!EventTracker}
     */
    eventTracker: new EventTracker,

    /**
     * If non-null, this is the ID of the app to highlight to the user the next
     * time getAppsCallback runs. "Highlight" in this case means to switch to
     * the page and run the new tile animation.
     * @type {?string}
     */
    highlightAppId: null,

    /**
     * Initializes page list view.
     * @param {!Element} pageList A DIV element to host all pages.
     * @param {!Element} dotList An UL element to host nav dots. Each dot
     *     represents a page.
     * @param {!Element} cardSliderFrame The card slider frame that hosts
     *     pageList and switcher buttons.
     * @param {!Element|undefined} opt_trash Optional trash element.
     * @param {!Element|undefined} opt_pageSwitcherStart Optional start page
     *     switcher button.
     * @param {!Element|undefined} opt_pageSwitcherEnd Optional end page
     *     switcher button.
     */
    initialize: function(pageList, dotList, cardSliderFrame, opt_trash,
                         opt_pageSwitcherStart, opt_pageSwitcherEnd) {
      this.pageList = pageList;

      this.dotList = dotList;
      cr.ui.decorate(this.dotList, ntp.DotList);

      this.trash = opt_trash;
      if (this.trash)
        new ntp.Trash(this.trash);

      this.pageSwitcherStart = opt_pageSwitcherStart;
      if (this.pageSwitcherStart)
        ntp.initializePageSwitcher(this.pageSwitcherStart);

      this.pageSwitcherEnd = opt_pageSwitcherEnd;
      if (this.pageSwitcherEnd)
        ntp.initializePageSwitcher(this.pageSwitcherEnd);

      this.shownPage = loadTimeData.getInteger('shown_page_type');
      this.shownPageIndex = loadTimeData.getInteger('shown_page_index');

      if (loadTimeData.getBoolean('showApps')) {
        // Request data on the apps so we can fill them in.
        // Note that this is kicked off asynchronously.  'getAppsCallback' will
        // be invoked at some point after this function returns.
        chrome.send('getApps');
      } else {
        // No apps page.
        if (this.shownPage == loadTimeData.getInteger('apps_page_id')) {
          this.setShownPage_(
              loadTimeData.getInteger('most_visited_page_id'), 0);
        }

        document.body.classList.add('bare-minimum');
      }

      document.addEventListener('keydown', this.onDocKeyDown_.bind(this));

      this.tilePages = this.pageList.getElementsByClassName('tile-page');
      this.appsPages = this.pageList.getElementsByClassName('apps-page');

      // Initialize the cardSlider without any cards at the moment.
      this.sliderFrame = cardSliderFrame;
      this.cardSlider = new cr.ui.CardSlider(this.sliderFrame, this.pageList,
          this.sliderFrame.offsetWidth);

      // Prevent touch events from triggering any sort of native scrolling if
      // there are multiple cards in the slider frame.
      var cardSlider = this.cardSlider;
      cardSliderFrame.addEventListener('touchmove', function(e) {
        if (cardSlider.cardCount <= 1)
          return;
        e.preventDefault();
      }, true);

      // Handle mousewheel events anywhere in the card slider, so that wheel
      // events on the page switchers will still scroll the page.
      // This listener must be added before the card slider is initialized,
      // because it needs to be called before the card slider's handler.
      cardSliderFrame.addEventListener('mousewheel', function(e) {
        if (cardSlider.currentCardValue.handleMouseWheel(e)) {
          e.preventDefault();  // Prevent default scroll behavior.
          e.stopImmediatePropagation();  // Prevent horizontal card flipping.
        }
      });

      this.cardSlider.initialize(
          loadTimeData.getBoolean('isSwipeTrackingFromScrollEventsEnabled'));

      // Handle events from the card slider.
      this.pageList.addEventListener('cardSlider:card_changed',
                                     this.onCardChanged_.bind(this));
      this.pageList.addEventListener('cardSlider:card_added',
                                     this.onCardAdded_.bind(this));
      this.pageList.addEventListener('cardSlider:card_removed',
                                     this.onCardRemoved_.bind(this));

      // Ensure the slider is resized appropriately with the window.
      window.addEventListener('resize', this.onWindowResize_.bind(this));

      // Update apps when online state changes.
      window.addEventListener('online',
          this.updateOfflineEnabledApps_.bind(this));
      window.addEventListener('offline',
          this.updateOfflineEnabledApps_.bind(this));
    },

    /**
     * Appends a tile page.
     *
     * @param {TilePage} page The page element.
     * @param {string} title The title of the tile page.
     * @param {boolean} titleIsEditable If true, the title can be changed.
     * @param {TilePage} opt_refNode Optional reference node to insert in front
     *     of.
     * When opt_refNode is falsey, |page| will just be appended to the end of
     * the page list.
     */
    appendTilePage: function(page, title, titleIsEditable, opt_refNode) {
      if (opt_refNode) {
        var refIndex = this.getTilePageIndex(opt_refNode);
        this.cardSlider.addCardAtIndex(page, refIndex);
      } else {
        this.cardSlider.appendCard(page);
      }

      // Remember special MostVisitedPage.
      if (typeof ntp.MostVisitedPage != 'undefined' &&
          page instanceof ntp.MostVisitedPage) {
        assert(this.tilePages.length == 1,
               'MostVisitedPage should be added as first tile page');
        this.mostVisitedPage = page;
      }

      if (typeof ntp.SuggestionsPage != 'undefined' &&
          page instanceof ntp.SuggestionsPage) {
        this.suggestionsPage = page;
      }

      // If we're appending an AppsPage and it's a temporary page, animate it.
      var animate = page instanceof ntp.AppsPage &&
                    page.classList.contains('temporary');
      // Make a deep copy of the dot template to add a new one.
      var newDot = new ntp.NavDot(page, title, titleIsEditable, animate);
      page.navigationDot = newDot;
      this.dotList.insertBefore(newDot,
                                opt_refNode ? opt_refNode.navigationDot : null);
      // Set a tab index on the first dot.
      if (this.dotList.dots.length == 1)
        newDot.tabIndex = 3;

      this.eventTracker.add(page, 'pagelayout', this.onPageLayout_.bind(this));
    },

    /**
     * Called by chrome when an app has changed positions.
     * @param {Object} appData The data for the app. This contains page and
     *     position indices.
     */
    appMoved: function(appData) {
      assert(loadTimeData.getBoolean('showApps'));

      var app = $(appData.id);
      assert(app, 'trying to move an app that doesn\'t exist');
      app.remove(false);

      this.appsPages[appData.page_index].insertApp(appData, false);
    },

    /**
     * Called by chrome when an existing app has been disabled or
     * removed/uninstalled from chrome.
     * @param {Object} appData A data structure full of relevant information for
     *     the app.
     * @param {boolean} isUninstall True if the app is being uninstalled;
     *     false if the app is being disabled.
     * @param {boolean} fromPage True if the removal was from the current page.
     */
    appRemoved: function(appData, isUninstall, fromPage) {
      assert(loadTimeData.getBoolean('showApps'));

      var app = $(appData.id);
      assert(app, 'trying to remove an app that doesn\'t exist');

      if (!isUninstall)
        app.replaceAppData(appData);
      else
        app.remove(!!fromPage);
    },

    /**
     * @return {boolean} If the page is still starting up.
     * @private
     */
    isStartingUp_: function() {
      return document.documentElement.classList.contains('starting-up');
    },

    /**
     * Tracks whether apps have been loaded at least once.
     * @type {boolean}
     * @private
     */
    appsLoaded_: false,

    /**
     * Callback invoked by chrome with the apps available.
     *
     * Note that calls to this function can occur at any time, not just in
     * response to a getApps request. For example, when a user
     * installs/uninstalls an app on another synchronized devices.
     * @param {Object} data An object with all the data on available
     *        applications.
     */
    getAppsCallback: function(data) {
      assert(loadTimeData.getBoolean('showApps'));

      var startTime = Date.now();

      // Remember this to select the correct card when done rebuilding.
      var prevCurrentCard = this.cardSlider.currentCard;

      // Make removal of pages and dots as quick as possible with less DOM
      // operations, reflows, or repaints. We set currentCard = 0 and remove
      // from the end to not encounter any auto-magic card selections in the
      // process and we hide the card slider throughout.
      this.cardSlider.currentCard = 0;

      // Clear any existing apps pages and dots.
      // TODO(rbyers): It might be nice to preserve animation of dots after an
      // uninstall. Could we re-use the existing page and dot elements?  It
      // seems unfortunate to have Chrome send us the entire apps list after an
      // uninstall.
      while (this.appsPages.length > 0)
        this.removeTilePageAndDot_(this.appsPages[this.appsPages.length - 1]);

      // Get the array of apps and add any special synthesized entries
      var apps = data.apps;

      // Get a list of page names
      var pageNames = data.appPageNames;

      function stringListIsEmpty(list) {
        for (var i = 0; i < list.length; i++) {
          if (list[i])
            return false;
        }
        return true;
      }

      // Sort by launch ordinal
      apps.sort(function(a, b) {
        return a.app_launch_ordinal > b.app_launch_ordinal ? 1 :
          a.app_launch_ordinal < b.app_launch_ordinal ? -1 : 0;
      });

      // An app to animate (in case it was just installed).
      var highlightApp;

      // If there are any pages after the apps, add new pages before them.
      var lastAppsPage = (this.appsPages.length > 0) ?
          this.appsPages[this.appsPages.length - 1] : null;
      var lastAppsPageIndex = (lastAppsPage != null) ?
          Array.prototype.indexOf.call(this.tilePages, lastAppsPage) : -1;
      var nextPageAfterApps = lastAppsPageIndex != -1 ?
          this.tilePages[lastAppsPageIndex + 1] : null;

      // Add the apps, creating pages as necessary
      for (var i = 0; i < apps.length; i++) {
        var app = apps[i];
        var pageIndex = app.page_index || 0;
        while (pageIndex >= this.appsPages.length) {
          var pageName = loadTimeData.getString('appDefaultPageName');
          if (this.appsPages.length < pageNames.length)
            pageName = pageNames[this.appsPages.length];

          var origPageCount = this.appsPages.length;
          this.appendTilePage(new ntp.AppsPage(), pageName, true,
                              nextPageAfterApps);
          // Confirm that appsPages is a live object, updated when a new page is
          // added (otherwise we'd have an infinite loop)
          assert(this.appsPages.length == origPageCount + 1,
                 'expected new page');
        }

        if (app.id == this.highlightAppId)
          highlightApp = app;
        else
          this.appsPages[pageIndex].insertApp(app, false);
      }

      this.cardSlider.currentCard = prevCurrentCard;

      if (highlightApp)
        this.appAdded(highlightApp, true);

      logEvent('apps.layout: ' + (Date.now() - startTime));

      // Tell the slider about the pages and mark the current page.
      this.updateSliderCards();
      this.cardSlider.currentCardValue.navigationDot.classList.add('selected');

      if (!this.appsLoaded_) {
        this.appsLoaded_ = true;
        cr.dispatchSimpleEvent(document, 'sectionready', true, true);
      }
      this.updateAppLauncherPromoHiddenState_();
    },

    /**
     * Called by chrome when a new app has been added to chrome or has been
     * enabled if previously disabled.
     * @param {Object} appData A data structure full of relevant information for
     *     the app.
     * @param {boolean=} opt_highlight Whether the app about to be added should
     *     be highlighted.
     */
    appAdded: function(appData, opt_highlight) {
      assert(loadTimeData.getBoolean('showApps'));

      if (appData.id == this.highlightAppId) {
        opt_highlight = true;
        this.highlightAppId = null;
      }

      var pageIndex = appData.page_index || 0;

      if (pageIndex >= this.appsPages.length) {
        while (pageIndex >= this.appsPages.length) {
          this.appendTilePage(new ntp.AppsPage(),
                              loadTimeData.getString('appDefaultPageName'),
                              true);
        }
        this.updateSliderCards();
      }

      var page = this.appsPages[pageIndex];
      var app = $(appData.id);
      if (app) {
        app.replaceAppData(appData);
      } else if (opt_highlight) {
        page.insertAndHighlightApp(appData);
        this.setShownPage_(loadTimeData.getInteger('apps_page_id'),
                           appData.page_index);
      } else {
        page.insertApp(appData, false);
      }
    },

    /**
     * Callback invoked by chrome whenever an app preference changes.
     * @param {Object} data An object with all the data on available
     *     applications.
     */
    appsPrefChangedCallback: function(data) {
      assert(loadTimeData.getBoolean('showApps'));

      for (var i = 0; i < data.apps.length; ++i) {
        $(data.apps[i].id).appData = data.apps[i];
      }

      // Set the App dot names. Skip the first dot (Most Visited).
      var dots = this.dotList.getElementsByClassName('dot');
      var start = this.mostVisitedPage ? 1 : 0;
      for (var i = start; i < dots.length; ++i) {
        dots[i].displayTitle = data.appPageNames[i - start] || '';
      }
    },

    /**
     * Callback invoked by chrome whenever the app launcher promo pref changes.
     * @param {boolean} show Identifies if we should show or hide the promo.
     */
    appLauncherPromoPrefChangeCallback: function(show) {
      loadTimeData.overrideValues({showAppLauncherPromo: show});
      this.updateAppLauncherPromoHiddenState_();
    },

    /**
     * Updates the hidden state of the app launcher promo based on the page
     * shown and load data content.
     */
    updateAppLauncherPromoHiddenState_: function() {
      $('app-launcher-promo').hidden =
          !loadTimeData.getBoolean('showAppLauncherPromo') ||
          this.shownPage != loadTimeData.getInteger('apps_page_id');
    },

    /**
     * Invoked whenever the pages in apps-page-list have changed so that
     * the Slider knows about the new elements.
     */
    updateSliderCards: function() {
      var pageNo = Math.max(0, Math.min(this.cardSlider.currentCard,
                                        this.tilePages.length - 1));
      this.cardSlider.setCards(Array.prototype.slice.call(this.tilePages),
                               pageNo);
      // The shownPage property was potentially saved from a previous webui that
      // didn't have the same set of pages as the current one. So we cascade
      // from suggestions, to most visited and then to apps because we can have
      // an page with apps only (e.g., chrome://apps) or one with only the most
      // visited, but not one with only suggestions. And we alwayd default to
      // most visited first when previously shown page is not availabel anymore.
      // If most visited isn't there either, we go to apps.
      if (this.shownPage == loadTimeData.getInteger('suggestions_page_id')) {
        if (this.suggestionsPage)
          this.cardSlider.selectCardByValue(this.suggestionsPage);
        else
          this.shownPage = loadTimeData.getInteger('most_visited_page_id');
      }
      if (this.shownPage == loadTimeData.getInteger('most_visited_page_id')) {
        if (this.mostVisitedPage)
          this.cardSlider.selectCardByValue(this.mostVisitedPage);
        else
          this.shownPage = loadTimeData.getInteger('apps_page_id');
      }
      if (this.shownPage == loadTimeData.getInteger('apps_page_id') &&
          loadTimeData.getBoolean('showApps')) {
        this.cardSlider.selectCardByValue(
            this.appsPages[Math.min(this.shownPageIndex,
                                    this.appsPages.length - 1)]);
      } else if (this.mostVisitedPage) {
        this.shownPage = loadTimeData.getInteger('most_visited_page_id');
        this.cardSlider.selectCardByValue(this.mostVisitedPage);
      }
    },

    /**
     * Called whenever tiles should be re-arranging themselves out of the way
     * of a moving or insert tile.
     */
    enterRearrangeMode: function() {
      if (loadTimeData.getBoolean('showApps')) {
        var tempPage = new ntp.AppsPage();
        tempPage.classList.add('temporary');
        var pageName = loadTimeData.getString('appDefaultPageName');
        this.appendTilePage(tempPage, pageName, true);
      }

      if (ntp.getCurrentlyDraggingTile().firstChild.canBeRemoved()) {
        $('footer').classList.add('showing-trash-mode');
        $('footer-menu-container').style.minWidth = $('trash').offsetWidth -
            $('chrome-web-store-link').offsetWidth + 'px';
      }

      document.documentElement.classList.add('dragging-mode');
    },

    /**
     * Invoked whenever some app is released
     */
    leaveRearrangeMode: function() {
      var tempPage = document.querySelector('.tile-page.temporary');
      if (tempPage) {
        var dot = tempPage.navigationDot;
        if (!tempPage.tileCount &&
            tempPage != this.cardSlider.currentCardValue) {
          this.removeTilePageAndDot_(tempPage, true);
        } else {
          tempPage.classList.remove('temporary');
          this.saveAppPageName(tempPage,
                               loadTimeData.getString('appDefaultPageName'));
        }
      }

      $('footer').classList.remove('showing-trash-mode');
      $('footer-menu-container').style.minWidth = '';
      document.documentElement.classList.remove('dragging-mode');
    },

    /**
     * Callback for the 'pagelayout' event.
     * @param {Event} e The event.
     */
    onPageLayout_: function(e) {
      if (Array.prototype.indexOf.call(this.tilePages, e.currentTarget) !=
          this.cardSlider.currentCard) {
        return;
      }

      this.updatePageSwitchers();
    },

    /**
     * Adjusts the size and position of the page switchers according to the
     * layout of the current card, and updates the aria-label attributes of
     * the page switchers.
     */
    updatePageSwitchers: function() {
      if (!this.pageSwitcherStart || !this.pageSwitcherEnd)
        return;

      var page = this.cardSlider.currentCardValue;

      this.pageSwitcherStart.hidden = !page ||
          (this.cardSlider.currentCard == 0);
      this.pageSwitcherEnd.hidden = !page ||
          (this.cardSlider.currentCard == this.cardSlider.cardCount - 1);

      if (!page)
        return;

      var pageSwitcherLeft = isRTL() ? this.pageSwitcherEnd :
                                       this.pageSwitcherStart;
      var pageSwitcherRight = isRTL() ? this.pageSwitcherStart :
                                        this.pageSwitcherEnd;
      var scrollbarWidth = page.scrollbarWidth;
      pageSwitcherLeft.style.width =
          (page.sideMargin + 13) + 'px';
      pageSwitcherLeft.style.left = '0';
      pageSwitcherRight.style.width =
          (page.sideMargin - scrollbarWidth + 13) + 'px';
      pageSwitcherRight.style.right = scrollbarWidth + 'px';

      var offsetTop = page.querySelector('.tile-page-content').offsetTop + 'px';
      pageSwitcherLeft.style.top = offsetTop;
      pageSwitcherRight.style.top = offsetTop;
      pageSwitcherLeft.style.paddingBottom = offsetTop;
      pageSwitcherRight.style.paddingBottom = offsetTop;

      // Update the aria-label attributes of the two page switchers.
      this.pageSwitcherStart.updateButtonAccessibleLabel(this.dotList.dots);
      this.pageSwitcherEnd.updateButtonAccessibleLabel(this.dotList.dots);
    },

    /**
     * Returns the index of the given apps page.
     * @param {AppsPage} page The AppsPage we wish to find.
     * @return {number} The index of |page| or -1 if it is not in the
     *    collection.
     */
    getAppsPageIndex: function(page) {
      return Array.prototype.indexOf.call(this.appsPages, page);
    },

    /**
     * Handler for cardSlider:card_changed events from this.cardSlider.
     * @param {Event} e The cardSlider:card_changed event.
     * @private
     */
    onCardChanged_: function(e) {
      var page = e.cardSlider.currentCardValue;

      // Don't change shownPage until startup is done (and page changes actually
      // reflect user actions).
      if (!this.isStartingUp_()) {
        if (page.classList.contains('apps-page')) {
          this.setShownPage_(loadTimeData.getInteger('apps_page_id'),
                             this.getAppsPageIndex(page));
        } else if (page.classList.contains('most-visited-page')) {
          this.setShownPage_(
              loadTimeData.getInteger('most_visited_page_id'), 0);
        } else if (page.classList.contains('suggestions-page')) {
          this.setShownPage_(loadTimeData.getInteger('suggestions_page_id'), 0);
        } else {
          console.error('unknown page selected');
        }
      }

      // Update the active dot
      var curDot = this.dotList.getElementsByClassName('selected')[0];
      if (curDot)
        curDot.classList.remove('selected');
      page.navigationDot.classList.add('selected');
      this.updatePageSwitchers();
    },

    /**
     * Saves/updates the newly selected page to open when first loading the NTP.
     * @type {number} shownPage The new shown page type.
     * @type {number} shownPageIndex The new shown page index.
     * @private
     */
    setShownPage_: function(shownPage, shownPageIndex) {
      assert(shownPageIndex >= 0);
      this.shownPage = shownPage;
      this.shownPageIndex = shownPageIndex;
      chrome.send('pageSelected', [this.shownPage, this.shownPageIndex]);
      this.updateAppLauncherPromoHiddenState_();
    },

    /**
     * Listen for card additions to update the page switchers or the current
     * card accordingly.
     * @param {Event} e A card removed or added event.
     */
    onCardAdded_: function(e) {
      // When the second arg passed to insertBefore is falsey, it acts just like
      // appendChild.
      this.pageList.insertBefore(e.addedCard, this.tilePages[e.addedIndex]);
      this.onCardAddedOrRemoved_();
    },

    /**
     * Listen for card removals to update the page switchers or the current card
     * accordingly.
     * @param {Event} e A card removed or added event.
     */
    onCardRemoved_: function(e) {
      e.removedCard.parentNode.removeChild(e.removedCard);
      this.onCardAddedOrRemoved_();
    },

    /**
     * Called when a card is removed or added.
     * @private
     */
    onCardAddedOrRemoved_: function() {
      if (this.isStartingUp_())
        return;

      // Without repositioning there were issues - http://crbug.com/133457.
      this.cardSlider.repositionFrame();
      this.updatePageSwitchers();
    },

    /**
     * Save the name of an apps page.
     * Store the apps page name into the preferences store.
     * @param {AppsPage} appsPage The app page for which we wish to save.
     * @param {string} name The name of the page.
     */
    saveAppPageName: function(appPage, name) {
      var index = this.getAppsPageIndex(appPage);
      assert(index != -1);
      chrome.send('saveAppPageName', [name, index]);
    },

    /**
     * Window resize handler.
     * @private
     */
    onWindowResize_: function(e) {
      this.cardSlider.resize(this.sliderFrame.offsetWidth);
      this.updatePageSwitchers();
    },

    /**
     * Listener for offline status change events. Updates apps that are
     * not offline-enabled to be grayscale if the browser is offline.
     * @private
     */
    updateOfflineEnabledApps_: function() {
      var apps = document.querySelectorAll('.app');
      for (var i = 0; i < apps.length; ++i) {
        if (apps[i].appData.enabled && !apps[i].appData.offline_enabled) {
          apps[i].setIcon();
          apps[i].loadIcon();
        }
      }
    },

    /**
     * Handler for key events on the page. Ctrl-Arrow will switch the visible
     * page.
     * @param {Event} e The KeyboardEvent.
     * @private
     */
    onDocKeyDown_: function(e) {
      if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey)
        return;

      var direction = 0;
      if (e.keyIdentifier == 'Left')
        direction = -1;
      else if (e.keyIdentifier == 'Right')
        direction = 1;
      else
        return;

      var cardIndex =
          (this.cardSlider.currentCard + direction +
           this.cardSlider.cardCount) % this.cardSlider.cardCount;
      this.cardSlider.selectCard(cardIndex, true);

      e.stopPropagation();
    },

    /**
     * Returns the index of a given tile page.
     * @param {TilePage} page The TilePage we wish to find.
     * @return {number} The index of |page| or -1 if it is not in the
     *    collection.
     */
    getTilePageIndex: function(page) {
      return Array.prototype.indexOf.call(this.tilePages, page);
    },

    /**
     * Removes a page and navigation dot (if the navdot exists).
     * @param {TilePage} page The page to be removed.
     * @param {boolean=} opt_animate If the removal should be animated.
     */
    removeTilePageAndDot_: function(page, opt_animate) {
      if (page.navigationDot)
        page.navigationDot.remove(opt_animate);
      this.cardSlider.removeCard(page);
    },
  };

  return {
    PageListView: PageListView
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Page switcher
 * This is the class for the left and right navigation arrows that switch
 * between pages.
 */
cr.define('ntp', function() {

  function PageSwitcher() {
  }

  PageSwitcher.template = {
    __proto__: HTMLButtonElement.prototype,

    decorate: function(el) {
      el.__proto__ = PageSwitcher.template;

      el.addEventListener('click', el.activate_);

      el.direction_ = el.id == 'page-switcher-start' ? -1 : 1;

      el.dragWrapper_ = new cr.ui.DragWrapper(el, el);
    },

    /**
     * Activate the switcher (go to the next card).
     * @private
     */
    activate_: function() {
      ntp.getCardSlider().selectCard(this.nextCardIndex_(), true);
    },

    /**
     * Calculate the index of the card that this button will switch to.
     * @private
     */
    nextCardIndex_: function() {
      var cardSlider = ntp.getCardSlider();
      var index = cardSlider.currentCard + this.direction_;
      var numCards = cardSlider.cardCount - 1;
      return Math.max(0, Math.min(index, numCards));
    },

    /**
     * Update the accessible label attribute of this button, based on the
     * current position in the card slider and the names of the cards.
     * @param {NodeList} dots The dot elements which display the names of the
     *     cards.
     */
    updateButtonAccessibleLabel: function(dots) {
      var currentIndex = ntp.getCardSlider().currentCard;
      var nextCardIndex = this.nextCardIndex_();
      if (nextCardIndex == currentIndex) {
        this.setAttribute('aria-label', '');  // No next card.
        return;
      }

      var currentDot = dots[currentIndex];
      var nextDot = dots[nextCardIndex];
      if (!currentDot || !nextDot) {
        this.setAttribute('aria-label', '');  // Dots not initialised yet.
        return;
      }

      var currentPageTitle = currentDot.displayTitle;
      var nextPageTitle = nextDot.displayTitle;
      var msgName = (currentPageTitle == nextPageTitle) ?
          'page_switcher_same_title' : 'page_switcher_change_title';
      var ariaLabel = loadTimeData.getStringF(msgName, nextPageTitle);
      this.setAttribute('aria-label', ariaLabel);
    },

    shouldAcceptDrag: function(e) {
      // Only allow page switching when a drop could happen on the page being
      // switched to.
      var nextPage = ntp.getCardSlider().getCardAtIndex(this.nextCardIndex_());
      return nextPage.shouldAcceptDrag(e);
    },

    doDragEnter: function(e) {
      this.scheduleDelayedSwitch_(e);
      this.doDragOver(e);
    },

    doDragLeave: function(e) {
      this.cancelDelayedSwitch_();
    },

    doDragOver: function(e) {
      e.preventDefault();
      var targetPage = ntp.getCardSlider().currentCardValue;
      if (targetPage.shouldAcceptDrag(e))
        targetPage.setDropEffect(e.dataTransfer);
    },

    doDrop: function(e) {
      e.stopPropagation();
      this.cancelDelayedSwitch_();

      var tile = ntp.getCurrentlyDraggingTile();
      if (!tile)
        return;

      var sourcePage = tile.tilePage;
      var targetPage = ntp.getCardSlider().currentCardValue;
      if (targetPage == sourcePage || !targetPage.shouldAcceptDrag(e))
        return;

      targetPage.appendDraggingTile();
    },

    /**
     * Starts a timer to activate the switcher. The timer repeats until
     * cancelled by cancelDelayedSwitch_.
     * @private
     */
    scheduleDelayedSwitch_: function(e) {
      // Stop switching when the next page can't be dropped onto.
      var nextPage = ntp.getCardSlider().getCardAtIndex(this.nextCardIndex_());
      if (!nextPage.shouldAcceptDrag(e))
        return;

      var self = this;
      function navPageClearTimeout() {
        self.activate_();
        self.dragNavTimeout_ = null;
        self.scheduleDelayedSwitch_(e);
      }
      this.dragNavTimeout_ = window.setTimeout(navPageClearTimeout, 500);
    },

    /**
     * Cancels the timer that activates the switcher while dragging.
     * @private
     */
    cancelDelayedSwitch_: function() {
      if (this.dragNavTimeout_) {
        window.clearTimeout(this.dragNavTimeout_);
        this.dragNavTimeout_ = null;
      }
    },

  };

  return {
    initializePageSwitcher: PageSwitcher.template.decorate
  };
});


// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Nav dot
 * This is the class for the navigation controls that appear along the bottom
 * of the NTP.
 */

cr.define('ntp', function() {
  'use strict';

  /**
   * Creates a new navigation dot.
   * @param {TilePage} page The associated TilePage.
   * @param {string} title The title of the navigation dot.
   * @param {bool} titleIsEditable If true, the title can be changed.
   * @param {bool} animate If true, animates into existence.
   * @constructor
   * @extends {HTMLLIElement}
   */
  function NavDot(page, title, titleIsEditable, animate) {
    var dot = cr.doc.createElement('li');
    dot.__proto__ = NavDot.prototype;
    dot.initialize(page, title, titleIsEditable, animate);

    return dot;
  }

  NavDot.prototype = {
    __proto__: HTMLLIElement.prototype,

    initialize: function(page, title, titleIsEditable, animate) {
      this.className = 'dot';
      this.setAttribute('role', 'button');

      this.page_ = page;

      var selectionBar = this.ownerDocument.createElement('div');
      selectionBar.className = 'selection-bar';
      this.appendChild(selectionBar);

      // TODO(estade): should there be some limit to the number of characters?
      this.input_ = this.ownerDocument.createElement('input');
      this.input_.setAttribute('spellcheck', false);
      this.input_.value = title;
      // Take the input out of the tab-traversal focus order.
      this.input_.disabled = true;
      this.appendChild(this.input_);

      this.displayTitle = title;
      this.titleIsEditable_ = titleIsEditable;

      this.addEventListener('keydown', this.onKeyDown_);
      this.addEventListener('click', this.onClick_);
      this.addEventListener('dblclick', this.onDoubleClick_);
      this.dragWrapper_ = new cr.ui.DragWrapper(this, this);
      this.addEventListener('webkitTransitionEnd', this.onTransitionEnd_);

      this.input_.addEventListener('blur', this.onInputBlur_.bind(this));
      this.input_.addEventListener('mousedown',
                                   this.onInputMouseDown_.bind(this));
      this.input_.addEventListener('keydown', this.onInputKeyDown_.bind(this));

      if (animate) {
        this.classList.add('small');
        var self = this;
        window.setTimeout(function() {
          self.classList.remove('small');
        }, 0);
      }
    },

    /**
     * @return {TilePage} The associated TilePage.
     */
    get page() {
      return this.page_;
    },

    /**
     * Sets/gets the display title.
     * @type {string} title The display name for this nav dot.
     */
    get displayTitle() {
      return this.title;
    },
    set displayTitle(title) {
      this.title = this.input_.value = title;
    },

    /**
     * Removes the dot from the page. If |opt_animate| is truthy, we first
     * transition the element to 0 width.
     * @param {boolean=} opt_animate Whether to animate the removal or not.
     */
    remove: function(opt_animate) {
      if (opt_animate)
        this.classList.add('small');
      else
        this.parentNode.removeChild(this);
    },

    /**
     * Navigates the card slider to the page for this dot.
     */
    switchToPage: function() {
      ntp.getCardSlider().selectCardByValue(this.page_, true);
    },

    /**
     * Handler for keydown event on the dot.
     * @param {Event} e The KeyboardEvent.
     */
    onKeyDown_: function(e) {
      if (e.keyIdentifier == 'Enter') {
        this.onClick_(e);
        e.stopPropagation();
      }
    },

    /**
     * Clicking causes the associated page to show.
     * @param {Event} e The click event.
     * @private
     */
    onClick_: function(e) {
      this.switchToPage();
      // The explicit focus call is necessary because of overriding the default
      // handling in onInputMouseDown_.
      if (this.ownerDocument.activeElement != this.input_)
        this.focus();

      e.stopPropagation();
    },

    /**
     * Double clicks allow the user to edit the page title.
     * @param {Event} e The click event.
     * @private
     */
    onDoubleClick_: function(e) {
      if (this.titleIsEditable_) {
        this.input_.disabled = false;
        this.input_.focus();
        this.input_.select();
      }
    },

    /**
     * Prevent mouse down on the input from selecting it.
     * @param {Event} e The click event.
     * @private
     */
    onInputMouseDown_: function(e) {
      if (this.ownerDocument.activeElement != this.input_)
        e.preventDefault();
    },

    /**
     * Handle keypresses on the input.
     * @param {Event} e The click event.
     * @private
     */
    onInputKeyDown_: function(e) {
      switch (e.keyIdentifier) {
        case 'U+001B':  // Escape cancels edits.
          this.input_.value = this.displayTitle;
        case 'Enter':  // Fall through.
          this.input_.blur();
          break;
      }
    },

    /**
     * When the input blurs, commit the edited changes.
     * @param {Event} e The blur event.
     * @private
     */
    onInputBlur_: function(e) {
      window.getSelection().removeAllRanges();
      this.displayTitle = this.input_.value;
      ntp.saveAppPageName(this.page_, this.displayTitle);
      this.input_.disabled = true;
    },

    shouldAcceptDrag: function(e) {
      return this.page_.shouldAcceptDrag(e);
    },

    /**
     * A drag has entered the navigation dot. If the user hovers long enough,
     * we will navigate to the relevant page.
     * @param {Event} e The MouseOver event for the drag.
     * @private
     */
    doDragEnter: function(e) {
      var self = this;
      function navPageClearTimeout() {
        self.switchToPage();
        self.dragNavTimeout = null;
      }
      this.dragNavTimeout = window.setTimeout(navPageClearTimeout, 500);

      this.doDragOver(e);
    },

    /**
     * A dragged element has moved over the navigation dot. Show the correct
     * indicator and prevent default handling so the <input> won't act as a drag
     * target.
     * @param {Event} e The MouseOver event for the drag.
     * @private
     */
    doDragOver: function(e) {
      e.preventDefault();

      if (!this.dragWrapper_.isCurrentDragTarget)
        ntp.setCurrentDropEffect(e.dataTransfer, 'none');
      else
        this.page_.setDropEffect(e.dataTransfer);
    },

    /**
     * A dragged element has been dropped on the navigation dot. Tell the page
     * to append it.
     * @param {Event} e The MouseOver event for the drag.
     * @private
     */
    doDrop: function(e) {
      e.stopPropagation();
      var tile = ntp.getCurrentlyDraggingTile();
      if (tile && tile.tilePage != this.page_)
        this.page_.appendDraggingTile();
      // TODO(estade): handle non-tile drags.

      this.cancelDelayedSwitch_();
    },

    /**
     * The drag has left the navigation dot.
     * @param {Event} e The MouseOver event for the drag.
     * @private
     */
    doDragLeave: function(e) {
      this.cancelDelayedSwitch_();
    },

    /**
     * Cancels the timer for page switching.
     * @private
     */
    cancelDelayedSwitch_: function() {
      if (this.dragNavTimeout) {
        window.clearTimeout(this.dragNavTimeout);
        this.dragNavTimeout = null;
      }
    },

    /**
     * A transition has ended.
     * @param {Event} e The transition end event.
     * @private
     */
    onTransitionEnd_: function(e) {
      if (e.propertyName === 'max-width' && this.classList.contains('small'))
        this.parentNode.removeChild(this);
    },
  };

  return {
    NavDot: NavDot,
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview New tab page
 * This is the main code for the new tab page used by touch-enabled Chrome
 * browsers.  For now this is still a prototype.
 */

// Use an anonymous function to enable strict mode just for this file (which
// will be concatenated with other files when embedded in Chrome
cr.define('ntp', function() {
  'use strict';

  /**
   * NewTabView instance.
   * @type {!Object|undefined}
   */
  var newTabView;

  /**
   * The 'notification-container' element.
   * @type {!Element|undefined}
   */
  var notificationContainer;

  /**
   * If non-null, an info bubble for showing messages to the user. It points at
   * the Most Visited label, and is used to draw more attention to the
   * navigation dot UI.
   * @type {!Element|undefined}
   */
  var promoBubble;

  /**
   * If non-null, an bubble confirming that the user has signed into sync. It
   * points at the login status at the top of the page.
   * @type {!Element|undefined}
   */
  var loginBubble;

  /**
   * true if |loginBubble| should be shown.
   * @type {boolean}
   */
  var shouldShowLoginBubble = false;

  /**
   * The 'other-sessions-menu-button' element.
   * @type {!Element|undefined}
   */
  var otherSessionsButton;

  /**
   * The time when all sections are ready.
   * @type {number|undefined}
   * @private
   */
  var startTime;

  /**
   * The time in milliseconds for most transitions.  This should match what's
   * in new_tab.css.  Unfortunately there's no better way to try to time
   * something to occur until after a transition has completed.
   * @type {number}
   * @const
   */
  var DEFAULT_TRANSITION_TIME = 500;

  /**
   * See description for these values in ntp_stats.h.
   * @enum {number}
   */
  var NtpFollowAction = {
    CLICKED_TILE: 11,
    CLICKED_OTHER_NTP_PANE: 12,
    OTHER: 13
  };

  /**
   * Creates a NewTabView object. NewTabView extends PageListView with
   * new tab UI specific logics.
   * @constructor
   * @extends {PageListView}
   */
  function NewTabView() {
    var pageSwitcherStart = null;
    var pageSwitcherEnd = null;
    if (loadTimeData.getValue('showApps')) {
      pageSwitcherStart = getRequiredElement('page-switcher-start');
      pageSwitcherEnd = getRequiredElement('page-switcher-end');
    }
    this.initialize(getRequiredElement('page-list'),
                    getRequiredElement('dot-list'),
                    getRequiredElement('card-slider-frame'),
                    getRequiredElement('trash'),
                    pageSwitcherStart, pageSwitcherEnd);
  }

  NewTabView.prototype = {
    __proto__: ntp.PageListView.prototype,

    /** @override */
    appendTilePage: function(page, title, titleIsEditable, opt_refNode) {
      ntp.PageListView.prototype.appendTilePage.apply(this, arguments);

      if (promoBubble)
        window.setTimeout(promoBubble.reposition.bind(promoBubble), 0);
    }
  };

  /**
   * Invoked at startup once the DOM is available to initialize the app.
   */
  function onLoad() {
    sectionsToWaitFor = 0;
    if (loadTimeData.getBoolean('showMostvisited'))
      sectionsToWaitFor++;
    if (loadTimeData.getBoolean('showApps')) {
      // Fix various bugs when showing apps is not enabled.
      if (loadTimeData.getBoolean('showAppsPage'))
        sectionsToWaitFor++;
      if (loadTimeData.getBoolean('showAppLauncherPromo')) {
        $('app-launcher-promo-close-button').addEventListener('click',
            function() { chrome.send('stopShowingAppLauncherPromo'); });
        $('apps-promo-learn-more').addEventListener('click',
            function() { chrome.send('onLearnMore'); });
      }
    }
    if (loadTimeData.getBoolean('isDiscoveryInNTPEnabled'))
      sectionsToWaitFor++;
    measureNavDots();

    // Load the current theme colors.
    themeChanged();

    newTabView = new NewTabView();

    notificationContainer = getRequiredElement('notification-container');
    notificationContainer.addEventListener(
        'webkitTransitionEnd', onNotificationTransitionEnd);

    if (loadTimeData.getBoolean('showRecentlyClosed')) {
      cr.ui.decorate($('recently-closed-menu-button'), ntp.RecentMenuButton);
      chrome.send('getRecentlyClosedTabs');
    } else {
      $('recently-closed-menu-button').hidden = true;
    }

    if (loadTimeData.getBoolean('showOtherSessionsMenu')) {
      otherSessionsButton = getRequiredElement('other-sessions-menu-button');
      cr.ui.decorate(otherSessionsButton, ntp.OtherSessionsMenuButton);
      otherSessionsButton.initialize(loadTimeData.getBoolean('isUserSignedIn'));
    } else {
      getRequiredElement('other-sessions-menu-button').hidden = true;
    }

    if (loadTimeData.getBoolean('showMostvisited')) {
      var mostVisited = new ntp.MostVisitedPage();
      // Move the footer into the most visited page if we are in "bare minimum"
      // mode.
      if (document.body.classList.contains('bare-minimum'))
        mostVisited.appendFooter(getRequiredElement('footer'));
      newTabView.appendTilePage(mostVisited,
                                loadTimeData.getString('mostvisited'),
                                false);
      chrome.send('getMostVisited');
    }

    if (loadTimeData.getBoolean('isDiscoveryInNTPEnabled')) {
      var suggestionsScript = document.createElement('script');
      suggestionsScript.src = 'suggestions_page.js';
      suggestionsScript.onload = function() {
         newTabView.appendTilePage(new ntp.SuggestionsPage(),
                                   loadTimeData.getString('suggestions'),
                                   false,
                                   (newTabView.appsPages.length > 0) ?
                                       newTabView.appsPages[0] : null);
         chrome.send('getSuggestions');
         cr.dispatchSimpleEvent(document, 'sectionready', true, true);
      };
      document.querySelector('head').appendChild(suggestionsScript);
    }

    if (!loadTimeData.getBoolean('showWebStoreIcon')) {
      var webStoreIcon = $('chrome-web-store-link');
      // Not all versions of the NTP have a footer, so this may not exist.
      if (webStoreIcon)
        webStoreIcon.hidden = true;
    } else {
      var webStoreLink = loadTimeData.getString('webStoreLink');
      var url = appendParam(webStoreLink, 'utm_source', 'chrome-ntp-launcher');
      $('chrome-web-store-link').href = url;
      $('chrome-web-store-link').addEventListener('click',
          onChromeWebStoreButtonClick);
    }

    // We need to wait for all the footer menu setup to be completed before
    // we can compute its layout.
    layoutFooter();

    if (loadTimeData.getString('login_status_message')) {
      loginBubble = new cr.ui.Bubble;
      loginBubble.anchorNode = $('login-container');
      loginBubble.arrowLocation = cr.ui.ArrowLocation.TOP_END;
      loginBubble.bubbleAlignment =
          cr.ui.BubbleAlignment.BUBBLE_EDGE_TO_ANCHOR_EDGE;
      loginBubble.deactivateToDismissDelay = 2000;
      loginBubble.closeButtonVisible = false;

      $('login-status-advanced').onclick = function() {
        chrome.send('showAdvancedLoginUI');
      };
      $('login-status-dismiss').onclick = loginBubble.hide.bind(loginBubble);

      var bubbleContent = $('login-status-bubble-contents');
      loginBubble.content = bubbleContent;

      // The anchor node won't be updated until updateLogin is called so don't
      // show the bubble yet.
      shouldShowLoginBubble = true;
    }

    if (loadTimeData.valueExists('bubblePromoText')) {
      promoBubble = new cr.ui.Bubble;
      promoBubble.anchorNode = getRequiredElement('promo-bubble-anchor');
      promoBubble.arrowLocation = cr.ui.ArrowLocation.BOTTOM_START;
      promoBubble.bubbleAlignment = cr.ui.BubbleAlignment.ENTIRELY_VISIBLE;
      promoBubble.deactivateToDismissDelay = 2000;
      promoBubble.content = parseHtmlSubset(
          loadTimeData.getString('bubblePromoText'), ['BR']);

      var bubbleLink = promoBubble.querySelector('a');
      if (bubbleLink) {
        bubbleLink.addEventListener('click', function(e) {
          chrome.send('bubblePromoLinkClicked');
        });
      }

      promoBubble.handleCloseEvent = function() {
        promoBubble.hide();
        chrome.send('bubblePromoClosed');
      };
      promoBubble.show();
      chrome.send('bubblePromoViewed');
    }

    var loginContainer = getRequiredElement('login-container');
    loginContainer.addEventListener('click', showSyncLoginUI);
    if (loadTimeData.getBoolean('shouldShowSyncLogin'))
      chrome.send('initializeSyncLogin');

    doWhenAllSectionsReady(function() {
      // Tell the slider about the pages.
      newTabView.updateSliderCards();
      // Mark the current page.
      newTabView.cardSlider.currentCardValue.navigationDot.classList.add(
          'selected');

      if (loadTimeData.valueExists('notificationPromoText')) {
        var promoText = loadTimeData.getString('notificationPromoText');
        var tags = ['IMG'];
        var attrs = {
          src: function(node, value) {
            return node.tagName == 'IMG' &&
                   /^data\:image\/(?:png|gif|jpe?g)/.test(value);
          },
        };

        var promo = parseHtmlSubset(promoText, tags, attrs);
        var promoLink = promo.querySelector('a');
        if (promoLink) {
          promoLink.addEventListener('click', function(e) {
            chrome.send('notificationPromoLinkClicked');
          });
        }

        showNotification(promo, [], function() {
          chrome.send('notificationPromoClosed');
        }, 60000);
        chrome.send('notificationPromoViewed');
      }

      cr.dispatchSimpleEvent(document, 'ntpLoaded', true, true);
      document.documentElement.classList.remove('starting-up');

      startTime = Date.now();
    });

    preventDefaultOnPoundLinkClicks();  // From webui/js/util.js.
    cr.ui.FocusManager.disableMouseFocusOnButtons();
  }

  /**
   * Launches the chrome web store app with the chrome-ntp-launcher
   * source.
   * @param {Event} e The click event.
   */
  function onChromeWebStoreButtonClick(e) {
    chrome.send('recordAppLaunchByURL',
                [encodeURIComponent(this.href),
                 ntp.APP_LAUNCH.NTP_WEBSTORE_FOOTER]);
  }

  /*
   * The number of sections to wait on.
   * @type {number}
   */
  var sectionsToWaitFor = -1;

  /**
   * Queued callbacks which lie in wait for all sections to be ready.
   * @type {array}
   */
  var readyCallbacks = [];

  /**
   * Fired as each section of pages becomes ready.
   * @param {Event} e Each page's synthetic DOM event.
   */
  document.addEventListener('sectionready', function(e) {
    if (--sectionsToWaitFor <= 0) {
      while (readyCallbacks.length) {
        readyCallbacks.shift()();
      }
    }
  });

  /**
   * This is used to simulate a fire-once event (i.e. $(document).ready() in
   * jQuery or Y.on('domready') in YUI. If all sections are ready, the callback
   * is fired right away. If all pages are not ready yet, the function is queued
   * for later execution.
   * @param {function} callback The work to be done when ready.
   */
  function doWhenAllSectionsReady(callback) {
    assert(typeof callback == 'function');
    if (sectionsToWaitFor > 0)
      readyCallbacks.push(callback);
    else
      window.setTimeout(callback, 0);  // Do soon after, but asynchronously.
  }

  /**
   * Fills in an invisible div with the 'Most Visited' string so that
   * its length may be measured and the nav dots sized accordingly.
   */
  function measureNavDots() {
    var measuringDiv = $('fontMeasuringDiv');
    if (loadTimeData.getBoolean('showMostvisited'))
      measuringDiv.textContent = loadTimeData.getString('mostvisited');

    // The 4 is for border and padding.
    var pxWidth = Math.max(measuringDiv.clientWidth * 1.15 + 4, 80);

    var styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    // max-width is used because if we run out of space, the nav dots will be
    // shrunk.
    styleElement.textContent = '.dot { max-width: ' + pxWidth + 'px; }';
    document.querySelector('head').appendChild(styleElement);
  }

  /**
   * Layout the footer so that the nav dots stay centered.
   */
  function layoutFooter() {
    var menu = $('footer-menu-container');
    var logo = $('logo-img');
    if (menu.clientWidth > logo.clientWidth)
      logo.style.WebkitFlex = '0 1 ' + menu.clientWidth + 'px';
    else
      menu.style.WebkitFlex = '0 1 ' + logo.clientWidth + 'px';
  }

  function themeChanged(opt_hasAttribution) {
    $('themecss').href = 'chrome-search://theme/css/new_tab_theme.css?' + Date.now();

    if (typeof opt_hasAttribution != 'undefined') {
      document.documentElement.setAttribute('hasattribution',
                                            opt_hasAttribution);
    }

    updateAttribution();
  }

  function setBookmarkBarAttached(attached) {
    document.documentElement.setAttribute('bookmarkbarattached', attached);
  }

  /**
   * Attributes the attribution image at the bottom left.
   */
  function updateAttribution() {
    var attribution = $('attribution');
    if (document.documentElement.getAttribute('hasattribution') == 'true') {
      attribution.hidden = false;
    } else {
      attribution.hidden = true;
    }
  }

  /**
   * Timeout ID.
   * @type {number}
   */
  var notificationTimeout = 0;

  /**
   * Shows the notification bubble.
   * @param {string|Node} message The notification message or node to use as
   *     message.
   * @param {Array.<{text: string, action: function()}>} links An array of
   *     records describing the links in the notification. Each record should
   *     have a 'text' attribute (the display string) and an 'action' attribute
   *     (a function to run when the link is activated).
   * @param {Function} opt_closeHandler The callback invoked if the user
   *     manually dismisses the notification.
   */
  function showNotification(message, links, opt_closeHandler, opt_timeout) {
    window.clearTimeout(notificationTimeout);

    var span = document.querySelector('#notification > span');
    if (typeof message == 'string') {
      span.textContent = message;
    } else {
      span.textContent = '';  // Remove all children.
      span.appendChild(message);
    }

    var linksBin = $('notificationLinks');
    linksBin.textContent = '';
    for (var i = 0; i < links.length; i++) {
      var link = linksBin.ownerDocument.createElement('div');
      link.textContent = links[i].text;
      link.action = links[i].action;
      link.onclick = function() {
        this.action();
        hideNotification();
      };
      link.setAttribute('role', 'button');
      link.setAttribute('tabindex', 0);
      link.className = 'link-button';
      linksBin.appendChild(link);
    }

    function closeFunc(e) {
      if (opt_closeHandler)
        opt_closeHandler();
      hideNotification();
    }

    document.querySelector('#notification button').onclick = closeFunc;
    document.addEventListener('dragstart', closeFunc);

    notificationContainer.hidden = false;
    showNotificationOnCurrentPage();

    newTabView.cardSlider.frame.addEventListener(
        'cardSlider:card_change_ended', onCardChangeEnded);

    var timeout = opt_timeout || 10000;
    notificationTimeout = window.setTimeout(hideNotification, timeout);
  }

  /**
   * Hide the notification bubble.
   */
  function hideNotification() {
    notificationContainer.classList.add('inactive');

    newTabView.cardSlider.frame.removeEventListener(
        'cardSlider:card_change_ended', onCardChangeEnded);
  }

  /**
   * Happens when 1 or more consecutive card changes end.
   * @param {Event} e The cardSlider:card_change_ended event.
   */
  function onCardChangeEnded(e) {
    // If we ended on the same page as we started, ignore.
    if (newTabView.cardSlider.currentCardValue.notification)
      return;

    // Hide the notification the old page.
    notificationContainer.classList.add('card-changed');

    showNotificationOnCurrentPage();
  }

  /**
   * Move and show the notification on the current page.
   */
  function showNotificationOnCurrentPage() {
    var page = newTabView.cardSlider.currentCardValue;
    doWhenAllSectionsReady(function() {
      if (page != newTabView.cardSlider.currentCardValue)
        return;

      // NOTE: This moves the notification to inside of the current page.
      page.notification = notificationContainer;

      // Reveal the notification and instruct it to hide itself if ignored.
      notificationContainer.classList.remove('inactive');

      // Gives the browser time to apply this rule before we remove it (causing
      // a transition).
      window.setTimeout(function() {
        notificationContainer.classList.remove('card-changed');
      }, 0);
    });
  }

  /**
   * When done fading out, set hidden to true so the notification can't be
   * tabbed to or clicked.
   * @param {Event} e The webkitTransitionEnd event.
   */
  function onNotificationTransitionEnd(e) {
    if (notificationContainer.classList.contains('inactive'))
      notificationContainer.hidden = true;
  }

  function setRecentlyClosedTabs(dataItems) {
    $('recently-closed-menu-button').dataItems = dataItems;
    layoutFooter();
  }

  function setMostVisitedPages(data, hasBlacklistedUrls) {
    newTabView.mostVisitedPage.data = data;
    cr.dispatchSimpleEvent(document, 'sectionready', true, true);
  }

  function setSuggestionsPages(data, hasBlacklistedUrls) {
    newTabView.suggestionsPage.data = data;
  }

  /**
   * Set the dominant color for a node. This will be called in response to
   * getFaviconDominantColor. The node represented by |id| better have a setter
   * for stripeColor.
   * @param {string} id The ID of a node.
   * @param {string} color The color represented as a CSS string.
   */
  function setFaviconDominantColor(id, color) {
    var node = $(id);
    if (node)
      node.stripeColor = color;
  }

  /**
   * Updates the text displayed in the login container. If there is no text then
   * the login container is hidden.
   * @param {string} loginHeader The first line of text.
   * @param {string} loginSubHeader The second line of text.
   * @param {string} iconURL The url for the login status icon. If this is null
        then the login status icon is hidden.
   * @param {boolean} isUserSignedIn Indicates if the user is signed in or not.
   */
  function updateLogin(loginHeader, loginSubHeader, iconURL, isUserSignedIn) {
    if (loginHeader || loginSubHeader) {
      $('login-container').hidden = false;
      $('login-status-header').innerHTML = loginHeader;
      $('login-status-sub-header').innerHTML = loginSubHeader;
      $('card-slider-frame').classList.add('showing-login-area');

      if (iconURL) {
        $('login-status-header-container').style.backgroundImage = url(iconURL);
        $('login-status-header-container').classList.add('login-status-icon');
      } else {
        $('login-status-header-container').style.backgroundImage = 'none';
        $('login-status-header-container').classList.remove(
            'login-status-icon');
      }
    } else {
      $('login-container').hidden = true;
      $('card-slider-frame').classList.remove('showing-login-area');
    }
    if (shouldShowLoginBubble) {
      window.setTimeout(loginBubble.show.bind(loginBubble), 0);
      chrome.send('loginMessageSeen');
      shouldShowLoginBubble = false;
    } else if (loginBubble) {
      loginBubble.reposition();
    }
    if (otherSessionsButton) {
      otherSessionsButton.updateSignInState(isUserSignedIn);
      layoutFooter();
    }
  }

  /**
   * Show the sync login UI.
   * @param {Event} e The click event.
   */
  function showSyncLoginUI(e) {
    var rect = e.currentTarget.getBoundingClientRect();
    chrome.send('showSyncLoginUI',
                [rect.left, rect.top, rect.width, rect.height]);
  }

  /**
   * Logs the time to click for the specified item.
   * @param {string} item The item to log the time-to-click.
   */
  function logTimeToClick(item) {
    var timeToClick = Date.now() - startTime;
    chrome.send('logTimeToClick',
        ['NewTabPage.TimeToClick' + item, timeToClick]);
  }

  /**
   * Wrappers to forward the callback to corresponding PageListView member.
   */
  function appAdded() {
    return newTabView.appAdded.apply(newTabView, arguments);
  }

  function appMoved() {
    return newTabView.appMoved.apply(newTabView, arguments);
  }

  function appRemoved() {
    return newTabView.appRemoved.apply(newTabView, arguments);
  }

  function appsPrefChangeCallback() {
    return newTabView.appsPrefChangedCallback.apply(newTabView, arguments);
  }

  function appLauncherPromoPrefChangeCallback() {
    return newTabView.appLauncherPromoPrefChangeCallback.apply(newTabView,
                                                               arguments);
  }

  function appsReordered() {
    return newTabView.appsReordered.apply(newTabView, arguments);
  }

  function enterRearrangeMode() {
    return newTabView.enterRearrangeMode.apply(newTabView, arguments);
  }

  function setForeignSessions(sessionList, isTabSyncEnabled) {
    if (otherSessionsButton) {
      otherSessionsButton.setForeignSessions(sessionList, isTabSyncEnabled);
      layoutFooter();
    }
  }

  function reloadForeignSessions() {
    if (otherSessionsButton) {
      otherSessionsButton.reloadForeignSessions();
    }
  }

  function getAppsCallback() {
    return newTabView.getAppsCallback.apply(newTabView, arguments);
  }

  function getAppsPageIndex() {
    return newTabView.getAppsPageIndex.apply(newTabView, arguments);
  }

  function getCardSlider() {
    return newTabView.cardSlider;
  }

  function leaveRearrangeMode() {
    return newTabView.leaveRearrangeMode.apply(newTabView, arguments);
  }

  function saveAppPageName() {
    return newTabView.saveAppPageName.apply(newTabView, arguments);
  }

  function setAppToBeHighlighted(appId) {
    newTabView.highlightAppId = appId;
  }

  // Return an object with all the exports
  return {
    appAdded: appAdded,
    appMoved: appMoved,
    appRemoved: appRemoved,
    appsPrefChangeCallback: appsPrefChangeCallback,
    appLauncherPromoPrefChangeCallback: appLauncherPromoPrefChangeCallback,
    enterRearrangeMode: enterRearrangeMode,
    getAppsCallback: getAppsCallback,
    getAppsPageIndex: getAppsPageIndex,
    getCardSlider: getCardSlider,
    onLoad: onLoad,
    leaveRearrangeMode: leaveRearrangeMode,
    logTimeToClick: logTimeToClick,
    NtpFollowAction: NtpFollowAction,
    reloadForeignSessions: reloadForeignSessions,
    saveAppPageName: saveAppPageName,
    setAppToBeHighlighted: setAppToBeHighlighted,
    setBookmarkBarAttached: setBookmarkBarAttached,
    setForeignSessions: setForeignSessions,
    setMostVisitedPages: setMostVisitedPages,
    setSuggestionsPages: setSuggestionsPages,
    setRecentlyClosedTabs: setRecentlyClosedTabs,
    setFaviconDominantColor: setFaviconDominantColor,
    showNotification: showNotification,
    themeChanged: themeChanged,
    updateLogin: updateLogin
  };
});

//document.addEventListener('DOMContentLoaded', ntp.onLoad);
//document.addEventListener('load', ntp.onLoad);

// Add bookmark at here
//ntp.setBookmarkBarAttached(true);

var toCssPx = cr.ui.toCssPx;

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview The recently closed menu: button, model data, and menu.
 */

cr.define('ntp', function() {
  'use strict';

  /**
   * Returns the text used for a recently closed window.
   * @param {number} numTabs Number of tabs in the window.
   * @return {string} The text to use.
   */
  function formatTabsText(numTabs) {
    if (numTabs == 1)
      return loadTimeData.getString('closedwindowsingle');
    return loadTimeData.getStringF('closedwindowmultiple', numTabs);
  }

  var Menu = cr.ui.Menu;
  var MenuItem = cr.ui.MenuItem;
  var MenuButton = cr.ui.MenuButton;
  var RecentMenuButton = cr.ui.define('button');

  RecentMenuButton.prototype = {
    __proto__: MenuButton.prototype,

    decorate: function() {
      MenuButton.prototype.decorate.call(this);
      this.menu = new Menu;
      cr.ui.decorate(this.menu, Menu);
      this.menu.classList.add('footer-menu');
      document.body.appendChild(this.menu);

      this.needsRebuild_ = true;
      this.anchorType = cr.ui.AnchorType.ABOVE;
      this.invertLeftRight = true;
    },

    /**
     * Shows the menu, first rebuilding it if necessary.
     * TODO(estade): the right of the menu should align with the right of the
     * button.
     * @override
     */
    showMenu: function(shouldSetFocus) {
      if (this.needsRebuild_) {
        this.menu.textContent = '';
        this.dataItems_.forEach(this.addItem_, this);
        this.needsRebuild_ = false;
      }

      MenuButton.prototype.showMenu.apply(this, arguments);
    },

    /**
     * Sets the menu model data.
     * @param {Array} dataItems Array of objects that describe the apps.
     */
    set dataItems(dataItems) {
      this.dataItems_ = dataItems;
      this.needsRebuild_ = true;
      this.hidden = !dataItems.length;
    },

    /**
     * Adds an app to the menu.
     * @param {Object} data An object encapsulating all data about the app.
     * @private
     */
    addItem_: function(data) {
      var isWindow = data.type == 'window';
      var a = this.ownerDocument.createElement('a');
      a.className = 'footer-menu-item';
      a.id = 'footer-menu-item-' + data.sessionId;
      if (isWindow) {
        a.href = '';
        a.classList.add('recent-window');
        a.textContent = formatTabsText(data.tabs.length);
        a.title = data.tabs.map(function(tab) { return tab.title; }).join('\n');
      } else {
        a.href = data.url;
        chrome.send('_getFaviconImage',
                    [getFaviconUrlForCurrentDevicePixelRatio(data.url), a.id]);
        a.textContent = data.title;
      }

      var menuButton = MenuButton;
      var currentInstance = this;

      function onActivated(e) {
        ntp.logTimeToClick('RecentlyClosed');
        chrome.send('recordAppLaunchByURL',
                    [encodeURIComponent(data.url),
                     ntp.APP_LAUNCH.NTP_RECENTLY_CLOSED]);
        var index = Array.prototype.indexOf.call(a.parentNode.children, a);
        var orig = e.originalEvent;
        var button = 0;
        if (orig instanceof MouseEvent)
          button = orig.button;
        var params = [data.sessionId,
                      index,
                      button,
                      orig.altKey,
                      orig.ctrlKey,
                      orig.metaKey,
                      orig.shiftKey];
        chrome.send('reopenTab', params);

        e.preventDefault();
        e.stopPropagation();
        menuButton.prototype.hideMenu.apply(currentInstance, null);
      }
      a.addEventListener('activate', onActivated);
      a.addEventListener('click', function(e) { e.preventDefault(); });

      this.menu.appendChild(a);
      cr.ui.decorate(a, MenuItem);
    },
  };

  return {
    RecentMenuButton: RecentMenuButton,
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview The menu that shows tabs from sessions on other devices.
 */

cr.define('ntp', function() {
  'use strict';

  /** @const */ var ContextMenuButton = cr.ui.ContextMenuButton;
  /** @const */ var Menu = cr.ui.Menu;
  /** @const */ var MenuItem = cr.ui.MenuItem;
  /** @const */ var MenuButton = cr.ui.MenuButton;
  /** @const */ var OtherSessionsMenuButton = cr.ui.define('button');

  // Histogram buckets for UMA tracking of menu usage.
  /** @const */ var HISTOGRAM_EVENT = {
      INITIALIZED: 0,
      SHOW_MENU: 1,
      LINK_CLICKED: 2,
      LINK_RIGHT_CLICKED: 3,
      SESSION_NAME_RIGHT_CLICKED: 4,
      SHOW_SESSION_MENU: 5,
      COLLAPSE_SESSION: 6,
      EXPAND_SESSION: 7,
      OPEN_ALL: 8
  };
  /** @const */ var HISTOGRAM_EVENT_LIMIT =
      HISTOGRAM_EVENT.OPEN_ALL + 1;

  /**
   * Record an event in the UMA histogram.
   * @param {number} eventId The id of the event to be recorded.
   * @private
   */
  function recordUmaEvent_(eventId) {
    chrome.send('metricsHandler:recordInHistogram',
        ['NewTabPage.OtherSessionsMenu', eventId, HISTOGRAM_EVENT_LIMIT]);
  }

  OtherSessionsMenuButton.prototype = {
    __proto__: MenuButton.prototype,

    decorate: function() {
      MenuButton.prototype.decorate.call(this);
      this.menu = new Menu;
      cr.ui.decorate(this.menu, Menu);
      this.menu.menuItemSelector = '[role=menuitem]';
      this.menu.classList.add('footer-menu');
      this.menu.addEventListener('contextmenu',
                                 this.onContextMenu_.bind(this), true);
      document.body.appendChild(this.menu);

      // Create the context menu that appears when the user right clicks
      // on a device name.
      this.deviceContextMenu_ = DeviceContextMenuController.getInstance().menu;
      document.body.appendChild(this.deviceContextMenu_);

      this.promoMessage_ = $('other-sessions-promo-template').cloneNode(true);
      this.promoMessage_.removeAttribute('id');  // Prevent a duplicate id.

      this.sessions_ = [];
      this.anchorType = cr.ui.AnchorType.ABOVE;
      this.invertLeftRight = true;

      // Initialize the images for the drop-down buttons that appear beside the
      // session names.
      MenuButton.createDropDownArrows();

      recordUmaEvent_(HISTOGRAM_EVENT.INITIALIZED);
    },

    /**
     * Initialize this element.
     * @param {boolean} signedIn Is the current user signed in?
     */
    initialize: function(signedIn) {
      this.updateSignInState(signedIn);
    },

    /**
     * Handle a context menu event for an object in the menu's DOM subtree.
     */
    onContextMenu_: function(e) {
      // Only record the action if it occurred in one of the menu items or
      // on one of the session headings.
      if (findAncestorByClass(e.target, 'footer-menu-item')) {
        recordUmaEvent_(HISTOGRAM_EVENT.LINK_RIGHT_CLICKED);
      } else {
        var heading = findAncestorByClass(e.target, 'session-heading');
        if (heading) {
          recordUmaEvent_(HISTOGRAM_EVENT.SESSION_NAME_RIGHT_CLICKED);

          // Let the context menu know which session it was invoked on,
          // since they all share the same instance of the menu.
          DeviceContextMenuController.getInstance().setSession(
              heading.sessionData_);
        }
      }
    },

    /**
     * Hides the menu.
     * @override
     */
    hideMenu: function() {
      // Don't hide if the device context menu is currently showing.
      if (this.deviceContextMenu_.hidden)
        MenuButton.prototype.hideMenu.call(this);
    },

    /**
     * Shows the menu, first rebuilding it if necessary.
     * TODO(estade): the right of the menu should align with the right of the
     * button.
     * @override
     */
    showMenu: function(shouldSetFocus) {
      if (this.sessions_.length == 0)
        chrome.send('getForeignSessions');
      recordUmaEvent_(HISTOGRAM_EVENT.SHOW_MENU);
      MenuButton.prototype.showMenu.apply(this, arguments);

      // Work around https://bugs.webkit.org/show_bug.cgi?id=85884.
      this.menu.scrollTop = 0;
    },

    /**
     * Reset the menu contents to the default state.
     * @private
     */
    resetMenuContents_: function() {
      this.menu.innerHTML = '';
      this.menu.appendChild(this.promoMessage_);
    },

    /**
     * Create a custom click handler for a link, so that clicking on a link
     * restores the session (including back stack) rather than just opening
     * the URL.
     */
    makeClickHandler_: function(sessionTag, windowId, tabId) {
      var self = this;
      return function(e) {
        recordUmaEvent_(HISTOGRAM_EVENT.LINK_CLICKED);
        chrome.send('openForeignSession', [sessionTag, windowId, tabId,
            e.button, e.altKey, e.ctrlKey, e.metaKey, e.shiftKey]);
        e.preventDefault();
      };
    },

    /**
     * Add the UI for a foreign session to the menu.
     * @param {Object} session Object describing the foreign session.
     */
    addSession_: function(session) {
      var doc = this.ownerDocument;

      var section = doc.createElement('section');
      this.menu.appendChild(section);

      var heading = doc.createElement('h3');
      heading.className = 'session-heading';
      heading.textContent = session.name;
      heading.sessionData_ = session;
      section.appendChild(heading);

      var dropDownButton = new ContextMenuButton;
      dropDownButton.classList.add('drop-down');
      // Keep track of the drop down that triggered the menu, so we know
      // which element to apply the command to.
      function handleDropDownFocus(e) {
        DeviceContextMenuController.getInstance().setSession(session);
      }
      dropDownButton.addEventListener('mousedown', handleDropDownFocus);
      dropDownButton.addEventListener('focus', handleDropDownFocus);
      heading.appendChild(dropDownButton);

      var timeSpan = doc.createElement('span');
      timeSpan.className = 'details';
      timeSpan.textContent = session.modifiedTime;
      heading.appendChild(timeSpan);

      cr.ui.contextMenuHandler.setContextMenu(heading,
                                              this.deviceContextMenu_);

      if (!session.collapsed)
        section.appendChild(this.createSessionContents_(session));
    },

    /**
     * Create the DOM tree representing the tabs and windows in a session.
     * @param {Object} session The session model object.
     * @return {Element} A single div containing the list of tabs & windows.
     * @private
     */
    createSessionContents_: function(session) {
      var doc = this.ownerDocument;
      var contents = doc.createElement('div');

      for (var i = 0; i < session.windows.length; i++) {
        var window = session.windows[i];

        // Show a separator between multiple windows in the same session.
        if (i > 0)
          contents.appendChild(doc.createElement('hr'));

        for (var j = 0; j < window.tabs.length; j++) {
          var tab = window.tabs[j];
          var a = doc.createElement('a');
          a.className = 'footer-menu-item';
          a.id = 'footer-menu-item-' + tab.sessionId;
          a.textContent = tab.title;
          a.href = tab.url;
          chrome.send('_getFaviconImage',
                      [getFaviconUrlForCurrentDevicePixelRatio(tab.url), a.id]);

          var clickHandler = this.makeClickHandler_(tab.sessionId);
          a.addEventListener('click', clickHandler);
          contents.appendChild(a);
          cr.ui.decorate(a, MenuItem);
        }
      }

      return contents;
    },

    /**
     * Sets the menu model data. An empty list means that either there are no
     * foreign sessions, or tab sync is disabled for this profile.
     * |isTabSyncEnabled| makes it possible to distinguish between the cases.
     *
     * @param {Array} sessionList Array of objects describing the sessions
     *     from other devices.
     * @param {boolean} isTabSyncEnabled Is tab sync enabled for this profile?
     */
    setForeignSessions: function(sessionList, isTabSyncEnabled) {
      this.sessions_ = sessionList;
      this.resetMenuContents_();
      if (sessionList.length > 0) {
        // Rebuild the menu with the new data.
        for (var i = 0; i < sessionList.length; i++) {
          this.addSession_(sessionList[i]);
        }
      }

      // The menu button is shown iff tab sync is enabled.
      this.hidden = !isTabSyncEnabled;
    },

    reloadForeignSessions: function() {
      this.setForeignSessions(this.sessions_, true);
    },

    /**
     * Called when this element is initialized, and from the new tab page when
     * the user's signed in state changes,
     * @param {boolean} signedIn Is the user currently signed in?
     */
    updateSignInState: function(signedIn) {
      if (signedIn)
        chrome.send('getForeignSessions');
      else
        this.hidden = true;
    },
  };

  /**
   * Controller for the context menu for device names in the list of sessions.
   * This class is designed to be used as a singleton.
   *
   * @constructor
   */
  function DeviceContextMenuController() {
    this.__proto__ = DeviceContextMenuController.prototype;
    this.initialize();
  }
  cr.addSingletonGetter(DeviceContextMenuController);

  DeviceContextMenuController.prototype = {

    initialize: function() {
      var menu = new cr.ui.Menu;
      cr.ui.decorate(menu, cr.ui.Menu);
      menu.classList.add('device-context-menu');
      menu.classList.add('footer-menu-context-menu');
      this.menu = menu;
      this.collapseItem_ = this.appendMenuItem_('collapseSessionMenuItemText');
      this.collapseItem_.addEventListener('activate',
                                          this.onCollapseOrExpand_.bind(this));
      this.expandItem_ = this.appendMenuItem_('expandSessionMenuItemText');
      this.expandItem_.addEventListener('activate',
                                        this.onCollapseOrExpand_.bind(this));
      this.openAllItem_ = this.appendMenuItem_('restoreSessionMenuItemText');
      this.openAllItem_.addEventListener('activate',
                                         this.onOpenAll_.bind(this));
    },

    /**
     * Appends a menu item to |this.menu|.
     * @param {string} textId The ID for the localized string that acts as
     *     the item's label.
     */
    appendMenuItem_: function(textId) {
      var button = cr.doc.createElement('button');
      this.menu.appendChild(button);
      cr.ui.decorate(button, cr.ui.MenuItem);
      button.textContent = loadTimeData.getString(textId);
      return button;
    },

    /**
     * Handler for the 'Collapse' and 'Expand' menu items.
     * @param {Event} e The activation event.
     * @private
     */
    onCollapseOrExpand_: function(e) {
      this.session_.collapsed = !this.session_.collapsed;
      this.updateMenuItems_();
      // There is no collapsed filter in chrome extension API.
      // Mimic the behavior by setting foreign sessions again
      // with existing data.
      ntp.reloadForeignSessions();

      //chrome.send('setForeignSessionCollapsed',
      //            [this.session_.tag, this.session_.collapsed]);
      //chrome.send('getForeignSessions');

      var eventId = this.session_.collapsed ?
          HISTOGRAM_EVENT.COLLAPSE_SESSION : HISTOGRAM_EVENT.EXPAND_SESSION;
      recordUmaEvent_(eventId);
    },

    /**
     * Handler for the 'Open all' menu item.
     * @param {Event} e The activation event.
     * @private
     */
    onOpenAll_: function(e) {
      chrome.send('openForeignSession', [this.session_.tag]);
      recordUmaEvent_(HISTOGRAM_EVENT.OPEN_ALL);
    },

    /**
     * Set the session data for the session the context menu was invoked on.
     * This should never be called when the menu is visible.
     * @param {Object} session The model object for the session.
     */
    setSession: function(session) {
      this.session_ = session;
      this.updateMenuItems_();
    },

    /**
     * Set the visibility of the Expand/Collapse menu items based on the state
     * of the session that this menu is currently associated with.
     * @private
     */
    updateMenuItems_: function() {
      this.collapseItem_.hidden = this.session_.collapsed;
      this.expandItem_.hidden = !this.session_.collapsed;
    }
  };

  return {
    OtherSessionsMenuButton: OtherSessionsMenuButton,
  };
});

var loadLocalizedData = function() {
  var self_url = document.getElementById("extension_script").src;
  var locale = self_url.substring(self_url.indexOf("?") + 1);
  var extension_url = self_url.substring(0, self_url.lastIndexOf("/") + 1);

  var xhr = new XMLHttpRequest();
  xhr.open("GET", extension_url + "_locales/" + locale + "/loadTimeData.js", false);
  xhr.send();

  if (xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
    eval(xhr.responseText);

    if (cr.isMac)
      loadTimeData.data_.fontfamily = "'Lucida Grande', sans-serif";
    if (cr.isLinux)
      loadTimeData.data_.fontfamily = "Ubuntu, Arial, sans-serif";

    loadTimeData.data_.showMostvisited = true;
    loadTimeData.data_.showOtherSessionsMenu = true;
    loadTimeData.data_.showRecentlyClosed = true;
    // Let the most visited page be the default.
    loadTimeData.data_.shown_page_type = 1024;
    loadTimeData.data_.isUserSignedIn = true;
    loadTimeData.data_.disableCreateAppShortcut = false;
    loadTimeData.data_.hasattribution = 
      (chrome.embeddedSearch.newTabPage.themeBackgroundInfo.attributionUrl != undefined);
  }
};
loadLocalizedData();

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This is a simple template engine inspired by JsTemplates
 * optimized for i18n.
 *
 * It currently supports three handlers:
 *
 *   * i18n-content which sets the textContent of the element.
 *
 *     <span i18n-content="myContent"></span>
 *
 *   * i18n-options which generates <option> elements for a <select>.
 *
 *     <select i18n-options="myOptionList"></select>
 *
 *   * i18n-values is a list of attribute-value or property-value pairs.
 *     Properties are prefixed with a '.' and can contain nested properties.
 *
 *     <span i18n-values="title:myTitle;.style.fontSize:fontSize"></span>
 *
 * This file is a copy of i18n_template.js, with minor tweaks to support using
 * load_time_data.js. It should replace i18n_template.js eventually.
 */

var i18nTemplate = (function() {
  /**
   * This provides the handlers for the templating engine. The key is used as
   * the attribute name and the value is the function that gets called for every
   * single node that has this attribute.
   * @type {Object}
   */
  var handlers = {
    /**
     * This handler sets the textContent of the element.
     * @param {HTMLElement} element The node to modify.
     * @param {string} key The name of the value in the dictionary.
     * @param {LoadTimeData} dictionary The dictionary of strings to draw from.
     */
    'i18n-content': function(element, key, dictionary) {
      element.textContent = dictionary.getString(key);
    },

    /**
     * This handler adds options to a <select> element.
     * @param {HTMLElement} select The node to modify.
     * @param {string} key The name of the value in the dictionary. It should
     *     identify an array of values to initialize an <option>. Each value,
     *     if a pair, represents [content, value]. Otherwise, it should be a
     *     content string with no value.
     * @param {LoadTimeData} dictionary The dictionary of strings to draw from.
     */
    'i18n-options': function(select, key, dictionary) {
      var options = dictionary.getValue(key);
      options.forEach(function(optionData) {
        var option = typeof optionData == 'string' ?
            new Option(optionData) :
            new Option(optionData[1], optionData[0]);
        select.appendChild(option);
      });
    },

    /**
     * This is used to set HTML attributes and DOM properties. The syntax is:
     *   attributename:key;
     *   .domProperty:key;
     *   .nested.dom.property:key
     * @param {HTMLElement} element The node to modify.
     * @param {string} attributeAndKeys The path of the attribute to modify
     *     followed by a colon, and the name of the value in the dictionary.
     *     Multiple attribute/key pairs may be separated by semicolons.
     * @param {LoadTimeData} dictionary The dictionary of strings to draw from.
     */
    'i18n-values': function(element, attributeAndKeys, dictionary) {
      var parts = attributeAndKeys.replace(/\s/g, '').split(/;/);
      parts.forEach(function(part) {
        if (!part)
          return;

        var attributeAndKeyPair = part.match(/^([^:]+):(.+)$/);
        if (!attributeAndKeyPair)
          throw new Error('malformed i18n-values: ' + attributeAndKeys);

        var propName = attributeAndKeyPair[1];
        var propExpr = attributeAndKeyPair[2];

        var value = dictionary.getValue(propExpr);

        // Allow a property of the form '.foo.bar' to assign a value into
        // element.foo.bar.
        if (propName[0] == '.') {
          var path = propName.slice(1).split('.');
          var targetObject = element;
          while (targetObject && path.length > 1) {
            targetObject = targetObject[path.shift()];
          }
          if (targetObject) {
            targetObject[path] = value;
            // In case we set innerHTML (ignoring others) we need to
            // recursively check the content.
            if (path == 'innerHTML')
              process(element, dictionary);
          }
        } else {
          element.setAttribute(propName, value);
        }
      });
    }
  };

  var attributeNames = Object.keys(handlers);
  var selector = '[' + attributeNames.join('],[') + ']';

  /**
   * Processes a DOM tree with the {@code dictionary} map.
   * @param {HTMLElement} node The root of the DOM tree to process.
   * @param {LoadTimeData} dictionary The dictionary to draw from.
   */
  function process(node, dictionary) {
    var elements = node.querySelectorAll(selector);
    for (var element, i = 0; element = elements[i]; i++) {
      for (var j = 0; j < attributeNames.length; j++) {
        var name = attributeNames[j];
        var attribute = element.getAttribute(name);
        if (attribute != null)
          handlers[name](element, attribute, dictionary);
      }
    }
  }

  return {
    process: process
  };
}());


i18nTemplate.process(document, loadTimeData);


// Copied from chrome-search://most-visited/util.js
/**
 * Validates a RGBA color component. It must be a number between 0 and 255.
 * @param {number} component An RGBA component.
 * @return {boolean} True if the component is valid.
 */
function isValidRBGAComponent(component) {
  return isFinite(component) && component >= 0 && component <= 255;
}

/**
 * Converts an Array of color components into RGBA format "rgba(R,G,B,A)".
 * @param {Array.<number>} rgbaColor Array of rgba color components.
 * @return {?string} CSS color in RGBA format or null if invalid.
 */
function convertArrayToRGBAColor(rgbaColor) {
  // Array must contain 4 valid components.
  if (rgbaColor instanceof Array && rgbaColor.length === 4 &&
      isValidRBGAComponent(rgbaColor[0]) &&
      isValidRBGAComponent(rgbaColor[1]) &&
      isValidRBGAComponent(rgbaColor[2]) &&
      isValidRBGAComponent(rgbaColor[3])) {
    return 'rgba(' +
            rgbaColor[0] + ',' +
            rgbaColor[1] + ',' +
            rgbaColor[2] + ',' +
            rgbaColor[3] / 255 + ')';
  }
  return null;
}
// End Copied from chrome-search://most-visited/util.js

var updateTheme = function() {
  var themeInfo = chrome.embeddedSearch.newTabPage.themeBackgroundInfo;
  ntp.themeChanged(themeInfo.attributionUrl != undefined);

  var loadCustomTheme = function() {
    document.body.style.backgroundColor = 
      convertArrayToRGBAColor(themeInfo.backgroundColorRgba);

    if (themeInfo.imageUrl) {
      document.body.style.backgroundImage = themeInfo.imageUrl;
      document.body.style.backgroundRepeat = themeInfo.imageTiling;
      document.body.style.backgroundPosition = themeInfo.imageHorizontalAlignment +
        " " + themeInfo.imageVerticalAlignment;
    } else
      document.body.style.backgroundImage = "";

    document.body.style.backgroundSize = "initial";
    if (themeInfo.attributionUrl)
      $("attribution-img").style.content = themeInfo.attributionUrl;
  };

  if (themeInfo.usingDefaultTheme) {
    document.body.style.backgroundImage = "";
    document.body.style.backgroundColor = 
      convertArrayToRGBAColor(themeInfo.backgroundColorRgba);
  } else
    setTimeout(loadCustomTheme, 40);

  var color = convertArrayToRGBAColor(themeInfo.textColorRgba);
  var pageTitles = document.getElementsByClassName("title");
  for (var i = 0; i < pageTitles.length; i++)
    pageTitles[i].style.color = color;
};

document.addEventListener('ntpLoaded', updateTheme);
chrome.embeddedSearch.newTabPage.onthemechange = updateTheme;


var retryCount = 0, retryInterval = 50;
var topsite;

var setTopSite = function() {
  if (chrome.embeddedSearch.newTabPage.mostVisited.length == topsite.length) {
    console.log("mostVisited loaded in " + retryCount * retryInterval + "ms");
    ntp.setMostVisitedPages(topsite);
  } else {
    retryCount++;
    window.setTimeout(setTopSite, retryInterval);
  }
};

cr.define("ntr", function() {
  var appPageIndex, appPageSettings;
  var appPageSettingsName = "ntp_app_settings";

  function loadDefaultAppPageSettings() {
    appPageSettings = {
      pageNames: {
        maxIndex: 0
      },
      appOrder: {}
    };
  }

  function loadAppPageSettings() {
    var settings = localStorage.getItem(appPageSettingsName);
    if (!settings) {
      loadDefaultAppPageSettings();
      return;
    }

    try {
      appPageSettings = JSON.parse(settings);
    } catch(e) {
      loadDefaultAppPageSettings();
    }
  }

  loadAppPageSettings();

  function saveAppPageSettings() {
    localStorage.setItem(appPageSettingsName, JSON.stringify(appPageSettings));
  }

  function setPageIndex(pageIndex) {
    appPageIndex = pageIndex;
  }

  function saveAppPageName(name, index) {
    appPageSettings.pageNames[index] = name;
    if (index > appPageSettings.pageNames.maxIndex)
      appPageSettings.pageNames.maxIndex = index;

    saveAppPageSettings();
  }

  function reorderApps(apps) {
    for (var i = 0; i < apps.length; i++) {
      appPageSettings.appOrder[apps[i]] = {
        pageIndex: appPageIndex,
        order: i
      };
    }
    saveAppPageSettings();
  }

  function processAppInfo(item) {
    if (!item.isApp)
        return null;

    var appOrder = appPageSettings.appOrder[item.id];
    if (appOrder) {
      item.app_launch_ordinal = appOrder.order;
      item.page_index = appOrder.pageIndex;
    } else if (item.id == "ahfgeienlihckogmohjhadlkjgocpleb") {
      // Put web store at first
      item.app_launch_ordinal = "a" + item.name;
    } else if (item.type == "hosted_app" && item.updateUrl == undefined) {
      // Put bookmark links at last
      item.app_launch_ordinal = "z" + item.name;
    } else {
      item.app_launch_ordinal = "t" + item.name;
    }

    if (item.icons && item.icons.length > 0) {
      item.icon_big = item.icons[item.icons.length - 1].url;
      item.icon_small = item.icons[0].url;
      item.icon_big_exists = true;
      item.icon_small_exists = true;

      if (item.icons.length == 1) {
        if (item.icons[0].size < 128)
          item.icon_big_exists = false;
        else
          item.icon_small_exists = false;
      }
    } else {
      item.icon_big = "chrome://extension-icon/" + item.id + "/128/0";
      item.icon_small = "chrome://extension-icon/" + item.id + "/16/0";
    }

    if (item.type == "packaged_app")
      item.packagedApp = true;

    item.full_name = item.name;
    item.title = item.name;
    item.detailsUrl = item.homepageUrl;
    item.launch_type = item.launchType;
    return item;
  }

  function getAppPageNames() {
    var names = [];
    if (!appPageSettings.pageNames[0])
      names.push(loadTimeData.data_.appDefaultPageName);

    for (var i = 0; i <= appPageSettings.pageNames.maxIndex; i++)
      if (appPageSettings.pageNames[i])
        names.push(appPageSettings.pageNames[i]);

    return names;
  }

  return {
    setPageIndex: setPageIndex,
    saveAppPageName: saveAppPageName,
    reorderApps: reorderApps,
    processAppInfo: processAppInfo,
    getAppPageNames: getAppPageNames
  };
});

// Duplicate with loadTimeData.js
window.addEventListener("message", function(event) {
  console.log(event.data);

  if (event.data.method == "topSitesResult") {
    topsite = event.data.result;
    setTopSite();
  } else if (event.data.method == "dominantColorResult") {
    ntp.setFaviconDominantColor(event.data.result.id, event.data.result.dominantColor);
  } else if (event.data.method == "recentlyClosedResult") {
    // Process the result to fit the previous format.
    var result = event.data.result;
    for (var i = 0; i < result.length; i++) {
      if (result[i].window) {
        result[i] = result[i].window;
        result[i].type = "window";
      } else
        result[i] = result[i].tab;
    }
    ntp.setRecentlyClosedTabs(result);
  } else if (event.data.method == "_setFaviconImage") {
    document.getElementById(event.data.result.id).style.backgroundImage =
      "url('" + event.data.result.data + "')";
  } else if (event.data.method == "_setAppImage") {
    document.getElementById(event.data.result.id).src = event.data.result.data;
  } else if (event.data.method == "foreignSessionsResult") {
    // Process the result to fit the previous format.
    moment.lang(event.data.result.languages);

    var result = event.data.result.data;
    for (var i = 0; i < result.length; i++) {
      var item = result[i];
      item.name = item.deviceName || item.info;
      item.collapsed = false;
      item.modifiedTime = "";
      item.tag = new Array();
      item.windows = new Array();

      var sessions = item.sessions;
      for (var j = 0; j < sessions.length; j++) {
        var session = sessions[j];
        item.windows.push(session.window);
        if (item.modifiedTime == "")
          item.modifiedTime = moment.unix(session.lastModified).fromNow();
        // Open all sessions when clicking "open all" menu.
        item.tag.push(session.window.sessionId);
      }
    }
    ntp.setForeignSessions(result, true);
  } else if (event.data.method == "appsResult") {
    // Process the result to fit the previous format.
    var result = {
      appPageNames: ntr.getAppPageNames(),
      apps: []
    };

    var apps = event.data.result;
    for (var i = 0; i < apps.length; i++) {
      var item = ntr.processAppInfo(apps[i]);
      if (item != null)
        result.apps.push(item);
    }
    ntp.getAppsCallback(result);
  } else if (event.data.method == "appInstalled") {
    var item = ntr.processAppInfo(event.data.result);
    if (item != null)
      ntp.appAdded(item, false);
  } else if (event.data.method == "appUninstalled") {
    var item = { id: event.data.result };
    // The app can be an extension or theme that is not shown.
    if ($(event.data.result))
      ntp.appRemoved(item, true, true);
  } else if (event.data.method == "appEnabled" ||
             event.data.method == "appDisabled") {
    var item = ntr.processAppInfo(event.data.result);
    if (item != null)
      ntp.appRemoved(item, false, true);
  } else if (event.data.method == "onRecentlyClosed") {
    chrome.send("getRecentlyClosedTabs");
  } else if (event.data.method == "_setSettings") {
    var options = event.data.result;

    var mostVisitedPageGridValues = ntp.getMostVisitedPageGridValues();
    mostVisitedPageGridValues.maxColCount = options.mTilesPerRow.value;
    ntp.loadMostVisitedPageSettings(options.mNumberOfTiles.value);

    var appsPageGridValues = ntp.getAppsPageGridValues();
    appsPageGridValues.maxColCount = options.mAppsPerRow.value;
    ntp.loadAppsPageSettings();

    loadTimeData.data_.showAppsPage = options.showAppsPage;
    if (options.showAppsPage)
      restoreLastPage();

    // Manually call onLoad
    ntp.onLoad();
  }
}, false);

// Restore last page.
var restoreLastPage = function() {
  var shownPage = localStorage.getItem("ntp_shown_page_type");
  if (shownPage != null && Number(shownPage) != NaN)
    loadTimeData.data_.shown_page_type = Number(shownPage);

  var shownPageIndex = localStorage.getItem("ntp_shown_page_index");
  if (shownPageIndex != null && Number(shownPageIndex) != NaN)
    loadTimeData.data_.shown_page_index = Number(shownPageIndex);
};

window.loaded = true;
chrome.send("_getSettings");
