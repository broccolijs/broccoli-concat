var Plugin = require('broccoli-plugin');
var FSTree = require('fs-tree-diff');
var path = require('path');
var fs = require('fs-extra');
var merge = require('lodash.merge');
var omit = require('lodash.omit');
var uniq = require('lodash.uniq');
var walkSync = require('walk-sync');

var ensureNoGlob = require('./lib/utils/ensure-no-glob');
var ensurePosix = require('./lib/utils/ensure-posix');
var isDirectory = require('./lib/utils/is-directory');
var makeIndex = require('./lib/utils/make-index');

module.exports = Concat;
Concat.prototype = Object.create(Plugin.prototype);
Concat.prototype.constructor = Concat;

var id = 0;
function Concat(inputNode, options, Strategy) {
  if (!(this instanceof Concat)) {
    return new Concat(inputNode, options, Strategy);
  }

  if (!options || !options.outputFile) {
    throw new Error('the outputFile option is required');
  }

  var inputNodes;
  id++;

  if (process.env.CONCAT_STATS) {
    inputNodes = Concat.inputNodesForConcatStats(inputNode, id, options.outputFile);
  } else {
    inputNodes = [inputNode];
  }

  Plugin.call(this, inputNodes, {
    annotation: options.annotation,
    name: (Strategy.name || 'Unknown') + 'Concat',
    persistentOutput: true
  });

  this.id = id;

  if (Strategy === undefined) {
    throw new TypeError('Concat requires a concat Strategy');
  }

  this.Strategy = Strategy;
  this.sourceMapConfig = omit(options.sourceMapConfig || {}, 'enabled');
  this.allInputFiles = uniq([].concat(options.headerFiles || [], options.inputFiles || [], options.footerFiles || []));
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

  this._lastTree = null;

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

Concat.prototype.shouldBuild = function() {
  var currentTree = this.getCurrentFSTree();
  var isRebuild = !!this._lastTree;
  var patch;

  if (isRebuild) {
    patch = this._lastTree.calculatePatch(currentTree);
  }

  this._lastTree = currentTree;

  // We build if this is an initial build (not a rebuild)
  // or if the patch has non-zero length
  return !isRebuild || patch.length !== 0;
};

Concat.prototype.build = function() {
  if (!this.shouldBuild()) {
    return;
  }

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

Concat.prototype.getCurrentFSTree = function() {
  return FSTree.fromEntries(this.listEntries());
}

Concat.prototype.listEntries = function() {
  // If we have no inputFiles at all, use undefined as the filter to return
  // all files in the inputDir.
  var filter = this.allInputFiles.length ? this.allInputFiles : undefined;
  var inputDir = this.inputPaths[0];
  return walkSync.entries(inputDir, filter);
};

/**
 * Returns the full paths for any matching inputFiles.
 */
Concat.prototype.listFiles = function() {
  var inputDir = this.inputPaths[0];
  return this.listEntries().map(function(entry) {
    return ensurePosix(path.join(inputDir, entry.relativePath));
  });
};

Concat.prototype.addFiles = function(beginSection) {
  var headerFooterFileOverlap = false;
  var posixInputPath = ensurePosix(this.inputPaths[0]);

  var files = this.listFiles().filter(function(file) {
    var relativePath = file.replace(posixInputPath + '/', '');

    // * remove inputFiles that are already contained within headerFiles and footerFiles
    // * allow duplicates between headerFiles and footerFiles

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
