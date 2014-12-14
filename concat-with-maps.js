var helpers = require('broccoli-kitchen-sink-helpers');
var CachingWriter = require('broccoli-caching-writer');
var path = require('path');
var fs = require('fs');
var merge = require('lodash-node/modern/objects/merge');
var ConcatWithSourcemap = require('fast-sourcemap-concat');

module.exports = CachingWriter.extend({
  enforceSingleInputTree: true,

  init: function() {
    if (!this.separator) {
      this.separator = '\n';
    }
    if (!this.outputFile) {
      throw new Error("outputFile is required");
    }
  },

  updateCache: function(inDir, outDir) {
    var concat = this.concat = new ConcatWithSourcemap({
      outputFile: path.join(outDir, this.outputFile),
      sourceRoot: this.sourceRoot,
      baseDir: inDir
    });

    if (this.header) {
      concat.addSpace(this.header + this.separator);
    }

    if (this.headerFiles) {
      this.headerFiles.forEach(function(hf) {
        concat.addFile(hf);
        concat.addSpace(this.separator);
      });
    }

    try {
      this.addFiles(inDir);
    } catch(error) {
      // multiGlob is obtuse.
      if (!error.message.match("did not match any files" || !this.allowNone)) {
        throw error;
      }
    }

    if (this.footer) {
      concat.addSpace(this.footer + this.separator);
    }
    if (this.footerFiles) {
      this.footerFiles.forEach(function(ff) {
        concat.addFile(ff);
        concat.addSpace(this.separator);
      }.bind(this));
    }
    return this.concat.end();
  },

  addFiles: function(inDir) {
    helpers.multiGlob(this.inputFiles, {
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
        this.concat.addSpace(this.separator);
      }
    }.bind(this));
  },

});
