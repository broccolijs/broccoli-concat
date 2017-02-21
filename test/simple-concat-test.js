var concat = require('..');
var fs = require('fs-extra');
var path = require('path');
var broccoli = require('broccoli');
var expectFile = require('./helpers/expect-file');

var chai = require('chai');
var chaiFiles = require('chai-files');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiFiles);
chai.use(chaiAsPromised);

var expect = chai.expect;
var file = chaiFiles.file;

var firstFixture = path.join(__dirname, 'fixtures', 'first');
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
});
