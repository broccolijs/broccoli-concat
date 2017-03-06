var fs = require('fs-extra');
var path = require('path');
var merge = require('lodash.merge');
var Coder = require('fast-sourcemap-concat/lib/coder');

var countNewLines = require('./count-new-lines');
var ensurePosixEOL = require('./ensure-posix-eol');

function SourceMapGenerator(attrs) {
  this.inputPath = attrs.inputPath;

  this._map = {
    version: 3,
    sources: [],
    sourcesContent: [],
    names: [],
    mappings: []
  };

  if (attrs.sourceRoot) {
    this._map.sourceRoot = attrs.sourceRoot;
  }

  this._map.file = attrs.file;

  this.resetState();
}

SourceMapGenerator.prototype = merge(SourceMapGenerator.prototype, {
  resetState: function() {
    this.column = 0;
    this.linesMapped = 0;
    this.encoder = new Coder();
  },

  /**
   * Given a set of Entry objects, generates the corresponding sourcemap.
   */
  fromEntries: function(entries, filesWithSourceMaps) {
    this.resetState();

    var concat = this;

    return entries.reduce(function(map, entry) {
      if (filesWithSourceMaps[entry.file]) {
        var sourceMapPath = filesWithSourceMaps[entry.file];
        var externalMap = concat._resolveExternalSourceMap(entry.file, sourceMapPath);

        if (externalMap) {
          return concat._assimilateSourceMap(map, entry, externalMap); // Assimilate source map
        } else {
          return concat._addEntryToSourceMap(map, entry);
        }
      } else {
        return concat._addEntryToSourceMap(map, entry);
      }
    }, this._createSourceMap());
  },

  /**
   * Creates an empty sourcemap.
   */
  _createSourceMap: function() {
    return merge({}, this._map);
  },

  /**
   * Adds a given Entry to a source map.
   */
  _addEntryToSourceMap: function(map, entry) {
    if (!entry.content) {
      return map;
    }

    map.sources.push(entry.file);
    map.sourcesContent.push(entry.content);
    map.mappings.push(this._encodeEntry(entry, map.sources.length - 1));

    return map;
  },

  /**
   * Generates an encoded mapping for the given entry.
   */
  _encodeEntry: function(entry, sourceIndex) {
    var lineCount = countNewLines(entry.content);
    var mapping = this.encoder.encode({
      generatedColumn: this.column,
      source: sourceIndex,
      originalLine: 0,
      originalColumn: 0
    });

    if (lineCount === 0) {
      // no newline in the source. Keep outputting one big line.
      this.column += entry.content.length;
    } else {
      // end the line
      this.column = 0;
      this.encoder.resetColumn();
      mapping += ';';
      this.encoder.adjustLine(lineCount - 1);
    }

    // For the remainder of the lines (if any), we're just following
    // one-to-one.
    for (var i = 0; i < lineCount-1; i++) {
      mapping += 'AACA;';
    }

    this.linesMapped += lineCount;
    return mapping;
  },

  /**
   * Assimilates an external sourcemap into the passed in sourcemap.
   */
  _assimilateSourceMap: function(map, entry, externalMap) {
    var initialLinesMapped = this.linesMapped;
    var lineCount = countNewLines(entry.content);

    // Do assimilation

    var sourcesOffset = map.sources.length;
    var namesOffset = map.names.length;

    map.sources = map.sources.concat(this._resolveSources(externalMap.sources));
    map.sourcesContent = map.sourcesContent.concat(this._resolveSourcesContent(externalMap, entry.file));

    while (map.sourcesContent.length > map.sources.length) {
      map.sourcesContent.pop();
    }

    while (map.sourcesContent.length < map.sources.length) {
      map.sourcesContent.push(null);
    }

    map.names = map.names.concat(externalMap.names);

    map.mappings.push(this._mergeMappings(externalMap, sourcesOffset, namesOffset));

    while (this.linesMapped - initialLinesMapped < lineCount) {
      // This cleans up after upstream sourcemaps that are too short
      // for their sourcecode so they don't break the rest of our
      // mapping. Coffeescript does this.
      map.mappings.push('');
      this.linesMapped++;
    }

    while (lineCount < this.linesMapped - initialLinesMapped) {
      // Likewise, this cleans up after upstream sourcemaps that are
      // too long for their sourcecode.
      // TODO: How do we handle this?
      entry.content += "\n";
      lineCount++;
    }

    return map;
  },

  _mergeMappings: function(externalMap, sourcesOffset, namesOffset, cacheHint) {
    this.decoder = new Coder();

    var mappings = '';
    var inputMappings = externalMap.mappings;

    var pattern = /^([;,]*)([^;,]*)/;
    var continuation = /^([;,]*)((?:AACA;)+)/;

    var initialMappedLines = this.linesMapped;

    var lines;

    while (inputMappings.length > 0) {
      var match = pattern.exec(inputMappings);

      // If the entry was preceded by separators, copy them through.
      if (match[1]) {
        mappings += match[1];
        lines = match[1].replace(/,/g, '').length;
        if (lines > 0) {
          this.linesMapped += lines;
          this.encoder.resetColumn();
          this.decoder.resetColumn();
        }
      }

      // Re-encode the entry.
      if (match[2]){
        var value = this.decoder.decode(match[2]);
        value.generatedColumn += this.column;
        this.column = 0;

        if (sourcesOffset && value.hasOwnProperty('source')) {
          value.source += sourcesOffset;
          this.decoder.prev_source += sourcesOffset;
          sourcesOffset = 0;
        }

        if (namesOffset && value.hasOwnProperty('name')) {
          value.name += namesOffset;
          this.decoder.prev_name += namesOffset;
          namesOffset = 0;
        }

        mappings += this.encoder.encode(value);
      }

      inputMappings = inputMappings.slice(match[0].length);

      // Once we've applied any offsets, we can try to jump ahead.
      if (!sourcesOffset && !namesOffset) {
        if (cacheHint) {
          // Our cacheHint tells us what our final encoder state will be
          // after processing this file. And since we've got nothing
          // left ahead that needs rewriting, we can just copy the
          // remaining mappings over and jump to the final encoder
          // state.
          mappings += inputMappings;
          inputMappings = '';
          this.linesMapped = initialMappedLines + cacheHint.lines;
          this.encoder = cacheHint.encoder;
        }

        if ((match = continuation.exec(inputMappings))) {
          // This is a significant optimization, especially when we're
          // doing simple line-for-line concatenations.
          lines = match[2].length / 5;
          this.encoder.adjustLine(lines);
          this.encoder.resetColumn();
          this.decoder.adjustLine(lines);
          this.decoder.resetColumn();
          this.linesMapped += lines + match[1].replace(/,/g, '').length;
          mappings += match[0];
          inputMappings = inputMappings.slice(match[0].length);
        }
      }
    }

    return mappings;
  },

  _resolveSources: function(sources) {
    var inputPath = this.inputPath;

    if (!inputPath) {
      return sources;
    }

    return sources.map(function(source) {
      return source.replace(inputPath, '');
    });
  },

  _resolveSourcesContent: function(map, file) {
    if (map.sourcesContent) {
      // Upstream srcmap already had inline content, so easy.
      return map.sourcesContent;
    } else {
      // Look for original sources relative to our input source filename.
      return map.sources.map(function(source) {
        var fullPath;

        if (path.isAbsolute(source)) {
          fullPath = source;
        } else {
          fullPath = path.join(path.dirname(this._resolveFile(file)), source);
        }

        return ensurePosixEOL(fs.readFileSync(fullPath, 'utf-8'));
      }.bind(this));
    }
  },

  _resolveFile: function(file) {
    if (this.inputPath && file.slice(0, 1) !== '/') {
      return path.join(this.inputPath, file);
    }

    return file;
  },

  _resolveExternalSourceMap: function(fileWithSourceMap, externalSourceMapURL) {
    try {
      var base64Map = /^data:.+?;base64,/.exec(externalSourceMapURL);
      var srcMap;

      // If the URL was a base64 encoded sourcemap...
      if (base64Map) {
        srcMap = new Buffer(externalSourceMapURL.slice(base64Map[0].length), 'base64');
      }

      // If the URL was an absolute path, resolve from the input directory
      else if (this.inputPath && externalSourceMapURL.slice(0,1) === '/') {
        srcMap = fs.readFileSync(
          path.join(this.inputPath, externalSourceMapURL),
          'utf8'
        );
      }

      // If the URL was a relative path, resolve from the directory of the file
      else {
        srcMap = fs.readFileSync(
          path.join(path.dirname(this._resolveFile(fileWithSourceMap)), externalSourceMapURL),
          'utf8'
        );
      }

      return JSON.parse(srcMap);
    } catch (err) {
      console.log('Warning: ignoring input sourcemap for ' + fileWithSourceMap + ' because ' + err.message);
    }
  }
});

module.exports = SourceMapGenerator;
