'use strict';

const fs = require('fs-extra');
const path = require('path');
const expect = require('chai').expect;

function expectSameFiles(actualContent, expectedContent, filename) {
  if (/\.map$/.test(filename)) {
    expect(JSON.parse(actualContent)).to.deep.equal(expectedContent ? JSON.parse(expectedContent) : undefined, 'discrepancy in ' + filename);
  } else {
    expect(actualContent).to.equal(expectedContent, 'discrepancy in ' + filename);
  }
}

module.exports = function expectFile(filename) {
  let stripURL = false;

  return {
    in(result) {
      let actualContent = fs.readFileSync(path.join(result.directory, filename), 'utf-8');
      fs.writeFileSync(path.join(__dirname, '..' , 'actual', filename), actualContent);

      let expectedContent;

      try {
        expectedContent = fs.readFileSync(path.join(__dirname, '..' , 'expected', filename), 'utf-8');
        if (stripURL) {
          expectedContent = expectedContent.replace(/\/\/# sourceMappingURL=.*\n$/, '');
        }

      } catch (err) {
        console.warn('Missing expected file: ' + path.join(__dirname, '..' , 'expected', filename));
      }

      expectSameFiles(actualContent, expectedContent, filename);

      return this;
    },

    notIn(result) {
      expect(fs.existsSync(path.join(result.directory, filename))).to.equal(false, filename + ' should not have been present');
      return this;
    },

    withoutSrcURL() {
      stripURL = true;
      return this;
    }
  };
};
