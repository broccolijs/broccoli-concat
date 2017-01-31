var SimpleConcat = require('../../lib/strategies/simple');

var path = require('path');
var chai = require('chai');
var chaiFiles = require('chai-files');
var quickTemp = require('quick-temp');
var fixturify = require('fixturify');

chai.use(chaiFiles);

var expect = chai.expect;
var file = chaiFiles.file;

describe('SimpleConcat', function() {
  var outputFile;
  var inputDir;

  beforeEach(function() {
    inputDir = quickTemp.makeOrRemake(this, 'tmpInputDir');
    outputFile = quickTemp.makeOrRemake(this, 'tmpDestDir') + '/' + 'output.js';

    fixturify.writeSync(inputDir, {
      a: {
        'a.js': '//a/a',
        'b.js': '//a/b'
      },
      'a.js': '//a',
      'b.js': '//b',
      'c.js': '//c'
    });
  });

  afterEach(function() {
    quickTemp.remove(this, 'tmpInputDir');
    quickTemp.remove(this, 'tmpDestDir');
  });

  it('is patch based', function() {
    expect(SimpleConcat.isPatchBased).to.be.ok;
  });

  it('can handle empty scenarios with allowNone', function() {
    var concat = new SimpleConcat({
      allowNone: true
    });
    concat.write(outputFile);
    expect(file(outputFile)).to.equal('');
  });

  it('throws on empty scenarios without allowNone', function() {
    var concat = new SimpleConcat({
      allowNone: false
    });
    expect(function() { concat.write(outputFile) }).to.throw('Concatenation result is empty');
  });

  it('prepends header to the output', function() {
    var concat = new SimpleConcat({
      inputDir: inputDir,
      header: 'should be first'
    });
    concat.addFile('a.js');
    concat.write(outputFile);
    expect(file(outputFile)).to.equal('should be first//a');
  });

  it('appends footer to the output', function() {
    var concat = new SimpleConcat({
      inputDir: inputDir,
      footer: 'should be last'
    });
    concat.addFile('a.js');
    concat.write(outputFile);
    expect(file(outputFile)).to.equal('//ashould be last');
  });

  it('prepends header and appends footer to the output', function() {
    var concat = new SimpleConcat({
      inputDir: inputDir,
      header: 'should be first',
      footer: 'should be last'
    });
    concat.addFile('a.js');
    concat.write(outputFile);
    expect(file(outputFile)).to.equal('should be first//ashould be last');
  });

  describe('addFile', function() {
    it('correctly adds files in alphabetical (stable) order', function() {
      var concat = new SimpleConcat({
        inputDir: inputDir,
      });

      concat.addFile('a.js');
      concat.addFile('a/b.js');
      concat.addFile('a/a.js');
      concat.addFile('c.js');
      concat.addFile('b.js');

      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//a//a/a//a/b//b//c');
    });

    it('correctly orders headerFiles at the front', function() {
      var concat = new SimpleConcat({
        inputDir: inputDir,
        headerFiles: ['b.js', 'a/a.js']
      });

      concat.addFile('a.js');
      concat.addFile('a/b.js');
      concat.addFile('a/a.js');
      concat.addFile('c.js');
      concat.addFile('b.js');

      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//b//a/a//a//a/b//c');
    });

    it('correctly orders footerFiles at the end', function() {
      var concat = new SimpleConcat({
        inputDir: inputDir,
        footerFiles: ['b.js', 'a/a.js']
      });

      concat.addFile('a.js');
      concat.addFile('a/b.js');
      concat.addFile('a/a.js');
      concat.addFile('c.js');
      concat.addFile('b.js');

      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//a//a/b//c//b//a/a');
    });
  });

  describe('updateFile', function() {
    it('correctly updates an existing file', function() {
      var concat = new SimpleConcat({
        inputDir: inputDir
      });

      concat.addFile('a.js');
      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//a');

      fixturify.writeSync(inputDir, {
        'a.js': '//a-modified'
      });

      concat.updateFile('a.js');
      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//a-modified');
    });

    it('correctly updates a header file', function() {
      var concat = new SimpleConcat({
        inputDir: inputDir,
        headerFiles: [ 'b.js', 'a.js' ]
      });

      concat.addFile('a.js');
      concat.addFile('b.js');
      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//b//a');

      fixturify.writeSync(inputDir, {
        'a.js': '//a-modified'
      });

      concat.updateFile('a.js');
      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//b//a-modified');
    });

    it('correctly updates a footer file', function() {
      var concat = new SimpleConcat({
        inputDir: inputDir,
        footerFiles: [ 'a.js', 'b.js' ]
      });

      concat.addFile('a.js');
      concat.addFile('b.js');
      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//a//b');

      fixturify.writeSync(inputDir, {
        'a.js': '//a-modified'
      });

      concat.updateFile('a.js');
      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//a-modified//b');
    });

    it('throws an error when updating a non-existent file', function() {
      var concat = new SimpleConcat({
        inputDir: inputDir
      });

      expect(function() {
        concat.updateFile('a.js')
      }).to.throw('Trying to update a.js but it has not been read before');
    });
  });

  describe('removeFile', function() {
    it('correctly removes an existing file', function() {
      var concat = new SimpleConcat({
        inputDir: inputDir,
      });

      concat.addFile('a.js');
      concat.addFile('a/b.js');
      concat.addFile('a/a.js');
      concat.addFile('c.js');
      concat.addFile('b.js');

      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//a//a/a//a/b//b//c');

      concat.removeFile('a/b.js');
      concat.removeFile('c.js');

      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//a//a/a//b');
    });

    it('correctly removes a header file', function() {
      var concat = new SimpleConcat({
        inputDir: inputDir,
        headerFiles: ['b.js', 'a.js']
      });

      concat.addFile('a.js');
      concat.addFile('a/b.js');
      concat.addFile('a/a.js');
      concat.addFile('c.js');
      concat.addFile('b.js');

      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//b//a//a/a//a/b//c');

      concat.removeFile('b.js');

      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//a//a/a//a/b//c');
    });

    it('correctly removes a footer file', function() {
      var concat = new SimpleConcat({
        inputDir: inputDir,
      });

      concat.addFile('a.js');
      concat.addFile('a/b.js');
      concat.addFile('a/a.js');
      concat.addFile('c.js');
      concat.addFile('b.js');

      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//a//a/a//a/b//b//c');

      concat.removeFile('a/b.js');
      concat.removeFile('c.js');

      concat.write(outputFile);
      expect(file(outputFile)).to.equal('//a//a/a//b');
    });

    it('throws an error when removing a non-existent file', function() {
      var concat = new SimpleConcat({
        inputDir: inputDir
      });

      expect(function() {
        concat.removeFile('a.js')
      }).to.throw('Trying to remove a.js but it did not previously exist');
    });
  });
});
