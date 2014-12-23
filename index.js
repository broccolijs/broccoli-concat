var SourceMapAwareConcat = require('./concat-with-maps');
var SimpleConcat = require('./simple-concat');

module.exports = function(inputTree, options) {
  if (!options || !options.outputFile) {
    throw new Error("outputFile is required");
  }

  var extensions = (options.sourceMapsForExtensions || ['js']);
  for (var i=0; i<extensions.length; i++) {
    var ext = '.' + extensions[i].replace(/^\./,'');
    if (options.outputFile.slice(-1 * ext.length) === ext) {
      return new SourceMapAwareConcat(inputTree, options);
    }
  }
  return new SimpleConcat(inputTree, options);
};
