var path = require('path');
var merge = require('lodash.merge');
var SourceMapUrl = require('source-map-url');

var SimpleConcat = require('./simple');
var SourceMapGenerator = require('../utils/source-map-generator');
var countNewLines = require('../utils/count-new-lines');

function SourceMapConcat(attrs) {
  SimpleConcat.apply(this, arguments);

  if (!attrs || (!attrs.outputFile && (!attrs.mapURL || !attrs.file))) {
    throw new Error("Must specify at least outputFile or mapURL and file");
  }

  if (attrs.mapFile && !attrs.mapURL) {
    throw new Error("must specify the mapURL when setting a custom mapFile");
  }

  this.allowNone = attrs.allowNone;
  this.outputFile = attrs.outputFile;
  this.mapFile = attrs.mapFile || (this.outputFile && this.outputFile.replace(/\.js$/, '') + '.map');
  this.mapURL = attrs.mapURL || (this.mapFile && path.basename(this.mapFile));
  this.mapCommentType = attrs.mapCommentType || 'line';

  this._generator = new SourceMapGenerator({
    inputPath: attrs.inputPath,
    sourceRoot: attrs.sourceRoot,
    file: attrs.file || path.basename(this.outputFile)
  });
  this._filesWithSourceMaps = Object.create(null);
}

SourceMapConcat.isPatchBased = true;

SourceMapConcat.prototype = merge(Object.create(SimpleConcat.prototype), {
  constructor: SourceMapConcat,

  /**
   * A simple helper method to easily invoke a method on the superclass.
   *
   * @private
   */
  _super: function(method, args) {
    return SimpleConcat.prototype[method].apply(this, args);
  },

  /**
   * Adds a file to the internal representation and properly tracks if it has an
   * external sourcemap.
   *
   * @override
   */
  addFile: function(file, content) {
    if (SourceMapUrl.existsIn(content)) {
      this._filesWithSourceMaps[file] = SourceMapUrl.getFrom(content);
      content = SourceMapUrl.removeFrom(content);
    }

    this._super('addFile', [file, content]);
  },

  /**
   * Updates a file in the internal representation and properly tracks if it has
   * an external sourcemap.
   *
   * @override
   */
  updateFile: function(file, content) {
    // Update any reference to another sourcemap
    if (SourceMapUrl.existsIn(content)) {
      this._filesWithSourceMaps[file] = SourceMapUrl.getFrom(content);
      content = SourceMapUrl.removeFrom(content);
    } else if (this._filesWithSourceMaps[file]) {
      this._filesWithSourceMaps[file] = undefined;
    }

    this._super('updateFile', [file, content]);
  },

  /**
   * Removes a file in the internal representation and any related external
   * sourcemap.
   *
   * @override
   */
  removeFile: function(file) {
    // Update any reference to another sourcemap
    if (this._filesWithSourceMaps[file]) {
      this._filesWithSourceMaps[file] = undefined;
    }

    this._super('removeFile', [file]);
  },

  /**
   * Extends the SimpleConcat#result to include a sourceMappingURL comment.
   *
   * @override
   */
  result: function() {
    var result = this._super('result');

    if (result === undefined) {
      // We return undefined when not allowing none, otherwise we use an empty
      // string so that we can append the sourceMappingURL comment.
      if (!this.allowNone) {
        return;
      } else {
        result = '';
      }
    }

    if (this.mapCommentType === 'line') {
      result += '//# sourceMappingURL=' + this.mapURL + '\n';
    } else {
      result += '/*# sourceMappingURL=' + this.mapURL + ' */\n';
    }

    return result;
  },

  /**
   * Generates the sourcemap corresponding to the result output.
   */
  resultSourceMap: function() {
    var i;

    // Get all the Entry objects for this concatenation.
    var inputEntries = [].concat(
      this._internalHeaderFiles,
      this._internal,
      this._internalFooterFiles
    );

    var map = this._generator.fromEntries(inputEntries, this._filesWithSourceMaps);

    var newlineSeparator = this.separator === '\n';

    if (this.header) {
      var headerLineCount = newlineSeparator ?
        countNewLines(this.header) + 1 :
        countNewLines(this.header);

      for (i = 0; i < headerLineCount; i++) {
        map.mappings.unshift('');
      }
    }

    if (this.footer) {
      var footerLineCount = newlineSeparator ?
        countNewLines(this.footer) + 2 :
        countNewLines(this.footer);

      for (i = 0; i < footerLineCount; i++) {
        map.mappings.push('');
      }
    }

    var joiner = newlineSeparator ? ';' : '';
    map.mappings = map.mappings.join(joiner);

    return JSON.stringify(map);
  }
});

module.exports = SourceMapConcat;
