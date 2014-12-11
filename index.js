var helpers = require('broccoli-kitchen-sink-helpers');
var CachingWriter = require('broccoli-caching-writer');
var path = require('path');
var fs = require('fs');
var merge = require('lodash-node/modern/objects/merge');
var ConcatWithSourcemap = require('fast-source-map');

module.exports = CachingWriter.extend({
  enforceSingleInputTree: true,

  init: function(inputTrees, options) {
    CachingWriter.apply(this, arguments);
    this.options = merge({
      inputFiles: ['**/*.js'],
      separator: '\n'
    }, options);

    if (!this.options.outputFile) {
      throw new Error("outputFile is required");
    }
  },

  updateCache: function(inDir, outDir) {
    this.concat = new ConcatWithSourcemap({
      outputFile: path.join(outDir, this.options.outputFile),
      sourceRoot: this.options.sourceRoot,
      baseDir: inDir
    });

    if (this.options.header) {
      this.concat.addSpace(this.options.header);
    }

    try {
      this.addFiles(inDir);
    } catch(error) {
      // multiGlob is obtuse.
      if (!error.message.match("did not match any files" || !this.options.allowNone)) {
        throw error;
      }
    }

    if (this.options.footer) {
      this.concat.addSpace(this.options.footer);
    }
    return this.concat.end();
  },

  addFiles: function(inDir) {
    helpers.multiGlob(this.options.inputFiles, {
      cwd: inDir,
      root: inDir,
      nomount: false
    }).forEach(function(file) {
      var stat;
      try {
        stat = fs.statSync(path.join(inDir, file));
      } catch(err) {}
      if (stat && !stat.isDirectory()) {
        this.concat.addFile(file);
      }
    }.bind(this));
  },

});
