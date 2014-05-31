var options = {
  mTilesPerRow: {
    key: "mostVisited.tilesPerRow",
    element: "mTilesPerRow",
    defaultValue: 4
  },
  mNumberOfTiles: {
    key: "mostVisited.numberOfTiles",
    element: "mNumberOfTiles",
    defaultValue: 8
  },
  mShowWebstore: {
    key: "appsPage.showWebstore",
    element: "mShowWebstore",
    defaultValue: true
  }
};

function getOptionValue(option, value) {
  if (value == null)
    return option.defaultValue;

  if (typeof(option.defaultValue) == "number") {
    if (isNaN(value))
      return option.defaultValue;
    else
      return Number(value);
  }

  if (typeof(option.defaultValue) == "boolean" && typeof(value) != "boolean")
    return value == "true";

  return value;
}
