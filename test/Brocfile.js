var Concat = require('..');
var merge = require('broccoli-merge-trees');

var tree = new Concat('fixture', {
  files: ['inner/*.js'],
  outputFile: 'intermediate.js'
});

tree = merge([tree, 'fixture']);

tree = new Concat(tree, {
  files: ['other/*.js', 'intermediate.js'],
  outputFile: 'final.js'
});


module.exports = tree;
