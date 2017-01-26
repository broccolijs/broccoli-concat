var CachingWriter = require('broccoli-caching-writer');
var path = require('path');
var fs = require('fs-extra');
var merge = require('lodash.merge');
var omit = require('lodash.omit');
var uniq = require('lodash.uniq');

var ensureNoGlob = require('./lib/utils/ensure-no-glob');
var ensurePosix = require('./lib/utils/ensure-posix');
var isDirectory = require('./lib/utils/is-directory');
var makeIndex = require('./lib/utils/make-index');

module.exports = Concat;
Concat.prototype = Object.create(CachingWriter.prototype);
Concat.prototype.constructor = Concat;

var id = 0;
function Concat(inputNode, options, Strategy) {
  if (!(this instanceof Concat)) {
    return new Concat(inputNode, options, Strategy);
  }

  if (!options || !options.outputFile) {
    throw new Error('the outputFile option is required');
  }

  var allInputFiles = uniq([].concat(options.headerFiles || [], options.inputFiles || [], options.footerFiles || []));

  var inputNodes;
  id++;

  if (process.env.CONCAT_STATS) {
    inputNodes = Concat.inputNodesForConcatStats(inputNode, id, options.outputFile);
  } else {
    inputNodes = [inputNode];
  }

  CachingWriter.call(this, inputNodes, {
    inputFiles: allInputFiles.length === 0 ? undefined : allInputFiles,
    annotation: options.annotation,
    name: (Strategy.name || 'Unknown') + 'Concat'
  });

  this.id = id;

  if (Strategy === undefined) {
    throw new TypeError('Concat requires a concat Strategy');
  }

  this.Strategy = Strategy;
  this.sourceMapConfig = omit(options.sourceMapConfig || {}, 'enabled');
  this.inputFiles = options.inputFiles;
  this.outputFile = options.outputFile;
  this.allowNone = options.allowNone;
  this.header = options.header;
  this.headerFiles = options.headerFiles;
  this._headerFooterFilesIndex = makeIndex(options.headerFiles, options.footerFiles);
  this.footer = options.footer;
  this.footerFiles = options.footerFiles;
  this.separator = (options.separator != null) ? options.separator : '\n';

  ensureNoGlob('headerFiles', this.headerFiles);
  ensureNoGlob('footerFiles', this.footerFiles);

  this.encoderCache = {};
}

Concat.inputNodesForConcatStats = function(inputNode, id, outputFile) {
  var dir = process.cwd() + '/concat-stats-for';
  fs.mkdirpSync(dir);

  return [
    require('broccoli-stew').debug(inputNode, {
      dir: dir,
      name: id + '-' + path.basename(outputFile)
    })
  ];
};

Concat.prototype.build = function() {
  var separator = this.separator;
  var firstSection = true;
  var outputFile = path.join(this.outputPath, this.outputFile);

  fs.mkdirpSync(path.dirname(outputFile));

  this.concat = new this.Strategy(merge(this.sourceMapConfig, {
    outputFile: outputFile,
    baseDir: this.inputPaths[0],
    cache: this.encoderCache,
    pluginId: this.id
  }));

  return this.concat.end(function(concat) {
    function beginSection() {
      if (firstSection) {
        firstSection = false;
      } else {
        concat.addSpace(separator);
      }
    }

    if (this.header) {
      beginSection();
      concat.addSpace(this.header);
    }

    if (this.headerFiles) {
      this.headerFiles.forEach(function(file) {
        beginSection();
        concat.addFile(file);
      });
    }

    this.addFiles(beginSection);

    if (this.footerFiles) {
      this.footerFiles.forEach(function(file) {
        beginSection();
        concat.addFile(file);
      });
    }

    if (this.footer) {
      beginSection();
      concat.addSpace(this.footer + '\n');
    }
  }, this);
};

Concat.prototype.addFiles = function(beginSection) {
  var headerFooterFileOverlap = false;
  var posixInputPath = ensurePosix(this.inputPaths[0]);

  var files = uniq(this.listFiles().map(ensurePosix)).filter(function(file){
    var relativePath = file.replace(posixInputPath + '/', '');

    // * remove inputFiles that are already contained within headerFiles and footerFiles
    // * alow duplicates between headerFiles and footerFiles

    if (this._headerFooterFilesIndex[relativePath] === true) {
      headerFooterFileOverlap = true;
      return false;
    }

    return !isDirectory(file);
  }, this);

  // raise IFF:
  //   * headerFiles or footerFiles overlapped with inputFiles
  //   * nothing matched inputFiles
  if (headerFooterFileOverlap === false &&
      files.length === 0 &&
      !this.allowNone) {
    throw new Error('Concat: nothing matched [' + this.inputFiles + ']');
  }

  files.forEach(function(file) {
    beginSection();
    this.concat.addFile(file.replace(posixInputPath + '/', ''));
  }, this);
};
