var concat = require('..');
var fs = require('fs-extra');
var path = require('path');
var broccoli = require('broccoli');
var walkSync = require('walk-sync');
var expectFile = require('./helpers/expect-file');

var chai = require('chai');
var chaiFiles = require('chai-files');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiFiles);
chai.use(chaiAsPromised);

var expect = chai.expect;
var file = chaiFiles.file;

var firstFixture = path.join(__dirname, 'fixtures', 'first');
var secondFixture = path.join(__dirname, 'fixtures', 'second');
var emptyFixture = path.join(__dirname, 'fixtures', 'empty');

describe('simple-concat', function() {
  var builder;

  afterEach(function() {
    if (builder) {
      return builder.cleanup();
    }
  });

  it('does not generate sourcemaps', function() {
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

  /**
   * Tests below here should appear for both simple-concat and sourcemap-concat.
   */

  it('concatenates all files in one dir', function() {
    var node = concat(firstFixture, {
      outputFile: '/all-inner.js',
      inputFiles: ['inner/*.js'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all-inner.js').withoutSrcURL().in(result);
    });
  });

  it('concatenates files across dirs', function() {
    var node = concat(firstFixture, {
      outputFile: '/all.js',
      inputFiles: ['**/*.js'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all.js').withoutSrcURL().in(result);
    });
  });

  it('concatenates all files across dirs when inputFiles is not specified', function() {
    var node = concat(firstFixture, {
      outputFile: '/all.js',
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all.js').withoutSrcURL().in(result);
    });
  });

  it('inserts header', function() {
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

  it('inserts header, headeFiles, footer and footerFiles - and overlaps with inputFiles', function() {
    var node = concat(firstFixture, {
      header: '/* This is my header.s*/',
      headerFiles: ['inner/first.js', 'inner/second.js'],
      inputFiles: ['**/*.js'],
      footerFiles: ['other/third.js', 'other/fourth.js'],
      footer: '/* This is my footer. */',
      outputFile: '/all-the-things.js',
      sourceMapConfig: { enabled:  false }
    });

    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all-the-things.js').withoutSrcURL().in(result);
    });
  });

  it('headerFiles, but with a glob', function() {
    expect(function() {
      concat(firstFixture, {
        headerFiles: ['inner/*.js'],
        inputFiles: ['**/*.js'],
        outputFile: '/all-the-things.js',
        sourceMapConfig: { enabled: false }
      });
    }).to.throw('headerFiles cannot contain a glob,  `inner/*.js`');
  });

  it('footerFiles, but with a glob', function() {
    expect(function() {
      concat(firstFixture, {
        footerFiles: ['inner/*.js'],
        inputFiles: ['**/*.js'],
        outputFile: '/all-the-things.js',
        sourceMapConfig: { enabled: false }
      });
    }).to.throw('footerFiles cannot contain a glob,  `inner/*.js`');
  });

  it('inserts header, headeFiles, footer and footerFiles (reveresed) - and overlaps with inputFiles', function() {
    var node = concat(firstFixture, {
      header: '/* This is my header.s*/',
      headerFiles: ['inner/second.js', 'inner/first.js'],
      inputFiles: ['**/*.js'],
      footerFiles: ['other/fourth.js', 'other/third.js'],
      footer: '/* This is my footer. */',
      outputFile: '/all-the-things-reversed.js',
      sourceMapConfig: { enabled: false }
    });

    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('all-the-things-reversed.js').withoutSrcURL().in(result);
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

  it('dedupe uniques in inputFiles', function() {
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

  it('prepends headerFiles', function() {
    var node = concat(firstFixture, {
      outputFile: '/inner-with-headers.js',
      inputFiles: ['inner/*.js'],
      headerFiles: ['other/third.js', 'other/fourth.js'],
      sourceMapConfig: { enabled: false }
    });

    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('inner-with-headers.js').withoutSrcURL().in(result);
    });
  });

  it('prepends headerFiles (order reversed)', function() {
    var node = concat(firstFixture, {
      outputFile: '/inner-with-headers-reversed.js',
      inputFiles: ['inner/*.js'],
      headerFiles: ['other/fourth.js', 'other/third.js'],
      sourceMapConfig: { enabled: false }
    });

    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('inner-with-headers-reversed.js').withoutSrcURL().in(result);
    });
  });

  it('appends footer files', function() {
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

  it('can build empty files with allowNone disabled', function() {
    var node = concat(emptyFixture, {
      outputFile: '/empty-no-sourcemap.js',
      inputFiles: ['*.js'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('empty-no-sourcemap.js').in(result);
    });
  });

  it('can ignore non-existent input', function() {
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

  it('does not ignore non-existent input when allowNone is not explicitly set', function() {
    var node = concat(firstFixture, {
      outputFile: '/nothing.css',
      inputFiles: ['nothing/*.css'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    return expect(builder.build()).to.be.rejectedWith("Concat: nothing matched [nothing/*.css]");
  });

  it('is not fooled by directories named *.js', function() {
    var node = concat(secondFixture, {
      outputFile: '/sneaky.js',
      inputFiles: ['**/*.js'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('sneaky.js').withoutSrcURL().in(result);
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
        sourceMapConfig: { enabled: false }
      });

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(fs.readFileSync(result.directory + '/rebuild.js', 'UTF8')).to.eql('');

        write('omg.js', 'hi');

        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('hi');
        unlink('omg.js');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('');
        return builder.build();
      });
    });

    it('inputFile ordering', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        inputFiles: ['**/*.js'],
        allowNone: true,
        sourceMapConfig: { enabled: false }
      });
      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('');

        write('z.js', 'z');
        write('a.js', 'a');
        write('b.js', 'b');

        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('a\nb\nz');
        unlink('a.js');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('a\nb\nz');
        return builder.build();
      });
    });

    it('headerFiles', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js', 'a.js'],
        sourceMapConfig: { enabled: false }
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na');
        return builder.build();
      });
    });

    it('footerFiles', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        footerFiles: ['b.js', 'a.js'],
        sourceMapConfig: { enabled: false }
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na');
        return builder.build();
      });
    });

    it('footerFiles + headerFiles', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js'],
        footerFiles: ['a.js'],
        sourceMapConfig: { enabled: false }
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na');
        return builder.build();
      });
    });

    it('footerFiles + inputFiles (glob) + headerFiles', function() {
      var node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js'],
        footerFiles: ['a.js'],
        inputFiles: [ '**/*.js'],
        sourceMapConfig: { enabled: false }
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na');
        write('a.js', 'a-updated');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na-updated');
        write('a.js', 'a');
        return builder.build();
      }).then(function(result) {
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na');
        write('z.js', 'z-updated');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz-updated\na');
        unlink('z.js');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\na');
        write('z.js', 'z');
        return builder.build();
      }).then(function(result){
        expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na');
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
        inputFiles: ['inner/first.js', 'inner/second.js'],
        sourceMapConfig: { enabled: false }
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
