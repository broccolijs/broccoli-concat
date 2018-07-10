'use strict';

const lint = require('mocha-eslint');

const paths = [
  'lib',
  'test/**.js',
  'test/helpers/**.js',
  'test/strategies/**.js',
  'bench',
  '**.js'
];

lint(paths);
