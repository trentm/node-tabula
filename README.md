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



# TODO

- Describe the "opinions", features and limitations of this module.

- `tabula` CLI for piping in a JSON array of objects, or stream of objects.

- Merge this with [node-tab](https://github.com/davepacheco/node-tab) if
  reasonable. I have some PR work for it (that I haven't completed) to add some
  conveniences that `tabulate` provides. It is silly to have two table-printing
  libs in play.


# License

MIT. See LICENSE.txt.
