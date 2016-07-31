/* global describe, afterEach, beforeEach, it, expect */

var concat = require('..');
var fs = require('fs');
var path = require('path');
var broccoli = require('broccoli');
var merge = require('broccoli-merge-trees');
var validateSourcemap = require('sourcemap-validator');

var chai = require('chai');
var chaiFiles = require('chai-files');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiFiles);
chai.use(chaiAsPromised);

var expect = chai.expect;
var file = chaiFiles.file;

var firstFixture = path.join(__dirname, 'fixtures', 'first');
var secondFixture = path.join(__dirname, 'fixtures', 'second');

describe('sourcemap-concat', function() {
  var builder;

  afterEach(function() {
    if (builder) {
      return builder.cleanup();
    }
  });

  it('concatenates files in one dir', function() {
    var node = concat(firstFixture, {
      outputFile: '/all-inner.js',
      inputFiles: ['inner/*.js']
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('all-inner.js').in(result);
    });
  });

  it('concatenates files across dirs', function() {
    var node = concat(firstFixture, {
      outputFile: '/all.js',
      inputFiles: ['**/*.js']
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('all.js').in(result);
    });
  });

  it('concatenates all files across dirs when inputFiles is not specified', function() {
    var node = concat(firstFixture, {
      outputFile: '/all.js'
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('all.js').in(result);
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
      expectValidSourcemap('all-with-header.js').in(result);
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
      expectValidSourcemap('all-the-things.js').in(result);
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
      expectValidSourcemap('all-the-things-reversed.js').in(result);
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

      expect(file(actual)).to.equal(file(expected));
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
      expectValidSourcemap('staged.js').in(result);
    });
  });

  it('inputFiles are sorted lexicographically (improve stability of build output)', function() {
    var final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/second.js', 'inner/first.js'],
      sourceMapConfig: {
        enabled: false
      }
    });

    builder = new broccoli.Builder(final);
    return builder.build().then(function(result) {
      var first = fs.readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
      var second = fs.readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

      var expected = first + '\n' +  second;
      expect(file(result.directory + '/staged.js')).to.equal(expected);
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
      var first = fs.readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
      var second = fs.readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

      var expected = first + '\n' +  second;
      expect(file(result.directory + '/staged.js')).to.equal(expected);
    });
  });

  it('dedupe uniques in inputFiles (with sourcemaps)', function() {
    var final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/first.js', 'inner/second.js', 'inner/first.js']
    });

    builder = new broccoli.Builder(final);
    return builder.build().then(function(result) {
      var first = fs.readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
      var second = fs.readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

      var expected = first + '\n' +  second + '//# sourceMappingURL=staged.map';
      expect(file(result.directory + '/staged.js')).to.equal(expected, 'output is wrong');
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
      expectValidSourcemap('inner-with-headers.js').in(result);
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
      expectValidSourcemap('inner-with-headers-reversed.js').in(result);
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
      expectValidSourcemap('inner-with-footers.js').in(result);
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
      expectValidSourcemap('nothing.js').in(result);
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
    return expect(builder.build()).to.be.rejectedWith("ConcatWithMaps: nothing matched [nothing/*.js]");
  });

  it('does not ignore empty content when allowNone is not explicitly set and sourcemaps are disabled', function() {
    var node = concat(firstFixture, {
      outputFile: '/nothing.css',
      inputFiles: ['nothing/*.css']
    });
    builder = new broccoli.Builder(node);
    return expect(builder.build()).to.be.rejected;
  });

  it('is not fooled by directories named *.js', function() {
    var node = concat(secondFixture, {
      outputFile: '/sneaky.js',
      inputFiles: ['**/*.js']
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('sneaky.js').in(result);
    });
  });

  describe('rebuild', function() {
    var inputDir;
    var quickTemp = require('quick-temp');
    beforeEach(function() {
      inputDir = quickTemp.makeOrRemake(this, 'rebuild-tests');
    });

    // write/unlink in inputDir
    function write(file, content) { fs.writeFileSync(inputDir + '/' + file, content); }
    function unlink(file)         { fs.unlinkSync(inputDir + '/' + file); }

    // other helper
    function read(fullPath)       { return fs.readFileSync(fullPath, 'UTF8'); }

    it('add/remove inputFile', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        inputFiles: ['**/*.js'],
        allowNone: true,
      });

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(fs.readFileSync(result.directory + '/rebuild.js', 'UTF8')).to.eql('//# sourceMappingURL=rebuild.map');

        write('omg.js', 'hi');

        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('hi//# sourceMappingURL=rebuild.map');
        unlink('omg.js')
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('//# sourceMappingURL=rebuild.map');
        return builder.build();
      });
    });

    it('inputFile ordering', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        inputFiles: ['**/*.js'],
        allowNone: true,
      });
      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('//# sourceMappingURL=rebuild.map');

        write('z.js', 'z');
        write('a.js', 'a');
        write('b.js', 'b');

        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('a\nb\nz//# sourceMappingURL=rebuild.map');
        unlink('a.js')
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz//# sourceMappingURL=rebuild.map');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('a\nb\nz//# sourceMappingURL=rebuild.map');
        return builder.build();
      });
    });

    it('headerFiles', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js', 'a.js'],
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map');
        return builder.build();
      });
    });

    it('footerFiles', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        footerFiles: ['b.js', 'a.js'],
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map');
        return builder.build();
      });
    });

    it('footerFiles + headerFiles', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js'],
        footerFiles: ['a.js'],
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map');
        return builder.build();
      });
    });

    it('footerFiles + inputFiles (glob) + headerFiles', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js'],
        footerFiles: ['a.js'],
        inputFiles: [ '**/*.js'],
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na-updated//# sourceMappingURL=rebuild.map');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz-updated\na//# sourceMappingURL=rebuild.map');
        unlink('z.js');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map');
        write('z.js', 'z');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map');
        return builder.build();
      });
    });
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
    expect(file(outputFile)).to.equal('abc');
  });

  it('addFile', function() {
    concat.addFile('inner/first.js');
    concat.addFile('inner/second.js');
    concat.addFile('other/third.js');
    concat.end();
    expect(file(outputFile)).to.equal(file(__dirname + '/expected/concat-without-maps-1.js'));
  });

  it('addFile & addSpace', function() {
    concat.addFile('inner/first.js');
    concat.addSpace('"a";\n');
    concat.addSpace('"b";\n');
    concat.addSpace('"c";\n');
    concat.addFile('inner/second.js');
    concat.end();
    expect(file(outputFile)).to.equal(file(__dirname + '/expected/concat-without-maps-2.js'));
  });
});

function expectFile(filename) {
  var stripURL = false;

  return {
    in: function(result) {
      var actualContent = fs.readFileSync(path.join(result.directory, filename), 'utf-8');
      fs.writeFileSync(path.join(__dirname, 'actual', filename), actualContent);

      var expectedContent;

      try {
        expectedContent = fs.readFileSync(path.join(__dirname, 'expected', filename), 'utf-8');
        if (stripURL) {
          expectedContent = expectedContent.replace(/\/\/# sourceMappingURL=.*$/, '');
        }

      } catch (err) {
        console.warn('Missing expected file: ' + path.join(__dirname, 'expected', filename));
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
