A light `tabula(items, options)` function for printing a text table
to stdout.

Why another one? I had one that worked for me and wanted to re-use it. Trawling
through dozens of available ones on npm was a chore I haven't done. I'd welcome
a table-printing node.js bake off.


# Install

    npm install tabula


# Usage

```javascript
var tabula = require('tabula');

var items = [
    {name: 'trent', age: 38, game: 'hockey'},
    {name: 'ewan', age: 4, game: 'chess'}
];

tabula(items);
/* prints:
NAME   AGE  GAME
trent  38   hockey
ewan   4    chess
*/

tabula(items, {columns: ['name', 'age']});
/* prints:
NAME   AGE
trent  38
ewan   4
*/

tabula(items, {
    columns: ['name', 'age'],
    skipHeader: true
});
/* prints:
trent  38
ewan   4
*/

// Sort by age. Attempts numeric sort on given fields.
// Note: This actually sorts the given `items` array in-place.
tabula(items, {
    columns: ['name', 'age'],
    sort: ['age']
});
/* prints:
NAME   AGE
ewan   4
trent  38
*/
```

TODO: document dottedLookup
TODO: document align=right
TODO: document opts.noAnsi


# `tabula` CLI

There is also a `tabula` CLI that can be used for emitting a table
from a stream of JSON objects (or a single JSON array). E.g.:

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


# Features

This section is an (incomplete) list and demo of some of tabula's features.


## ANSI escape codes

`tabula` (as of version 1.7.0) properly calculates widths for cells using
ANSI escape codes for coloring. E.g. try this sample:

```
var tabula = require('tabula');
function red(s) {
    return '\033[31m' + s + '\033[39m';
}
tabula([
    { name: 'Trent', age: 42, job: 'Engineer' },
    { name: 'Ewan', age: red(8), job: 'Student' },
]);
```


# TODO

- Describe the "opinions", features and limitations of this module.

- `tabula` CLI for piping in a JSON array of objects, or stream of objects.
    - streaming
    - option for skipping non-JSON lines (e.g. for bunyan logs)
    - option for non-JSON input? e.g. space separated ('json -ga foo bar'
      output, output from other table-emitting things, perhaps then 2-space
      or more separated), naive-csv
    - separate tabula-cli module?
    - test cases

- Merge this with [node-tab](https://github.com/davepacheco/node-tab) if
  reasonable. I have some PR work for it (that I haven't completed) to add some
  conveniences that `tabulate` provides. It is silly to have two table-printing
  libs in play.


# License

MIT. See LICENSE.txt.
