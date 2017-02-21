var lint = require('mocha-eslint');

var paths = [
  'lib',
  'test/**.js',
  'test/helpers/**.js',
  'test/strategies/**.js',
  'bench',
  '**.js'
];

lint(paths);
