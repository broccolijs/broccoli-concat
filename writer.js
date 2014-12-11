var helpers = require('broccoli-kitchen-sink-helpers');
var CachingWriter = require('broccoli-caching-writer');
var path = require('path');
var fs = require('fs');
var merge = require('lodash-node/modern/objects/merge');
var ConcatWithSourcemap = require('fast-sourcemap-concat');

module.exports = CachingWriter.extend({
  enforceSingleInputTree: true,

  init: function(inputTrees, options) {
    this.options = merge({
      inputFiles: ['**/*.js'],
      separator: '\n'
    }, options);

    if (!this.options.outputFile) {
      throw new Error("outputFile is required");
    }
  },

  updateCache: function(inDir, outDir) {
    var concat = this.concat = new ConcatWithSourcemap({
      outputFile: path.join(outDir, this.options.outputFile),
      sourceRoot: this.options.sourceRoot,
      baseDir: inDir
    });

    if (this.options.header) {
      concat.addSpace(this.options.header);
    }

    if (this.options.headerFiles) {
      this.options.headerFiles.forEach(function(hf) {
        concat.addFile(hf);
      });
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
      concat.addSpace(this.options.footer);
    }
    if (this.options.footerFiles) {
      this.options.footerFiles.forEach(function(ff) {
        concat.addFile(ff);
      });
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
