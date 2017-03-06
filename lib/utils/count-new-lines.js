module.exports = function countNewLines(src) {
  var newlinePattern = /(\r?\n)/g;
  var count = 0;
  while (newlinePattern.exec(src)) {
    count++;
  }
  return count;
};
