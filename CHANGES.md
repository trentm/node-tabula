# node-tabule changelog

## 1.2.2 (not yet released)

- Return an empty string from `tabulaFormat` if the given array if items is empty.
  Otherwise `tabulaPrint` blows up trying to write `undefined`.


## 1.2.1

- Export `sortArrayOfObjects` function. This is used internally for `opts.sort`
  handling, however it might be useful in CLIs that want to sort in the same
  way as table formatting would even if not using table formatting. E.g. a
  CLI that has a "-j, --json" option to emit JSON.


## 1.2.0

- Add a (mostly for play) `tabula` CLI that can be used for emitting a table
  from a stream of JSON objects (or a single JSON array). E.g.

        $ echo '[{"name":"trent","age":38}, {"name":"ewan","age":4}]' | tabula
        NAME   AGE
        trent  38
        ewan   4

        # column selection
        $ echo '[{"name":"trent","age":38}, {"name":"ewan","age":4}]' | tabula name
        NAME
        trent
        ewan

        # sorting
        $ echo '[{"name":"trent","age":38}, {"name":"ewan","age":4}]' | tabula -s age
        NAME   AGE
        ewan   4
        trent  38

## 1.1.1

- Drop debugging code.


## 1.1.0

- Render complex cell values (objects and arrays) with `JSON.stringify(value)`
  and functions a la `util.inspect()`. E.g.:

        tabula([
            {"foo":"bar","obj":{"one":1}},
            {"foo":"baz","obj":{"two":2}}
        ]);

  results in:

        FOO  OBJ
        bar  {"one":1}
        baz  {"two":2}

- Make `options.columns` optional -- defaults to the keys of the first item.
  This allows one to just naively pass in an array of objects.


## 1.0.0

First release.
