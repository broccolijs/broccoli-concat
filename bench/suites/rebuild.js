const concat = require('../../index.js');
const FixtureGenerator = require('../fixtures/generator');
const { Builder } = require('broccoli');

// The large file contents is just a string with >1mb length
const largeFileContents = require('../fixtures/large-file');

/**
 * This suite reuses a build instance for each iteration to test rebuilds.
 */
module.exports = {
  setup() {
    this.fixture = new FixtureGenerator();
    this.fixture.write(
      process.env.FILE_COUNT || 10,
      process.env.DEPTH,
      process.env.LARGE_FILES && largeFileContents
    );

    let node = concat(this.fixture.directory, {
      outputFile: '/result.js'
    });

    this.builder = new Builder(node);
    return this.builder.build();
  },

  beforeScenario() {
    this.fixture.touch();
  },

  scenario() {
    return this.builder.build();
  },

  cleanup() {
    return this.builder.cleanup().then(() => {
      this.fixture.cleanup();
    });
  }
};
