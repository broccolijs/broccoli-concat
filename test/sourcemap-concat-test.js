'use strict';

const concat = require('..');
const co = require('co');
const fs = require('fs-extra');
const path = require('path');
const broccoli = require('broccoli');
const merge = require('broccoli-merge-trees');
const validateSourcemap = require('sourcemap-validator');
const expectFile = require('./helpers/expect-file');

const chai = require('chai');
const chaiFiles = require('chai-files');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiFiles);
chai.use(chaiAsPromised);

const expect = chai.expect;
const file = chaiFiles.file;

const fixtures = path.join(__dirname, 'fixtures');
const firstFixture = path.join(fixtures, 'first');
const secondFixture = path.join(fixtures, 'second');
const emptyFixture = path.join(fixtures, 'empty');
const sprintfFixture = path.join(__dirname, 'fixtures', 'sprintf');
const walkSync = require('walk-sync');

describe('sourcemap-concat', function() {
  let builder;
  const originalWarn = console.warn;

  afterEach(function() {
    console.warn = originalWarn;
    if (builder) {
      return builder.cleanup();
    }
  });

  it('concatenates sprintf alone', function() {
    const node = concat(sprintfFixture, {
      outputFile: '/sprintf-alone.js',
      inputFiles: ['dist/*.js'],
      sourceMapConfig: { enabled: true }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('sprintf-alone.js').in(result);
      expectFile('sprintf-alone.map').in(result);
      expectValidSourcemap('sprintf-alone.js').in(result);
    });
  });

  it('concatenates sprintf with another lib', function() {
    const node = concat(sprintfFixture, {
      outputFile: '/sprintf-multi.js',
      inputFiles: ['dist/*.js', 'other/*.js'],
      sourceMapConfig: { enabled: true }
    });
    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectFile('sprintf-multi.js').in(result);
      expectFile('sprintf-multi.map').in(result);
      expectValidSourcemap('sprintf-multi.js').in(result);
    });
  });


  it('passes sourcemaps config to the sourcemaps engine', co.wrap(function *() {
    let node = concat(firstFixture, {
      inputFiles: ['**/*.js'],
      outputFile: '/all-with-source-root.js',
      sourceMapConfig: { enabled: true, sourceRoot: "/foo" }
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    let expected = path.join(__dirname, 'expected', 'all-with-source-root.map');
    let actual = path.join(result.directory, 'all-with-source-root.map');

    expect(file(actual)).to.equal(file(expected));
  }));

  it('assimilates existing sourcemap', co.wrap(function *() {
    let inner = concat(firstFixture, {
      outputFile: '/all-inner.js',
      inputFiles: ['inner/*.js'],
      header: "/* This is my header. */"
    });
    let other = concat(firstFixture, {
      outputFile: '/all-other.js',
      inputFiles: ['other/*.js'],
      header: "/* Other header. */"
    });

    let final = concat(merge([inner, other]), {
      outputFile: '/staged.js',
      inputFiles: ['all-inner.js', 'all-other.js'],
    });

    builder = new broccoli.Builder(final);
    let result = yield builder.build();
    expectValidSourcemap('staged.js').in(result);
  }));

  it('should accept inline sourcemaps', co.wrap(function *() {
    let node = concat(fixtures, {
      inputFiles: ['inline-mapped/*.js', 'first/**/*.js'],
      outputFile: '/inline-mapped.js'
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('inline-mapped.js').in(result);
  }));

  it('should correctly concatenate a sourcemapped coffeescript example', co.wrap(function *() {
    let node = concat(fixtures, {
      inputFiles: ['coffee/*.js'],
      outputFile: '/coffee.js'
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('coffee.js').in(result);
  }));

  it('should discover external sources', co.wrap(function *() {
    let node = concat(fixtures, {
      headerFiles: ['first/inner/first.js'],
      footerFiles: ['first/inner/second.js'],
      inputFiles: ['external-content/all-inner.js'],
      outputFile: '/external-content.js'
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('external-content.js').in(result);
  }));

  it('supports custom "mapURL"', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/all-inner-with-custom-map.js',
      inputFiles: ['inner/*.js'],
      sourceMapConfig: {
        mapURL: 'maps/custom.map'
      }
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('all-inner-with-custom-map.js').in(result);
  }));

  it('outputs block comments when "mapCommentType" is "block"', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/all-inner-block-comment.js',
      inputFiles: ['inner/*.js'],
      sourceMapConfig: { mapCommentType: 'block' }
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('all-inner-block-comment.js').in(result);
  }));

  it('should warn but tolerate broken sourcemap URL', co.wrap(function *() {
    let node = concat(fixtures, {
      outputFile: '/with-broken-input-map.js',
      inputFiles: ['broken-sourcemap-url.js']
    });
    let logCount = 0;
    console.warn = function() {
      logCount++;
    };

    builder = new broccoli.Builder(node);
    return builder.build().then(function(result) {
      expectValidSourcemap('with-broken-input-map.js').in(result);
      expect(logCount).to.equal(1);
    });
  }));

  it('corrects sourcemap that is too short', co.wrap(function *() {
    let node = concat(fixtures, {
      inputFiles: ['short/*.js'],
      outputFile: '/short.js'
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('short.js').in(result);
  }));

  it('should correctly concat input sourcemaps with fewer sourcesContent than sources', co.wrap(function *() {
    let node = concat(fixtures, {
      headerFiles: ['first/inner/first.js'],
      footerFiles: ['first/inner/second.js'],
      inputFiles: ['sources/too-few.js'],
      outputFile: '/too-few-sources.js'
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('too-few-sources.js').in(result);
  }));

  it('should correctly concat input sourcemaps with more sourcesContent than sources', co.wrap(function *() {
    let node = concat(fixtures, {
      headerFiles: ['first/inner/first.js'],
      footerFiles: ['first/inner/second.js'],
      inputFiles: ['sources/too-many.js'],
      outputFile: '/too-many-sources.js'
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('too-many-sources.js').in(result);
  }));

  it('correctly maps multiline header and footer', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/all-inner-multiline.js',
      inputFiles: ['inner/*.js'],
      header: '\n\/\/the best\n\n',
      footer: '\n\/\/around\n'
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectFile('all-inner-multiline.js').in(result);
    expectFile('all-inner-multiline.map').in(result);
    expectValidSourcemap('all-inner-multiline.js').in(result);
  }));

  /**
   * Tests below here should appear for both simple-concat and sourcemap-concat.
   */

  it('concatenates files in one dir', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/all-inner.js',
      inputFiles: ['inner/*.js']
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('all-inner.js').in(result);
  }));

  it('concatenates files across dirs', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/all.js',
      inputFiles: ['**/*.js']
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('all.js').in(result);
  }));

  it('concatenates all files across dirs when inputFiles is not specified', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/all.js'
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('all.js').in(result);
  }));

  it('inserts header', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/all-with-header.js',
      inputFiles: ['**/*.js'],
      header: "/* This is my header. */"
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('all-with-header.js').in(result);
  }));

  it('inserts header, headerFiles, footer and footerFiles - and overlaps with inputFiles', co.wrap(function *() {
    let node = concat(firstFixture, {
      header: '/* This is my header.s*/',
      headerFiles: ['inner/first.js', 'inner/second.js'],
      inputFiles: ['**/*.js'],
      footerFiles: ['other/third.js', 'other/fourth.js'],
      footer: '/* This is my footer. */',
      outputFile: '/all-the-things.js'
    });

    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('all-the-things.js').in(result);
  }));

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

  it('inserts header, headerFiles, footer and footerFiles (reversed) - and overlaps with inputFiles', co.wrap(function *() {
    let node = concat(firstFixture, {
      header: '/* This is my header.s*/',
      headerFiles: ['inner/second.js', 'inner/first.js'],
      inputFiles: ['**/*.js'],
      footerFiles: ['other/fourth.js', 'other/third.js'],
      footer: '/* This is my footer. */',
      outputFile: '/all-the-things-reversed.js'
    });

    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('all-the-things-reversed.js').in(result);
  }));

  it('inputFiles are sorted lexicographically (improve stability of build output)', co.wrap(function *() {
    let final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/second.js', 'inner/first.js']
    });

    builder = new broccoli.Builder(final);
    let result = yield builder.build();
    let first = fs.readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
    let second = fs.readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

    let expected = first + '\n' + second + '//# sourceMappingURL=staged.map\n';
    expect(file(result.directory + '/staged.js')).to.equal(expected);
  }));

  it('dedupe uniques in inputFiles', co.wrap(function *() {
    let final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/first.js', 'inner/second.js', 'inner/first.js']
    });

    builder = new broccoli.Builder(final);
    let result = yield builder.build();
    let first = fs.readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
    let second = fs.readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

    let expected = first + '\n' +  second + '//# sourceMappingURL=staged.map\n';
    expect(file(result.directory + '/staged.js')).to.equal(expected, 'output is wrong');
  }));

  it('prepends headerFiles', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/inner-with-headers.js',
      inputFiles: ['inner/*.js'],
      headerFiles: ['other/third.js', 'other/fourth.js']
    });

    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('inner-with-headers.js').in(result);
  }));

  it('prepends headerFiles (order reversed)', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/inner-with-headers-reversed.js',
      inputFiles: ['inner/*.js'],
      headerFiles: ['other/fourth.js', 'other/third.js']
    });

    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('inner-with-headers-reversed.js').in(result);
  }));

  it('appends footer files', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/inner-with-footers.js',
      inputFiles: ['inner/*.js'],
      footerFiles: ['other/third.js', 'other/fourth.js']
    });

    builder = new broccoli.Builder(node);

    let result = yield builder.build();
    expectValidSourcemap('inner-with-footers.js').in(result);
  }));

  it('can build empty files with allowNone disabled', co.wrap(function *() {
    let node = concat(emptyFixture, {
      outputFile: '/empty.js',
      inputFiles: ['*.js']
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectFile('empty.js').in(result);
    expectFile('empty.map').in(result);
  }));

  it('can ignore non-existent input', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/nothing.js',
      inputFiles: ['nothing/*.js'],
      allowNone: true
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectFile('nothing.js').in(result);
    expectFile('nothing.map').in(result);
    // TODO:  https://github.com/ben-ng/sourcemap-validator/issues/4
  }));

  it('does not ignore non-existent input when allowNone is not explicitly set', function() {
    let node = concat(firstFixture, {
      outputFile: '/nothing.js',
      inputFiles: ['nothing/*.js']
    });
    builder = new broccoli.Builder(node);
    return expect(builder.build()).to.be.rejectedWith("Concat: nothing matched [nothing/*.js]");
  });

  it('is not fooled by directories named *.js', co.wrap(function *() {
    let node = concat(secondFixture, {
      outputFile: '/sneaky.js',
      inputFiles: ['**/*.js']
    });
    builder = new broccoli.Builder(node);
    let result = yield builder.build();
    expectValidSourcemap('sneaky.js').in(result);
  }));

  describe('rebuild', function() {
    let inputDir;
    let quickTemp = require('quick-temp');
    beforeEach(function() {
      inputDir = quickTemp.makeOrRemake(this, 'rebuild-tests');
    });

    // write/unlink in inputDir
    function write(file, content) { fs.writeFileSync(inputDir + '/' + file, content); }
    function unlink(file)         { fs.unlinkSync(inputDir + '/' + file); }

    // other helper
    function read(fullPath)       { return fs.readFileSync(fullPath, 'UTF8'); }

    it('add/remove inputFile', co.wrap(function *() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        inputFiles: ['**/*.js'],
        allowNone: true,
      });

      builder = new broccoli.Builder(node);

      let result = yield builder.build();
      expect(fs.readFileSync(result.directory + '/rebuild.js', 'UTF8')).to.eql('//# sourceMappingURL=rebuild.map\n');

      write('omg.js', 'hi');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('hi//# sourceMappingURL=rebuild.map\n');

      unlink('omg.js');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('//# sourceMappingURL=rebuild.map\n');

      yield builder.build();
    }));

    it('inputFile ordering', co.wrap(function *() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        inputFiles: ['**/*.js'],
        allowNone: true,
      });
      builder = new broccoli.Builder(node);

      let result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('a\nb\nz//# sourceMappingURL=rebuild.map\n');

      unlink('a.js');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\nz//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('a\nb\nz//# sourceMappingURL=rebuild.map\n');

      yield builder.build();
    }));

    it('headerFiles', co.wrap(function *() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js', 'a.js'],
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);

      let result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a-updated');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z-updated');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      yield builder.build();
    }));

    it('footerFiles', co.wrap(function *() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        footerFiles: ['b.js', 'a.js'],
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);

      let result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a-updated');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z-updated');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      yield builder.build();
    }));

    it('footerFiles + headerFiles', co.wrap(function *() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js'],
        footerFiles: ['a.js'],
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);

      let result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a-updated');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z-updated');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      yield builder.build();
    }));

    it('footerFiles + inputFiles (glob) + headerFiles', co.wrap(function *() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js'],
        footerFiles: ['a.js'],
        inputFiles: [ '**/*.js'],
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);

      let result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a-updated');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na-updated//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z-updated');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\nz-updated\na//# sourceMappingURL=rebuild.map\n');

      unlink('z.js');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z');
      result = yield builder.build();
      expect(read(result.directory + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map\n');

      yield builder.build();
    }));
  });

  describe('CONCAT_STATS', function() {
    let node, inputNodesOutput;

    let runEmitTest = (dirPath) => {
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

      it('emits files', co.wrap(function* () {
        let dir = fs.statSync(dirPath);

        expect(dir.isDirectory()).to.eql(true);
        expect(walkSync(dirPath)).to.eql([]);

        builder = new broccoli.Builder(node);

        yield builder.build();
        dir = fs.statSync(dirPath);

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
      }));
    };

    describe('with default path', function() {
      runEmitTest(process.cwd() + '/concat-stats-for');
    });

    describe('with CONCAT_STATS_PATH', function() {
      let dir = path.join(require('os').tmpdir(), 'concat_temp_dir');

      beforeEach(function() {
        process.env.CONCAT_STATS_PATH = dir;
      });

      afterEach(function() {
        delete process.env.CONCAT_STATS_PATH;
      });

      runEmitTest(dir);
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

      let actualMin = fs.readFileSync(path.join(result.directory, subdir, jsFilename), 'utf-8');
      let actualMap = fs.readFileSync(path.join(result.directory, subdir, mapFilename), 'utf-8');
      validateSourcemap(actualMin, actualMap, {});
    }
  };
}
