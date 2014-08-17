/**
 * Alias for document.getElementById.
 * @param {string} id The ID of the element to find.
 * @return {HTMLElement} The found element or null if not found.
 */
function $(id) {
  return document.getElementById(id);
}

function getElementPropertyName(option) {
  return typeof(option.defaultValue) == "boolean" ? "checked" : "value";
}

function setValueFromLocalStorage(option) {
  var property = getElementPropertyName(option);
  var value = localStorage.getItem(option.key);
  $(option.element)[property] = getOptionValue(option, value);
}

function setLocalStorageFromValue(option) {
  var property = getElementPropertyName(option);
  var value = $(option.element)[property];
  localStorage.setItem(option.key, getOptionValue(option, value));
}

function loadSettings() {
  setValueFromLocalStorage(options.mTilesPerRow);
  setValueFromLocalStorage(options.mNumberOfTiles);
  setValueFromLocalStorage(options.mShowWebstore);
  setValueFromLocalStorage(options.mAppsPerRow);
}

function applySettings() {
  setLocalStorageFromValue(options.mTilesPerRow);
  setLocalStorageFromValue(options.mNumberOfTiles);
  setLocalStorageFromValue(options.mShowWebstore);
  setLocalStorageFromValue(options.mAppsPerRow);

  loadSettings();
}

function toggleDetails(pane, button) {
  var details = $(pane);
  if (details.className == "hide") {
    details.className = "show";
    $(button).innerHTML = "Hide Details";
  } else {
    details.className = "hide";
    $(button).innerHTML = "Show Details";
  }
}

function toggleNotLoadDetails() {
  toggleDetails("notLoadDetails", "notLoadToggle");

  // Prediction service does not need to be enabled on Chrome 36+.
  var version = window.navigator.appVersion.match(/\d+\.\d+\.\d+\.\d+/);
  if (version && Number(version[0].split(".")[0]) >= 36)
    $("notLoadPredictionService").className = "hide";
}

window.onload = function() {
  loadSettings();
  $("apply").addEventListener("click", applySettings);
  $("notLoadToggle").addEventListener("click", toggleNotLoadDetails);
  $("appsOpenNewTabToggle").addEventListener("click", toggleDetails.bind(
      this, "appsOpenNewTabDetails", "appsOpenNewTabToggle"));
};
