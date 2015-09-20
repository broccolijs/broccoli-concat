Broccoli concatenator that generates & propagates sourcemaps
-------------------------------------------------

This filter is designed to be fast & good enough. It can generates
source maps substantially faster than you'll get via
mozilla/source-map, because it's special-cased for straight
line-to-line contenation.

It discovers input sourcemaps in relative URLs, including data URIs.


### Usage

```js
var node = concat(node);
```

#### Advanced Usage

```js
var node = concat(node, {
  outputFile: '/output.js',
  header: ";(function() {",
  headerFiles: ['loader.js'],
  inputFiles: ['**/*']
  footerFiles: ['auto-start.js'],
  footer: "}());",
  allowNone: false | true // defaults to false, and will error if trying to concat but no files are found.
});
```

The structure of `output.js` will be as follows:

```
// - header
// - ordered content of the files in headerFiles
// - un-ordered content of files matched by inputFiles, but not in headerFiles or footerFiles
// - ordered content of the files in footerFiles
// - footer
```
