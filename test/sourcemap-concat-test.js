/* eslint-disable no-useless-escape */
'use strict';

const concat = require('..');
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
const dir = chaiFiles.dir;

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
    let outputPath = builder.outputPath;
    return builder.build().then(function() {
      expectFile('sprintf-alone.js').in(outputPath);
      expectFile('sprintf-alone.map').in(outputPath);
      expectValidSourcemap('sprintf-alone.js').in(outputPath);
    });
  });

  it('concatenates sprintf with another lib', function() {
    const node = concat(sprintfFixture, {
      outputFile: '/sprintf-multi.js',
      inputFiles: ['dist/*.js', 'other/*.js'],
      sourceMapConfig: { enabled: true }
    });
    builder = new broccoli.Builder(node);
    let outputPath = builder.outputPath;
    return builder.build().then(function() {
      expectFile('sprintf-multi.js').in(outputPath);
      expectFile('sprintf-multi.map').in(outputPath);
      expectValidSourcemap('sprintf-multi.js').in(outputPath);
    });
  });


  it('passes sourcemaps config to the sourcemaps engine', async function() {
    let node = concat(firstFixture, {
      inputFiles: ['**/*.js'],
      outputFile: '/all-with-source-root.js',
      sourceMapConfig: { enabled: true, sourceRoot: "/foo" }
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    let expected = path.join(__dirname, 'expected', 'all-with-source-root.map');
    let actual = path.join(builder.outputPath, 'all-with-source-root.map');

    expect(file(actual)).to.equal(file(expected));
  });

  it('assimilates existing sourcemap', async function() {
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
    await builder.build();
    expectValidSourcemap('staged.js').in(builder.outputPath);
  });

  it('should accept inline sourcemaps', async function() {
    let node = concat(fixtures, {
      inputFiles: ['inline-mapped/*.js', 'first/**/*.js'],
      outputFile: '/inline-mapped.js'
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('inline-mapped.js').in(builder.outputPath);
  });

  it('should correctly concatenate a sourcemapped coffeescript example', async function() {
    let node = concat(fixtures, {
      inputFiles: ['coffee/*.js'],
      outputFile: '/coffee.js'
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('coffee.js').in(builder.outputPath);
  });

  it('should discover external sources', async function() {
    let node = concat(fixtures, {
      headerFiles: ['first/inner/first.js'],
      footerFiles: ['first/inner/second.js'],
      inputFiles: ['external-content/all-inner.js'],
      outputFile: '/external-content.js'
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('external-content.js').in(builder.outputPath);
  });

  it('supports custom "mapURL"', async function() {
    let node = concat(firstFixture, {
      outputFile: '/all-inner-with-custom-map.js',
      inputFiles: ['inner/*.js'],
      sourceMapConfig: {
        mapURL: 'maps/custom.map'
      }
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('all-inner-with-custom-map.js').in(builder.outputPath);
  });

  it('outputs block comments when "mapCommentType" is "block"', async function() {
    let node = concat(firstFixture, {
      outputFile: '/all-inner-block-comment.js',
      inputFiles: ['inner/*.js'],
      sourceMapConfig: { mapCommentType: 'block' }
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('all-inner-block-comment.js').in(builder.outputPath);
  });

  it('should warn but tolerate broken sourcemap URL', async function() {
    let node = concat(fixtures, {
      outputFile: '/with-broken-input-map.js',
      inputFiles: ['broken-sourcemap-url.js']
    });
    let logCount = 0;
    console.warn = function() {
      logCount++;
    };

    builder = new broccoli.Builder(node);
    let outputPath = builder.outputPath;
    return builder.build().then(function() {
      expectValidSourcemap('with-broken-input-map.js').in(outputPath);
      expect(logCount).to.equal(1);
    });
  });

  it('corrects sourcemap that is too short', async function() {
    let node = concat(fixtures, {
      inputFiles: ['short/*.js'],
      outputFile: '/short.js'
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('short.js').in(builder.outputPath);
  });

  it('should correctly concat input sourcemaps with fewer sourcesContent than sources', async function() {
    let node = concat(fixtures, {
      headerFiles: ['first/inner/first.js'],
      footerFiles: ['first/inner/second.js'],
      inputFiles: ['sources/too-few.js'],
      outputFile: '/too-few-sources.js'
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('too-few-sources.js').in(builder.outputPath);
  });

  it('should correctly concat input sourcemaps with more sourcesContent than sources', async function() {
    let node = concat(fixtures, {
      headerFiles: ['first/inner/first.js'],
      footerFiles: ['first/inner/second.js'],
      inputFiles: ['sources/too-many.js'],
      outputFile: '/too-many-sources.js'
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('too-many-sources.js').in(builder.outputPath);
  });

  it('correctly maps multiline header and footer', async function() {
    let node = concat(firstFixture, {
      outputFile: '/all-inner-multiline.js',
      inputFiles: ['inner/*.js'],
      header: '\n\/\/the best\n\n',
      footer: '\n\/\/around\n'
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectFile('all-inner-multiline.js').in(builder.outputPath);
    expectFile('all-inner-multiline.map').in(builder.outputPath);
    expectValidSourcemap('all-inner-multiline.js').in(builder.outputPath);
  });

  /**
   * Tests below here should appear for both simple-concat and sourcemap-concat.
   */

  it('concatenates files in one dir', async function() {
    let node = concat(firstFixture, {
      outputFile: '/all-inner.js',
      inputFiles: ['inner/*.js']
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('all-inner.js').in(builder.outputPath);
  });

  it('concatenates outputFile path has subpath', async function() {
    let node = concat(firstFixture, {
      outputFile: 'sub-path/sub-sub-path/all-inner.js',
      inputFiles: ['inner/*.js'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectFile('all-inner.js').withoutSrcURL().in(path.join(builder.outputPath, 'sub-path/sub-sub-path/'));
  });

  it('concatenates files across dirs', async function() {
    let node = concat(firstFixture, {
      outputFile: '/all.js',
      inputFiles: ['**/*.js']
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('all.js').in(builder.outputPath);
  });

  it('concatenates all files across dirs when inputFiles is not specified', async function() {
    let node = concat(firstFixture, {
      outputFile: '/all.js'
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('all.js').in(builder.outputPath);
  });

  it('inserts header', async function() {
    let node = concat(firstFixture, {
      outputFile: '/all-with-header.js',
      inputFiles: ['**/*.js'],
      header: "/* This is my header. */"
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('all-with-header.js').in(builder.outputPath);
  });

  it('inserts header, headerFiles, footer and footerFiles - and overlaps with inputFiles', async function() {
    let node = concat(firstFixture, {
      header: '/* This is my header.s*/',
      headerFiles: ['inner/first.js', 'inner/second.js'],
      inputFiles: ['**/*.js'],
      footerFiles: ['other/third.js', 'other/fourth.js'],
      footer: '/* This is my footer. */',
      outputFile: '/all-the-things.js'
    });

    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('all-the-things.js').in(builder.outputPath);
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

  it('inserts header, headerFiles, footer and footerFiles (reversed) - and overlaps with inputFiles', async function() {
    let node = concat(firstFixture, {
      header: '/* This is my header.s*/',
      headerFiles: ['inner/second.js', 'inner/first.js'],
      inputFiles: ['**/*.js'],
      footerFiles: ['other/fourth.js', 'other/third.js'],
      footer: '/* This is my footer. */',
      outputFile: '/all-the-things-reversed.js'
    });

    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('all-the-things-reversed.js').in(builder.outputPath);
  });

  it('inputFiles are sorted lexicographically (improve stability of build output)', async function() {
    let final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/second.js', 'inner/first.js']
    });

    builder = new broccoli.Builder(final);
    await builder.build();
    let first = fs.readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
    let second = fs.readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

    let expected = first + '\n' + second + '//# sourceMappingURL=staged.map\n';
    expect(file(builder.outputPath + '/staged.js')).to.equal(expected);
  });

  it('dedupe uniques in inputFiles', async function() {
    let final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/first.js', 'inner/second.js', 'inner/first.js']
    });

    builder = new broccoli.Builder(final);
    await builder.build();
    let first = fs.readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
    let second = fs.readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

    let expected = first + '\n' +  second + '//# sourceMappingURL=staged.map\n';
    expect(file(builder.outputPath + '/staged.js')).to.equal(expected, 'output is wrong');
  });

  it('prepends headerFiles', async function() {
    let node = concat(firstFixture, {
      outputFile: '/inner-with-headers.js',
      inputFiles: ['inner/*.js'],
      headerFiles: ['other/third.js', 'other/fourth.js']
    });

    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('inner-with-headers.js').in(builder.outputPath);
  });

  it('prepends headerFiles (order reversed)', async function() {
    let node = concat(firstFixture, {
      outputFile: '/inner-with-headers-reversed.js',
      inputFiles: ['inner/*.js'],
      headerFiles: ['other/fourth.js', 'other/third.js']
    });

    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('inner-with-headers-reversed.js').in(builder.outputPath);
  });

  it('appends footer files', async function() {
    let node = concat(firstFixture, {
      outputFile: '/inner-with-footers.js',
      inputFiles: ['inner/*.js'],
      footerFiles: ['other/third.js', 'other/fourth.js']
    });

    builder = new broccoli.Builder(node);

    await builder.build();
    expectValidSourcemap('inner-with-footers.js').in(builder.outputPath);
  });

  it('can build empty files with allowNone disabled', async function() {
    let node = concat(emptyFixture, {
      outputFile: '/empty.js',
      inputFiles: ['*.js']
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectFile('empty.js').in(builder.outputPath);
    expectFile('empty.map').in(builder.outputPath);
  });

  it('can ignore non-existent input', async function() {
    let node = concat(firstFixture, {
      outputFile: '/nothing.js',
      inputFiles: ['nothing/*.js'],
      allowNone: true
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectFile('nothing.js').in(builder.outputPath);
    expectFile('nothing.map').in(builder.outputPath);
    // TODO:  https://github.com/ben-ng/sourcemap-validator/issues/4
  });

  it('does not ignore non-existent input when allowNone is not explicitly set', function() {
    let node = concat(firstFixture, {
      outputFile: '/nothing.js',
      inputFiles: ['nothing/*.js']
    });
    builder = new broccoli.Builder(node);
    return expect(builder.build()).to.be.rejectedWith("Concat: nothing matched [nothing/*.js]");
  });

  it('is not fooled by directories named *.js', async function() {
    let node = concat(secondFixture, {
      outputFile: '/sneaky.js',
      inputFiles: ['**/*.js']
    });
    builder = new broccoli.Builder(node);
    await builder.build();
    expectValidSourcemap('sneaky.js').in(builder.outputPath);
  });

  it('does not create concat-stats-for directory', async function() {
    let node = concat(firstFixture, {
      outputFile: '/all-inner.js',
      inputFiles: ['inner/*.js'],
      sourceMapConfig: { enabled: false }
    });

    builder = new broccoli.Builder(node);
    await builder.build();

    expect(dir(process.cwd() + '/concat-stats-for')).to.not.exist;
  });

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

    it('add/remove inputFile', async function() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        inputFiles: ['**/*.js'],
        allowNone: true,
      });

      builder = new broccoli.Builder(node);

      await builder.build();
      expect(fs.readFileSync(builder.outputPath + '/rebuild.js', 'UTF8')).to.eql('//# sourceMappingURL=rebuild.map\n');

      write('omg.js', 'hi');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('hi//# sourceMappingURL=rebuild.map\n');

      unlink('omg.js');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('//# sourceMappingURL=rebuild.map\n');

      await builder.build();
    });

    it('inputFile ordering', async function() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        inputFiles: ['**/*.js'],
        allowNone: true,
      });
      builder = new broccoli.Builder(node);

      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('a\nb\nz//# sourceMappingURL=rebuild.map\n');

      unlink('a.js');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('a\nb\nz//# sourceMappingURL=rebuild.map\n');

      await builder.build();
    });

    it('headerFiles', async function() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js', 'a.js'],
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);

      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a-updated');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z-updated');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      await builder.build();
    });

    it('footerFiles', async function() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        footerFiles: ['b.js', 'a.js'],
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);

      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a-updated');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z-updated');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      await builder.build();
    });

    it('footerFiles + headerFiles', async function() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js'],
        footerFiles: ['a.js'],
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);

      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a-updated');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na-updated//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z-updated');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      await builder.build();
    });

    it('footerFiles + inputFiles (glob) + headerFiles', async function() {
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

      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a-updated');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz\na-updated//# sourceMappingURL=rebuild.map\n');

      write('a.js', 'a');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z-updated');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz-updated\na//# sourceMappingURL=rebuild.map\n');

      unlink('z.js');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na//# sourceMappingURL=rebuild.map\n');

      write('z.js', 'z');
      await builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz\na//# sourceMappingURL=rebuild.map\n');

      await builder.build();
    });
  });

  describe('CONCAT_STATS', function() {
    let node, inputNodesOutput;

    let runEmitTest = (dirPath) => {
      beforeEach(function() {
        fs.removeSync(dirPath);
        inputNodesOutput = [];

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

      it('emits files', async function () {
        builder = new broccoli.Builder(node);
        await builder.build();

        expect(dir(dirPath)).to.not.exist;

        process.env.CONCAT_STATS = true;
        await builder.build();

        expect(dir(dirPath)).to.exist;
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
    in: function (outputPath, subdir) {
      if (!subdir) {
        subdir = '.';
      }

      if (!mapFilename) {
        mapFilename = jsFilename.replace(/\.js$/, '.map');
      }

      expectFile(jsFilename).in(outputPath, subdir);
      expectFile(mapFilename).in(outputPath, subdir);

      let actualMin = fs.readFileSync(path.join(outputPath, subdir, jsFilename), 'utf-8');
      let actualMap = fs.readFileSync(path.join(outputPath, subdir, mapFilename), 'utf-8');
      validateSourcemap(actualMin, actualMap, {});
    }
  };
}
