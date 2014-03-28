/**
 * Alias for document.getElementById.
 * @param {string} id The ID of the element to find.
 * @return {HTMLElement} The found element or null if not found.
 */
function $(id) {
  return document.getElementById(id);
}

function setValueFromLocalStorage(option) {
  var value = localStorage.getItem(option.key);
  if (value == null)
    $(option.element).value = option.defaultValue;
  else
    $(option.element).value = value;
}

function setLocalStorageFromValue(option) {
  var value = $(option.element).value;
  if (typeof(option.defaultValue) == "number" && isNaN(value))
    localStorage.setItem(option.key, option.defaultValue);
  else
    localStorage.setItem(option.key, value);
}

function loadSettings() {
  setValueFromLocalStorage(options.mTilesPerRow);
  setValueFromLocalStorage(options.mNumberOfTiles);
}

function applySettings() {
  setLocalStorageFromValue(options.mTilesPerRow);
  setLocalStorageFromValue(options.mNumberOfTiles);

  loadSettings();
}

window.onload = function() {
  loadSettings();
  $("apply").addEventListener("click", applySettings);
};
