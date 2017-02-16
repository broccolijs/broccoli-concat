const os = require('os');
const path = require('path');
const fixturify = require('fixturify');
const fs = require('fs-extra');

let ID = 1;

/**
 * A class to easily generate large amounts of fixture data.
 */
module.exports = class FixtureGenerator {
  static getId() {
    return `FixtureGenerator-${ID++}`;
  }

  constructor() {
    this.fixture = {};
    this.directory = path.join(os.tmpdir(), FixtureGenerator.getId());
    this._touchCounter = 1;
  }

  /**
   * Writes a fixture according to the given parameters.
   *
   * @public
   * @param {number} fileCount - How many files to create in the fixture.
   * @param {number} depth - How many sub-directories in the fixture. Each
   * directory level will have `FILE_COUNT` files.
   * @param {string} contents - The contents to use for each file. Files will
   * also have a unique identifier appended to the end of their contents.
   */
  write(fileCount, depth = 1, contents = '') {
    this.fixture = this._generateFixture(fileCount, depth, contents);

    fs.mkdirpSync(this.directory);
    fixturify.writeSync(this.directory, this.fixture);
  }

  /**
   * Modifies a previously written fixture file to simulate a file change event.
   *
   * @public
   */
  touch() {
    this.fixture['0.js'] += '.';
    fixturify.writeSync(this.directory, {
      '0.js': this.fixture['0.js']
    });
  }

  _generateFixture(fileCount, depth, contents) {
    let fixture = {};

    for (let i = 0; i < fileCount; i++) {
      let file = `${i}.js`;
      fixture[file] = `${contents}\n// ${i}`;
    }

    if (depth > 1) {
      fixture.nested = this._generateFixture(fileCount, depth - 1, contents);
    }

    return fixture;
  }

  /**
   * Cleans up any written fixture data.
   *
   * @public
   */
  cleanup() {
    fs.removeSync(this.directory);
  }
};
