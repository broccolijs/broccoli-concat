var Concat = require('..');
var merge = require('broccoli-merge-trees');

var tree = new Concat('fixture', {
  inputFiles: ['inner/*.js'],
  outputFile: 'intermediate.js'
});

tree = merge([tree, 'fixture']);

tree = new Concat(tree, {
  inputFiles: ['other/*.js', 'intermediate.js'],
  outputFile: 'final.js'
});


module.exports = tree;
