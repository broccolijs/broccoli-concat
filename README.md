# broccoli-concat

Concatenate trees into a single file.

## Usage

```js
var concatenated = concat(sourceTree, {
  inputFiles: [
    'app/**/*.css'
  ],
  outputFile: '/assets/app.css',
  separator: '\n', // (optional, defaults to \n)
  wrapInEval: true // (optional, defaults to false)
});
```

## Options

* separator - what to separate the files with, defaults to '\n'
* wrapInEval - whether to wrap in eval for sourceURL, defaults to false as causes problems with global variables