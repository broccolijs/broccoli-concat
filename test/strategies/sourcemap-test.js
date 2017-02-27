var SourceMapConcat = require('../../lib/strategies/source-map');
var expect = require('chai').expect;

describe('SourceMapConcat', function() {
  it('is patch based', function() {
    expect(SourceMapConcat.isPatchBased).to.be.ok;
  });

  it('can handle no input scenarios', function() {
    var concat = new SourceMapConcat({
      outputFile: 'output.js',
    });
    expect(concat.result()).to.equal(undefined);
    expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":[],"sourcesContent":[],"names":[],"mappings":"","file":"output.js"}');
  });

  it('can handle empty input scenarios', function() {
    var concat = new SourceMapConcat({
      outputFile: 'output.js',
    });
    concat.addFile('foo.js', '');
    expect(concat.result()).to.equal('//# sourceMappingURL=output.map\n');
    expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":[],"sourcesContent":[],"names":[],"mappings":"","file":"output.js"}');
  });

  it('prepends header to the output', function() {
    var concat = new SourceMapConcat({
      outputFile: 'output.js',
      header: 'should be first'
    });
    concat.addFile('a.js', '//a');
    expect(concat.result()).to.equal('should be first//a//# sourceMappingURL=output.map\n');
    expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js"],"sourcesContent":["//a"],"names":[],"mappings":"AAAA","file":"output.js"}');
  });

  it('appends footer to the output', function() {
    var concat = new SourceMapConcat({
      outputFile: 'output.js',
      footer: 'should be last'
    });
    concat.addFile('a.js', '//a');
    expect(concat.result()).to.equal('//ashould be last\n//# sourceMappingURL=output.map\n');
    expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js"],"sourcesContent":["//a"],"names":[],"mappings":"AAAA","file":"output.js"}');
  });

  it('prepends header and appends footer to the output', function() {
    var concat = new SourceMapConcat({
      outputFile: 'output.js',
      header: 'should be first',
      footer: 'should be last'
    });
    concat.addFile('a.js', '//a');
    expect(concat.result()).to.equal('should be first//ashould be last\n//# sourceMappingURL=output.map\n');
    expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js"],"sourcesContent":["//a"],"names":[],"mappings":"AAAA","file":"output.js"}');
  });

  describe('addFile', function() {
    it('correctly adds files in alphabetical (stable) order', function() {
      var concat = new SourceMapConcat({
        outputFile: 'output.js',
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//a//a/a//a/b//b//c//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js","a/a.js","a/b.js","b.js","c.js"],"sourcesContent":["//a","//a/a","//a/b","//b","//c"],"names":[],"mappings":"AAAAGCAAKCAAKCAAGCAA","file":"output.js"}');
    });

    it('correctly orders headerFiles at the front', function() {
      var concat = new SourceMapConcat({
        outputFile: 'output.js',
        headerFiles: ['b.js', 'a/a.js']
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//b//a/a//a//a/b//c//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["b.js","a/a.js","a.js","a/b.js","c.js"],"sourcesContent":["//b","//a/a","//a","//a/b","//c"],"names":[],"mappings":"AAAAGCAAKCAAGCAAKCAA","file":"output.js"}');
    });

    it('correctly orders footerFiles at the end', function() {
      var concat = new SourceMapConcat({
        outputFile: 'output.js',
        footerFiles: ['b.js', 'a/a.js']
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//a//a/b//c//b//a/a//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js","a/b.js","c.js","b.js","a/a.js"],"sourcesContent":["//a","//a/b","//c","//b","//a/a"],"names":[],"mappings":"AAAAGCAAKCAAGCAAGCAA","file":"output.js"}');
    });
  });

  describe('updateFile', function() {
    it('correctly updates an existing file', function() {
      var concat = new SourceMapConcat({
        outputFile: 'output.js',
      });

      concat.addFile('a.js', '//a');
      expect(concat.result()).to.equal('//a//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js"],"sourcesContent":["//a"],"names":[],"mappings":"AAAA","file":"output.js"}');

      concat.updateFile('a.js', '//a-modified');
      expect(concat.result()).to.equal('//a-modified//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js"],"sourcesContent":["//a-modified"],"names":[],"mappings":"AAAA","file":"output.js"}');
    });

    it('correctly updates a header file', function() {
      var concat = new SourceMapConcat({
        outputFile: 'output.js',
        headerFiles: [ 'b.js', 'a.js' ]
      });

      concat.addFile('a.js', '//a');
      concat.addFile('b.js', '//b');
      expect(concat.result()).to.equal('//b//a//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["b.js","a.js"],"sourcesContent":["//b","//a"],"names":[],"mappings":"AAAAGCAA","file":"output.js"}');

      concat.updateFile('a.js', '//a-modified');
      expect(concat.result()).to.equal('//b//a-modified//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["b.js","a.js"],"sourcesContent":["//b","//a-modified"],"names":[],"mappings":"AAAAGCAA","file":"output.js"}');
    });

    it('correctly updates a footer file', function() {
      var concat = new SourceMapConcat({
        outputFile: 'output.js',
        footerFiles: [ 'a.js', 'b.js' ]
      });

      concat.addFile('a.js', '//a');
      concat.addFile('b.js', '//b');
      expect(concat.result()).to.equal('//a//b//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js","b.js"],"sourcesContent":["//a","//b"],"names":[],"mappings":"AAAAGCAA","file":"output.js"}');

      concat.updateFile('a.js', '//a-modified');
      expect(concat.result()).to.equal('//a-modified//b//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js","b.js"],"sourcesContent":["//a-modified","//b"],"names":[],"mappings":"AAAAYCAA","file":"output.js"}');
    });

    it('throws an error when updating a non-existent file', function() {
      var concat = new SourceMapConcat({
        outputFile: 'output.js',
      });

      expect(function() {
        concat.updateFile('a.js', '');
      }).to.throw('Trying to update a.js but it has not been read before');
    });
  });

  describe('removeFile', function() {
    it('correctly removes an existing file', function() {
      var concat = new SourceMapConcat({
        outputFile: 'output.js',
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//a//a/a//a/b//b//c//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js","a/a.js","a/b.js","b.js","c.js"],"sourcesContent":["//a","//a/a","//a/b","//b","//c"],"names":[],"mappings":"AAAAGCAAKCAAKCAAGCAA","file":"output.js"}');

      concat.removeFile('a/b.js');
      concat.removeFile('c.js');

      expect(concat.result()).to.equal('//a//a/a//b//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js","a/a.js","b.js"],"sourcesContent":["//a","//a/a","//b"],"names":[],"mappings":"AAAAGCAAKCAA","file":"output.js"}');
    });

    it('correctly removes a header file', function() {
      var concat = new SourceMapConcat({
        outputFile: 'output.js',
        headerFiles: ['b.js', 'a.js']
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//b//a//a/a//a/b//c//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["b.js","a.js","a/a.js","a/b.js","c.js"],"sourcesContent":["//b","//a","//a/a","//a/b","//c"],"names":[],"mappings":"AAAAGCAAGCAAKCAAKCAA","file":"output.js"}');

      concat.removeFile('b.js');

      expect(concat.result()).to.equal('//a//a/a//a/b//c//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a.js","a/a.js","a/b.js","c.js"],"sourcesContent":["//a","//a/a","//a/b","//c"],"names":[],"mappings":"AAAAGCAAKCAAKCAA","file":"output.js"}');
    });

    it('correctly removes a footer file', function() {
      var concat = new SourceMapConcat({
        outputFile: 'output.js',
        footerFiles: ['b.js', 'a.js']
      });

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//a/a//a/b//c//b//a//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a/a.js","a/b.js","c.js","b.js","a.js"],"sourcesContent":["//a/a","//a/b","//c","//b","//a"],"names":[],"mappings":"AAAAKCAAKCAAGCAAGCAA","file":"output.js"}');

      concat.removeFile('b.js');

      expect(concat.result()).to.equal('//a/a//a/b//c//a//# sourceMappingURL=output.map\n');
      expect(concat.resultSourceMap()).to.equal('{"version":3,"sources":["a/a.js","a/b.js","c.js","a.js"],"sourcesContent":["//a/a","//a/b","//c","//a"],"names":[],"mappings":"AAAAKCAAKCAAGCAA","file":"output.js"}');
    });

    it('throws an error when removing a non-existent file', function() {
      var concat = new SourceMapConcat({
        outputFile: 'output.js',
      });

      expect(function() {
        concat.removeFile('a.js');
      }).to.throw('Trying to remove a.js but it did not previously exist');
    });
  });
});
