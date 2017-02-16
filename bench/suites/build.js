const concat = require('../../index.js');
const FixtureGenerator = require('../fixtures/generator');
const { Builder } = require('broccoli');

// The large file contents is just a string with >1mb length
const largeFileContents = require('../fixtures/large-file');

/**
 * This suite creates a brand new build instance for each iteration to test an
 * initial build scenario.
 */
module.exports = {
  setup() {
    this.fixture = new FixtureGenerator();
    this.fixture.write(
      process.env.FILE_COUNT || 10,
      process.env.DEPTH,
      process.env.LARGE_FILES && largeFileContents
    );
  },

  beforeScenario() {
    let node = concat(this.fixture.directory, {
      outputFile: '/result.js',
      sourceMapConfig: {
        enabled: process.env.SOURCE_MAPS !== 'false'
      }
    });

    this.builder = new Builder(node);
  },

  scenario() {
    return this.builder.build();
  },

  afterScenario() {
    return this.builder.cleanup();
  },

  cleanup() {
    this.fixture.cleanup();
  }
};
