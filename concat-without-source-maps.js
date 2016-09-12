'use strict';
var fs = require('fs');
var path = require('path');

module.exports = Simple;
function Simple(attrs) {
  this._internal = '';
  this.outputFile = attrs.outputFile;
  this.baseDir = attrs.baseDir;
  this._sizes = {};
  this.id = attrs.pluginId;
}

Simple.prototype.addFile = function(file) {
  var content =  fs.readFileSync(path.join(this.baseDir, file), 'UTF-8');
  this._internal += content;
  this._sizes[file] = content.length;
};

Simple.prototype.addSpace = function(space) {
  this._internal += space;
};

Simple.prototype.writeConcatStatsSync = function(outputPath, content) {
  fs.writeFileSync(outputPath, content);
};

Simple.prototype.end = function(cb, thisArg) {
  var result;
  if (cb) {
    result = cb.call(thisArg, this);
  }

  if (process.env.CONCAT_STATS) {
    var outputPath = process.cwd() + '/concat-stats-for-' + this.id + '-' + path.basename(this.outputFile) + '.json';

    this.writeConcatStatsSync(
      outputPath,
      JSON.stringify({
        outputFile: this.outputFile,
        sizes: this._sizes
      }, null, 2)
    )
  }

  fs.writeFileSync(this.outputFile, this._internal);
  return result;
};
