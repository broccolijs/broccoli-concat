/* global describe, afterEach, it, expect */

var expect = require('chai').expect;  // jshint ignore:line
var sinon = require('sinon');
var concat = require('..');
var fs = require('fs');
var path = require('path');
var broccoli = require('broccoli');
var merge = require('broccoli-merge-trees');
var validateSourcemap = require('sourcemap-validator');

var firstFixture = path.join(__dirname, 'fixtures', 'first');
var secondFixture = path.join(__dirname, 'fixtures', 'second');
var sprintfFixture = path.join(__dirname, 'fixtures', 'sprintf');
var builder;

function readFileSync() {
  // babel doesn't support Windows newlines
  // https://github.com/babel/babel/pull/2290
  return fs.readFileSync.apply(this, arguments).replace(/\r\n/g, '\n');
}

describe('sourcemap-concat', function() {

  it('concatenates sprintf alone', function() {
    var node = concat(sprintfFixture, {
      outputFile: '/sprintf-alone.js',
      inputFiles: ['dist/*.js'],
      sourceMapConfig: { enabled: true }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('sprintf-alone.js').in(result);
    });
  });

  it('concatenates sprintf with another lib', function() {
    var node = concat(sprintfFixture, {
      outputFile: '/sprintf-multi.js',
      inputFiles: ['dist/*.js', 'other/*.js'],
      sourceMapConfig: { enabled: true }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('sprintf-multi.js').in(result);
    });
  });

  it('concatenates files in one dir', function() {
    var node = concat(firstFixture, {
      outputFile: '/all-inner.js',
      inputFiles: ['inner/*.js']
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all-inner.js').in(result);
      expectFile('all-inner.map').in(result);
    });
  });

  it('concatenates files across dirs', function() {
    var node = concat(firstFixture, {
      outputFile: '/all.js',
      inputFiles: ['**/*.js']
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all.js').in(result);
      expectFile('all.map').in(result);
    });
  });

  it('concatenates all files across dirs when inputFiles is not specified', function() {
    var node = concat(firstFixture, {
      outputFile: '/all.js'
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all.js').in(result);
      expectFile('all.map').in(result);
    });
  });

  it('inserts header', function() {
    var node = concat(firstFixture, {
      outputFile: '/all-with-header.js',
      inputFiles: ['**/*.js'],
      header: "/* This is my header. */"
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all-with-header.js').in(result);
      expectFile('all-with-header.map').in(result);
    });
  });

  it('inserts header when sourcemaps are disabled', function() {
    var node = concat(firstFixture, {
      header: "/* This is my header. */",
      inputFiles: ['**/*.js'],
      outputFile: '/all-with-header.js',
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all-with-header.js').withoutSrcURL().in(result);
      expectFile('all-with-header.map').notIn(result);
    });
  });

  it('inserts header, headerFiles, footer and footerFiles - and overlaps with inputFiles', function() {
    var node = concat(firstFixture, {
      header: '/* This is my header.s*/',
      headerFiles: ['inner/first.js', 'inner/second.js'],
      inputFiles: ['**/*.js'],
      footerFiles: ['other/third.js', 'other/fourth.js'],
      footer: '/* This is my footer. */',
      outputFile: '/all-the-things.js'
    });

    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all-the-things.js').in(result);
      expectFile('all-the-things.map').in(result);
    });
  });

  it('headerFiles, but with a glob', function() {
    expect(function() {
      concat(firstFixture, {
        headerFiles: ['inner/*.js'],
        inputFiles: ['**/*.js'],
        outputFile: '/all-the-things.js'
      });
    }).to.throw('headerFiles cannot contain a glob,  `inner/*.js`');
  });

  it('footerFiles, but with a glob', function() {
    expect(function() {
      concat(firstFixture, {
        footerFiles: ['inner/*.js'],
        inputFiles: ['**/*.js'],
        outputFile: '/all-the-things.js'
      });
    }).to.throw('footerFiles cannot contain a glob,  `inner/*.js`');
  });

  it('inserts header, headerFiles, footer and footerFiles (reversed) - and overlaps with inputFiles', function() {
    var node = concat(firstFixture, {
      header: '/* This is my header.s*/',
      headerFiles: ['inner/second.js', 'inner/first.js'],
      inputFiles: ['**/*.js'],
      footerFiles: ['other/fourth.js', 'other/third.js'],
      footer: '/* This is my footer. */',
      outputFile: '/all-the-things-reversed.js'
    });

    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all-the-things-reversed.js').in(result);
      expectFile('all-the-things-reversed.map').in(result);
    });
  });

  it('disables sourcemaps when requested', function() {
    var node = concat(firstFixture, {
      header: "/* This is my header. */",
      inputFiles: ['**/*.js'],
      outputFile: '/no-sourcemap.js',
      sourceMapConfig: { enabled: false },
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('no-sourcemap.js').in(result);
      expectFile('no-sourcemap.map').notIn(result);
    });
  });

  it('passes sourcemaps config to the sourcemaps engine', function() {
    var node = concat(firstFixture, {
      inputFiles: ['**/*.js'],
      outputFile: '/all-with-source-root.js',
      sourceMapConfig: { enabled: true, sourceRoot: "/foo" }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      var expected = path.join(__dirname, 'expected', 'all-with-source-root.map');
      var actual = path.join(result.directory, 'all-with-source-root.map');

      assertFileEqual(readFileSync(actual, 'UTF-8'), readFileSync(expected, 'UTF-8'));
    });
  });

  it('assimilates existing sourcemap', function() {
    var inner = concat(firstFixture, {
      outputFile: '/all-inner.js',
      inputFiles: ['inner/*.js'],
      header: "/* This is my header. */"
    });
    var other = concat(firstFixture, {
      outputFile: '/all-other.js',
      inputFiles: ['other/*.js'],
      header: "/* Other header. */"
    });

    var final = concat(merge([inner, other]), {
      outputFile: '/staged.js',
      inputFiles: ['all-inner.js', 'all-other.js'],
    });

    builder = new broccoli.Builder(final);
    return builder.build().then(function(result) {
      expectFile('staged.js').in(result);
      expectFile('staged.map').in(result);
    });
  });

  it('dedupe uniques in inputFiles (with simpleconcat)', function() {
    var final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/first.js', 'inner/second.js', 'inner/first.js'],
      sourceMapConfig: {
        enabled: false
      }
    });

    builder = new broccoli.Builder(final);
    return builder.build().then(function(result) {
      var actual = readFileSync(result.directory + '/staged.js', 'UTF-8');

      var firstFixture = path.join(__dirname, 'fixtures', 'first');
      var first = readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
      var second = readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

      var expected = first + '\n' +  second;
      assertFileEqual(actual, expected, 'output is wrong');
    });
  });

  it('dedupe uniques in inputFiles (with sourcemaps)', function() {
    var final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/first.js', 'inner/second.js', 'inner/first.js']
    });

    builder = new broccoli.Builder(final);
    return builder.build().then(function(result) {
      var actual = readFileSync(result.directory + '/staged.js', 'UTF-8');

      var firstFixture = path.join(__dirname, 'fixtures', 'first');
      var first = readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
      var second = readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

      var expected = first + '\n' +  second + '//# sourceMappingURL=staged.map';
      assertFileEqual(actual, expected, 'output is wrong');
    });
  });

  it('prepends headerFiles', function() {
    var node = concat(firstFixture, {
      outputFile: '/inner-with-headers.js',
      inputFiles: ['inner/*.js'],
      headerFiles: ['other/third.js', 'other/fourth.js']
    });

    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('inner-with-headers.js').in(result);
      expectFile('inner-with-headers.map').in(result);
    });
  });

  it('prepends headerFiles (order reversed)', function() {
    var node = concat(firstFixture, {
      outputFile: '/inner-with-headers-reversed.js',
      inputFiles: ['inner/*.js'],
      headerFiles: ['other/fourth.js', 'other/third.js']
    });

    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('inner-with-headers-reversed.js').in(result);
      expectFile('inner-with-headers-reversed.map').in(result);
    });
  });

  it('appends footer files', function() {
    var node = concat(firstFixture, {
      outputFile: '/inner-with-footers.js',
      inputFiles: ['inner/*.js'],
      footerFiles: ['other/third.js', 'other/fourth.js']
    });

    builder = new broccoli.Builder(node);

    return builder.build().then(function(result) {
      expectFile('inner-with-footers.js').in(result);
      expectFile('inner-with-footers.map').in(result);
    });
  });

  it('appends footer files when sourcemaps are disabled', function() {
    var node = concat(firstFixture, {
      outputFile: '/inner-with-footers.js',
      inputFiles: ['inner/*.js'],
      footerFiles: ['other/third.js', 'other/fourth.js'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('inner-with-footers.js').withoutSrcURL().in(result);
      expectFile('inner-with-footers.map').notIn(result);
    });
  });

  it('can ignore empty content', function() {
    var node = concat(firstFixture, {
      outputFile: '/nothing.js',
      inputFiles: ['nothing/*.js'],
      allowNone: true
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('nothing.js').in(result);
      expectFile('nothing.map').in(result);
    });
  });
  it('can ignore empty content when sourcemaps are disabled', function() {
    var node = concat(firstFixture, {
      outputFile: '/nothing.css',
      inputFiles: ['nothing/*.css'],
      sourceMapConfig: { enabled: false },
      allowNone: true
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('nothing.css').in(result);
    });
  });

  it('does not ignore empty content when allowNone is not explicitly set', function() {
    var node = concat(firstFixture, {
      outputFile: '/nothing.js',
      inputFiles: ['nothing/*.js']
    });
    builder = new broccoli.Builder(node);
    var reason;
    return builder.build().catch(function(rejectionReason) {
      reason = rejectionReason;
    }).then(function(){
      expect(reason).to.be;
      expect(reason.message).to.eql("ConcatWithMaps: nothing matched [nothing/*.js]");
    });
  });

  it('does not ignore empty content when allowNone is not explicitly set and sourcemaps are disabled', function() {
    var node = concat(firstFixture, {
      outputFile: '/nothing.css',
      inputFiles: ['nothing/*.css']
    });
    var failure = sinon.spy();
    builder = new broccoli.Builder(node);
    return builder.build().catch(failure).then(function(){
      expect(failure.called).to.be.true;
    });
  });

  it('is not fooled by directories named *.js', function() {
    var node = concat(secondFixture, {
      outputFile: '/sneaky.js',
      inputFiles: ['**/*.js']
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('sneaky.js').in(result);
      expectFile('sneaky.map').in(result);
    });
  });

  afterEach(function() {
    if (builder) {
      return builder.cleanup();
    }
  });
});

