'use strict';

var concat = require('..');
var fs = require('fs-extra');
var path = require('path');
var broccoli = require('broccoli');
var validateSourcemap = require('sourcemap-validator');
var Minimatch = require('minimatch').Minimatch;
var expectFile = require('./helpers/expect-file');

var chai = require('chai');
chai.config.truncateThreshold = 0;
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

var expect = chai.expect;

var fixtures = path.join(__dirname, 'fixtures');
var firstFixture = path.join(fixtures, 'first');

describe('sourcemap-concat', function() {
  var builder;

  afterEach(function() {
    if (builder) {
      return builder.cleanup();
    }
  });

  describe('inputFiles optional postProcessing', function() {
    var matchComparator = require('../comparators/match');

    describe('inputFiles matcher matchComparator', function() {

      it('scenario 1', function() {
        var globs = [
          new Minimatch('a*'),
          new Minimatch('b*')
        ];

        var files = ['zasdf', 'asdf', 'basdf'].sort(function(a, b) {
          return matchComparator(a,b, globs);
        });

        expect(files).to.eql(['asdf', 'basdf', 'zasdf']);
      });

      it('scenario 2', function() {
        var globs = [
          new Minimatch('b*'),
          new Minimatch('a*')
        ];

        var files = ['zasdf', 'asdf', 'basdf'].sort(function(a, b) {
          return matchComparator(a,b, globs);
        });

        expect(files).to.eql(['basdf', 'asdf', 'zasdf']);
      });
    });

    it('response order first -> second', function() {
      var firstMatcher  = new Minimatch('**/first*');
      var secondMatcher = new Minimatch('**/second*');

      var node = concat(firstFixture, {
        inputFiles: ['inner/**/*.js'],
        outputFile: 'inner-first-second.js',
        inputFilesComparator: function(x, y) {
          return matchComparator(x,y, [firstMatcher, secondMatcher]);
        }
      });

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expectFile('inner-first-second.js').in(result);
        expectFile('inner-first-second.map').in(result);
        expectValidSourcemap('inner-first-second.js').in(result);
      });
    });

    it('response order second -> first', function() {
      var firstMatcher  = new Minimatch('**/first*');
      var secondMatcher = new Minimatch('**/second*');

      var node = concat(firstFixture, {
        inputFiles: ['inner/**/*.js'],
        outputFile: 'inner-second-first.js',
        inputFilesComparator: function(x, y) {
          return matchComparator(x, y, [secondMatcher, firstMatcher]);
        }
      });

      builder = new broccoli.Builder(node);
      return builder.build().then(function(result) {
        expectFile('inner-second-first.js').in(result);
        expectFile('inner-second-first.map').in(result);
        expectValidSourcemap('inner-second-first.js').in(result);
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
