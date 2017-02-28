var concat = require('..');
var fs = require('fs-extra');
var path = require('path');
var broccoli = require('broccoli');
var merge = require('broccoli-merge-trees');
var validateSourcemap = require('sourcemap-validator');
var expectFile = require('./helpers/expect-file');

var chai = require('chai');
var chaiFiles = require('chai-files');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiFiles);
chai.use(chaiAsPromised);

var expect = chai.expect;
var file = chaiFiles.file;

var fixtures = path.join(__dirname, 'fixtures');
var firstFixture = path.join(fixtures, 'first');
var secondFixture = path.join(fixtures, 'second');
var emptyFixture = path.join(fixtures, 'empty');
var walkSync = require('walk-sync');

describe('sourcemap-concat', function() {
  var builder;

  afterEach(function() {
    if (builder) {
      return builder.cleanup();
    }
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

  it('should accept inline sourcemaps', function() {
    var node = concat(fixtures, {
      inputFiles: ['inline-mapped/*.js', 'first/**/*.js'],
      outputFile: '/inline-mapped.js'
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('inline-mapped.js').in(result);
    });
  });

  it('should correctly concatenate a sourcemapped coffeescript example', function() {
    var node = concat(fixtures, {
      inputFiles: ['coffee/*.js'],
      outputFile: '/coffee.js'
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('coffee.js').in(result);
    });
  });

  it('should discover external sources', function() {
    var node = concat(fixtures, {
      headerFiles: ['first/inner/first.js'],
      footerFiles: ['first/inner/second.js'],
      inputFiles: ['external-content/all-inner.js'],
      outputFile: '/external-content.js'
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('external-content.js').in(result);
    });
  });

  it('supports custom "mapURL"', function() {
    var node = concat(firstFixture, {
      outputFile: '/all-inner-with-custom-map.js',
      inputFiles: ['inner/*.js'],
      sourceMapConfig: {
        mapURL: 'maps/custom.map'
      }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('all-inner-with-custom-map.js').in(result);
    });
  });

  it('outputs block comments when "mapCommentType" is "block"', function() {
    var node = concat(firstFixture, {
      outputFile: '/all-inner-block-comment.js',
      inputFiles: ['inner/*.js'],
      sourceMapConfig: { mapCommentType: 'block' }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('all-inner-block-comment.js').in(result);
    });
  });

  it('should warn but tolerate broken sourcemap URL', function() {
    var node = concat(fixtures, {
      outputFile: '/with-broken-input-map.js',
      inputFiles: ['broken-sourcemap-url.js']
    });
    var originalLog = console.log;
    var logCount = 0;
    console.log = function() {
      logCount++;
    };
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('with-broken-input-map.js').in(result);

      expect(logCount).to.equal(1);

      console.log = originalLog;
    });
  });

  it('corrects sourcemap that is too short', function() {
    var node = concat(fixtures, {
      inputFiles: ['short/*.js'],
      outputFile: '/short.js'
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('short.js').in(result);
    });
  });

  it('should correctly concat input sourcemaps with fewer sourcesContent than sources', function() {
    var node = concat(fixtures, {
      headerFiles: ['first/inner/first.js'],
      footerFiles: ['first/inner/second.js'],
      inputFiles: ['sources/too-few.js'],
      outputFile: '/too-few-sources.js'
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('too-few-sources.js').in(result);
    });
  });

  it('should correctly concat input sourcemaps with more sourcesContent than sources', function() {
    var node = concat(fixtures, {
      headerFiles: ['first/inner/first.js'],
      footerFiles: ['first/inner/second.js'],
      inputFiles: ['sources/too-many.js'],
      outputFile: '/too-many-sources.js'
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('too-many-sources.js').in(result);
    });
  });

  it('correctly maps multiline header and footer', function() {
    var node = concat(firstFixture, {
      outputFile: '/all-inner-multiline.js',
      inputFiles: ['inner/*.js'],
      header: '\n\/\/the best\n\n',
      footer: '\n\/\/around\n'
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all-inner-multiline.js').in(result);
      expectFile('all-inner-multiline.map').in(result);
      expectValidSourcemap('all-inner-multiline.js').in(result);
    });
  });

  /**
   * Tests below here should appear for both simple-concat and sourcemap-concat.
   */

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

  it('inputFiles are sorted lexicographically (improve stability of build output)', function() {
    var final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/second.js', 'inner/first.js']
    });

    builder = new broccoli.Builder(final);
    return builder.build().then(function(result) {
      var first = fs.readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
      var second = fs.readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

      var expected = first + '\n' + second + '//# sourceMappingURL=staged.map\n';
      expect(file(result.directory + '/staged.js')).to.equal(expected);
    });
  });

  it('dedupe uniques in inputFiles', function() {
    var final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/first.js', 'inner/second.js', 'inner/first.js']
    });

    builder = new broccoli.Builder(final);
    return builder.build().then(function(result) {
      var first = fs.readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
      var second = fs.readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

      var expected = first + '\n' +  second + '//# sourceMappingURL=staged.map\n';
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

  it('can build empty files with allowNone disabled', function() {
    var node = concat(emptyFixture, {
      outputFile: '/empty.js',
      inputFiles: ['*.js']
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('empty.js').in(result);
      expectFile('empty.map').in(result);
    });
  });

  it('can ignore non-existent input', function() {
    var node = concat(firstFixture, {
      outputFile: '/nothing.js',
      inputFiles: ['nothing/*.js'],
      allowNone: true
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('nothing.js').in(result);
      expectFile('nothing.map').in(result);
      // TODO:  https://github.com/ben-ng/sourcemap-validator/issues/4
    });
  });

  it('does not ignore non-existent input when allowNone is not explicitly set', function() {
    var node = concat(firstFixture, {
      outputFile: '/nothing.js',
      inputFiles: ['nothing/*.js']
    });
    builder = new broccoli.Builder(node);
    return expect(builder.build()).to.be.rejectedWith("Concat: nothing matched [nothing/*.js]");
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

    it('add/remove/update inputFile with sourcemap', function() {
      var inputNode = concat(inputDir, {
        outputFile: '/omg.js',
        inputFiles: ['**/*.js'],
        allowNone: true,
      });

      var node = concat(inputNode, {
        outputFile: '/rebuild.js',
        inputFiles: ['omg.js'],
        allowNone: true,
      });

      builder = new broccoli.Builder(node);
      write('gmo.js', 'hi');
      return builder.build().then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('hi//# sourceMappingURL=rebuild.map\n');
        expect(read(result.directory + '/rebuild.map')).to.eql('{"version":3,"sources":["gmo.js"],"sourcesContent":["hi"],"names":[],"mappings":"AAAA","file":"rebuild.js"}');
        write('gmo.js', 'hii');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('hii//# sourceMappingURL=rebuild.map\n');
        expect(read(result.directory + '/rebuild.map')).to.eql('{"version":3,"sources":["gmo.js"],"sourcesContent":["hii"],"names":[],"mappings":"AAAA","file":"rebuild.js"}');
        unlink('gmo.js');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('//# sourceMappingURL=rebuild.map\n');
        expect(read(result.directory + '/rebuild.map')).to.eql('{"version":3,"sources":[],"sourcesContent":[],"names":[],"mappings":"","file":"rebuild.js"}');
        return builder.build();
      });
    });

    it('add/remove/update inputFile', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        inputFiles: ['**/*.js'],
        allowNone: true,
      });

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(fs.readFileSync(result.directory + '/rebuild.js', 'UTF8')).to.eql('//# sourceMappingURL=rebuild.map\n');
        write('omg.js', 'hi');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('hi//# sourceMappingURL=rebuild.map\n');
        expect(read(result.directory + '/rebuild.map')).to.eql('{"version":3,"sources":["omg.js"],"sourcesContent":["hi"],"names":[],"mappings":"AAAA","file":"rebuild.js"}');
        write('omg.js', 'hii');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('hii//# sourceMappingURL=rebuild.map\n');
        expect(read(result.directory + '/rebuild.map')).to.eql('{"version":3,"sources":["omg.js"],"sourcesContent":["hii"],"names":[],"mappings":"AAAA","file":"rebuild.js"}');
        unlink('omg.js');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('//# sourceMappingURL=rebuild.map\n');
        expect(read(result.directory + '/rebuild.map')).to.eql('{"version":3,"sources":[],"sourcesContent":[],"names":[],"mappings":"","file":"rebuild.js"}');
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
        expect(read(result.directory + '/rebuild.js')).to.eql('//# sourceMappingURL=rebuild.map\n');

        write('z.js', 'z');
        write('a.js', 'a');
        write('b.js', 'b');

        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('a\nb\nz//# sourceMappingURL=rebuild.map\n');
        unlink('a.js');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz//# sourceMappingURL=rebuild.map\n');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('a\nb\nz//# sourceMappingURL=rebuild.map\n');
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
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map\n');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');
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
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map\n');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');
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
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map\n');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');
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
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map\n');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na-updated//# sourceMappingURL=rebuild.map\n');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map\n');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz-updated\na//# sourceMappingURL=rebuild.map\n');
        unlink('z.js');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');
        write('z.js', 'z');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map\n');
        return builder.build();
      });
    });
  });

  describe('CONCAT_STATS', function() {
    var node, inputNodesOutput;
    var dirPath = process.cwd() + '/concat-stats-for';

    beforeEach(function() {
      fs.removeSync(dirPath);
      inputNodesOutput = [];
      process.env.CONCAT_STATS = true;

      node = concat(firstFixture, {
        outputFile: '/rebuild.js',
        inputFiles: ['inner/first.js', 'inner/second.js']
      });
    });

    afterEach(function() {
      fs.removeSync(dirPath);
      inputNodesOutput.length = 0;
      delete process.env.CONCAT_STATS;
      builder.cleanup();
    });

    it('emits files', function() {
      var dir = fs.statSync(dirPath);

      expect(dir.isDirectory()).to.eql(true);
      expect(walkSync(dirPath)).to.eql([]);

      builder = new broccoli.Builder(node);

      return builder.build().then(function() {
        var dir = fs.statSync(dirPath);

        expect(dir.isDirectory()).to.eql(true);
        expect(walkSync(dirPath)).to.eql([
          node.id + '-rebuild.js.json',
          node.id + '-rebuild.js/',
          node.id + '-rebuild.js/inner/',
          node.id + '-rebuild.js/inner/first.js',
          node.id + '-rebuild.js/inner/second.js',
          node.id + '-rebuild.js/other/',
          node.id + '-rebuild.js/other/fourth.js',
          node.id + '-rebuild.js/other/third.js',
        ]);
      });
    });
  });
});

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

      var actualMin = fs.readFileSync(path.join(result.directory, subdir, jsFilename), 'utf-8');
      var actualMap = fs.readFileSync(path.join(result.directory, subdir, mapFilename), 'utf-8');
      validateSourcemap(actualMin, actualMap, {});
    }
  };
}
