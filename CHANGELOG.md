
# 2.3.4

* whitelist files we want to publish

# 2.3.3

 * [BUGFIX] ensure headerFiles / inputFiles / footerFiles are included in inputFiles passed to BCW, this prevents stale reads when only a headerFile or footerFile changed but nothing else.

# 2.3.2

 * [REVERT] inputFiles are now sorted lexicographically, this should improve stability of output
  ember-cli wasn't following the instructions and relied on undefined (brittle) behavior.

# 2.3.1

 * remove minimatch (unused dep)

# 2.3.0

 * inputFiles are now sorted lexicographically, this should improve stability of output

# 2.2.1

 * upgrade minimatch to ^3.0.2 (security advisory)
 * code test and repo cleanup
 * upgrade fast-sourcemap-concat
 * upgrade broccoli deps

# 2.2.0

 * update lodash
 * inputFiles parameter default to all files

# 2.1.0

 * dont mutate passed-in config
 * pass sourcemmapConfig to the underlying engine

# 2.0.4

  * ensure concat name is relevant

# 2.0.3

  * move node 5 to allowed failures
  * [BUGFIX] ensure the file handle is always cleaned-up

# 2.0.1

 * Newer fast-sourcemap-concat for upstream bugfixes.
 * Better perf due to reduced use of `stat` calls.

# 2.0.0

  * structure of output file is now as follows:
    1. header
    2. headerFiles
    3. inputFiles
    4. footerFiles
    5. footer

    Previous, 4 and 5 where reversed. This made wrapping in an IIFE needless
    complex

  * headerFiles & footerFiles now explicity throw if provided a glob entry
  * any inputFiles that also exist in headerFiles and footerFiles are now
    dropped from inputFiles


# beginning of time