describe('concat-without-maps', function() {
  var Concat = require('../concat-without-source-maps');
  var quickTemp = require('quick-temp');
  var concat;
  var outputFile;

  beforeEach(function() {
    outputFile = quickTemp.makeOrRemake(this, 'tmpDestDir') + '/' + 'foo.js';

    concat = new Concat({
      outputFile: outputFile,
      baseDir: firstFixture
    });
  });

  afterEach(function() {
    quickTemp.remove(this, 'tmpDestDir');
  });

  it('addSpace', function() {
    concat.addSpace('a');
    concat.addSpace('b');
    concat.addSpace('c');
    concat.end();
    assertFileEqual(readFileSync(outputFile, 'UTF-8'), 'abc');
  });

  it('addFile', function() {
    concat.addFile('inner/first.js');
    concat.addFile('inner/second.js');
    concat.addFile('other/third.js');
    concat.end();
    assertFileEqual(readFileSync(outputFile, 'UTF-8'), readFileSync(__dirname + '/expected/concat-without-maps-1.js', 'UTF-8'));
  });

  it('addFile & addSpace', function() {
    concat.addFile('inner/first.js');
    concat.addSpace('"a";\n');
    concat.addSpace('"b";\n');
    concat.addSpace('"c";\n');
    concat.addFile('inner/second.js');
    concat.end();
    assertFileEqual(readFileSync(outputFile, 'UTF-8'), readFileSync(__dirname + '/expected/concat-without-maps-2.js', 'UTF-8'));
  });
});

