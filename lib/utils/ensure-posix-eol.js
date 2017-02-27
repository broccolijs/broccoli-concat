var EOL = require('os').EOL;

module.exports = function ensurePosixEOL(string) {
  if (EOL !== '\n') {
    string = string.split(EOL).join('\n');
  }

  return string;
};
