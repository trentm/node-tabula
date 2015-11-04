# node-tabula changelog

## 1.7.1 (not yet released)

(nothing yet)


## 1.7.0

- Support for ANSI escape codes (used for colouring) in table cells.
  Before this change, the table cell widths would get messed up.


## 1.6.1

- [pull #3] Don't error on failed lookup (by Dave Eddy).

## 1.6.0

- Support for right-aligned columns. The default `align` is "left".

        tabula(items, {
            columns: [
                'name',
                {
                    lookup: 'size',
                    align: 'right'
                }
            ]
        });


## 1.5.0

- [pull #2] allow empty data with column headers.
- Add example with custom column names to `--help` output.

## 1.4.2

- Clean `tabula -h` output.


## 1.4.1

- Fix a breakage in v1.4.0 when `validFields` is specified.


## 1.4.0

- Entries in the `columns` array option to `tabula()` and `tabulaFormat()` can
  now be an object with `lookup` and `name` keys. This allows one to override the
  default `name = lookup.toUpperCase()`. E.g.:

        var items = [{'name':'trent','age':38}, {'name':'ewan','age':4}];
        tabula(items, {columns: ['name', {name: 'Age', lookup: 'age'}]});

  to get:

        NAME   Age
        trent  38
        ewan   4

  Support for specifying the `name` was added to the `tabula` CLI:

        $ echo '[{"name":"trent","age":38}, {"name":"ewan","age":4}]' \
            | tabula name age:Age
        NAME   Age
        trent  38
        ewan   4



## 1.3.0

- New `dottedLookup` boolean option to support looking up properties of objects
  in the row data.

        $ echo '[{"name":{"first":"trent","last":"mick"},"age":38},
            {"name":{"first":"ewan"},"age":4}]' \
            | tabula name.first age --dotted-lookup
        NAME.FIRST  AGE
        trent       38
        ewan        4

  Without this option:


        $ echo '[{"name":{"first":"trent","last":"mick"},"age":38},
            {"name":{"first":"ewan"},"age":4}]' \
            | tabula name.first age
        NAME.FIRST  AGE
        -           38
        -           4

  In node.js code this looks like:

        tabula(rows, {dottedLookup: true, ...})


## 1.2.2

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
