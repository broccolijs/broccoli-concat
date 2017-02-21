var lint = require('mocha-eslint');

var paths = [
  'lib',
  'test/**.js',
  'test/fixtures/**.js',
  'test/strategies/**.js',
  'bench',
  '**.js'
];

lint(paths);
