var SimpleConcat = require('../../lib/strategies/simple');
var expect = require('chai').expect;

describe('SimpleConcat', function() {
  it('is patch based', function() {
    expect(SimpleConcat.isPatchBased).to.be.ok;
  });

  it('can handle empty scenarios', function() {
    var concat = new SimpleConcat({});
    expect(concat.result()).to.equal('');
  });

  it('prepends header to the output', function() {
    var concat = new SimpleConcat({
      header: 'should be first'
    });
    concat.addFile('a.js', '//a');
    expect(concat.result()).to.equal('should be first//a');
  });

  it('appends footer to the output', function() {
    var concat = new SimpleConcat({
      footer: 'should be last'
    });
    concat.addFile('a.js', '//a');
    expect(concat.result()).to.equal('//ashould be last');
  });

  it('prepends header and appends footer to the output', function() {
    var concat = new SimpleConcat({
      header: 'should be first',
      footer: 'should be last'
    });
    concat.addFile('a.js', '//a');
    expect(concat.result()).to.equal('should be first//ashould be last');
  });

  describe('addFile', function() {
    it('correctly adds files in alphabetical (stable) order', function() {
      var concat = new SimpleConcat({});

      concat.addFile('a.js', '//a');
      concat.addFile('a/b.js', '//a/b');
      concat.addFile('a/a.js', '//a/a');
      concat.addFile('c.js', '//c');
      concat.addFile('b.js', '//b');

      expect(concat.result()).to.equal('//a//a/a//a/b//b//c');
    });

    it('correctly orders headerFiles at the front', function() {
      var concat = new SimpleConcat({
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
      var concat = new SimpleConcat({
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
      var concat = new SimpleConcat({});

      concat.addFile('a.js', '//a');
      expect(concat.result()).to.equal('//a');

      concat.updateFile('a.js', '//a-modified');
      expect(concat.result()).to.equal('//a-modified');
    });

    it('correctly updates a header file', function() {
      var concat = new SimpleConcat({
        headerFiles: [ 'b.js', 'a.js' ]
      });

      concat.addFile('a.js', '//a');
      concat.addFile('b.js', '//b');
      expect(concat.result()).to.equal('//b//a');

      concat.updateFile('a.js', '//a-modified');
      expect(concat.result()).to.equal('//b//a-modified');
    });

    it('correctly updates a footer file', function() {
      var concat = new SimpleConcat({
        footerFiles: [ 'a.js', 'b.js' ]
      });

      concat.addFile('a.js', '//a');
      concat.addFile('b.js', '//b');
      expect(concat.result()).to.equal('//a//b');

      concat.updateFile('a.js', '//a-modified');
      expect(concat.result()).to.equal('//a-modified//b');
    });

    it('throws an error when updating a non-existent file', function() {
      var concat = new SimpleConcat({});

      expect(function() {
        concat.updateFile('a.js', '')
      }).to.throw('Trying to update a.js but it has not been read before');
    });
  });

  describe('removeFile', function() {
    it('correctly removes an existing file', function() {
      var concat = new SimpleConcat({});

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
      var concat = new SimpleConcat({
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
      var concat = new SimpleConcat({
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
      var concat = new SimpleConcat({});

      expect(function() {
        concat.removeFile('a.js')
      }).to.throw('Trying to remove a.js but it did not previously exist');
    });
  });
});
