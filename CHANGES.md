# node-tabule changelog

## 1.1.1 (not yet released)

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
