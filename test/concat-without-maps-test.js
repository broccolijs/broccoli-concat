/* global describe, afterEach, beforeEach, it, expect */

var concat = require('..');
var fs = require('fs');
var path = require('path');

var chai = require('chai');
var chaiFiles = require('chai-files');

chai.use(chaiFiles);

var expect = chai.expect;
var file = chaiFiles.file;
var firstFixture = path.join(__dirname, 'fixtures', 'first');

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
