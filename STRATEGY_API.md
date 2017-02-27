# Concat Strategies

`broccoli-concat` performs file concatenation by using an internal representation called a `Strategy`. You can provide a custom `Strategy` to change how concatenation is done and what features are supported.

By default, `broccoli-concat` ships with [`SimpleConcat`](./lib/strategies/simple.js) and [`SourceMapConcat`](./lib/strategies/source-map.js) as its default concatenation strategies.

## Strategy API

To provide a custom `Strategy`, you must provide a class that includes the following methods:

- `addFile(file, content)`: Receives a path to a file and its contents to include in the concatenated output.
- `updateFile(file, content)`: Receives a path to a file and its contents that need to be updated in the previously concatenated output.
- `removeFile(file)`: Receives a path to a file that needs to be removed in the previously concatenated output.
- `result()`: Is expected to return the concatenated result of the above operations as a string. It should also return `undefined` if there was no input to the operation.

The above methods are intended to represent a "patch-based" approach to concatenating files. Additionally, to distinguish against an older approach to concatenating, your `Strategy` should define an `isPatchBased` flag on the class.

You can also optionally define a `resultSourceMap()` function which returns a string to be used as the contents of a sourcemap file.
