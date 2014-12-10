var helpers = require('broccoli-kitchen-sink-helpers');
var Writer = require('broccoli-writer');
var path = require('path');
var fs = require('fs');
var merge = require('lodash-node/modern/objects/merge');
var mkdirp = require('mkdirp');
var SourceMapGenerator = require('source-map').SourceMapGenerator;
var SourceMapConsumer = require('source-map').SourceMapConsumer;
var RSVP = require('rsvp');
var sourceMappingURL = require('source-map-url');

module.exports = Concat;
Concat.prototype = Object.create(Writer.prototype);
Concat.prototype.constructor = Concat;

function Concat (inputTree, options) {
  if (!(this instanceof Concat)) {
    return new Concat(inputTree, options);
  }
  Writer.call(this, inputTree, options);

  this.options = merge({
    inputFiles: ['**/*.js'],
    separator: '\n'
  }, options);

  if (!this.options.outputFile) {
    throw new Error("outputFile is required");
  }

  this.inputTree = inputTree;
}

Concat.prototype.write = function (readTree, outDir) {
  return readTree(this.inputTree).then(function(inDir) {
    return this.concatenate(inDir, outDir);
  }.bind(this));
};

Concat.prototype.concatenate = function(inDir, outDir) {
  this.openOutputStream(outDir);
  this.sourceMap = new SourceMapGenerator({
    file: this.options.outputFile,
    sourceRoot: this.options.sourceRoot
  });
  if (this.options.header) {
    this.pushContent(this.options.header);
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
    this.pushContent(this.options.footer);
  }
  return this.finish(outDir);
};

Concat.prototype.openOutputStream = function(outDir) {
  var filename = path.join(outDir, this.options.outputFile);
  mkdirp(path.dirname(filename));
  this.outStream = fs.createWriteStream(filename);
  this.lineOffset = 0;
};

Concat.prototype.pushContent = function(src) {
  if (this.lineOffset > 0) {
    this.pushSeparator();
  }
  this.outStream.write(src);
  var count = countLines(src);
  this.lineOffset += count;
  return count;
};

Concat.prototype.pushSeparator = function() {
  this.outStream.write(this.options.separator);
  if (typeof this._separatorLines === 'undefined') {
    this._separatorLines = countLines(this.options.separator);
  }
  this.lineOffset += this._separatorLines;
};

Concat.prototype.addFiles = function(inDir) {
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
      this.addFile(file, inDir);
    }
  }.bind(this));
};

Concat.prototype.addFile = function(file, inDir) {
  var content = fs.readFileSync(path.join(inDir, file), 'utf-8');
  var upstream = this.upstreamSourcemap(inDir, file, content);
  content = upstream.content;
  var lineCount = this.pushContent(content);

  for (var i=0; i < lineCount; i++) {
    this.sourceMap.addMapping({
      generated: {
        line: this.lineOffset - lineCount + i + 1, // 1-indexed
        column: 0
      },
      source: file,
      original: {
        line: i + 1,
        column: 0
      }
    });
  }
  this.sourceMap.setSourceContent(file, content);
  if (upstream.map) {
    this.sourceMap.applySourceMap(upstream.map);
  }
};

Concat.prototype.upstreamSourcemap = function(inDir, file, content) {
  if (!sourceMappingURL.existsIn(content)) {
    return {content: content, map: null};
  }
  var url = sourceMappingURL.getFrom(content);
  var map = new SourceMapConsumer(fs.readFileSync(path.join(path.dirname(path.join(inDir, file)), url), 'utf-8'));

  return {content: sourceMappingURL.removeFrom(content), map: map };
};


Concat.prototype.finish = function(outDir) {
  var mapFilename = path.join(
    outDir,
    this.options.outputFile.replace(/\.js$/, '')+'.map'
  );
  this.outStream.write('//# sourceMappingURL=' + path.basename(mapFilename));
  return new RSVP.Promise(function(resolve, reject) {
    this.outStream.on('finish', resolve);
    this.outStream.on('error', reject);
    this.outStream.end();
  }.bind(this)).then(function(){
    fs.writeFileSync(mapFilename, this.sourceMap.toString());
  }.bind(this));
};

function countLines(src) {
  var newlinePattern = /(\r?\n)/g;
  var count = 0;
  while (newlinePattern.exec(src)) {
    count++;
  }
  return count;
}
