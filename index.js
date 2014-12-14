var SourceMapAwareConcat = require('./writer');
var concat = require('broccoli-concat');
var helpers = require('broccoli-kitchen-sink-helpers');

module.exports = function(inputTree, options) {
  if (!options || !options.outputFile) {
    throw new Error("outputFile is required");
  }

  // This is here because broccoli-concat does the same thing, and we
  // don't want to surprise people by breaking only when they suddenly
  // disable sourcemaps.
  helpers.assertAbsolutePaths([options.outputFile]);

  var extensions = (options.sourceMapsForExtensions || ['js']);
  for (var i=0; i<extensions.length; i++) {
    var ext = '.' + extensions[i].replace(/^\./,'');
    if (options.outputFile.slice(-1 * ext.length) === ext) {
      return new SourceMapAwareConcat(inputTree, options);
    }
  }
  return concat(inputTree, options);
};
