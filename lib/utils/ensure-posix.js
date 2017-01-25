var path = require('path');

/**
 * Ensures a given file path uses the posic separator.
 *
 * @private
 */
module.exports = function ensurePosix(filepath) {
  if (path.sep !== '/') {
    return filepath.split(path.sep).join('/');
  }

  return filepath;
};
