'use strict';

const fs = require('fs-extra');
const path = require('path');

module.exports = class Simple {
  constructor(attrs) {
    this._internal = '';
    this.outputFile = attrs.outputFile;
    this.baseDir = attrs.baseDir;
    this._sizes = {};
    this.id = attrs.pluginId;
  }

  addFile(file) {
    let content =  fs.readFileSync(path.join(this.baseDir, file), 'UTF-8');
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
    let result;
    if (cb) {
      result = cb.call(thisArg, this);
    }

    if (process.env.CONCAT_STATS) {
      let outputPath = process.cwd() + '/concat-stats-for/' + this.id + '-' + path.basename(this.outputFile) + '.json';

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
};
