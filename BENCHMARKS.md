# Benchmarks

broccoli-concat includes some easy to run benchmarks for verifying the performance characteristics of the plugin. By default, you can simply do:

```bash
yarn run bench
# or
npm run bench
```

This will run benchmarks for initial builds and rebuilds. You can optionally provide several environmental variables to customize the benchmarking runs:

* `FILE_COUNT` (number, default: 10) - Specifies how many files to concat together in the fixture.
* `DEPTH` (number, default: 1) - Specifies how many sub-directories of files to place in the fixture. Each directory level will have `FILE_COUNT` files.
* `LARGE_FILES` (boolean, default: false) - Specifies whether to use fixture files with large memory footprints (>1mb).

So, if you want to run many iterations testing the performance of concatenating several large files in a nested structure, you'd run something like:

```bash
FILE_COUNT=3 DEPTH=4 LARGE_FILES=true yarn run bench
```

The resultant output should be something like:

```
Benchmarking with the following parameters
------------------------------------------
FILE_COUNT: 3
DEPTH: 4
LARGE_FILES: true
------------------------------------------
Average time for build over 10 iterations: 213.6ms
Average time for rebuild over 10 iterations: 288ms
```
