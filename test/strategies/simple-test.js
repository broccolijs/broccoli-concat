'use strict';

const SimpleConcat = require('../../lib/strategies/simple');
const expect = require('chai').expect;
const fixturify = require('fixturify');

const testDir = 'test/strategies';

function writeFixturifySync(obj) {
  fixturify.writeSync(testDir, obj);
}

beforeEach(function() {
  writeFixturifySync({
    'a.js': '//a',
    a: {
      'a.js': '//a/a',
      'b.js': '//a/b'
    },
    'b.js': '//b',
    'c.js': '//c'
  });
});

afterEach(function() {
  writeFixturifySync({
    'a.js': null,
    'b.js': null,
    'c.js': null,
    a: null
  });
});

describe('SimpleConcat', function() {
  it('is patch based', function() {
    expect(SimpleConcat.isPatchBased).to.be.ok;
  });

  it('can handle no input scenarios', function() {
    let concat = new SimpleConcat({});
    expect(concat.result()).to.equal(undefined);
  });

  it('can handle empty input scenarios', function() {
    let concat = new SimpleConcat({
      baseDir: testDir
    });
    let fileContent = '';
    let obj = {
      'a.js': fileContent
    };
    writeFixturifySync(obj);
    concat.addFile('a.js', fileContent);
    expect(concat.result()).to.equal('');
  });

  it('prepends header to the output', function() {
    let concat = new SimpleConcat({
      baseDir: testDir,
      header: 'should be first'
    });
    concat.addFile('a.js', '//a');
    expect(concat.result()).to.equal('should be first//a');
  });

  it('appends footer to the output', function() {
    let concat = new SimpleConcat({
      baseDir: testDir,
      footer: 'should be last'
    });
    concat.addFile('a.js', '//a');
    expect(concat.result()).to.equal('//ashould be last\n');
  });

  it('prepends header and appends footer to the output', function() {
    let concat = new SimpleConcat({
      baseDir: testDir,
      header: 'should be first',
      footer: 'should be last'
    });
    concat.addFile('a.js', '//a');
    expect(concat.result()).to.equal('should be first//ashould be last\n');
  });

  describe('addFile', function() {
    it('correctly adds files in alphabetical (stable) order', function() {
      let concat = new SimpleConcat({
        baseDir: testDir
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//a//a/a//a/b//b//c');
    });

    it('correctly orders headerFiles at the front', function() {
      let concat = new SimpleConcat({
        baseDir: testDir,
        headerFiles: ['b.js', 'a/a.js']
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//b//a/a//a//a/b//c');
    });

    it('correctly orders footerFiles at the end', function() {
      let concat = new SimpleConcat({
        baseDir: testDir,
        footerFiles: ['b.js', 'a/a.js']
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//a//a/b//c//b//a/a');
    });
  });

  describe('updateFile', function() {
    it('correctly updates an existing file', function() {
      let concat = new SimpleConcat({
        baseDir: testDir
      });

      concat.addFile('a.js', '//a');
      expect(concat.result()).to.equal('//a');

      concat.updateFile('a.js', '//a-modified');
      expect(concat.result()).to.equal('//a-modified');
    });

    it('correctly updates a header file', function() {
      let concat = new SimpleConcat({
        baseDir: testDir,
        headerFiles: ['b.js', 'a.js' ]
      });

      concat.addFile('a.js', '//a');
      concat.addFile('b.js', '//b');
      expect(concat.result()).to.equal('//b//a');

      concat.updateFile('a.js', '//a-modified');
      expect(concat.result()).to.equal('//b//a-modified');
    });

    it('correctly updates a footer file', function() {
      let concat = new SimpleConcat({
        baseDir: testDir,
        footerFiles: ['a.js', 'b.js' ]
      });

      concat.addFile('a.js', '//a');
      concat.addFile('b.js', '//b');
      expect(concat.result()).to.equal('//a//b');

      concat.updateFile('a.js', '//a-modified');
      expect(concat.result()).to.equal('//a-modified//b');
    });

    it('throws an error when updating a non-existent file', function() {
      let concat = new SimpleConcat({});

      expect(() => {
        concat.updateFile('a.js', '');
      }).to.throw('Trying to update a.js but it has not been read before');
    });
  });

  describe('removeFile', function() {
    it('correctly removes an existing file', function() {
      let concat = new SimpleConcat({
        baseDir: testDir
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//a//a/a//a/b//b//c');

      concat.removeFile('a/b.js');
      concat.removeFile('c.js');

      expect(concat.result()).to.equal('//a//a/a//b');
    });

    it('correctly removes a header file', function() {
      let concat = new SimpleConcat({
        baseDir: testDir,
        headerFiles: ['b.js', 'a.js']
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//b//a//a/a//a/b//c');

      concat.removeFile('b.js');

      expect(concat.result()).to.equal('//a//a/a//a/b//c');
    });

    it('correctly removes a footer file', function() {
      let concat = new SimpleConcat({
        baseDir: testDir,
        footerFiles: ['b.js', 'a.js']
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//a/a//a/b//c//b//a');

      concat.removeFile('b.js');

      expect(concat.result()).to.equal('//a/a//a/b//c//a');
    });

    it('throws an error when removing a non-existent file', function() {
      let concat = new SimpleConcat({});

      expect(() => {
        concat.removeFile('a.js');
      }).to.throw('Trying to remove a.js but it did not previously exist');
    });
  });
});
