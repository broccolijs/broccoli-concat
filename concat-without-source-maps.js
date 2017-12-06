'use strict';
var fs = require('fs-extra');
var path = require('path');

class Simple {
  constructor(attrs) {
    this._internal = '';
    this.outputFile = attrs.outputFile;
    this.baseDir = attrs.baseDir;
    this._sizes = {};
    this.id = attrs.pluginId;
  }

  addFile(file) {
    var content =  fs.readFileSync(path.join(this.baseDir, file), 'UTF-8');
    this._internal += content;
    this._sizes[file] = content.length;
  }

  addSpace(space) {
    this._internal += space;
  }

  writeConcatStatsSync(outputPath, content) {
    fs.mkdirpSync(path.dirname(outputPath));
    fs.writeFileSync(outputPath, JSON.stringify(content, null, 2));
  }

  end(cb, thisArg) {
    var result;
    if (cb) {
      result = cb.call(thisArg, this);
    }

    if (process.env.CONCAT_STATS) {
      var outputPath = process.cwd() + '/concat-stats-for/' + this.id + '-' + path.basename(this.outputFile) + '.json';

      this.writeConcatStatsSync(
        outputPath,
        {
          outputFile: this.outputFile,
          sizes: this._sizes
        }
      );
    }

    fs.writeFileSync(this.outputFile, this._internal);
    return result;
  }
}

module.exports = Simple;
