/* global describe, afterEach, it, expect */

var expect = require('chai').expect;  // jshint ignore:line
var concat = require('..');
var RSVP = require('rsvp');
RSVP.on('error', function(err){throw err;});
var fs = require('fs');
var path = require('path');
var broccoli = require('broccoli');
var merge = require('broccoli-merge-trees');

var fixtures = path.join(__dirname, 'fixtures');
var builder;

function expectFile(filename) {
  return {
      in: function(result) {
        var actualContent = fs.readFileSync(path.join(result.directory, filename), 'utf-8');
        fs.writeFileSync(path.join(__dirname, 'actual', filename), actualContent);

        var expectedContent;
        try {
          expectedContent = fs.readFileSync(path.join(__dirname, 'expected', filename), 'utf-8');
        } catch (err) {
          console.warn("Missing expcted file: " + path.join(__dirname, 'expected', filename));
        }
        expect(actualContent).to.equal(expectedContent, "discrepancy in " + filename);
      }
  };
}

describe('sourcemap-concat', function() {
  it('concatenates files in one dir', function() {
    var tree = concat(fixtures, {
      outputFile: 'all-inner.js',
      inputFiles: ['inner/*.js']
    });
    builder = new broccoli.Builder(tree);
    return builder.build().then(function(result) {
      expectFile('all-inner.js').in(result);
      expectFile('all-inner.map').in(result);
    });
  });

  it('concatenates files across dirs', function() {
    var tree = concat(fixtures, {
      outputFile: 'all.js',
      inputFiles: ['**/*.js']
    });
    builder = new broccoli.Builder(tree);
    return builder.build().then(function(result) {
      expectFile('all.js').in(result);
      expectFile('all.map').in(result);
    });
  });

  it('inserts header', function() {
    var tree = concat(fixtures, {
      outputFile: 'all-with-header.js',
      inputFiles: ['**/*.js'],
      header: "/* This is my header. */"
    });
    builder = new broccoli.Builder(tree);
    return builder.build().then(function(result) {
      expectFile('all-with-header.js').in(result);
      expectFile('all-with-header.map').in(result);
    });
  });

  it('assimilates existing sourcemap', function() {
    var inner = concat(fixtures, {
      outputFile: 'all-inner.js',
      inputFiles: ['inner/*.js'],
      header: "/* This is my header. */"
    });
    var other = concat(fixtures, {
      outputFile: 'all-other.js',
      inputFiles: ['other/*.js'],
      header: "/* Other header. */"
    });
    var final = concat(merge([inner, other]), {
      outputFile: 'staged.js',
      inputFiles: ['all-inner.js', 'all-other.js'],
    });

    builder = new broccoli.Builder(final);
    return builder.build().then(function(result) {
      expectFile('staged.js').in(result);
      expectFile('staged.map').in(result);
    });
  });

  it('appends footer files', function() {
    var tree = concat(fixtures, {
      outputFile: 'inner-with-footers.js',
      inputFiles: ['inner/*.js'],
      footerFiles: ['other/third.js', 'other/fourth.js']
    });
    builder = new broccoli.Builder(tree);
    return builder.build().then(function(result) {
      expectFile('inner-with-footers.js').in(result);
      expectFile('inner-with-footers.map').in(result);
    });
  });

  afterEach(function() {
    if (builder) {
      return builder.cleanup();
    }
  });

});
