'use strict';

const concat = require('..');
const co = require('co');
const fs = require('fs-extra');
const path = require('path');
const broccoli = require('broccoli');
const walkSync = require('walk-sync');
const expectFile = require('./helpers/expect-file');
const UnwatchedDir = require('broccoli-source').UnwatchedDir;

const chai = require('chai');
const chaiFiles = require('chai-files');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiFiles);
chai.use(chaiAsPromised);

const expect = chai.expect;
const file = chaiFiles.file;
const dir = chaiFiles.dir;

const firstFixture = path.join(__dirname, 'fixtures', 'first');
const secondFixture = path.join(__dirname, 'fixtures', 'second');
const emptyFixture = path.join(__dirname, 'fixtures', 'empty');

describe('simple-concat', function() {
  let builder;

  afterEach(function() {
    if (builder) {
      return builder.cleanup();
    }
  });

  it('does not generate sourcemaps', co.wrap(function *() {
    let node = concat(firstFixture, {
      header: "/* This is my header. */",
      inputFiles: ['**/*.js'],
      outputFile: '/no-sourcemap.js',
      sourceMapConfig: { enabled: false },
    });
    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('no-sourcemap.js').in(builder.outputPath);
    expectFile('no-sourcemap.map').notIn(builder.outputPath);
  }));

  it('concatenates files with content higher than limit', co.wrap(function* () {
    var node = concat(firstFixture, {
      outputFile: '/all-inner.js',
      inputFiles: ['inner/*.js'],
      contentLimit: 10,
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('all-inner.js').withoutSrcURL().in(builder.outputPath);
  }));

  /**
   * Tests below here should appear for both simple-concat and sourcemap-concat.
   */

  it('concatenates all files in one dir', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/all-inner.js',
      inputFiles: ['inner/*.js'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('all-inner.js').withoutSrcURL().in(builder.outputPath);
  }));

  it('concatenates files across dirs', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/all.js',
      inputFiles: ['**/*.js'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('all.js').withoutSrcURL().in(builder.outputPath);
  }));

  it('concatenates all files across dirs when inputFiles is not specified', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/all.js',
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('all.js').withoutSrcURL().in(builder.outputPath);
  }));

  it('inserts header', co.wrap(function *() {
    let node = concat(firstFixture, {
      header: "/* This is my header. */",
      inputFiles: ['**/*.js'],
      outputFile: '/all-with-header.js',
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('all-with-header.js').withoutSrcURL().in(builder.outputPath);
    expectFile('all-with-header.map').notIn(builder.outputPath);
  }));

  it('inserts header, headeFiles, footer and footerFiles - and overlaps with inputFiles', co.wrap(function *() {
    let node = concat(firstFixture, {
      header: '/* This is my header.s*/',
      headerFiles: ['inner/first.js', 'inner/second.js'],
      inputFiles: ['**/*.js'],
      footerFiles: ['other/third.js', 'other/fourth.js'],
      footer: '/* This is my footer. */',
      outputFile: '/all-the-things.js',
      sourceMapConfig: { enabled:  false }
    });

    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('all-the-things.js').withoutSrcURL().in(builder.outputPath);
  }));

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

  it('inserts header, headeFiles, footer and footerFiles (reveresed) - and overlaps with inputFiles', co.wrap(function *() {
    let node = concat(firstFixture, {
      header: '/* This is my header.s*/',
      headerFiles: ['inner/second.js', 'inner/first.js'],
      inputFiles: ['**/*.js'],
      footerFiles: ['other/fourth.js', 'other/third.js'],
      footer: '/* This is my footer. */',
      outputFile: '/all-the-things-reversed.js',
      sourceMapConfig: { enabled: false }
    });

    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('all-the-things-reversed.js').withoutSrcURL().in(builder.outputPath);
  }));

  it('inputFiles are sorted lexicographically (improve stability of build output)', co.wrap(function *() {
    let final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/second.js', 'inner/first.js'],
      sourceMapConfig: {
        enabled: false
      }
    });

    builder = new broccoli.Builder(final);
    yield builder.build();
    let first = fs.readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
    let second = fs.readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

    let expected = first + '\n' +  second;
    expect(file(builder.outputPath + '/staged.js')).to.equal(expected);
  }));

  it('dedupe uniques in inputFiles', co.wrap(function *() {
    let final = concat(firstFixture, {
      outputFile: '/staged.js',
      inputFiles: ['inner/first.js', 'inner/second.js', 'inner/first.js'],
      sourceMapConfig: {
        enabled: false
      }
    });

    builder = new broccoli.Builder(final);

    yield builder.build();
    let first = fs.readFileSync(path.join(firstFixture, 'inner/first.js'), 'UTF-8');
    let second = fs.readFileSync(path.join(firstFixture, 'inner/second.js'), 'UTF-8');

    let expected = first + '\n' +  second;
    expect(file(builder.outputPath + '/staged.js')).to.equal(expected);
  }));

  it('prepends headerFiles', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/inner-with-headers.js',
      inputFiles: ['inner/*.js'],
      headerFiles: ['other/third.js', 'other/fourth.js'],
      sourceMapConfig: { enabled: false }
    });

    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('inner-with-headers.js').withoutSrcURL().in(builder.outputPath);
  }));

  it('prepends headerFiles (order reversed)', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/inner-with-headers-reversed.js',
      inputFiles: ['inner/*.js'],
      headerFiles: ['other/fourth.js', 'other/third.js'],
      sourceMapConfig: { enabled: false }
    });

    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('inner-with-headers-reversed.js').withoutSrcURL().in(builder.outputPath);
  }));

  it('appends footer files', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/inner-with-footers.js',
      inputFiles: ['inner/*.js'],
      footerFiles: ['other/third.js', 'other/fourth.js'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('inner-with-footers.js').withoutSrcURL().in(builder.outputPath);
    expectFile('inner-with-footers.map').notIn(builder.outputPath);
  }));

  it('can build empty files with allowNone disabled', co.wrap(function *() {
    let node = concat(emptyFixture, {
      outputFile: '/empty-no-sourcemap.js',
      inputFiles: ['*.js'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('empty-no-sourcemap.js').in(builder.outputPath);
  }));

  it('can ignore non-existent input', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/nothing.css',
      inputFiles: ['nothing/*.css'],
      sourceMapConfig: { enabled: false },
      allowNone: true
    });
    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('nothing.css').in(builder.outputPath);
  }));

  it('does not ignore non-existent input when allowNone is not explicitly set', function() {
    let node = concat(firstFixture, {
      outputFile: '/nothing.css', inputFiles: ['nothing/*.css'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    return expect(builder.build()).to.be.rejectedWith("Concat: nothing matched [nothing/*.css]");
  });

  it('is not fooled by directories named *.js', co.wrap(function *() {
    let node = concat(secondFixture, {
      outputFile: '/sneaky.js',
      inputFiles: ['**/*.js'],
      sourceMapConfig: { enabled: false }
    });
    builder = new broccoli.Builder(node);
    yield builder.build();
    expectFile('sneaky.js').withoutSrcURL().in(builder.outputPath);
  }));

  it('does not create concat-stats-for directory', co.wrap(function *() {
    let node = concat(firstFixture, {
      outputFile: '/all-inner.js',
      inputFiles: ['inner/*.js'],
      sourceMapConfig: { enabled: false }
    });

    builder = new broccoli.Builder(node);
    yield builder.build();

    expect(dir(process.cwd() + '/concat-stats-for')).to.not.exist;
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
        sourceMapConfig: { enabled: false }
      });

      builder = new broccoli.Builder(node);

      yield builder.build();
      expect(fs.readFileSync(builder.outputPath + '/rebuild.js', 'UTF8')).to.eql('');

      write('omg.js', 'hi');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('hi');

      unlink('omg.js');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('');

      yield builder.build();
    }));

    it('inputFile ordering', co.wrap(function *() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        inputFiles: ['**/*.js'],
        allowNone: true,
        sourceMapConfig: { enabled: false }
      });
      builder = new broccoli.Builder(node);

      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('');

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('a\nb\nz');

      unlink('a.js');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz');

      write('a.js', 'a');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('a\nb\nz');

      yield builder.build();
    }));

    it('headerFiles', co.wrap(function *() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js', 'a.js'],
        sourceMapConfig: { enabled: false }
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);

      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na');

      write('a.js', 'a-updated');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na-updated');

      write('a.js', 'a');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na');

      write('z.js', 'z-updated');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na');

      yield builder.build();
    }));

    it('footerFiles', co.wrap(function *() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        footerFiles: ['b.js', 'a.js'],
        sourceMapConfig: { enabled: false }
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);

      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na');

      write('a.js', 'a-updated');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na-updated');

      write('a.js', 'a');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na');

      write('z.js', 'z-updated');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na');

      yield builder.build();
    }));

    it('footerFiles + headerFiles', co.wrap(function *() {
      let node = concat(inputDir, {
        outputFile: '/rebuild.js',
        headerFiles: ['b.js'],
        footerFiles: ['a.js'],
        sourceMapConfig: { enabled: false }
      });

      write('z.js', 'z');
      write('a.js', 'a');
      write('b.js', 'b');

      builder = new broccoli.Builder(node);

      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na');

      write('a.js', 'a-updated');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na-updated');

      write('a.js', 'a');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na');

      write('z.js', 'z-updated');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na');

      yield builder.build();
    }));

    it('footerFiles + inputFiles (glob) + headerFiles', co.wrap(function *() {
      let node = concat(inputDir, {
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

      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz\na');

      write('a.js', 'a-updated');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz\na-updated');

      write('a.js', 'a');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz\na');

      write('z.js', 'z-updated');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz-updated\na');

      unlink('z.js');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\na');

      write('z.js', 'z');
      yield builder.build();
      expect(read(builder.outputPath + '/rebuild.js')).to.eql('b\nz\na');

      yield builder.build();
    }));
  });

  describe('CONCAT_STATS', function() {
    let node, inputNodesOutput;

    let runEmitTest = (dirPath) => {
      beforeEach(function() {
        fs.removeSync(dirPath);
        inputNodesOutput = [];

        node = concat(new UnwatchedDir(firstFixture), {
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

      it('emits files', co.wrap(function* () {

        builder = new broccoli.Builder(node);
        yield builder.build();

        expect(dir(dirPath)).to.not.exist;

        process.env.CONCAT_STATS = true;
        yield builder.build();

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

  describe('fileSizes', function() {
    beforeEach(function() {
      process.env.CONCAT_STATS = true;
      fs.removeSync(__dirname + '/../concat-stats-for');
    });

    afterEach(function() {
      delete process.env.CONCAT_STATS;
      fs.removeSync(__dirname + '/../concat-stats-for');
    });

    it('can ignore non-existent input', co.wrap(function *() {
      let node = concat(firstFixture, {
        headerFiles: ['/nothing.js'],
        outputFile: '/nothing.css',
        inputFiles: ['nothing/*.css'],
        allowNone: true
      });
      builder = new broccoli.Builder(node);
      let result = yield builder.build();
      expect(fs.existsSync(__dirname + '/../concat-stats-for')).to.eql(true);
      expectFile('nothing.css').in(result);
    }));
  });
});
