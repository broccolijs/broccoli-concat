'use strict';

module.exports = function comparator(x, y, inputFileMatchers) {
  if (x === y) { return 0; }
  if (inputFileMatchers.length < 2) { return 0; }

  for (var i = 0; i < inputFileMatchers.length; i++) {
    var matcher = inputFileMatchers[i];

    if (matcher.match(x) && matcher.match(y)) {
      continue
    } else if (matcher.match(x)) {
      return -1;
    } else if (matcher.match(y)) {
      return 1;
    } else {
      return 1;
    }
  }

  return 0;
}
