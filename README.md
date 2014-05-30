A light `tabula(items, options)` function for printing a text table
to stdout.

Why another one? I had one that worked for me and wanted to re-use it. Trawling
through dozens of available ones on npm was a chore I haven't done. I'd welcome
a table-printing node.js bake off.

Follow <a href="https://twitter.com/intent/user?screen_name=trentmick" target="_blank">@trentmick</a>
for updates to node-tabula.


# Install

    npm install tabula


# Usage

```javascript
var tabula = require('tabula');

var data = [{"name":"trent","age":38}, {"name":"ewan","age":4}];
tabula(data);
```

prints the following to stdout

```
NAME   AGE
trent  38
ewan   4
```

# Features

TODO


# TODO

- Allow options.columns be optional (keys from first row). The options is
  totally optional.

- Describe the "opinions" and limitations of this module.

- A few actual tests.

- Merge this with [node-tab](https://github.com/davepacheco/node-tab) if
  reasonable. I have some PR work for it (that I haven't completed) to add some
  conveniences that `tabulate` provides. It is silly to have two table-printing
  libs in play.


# License

MIT. See LICENSE.txt.
