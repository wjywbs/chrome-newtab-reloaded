var options = {
  mTilesPerRow:   "mostVisited.tilesPerRow",
  mNumberOfTiles: "mostVisited.numberOfTiles"
};

/**
 * Alias for document.getElementById.
 * @param {string} id The ID of the element to find.
 * @return {HTMLElement} The found element or null if not found.
 */
function $(id) {
  return document.getElementById(id);
}

function setValueFromLocalStorage(elementId, key, defaultValue) {
  var value = localStorage.getItem(key);
  if (value == null)
    $(elementId).value = defaultValue;
  else
    $(elementId).value = value;
}

function setLocalStorageFromValue(elementId, key, defaultValue) {
  var value = $(elementId).value;
  if (typeof(defaultValue) == "number" && isNaN(value))
    localStorage.setItem(key, defaultValue);
  else
    localStorage.setItem(key, value);
}

function loadSettings() {
  setValueFromLocalStorage("tilesPerRow", options.mTilesPerRow, 4);
  setValueFromLocalStorage("numberOfTiles", options.mNumberOfTiles, 8);
}

function applySettings() {
  setLocalStorageFromValue("tilesPerRow", options.mTilesPerRow, 4);
  setLocalStorageFromValue("numberOfTiles", options.mNumberOfTiles, 8);

  loadSettings();
}

window.onload = function() {
  loadSettings();
  $("apply").addEventListener("click", applySettings);
};
