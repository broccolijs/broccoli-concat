var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var helpers = require('broccoli-kitchen-sink-helpers')
var Writer = require('broccoli-writer')
var jsStringEscape = require('js-string-escape')

module.exports = Concat

Concat.prototype = Object.create(Writer.prototype)
Concat.prototype.constructor = Concat
function Concat(inputTree, options) {
  if (!(this instanceof Concat)) return new Concat(inputTree, options)
  this.inputTree = inputTree
  for (var key in options) {
    if (options.hasOwnProperty(key)) {
      this[key] = options[key]
    }
  }

  this.cache = {}
}

Concat.prototype.DEFAULT_SEPARATOR = '\n'

Concat.prototype.getWrapInEval = function () {
  // default to false for now
  return this.wrapInEval == null ? false : this.wrapInEval;
};

Concat.prototype.getWrapInFunction = function() {
  // default to true for backwards compatibility
  return this.wrapInFunction == null ? true : this.wrapInFunction;
};

Concat.prototype.write = function (readTree, destDir) {
  var self = this
  return readTree(this.inputTree).then(function (srcDir) {
    var modulesAdded = {}
    var output = []

    if (self.header) {
      output.push(self.header)
    }

    // When we are done compiling, we replace self.cache with newCache, so that
    // unused cache entries are garbage-collected
    var newCache = {}
    var lstat
    var normalizedPath
    var fileName
    var isSymbolicLink

    var inputFiles = helpers.multiGlob(self.inputFiles, {cwd: srcDir})
    for (i = 0; i < inputFiles.length; i++) {

      fileName = inputFiles[i]
      normalizedPath = path.join(srcDir, fileName)
      lstat = fs.lstatSync(normalizedPath)
      isSymbolicLink = lstat.isSymbolicLink()

      if ( lstat.isFile() || isSymbolicLink ) {
        addFile(normalizedPath, fileName, isSymbolicLink)
      }
    }

    if (self.footer) {
      output.push(self.footer)
    }

    helpers.assertAbsolutePaths([self.outputFile])
    mkdirp.sync(path.join(destDir, path.dirname(self.outputFile)))
    var separator = self.separator == null ? self.DEFAULT_SEPARATOR : self.separator
    fs.writeFileSync(path.join(destDir, self.outputFile), output.join(separator))

    self.cache = newCache

    function addFile (normalizedPath, fileName, isSymbolicLink) {
      
      if (isSymbolicLink) {
        normalizedPath = fs.readlinkSync(normalizedPath, { encoding: 'utf8' })
      }
      
      // create a new stat to avoid using fstat information of the symbolic link
      
      var stat = fs.statSync(normalizedPath)

      // This function is just slow enough that we benefit from caching
      var statsHash = helpers.hashStats(stat, normalizedPath) // TODO: should it use normalizedPath or fileName?
      var cacheObject = self.cache[statsHash]
      if (cacheObject == null) { // cache miss

        var fileContents = fs.readFileSync(normalizedPath, { encoding: 'utf8' })

        if (self.getWrapInEval()) {
          fileContents = wrapInEval(fileContents, fileName, self.getWrapInFunction())
        }
        cacheObject = {
          output: fileContents
        }
      }
      newCache[statsHash] = cacheObject
      output.push(cacheObject.output)
    }
  })
}

function wrapInEval (fileContents, fileName, wrapInFunction) {
  // Should pull out copyright comment headers
  // Eventually we want source maps instead of sourceURL
  var output = 'eval("'

  if (wrapInFunction) {
    output += '(function() {'
  }

  output += jsStringEscape(fileContents)

  if (wrapInFunction) {
    output += '})();'
  }

  output += '//@ sourceURL=' + jsStringEscape(fileName) +
            '");\n'

  return output
}