function expectFile(filename) {
  var stripURL = false;

  return {
    in: function(result, subdir) {
      if (!subdir) {
        subdir = '.';
      }

      var actualContent = readFileSync(path.join(result.directory, subdir, filename), 'utf-8');
      fs.writeFileSync(path.join(__dirname, 'actual', filename), actualContent);

      var expectedContent;

      try {
        expectedContent = readFileSync(path.join(__dirname, 'expected', filename), 'utf-8');
        if (stripURL) {
          expectedContent = expectedContent.replace(/\/\/# sourceMappingURL=.*$/, '');
        }

      } catch (err) {
        console.warn('Missing expcted file: ' + path.join(__dirname, 'expected', filename));
      }

      expectSameFiles(actualContent, expectedContent, filename);

      return this;
    },

    notIn: function(result) {
      expect(fs.existsSync(path.join(result.directory, filename))).to.equal(false, filename + ' should not have been present');
      return this;
    },

    withoutSrcURL: function() {
      stripURL = true;
      return this;
    }
  };
}

function expectSameFiles(actualContent, expectedContent, filename) {
  if (/\.map$/.test(filename)) {
    expect(JSON.parse(actualContent)).to.deep.equal(expectedContent ? JSON.parse(expectedContent) : undefined, 'discrepancy in ' + filename);
  } else {
    expect(actualContent).to.equal(expectedContent, 'discrepancy in ' + filename);
  }
}

function assertFileEqual(actual, expected, message) {
  if (actual === expected) {
    expect(true).to.be.true;
  } else {
    throw new EqualityError('output is wrong', actual, expected);
  }
}

function EqualityError(message, actual, expected) {
  this.message = message;
  this.actual = actual;
  this.expected = expected;
  this.showDiff = true;
  Error.captureStackTrace(this, module.exports);
}

EqualityError.prototype = Object.create(Error.prototype);
EqualityError.prototype.name = 'EqualityError';
EqualityError.prototype.constructor = EqualityError;

function expectValidSourcemap(jsFilename, mapFilename) {
  return {
    in: function (result, subdir) {
      if (!subdir) {
        subdir = '.';
      }

      if (!mapFilename) {
        mapFilename = jsFilename.replace(/\.js$/, '.map');
      }

      expectFile(jsFilename).in(result, subdir);
      expectFile(mapFilename).in(result, subdir);

      var actualMin = readFileSync(path.join(result.directory, subdir, jsFilename), 'utf-8');
      var actualMap = readFileSync(path.join(result.directory, subdir, mapFilename), 'utf-8');
      validateSourcemap(actualMin, actualMap, {});
    }
  }
}
