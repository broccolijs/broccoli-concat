# broccoli-concat

Concatenate trees into a single file.

## Usage

```js
var concatenated = concat(sourceTree, {
  inputFiles: [
    'app/**/*.css'
  ],
  outputFile: '/assets/app.css',
  separator: '\n'  // (optional, defaults to \n)
});
```
