/*
 * Test cases that don't fit in other test files.
 */

var test = require('tape');

var tabula = require('../lib/tabula');

// ---- tests

test('exports', function (t) {
    t.ok(tabula, 'tabula');
    t.ok(tabula.format, 'tabula.format');
    t.ok(tabula.Stream, 'tabula.Stream');
    t.ok(tabula.sortArrayOfObjects, 'tabula.sortArrayOfObjects');
    t.end();
});

test('tabula.format', function (t) {
    var table = tabula.format(
        [
            {"foo": 1, "bar": 2}
        ]
    );
    t.equal(table, 'FOO  BAR\n1    2\n');
    t.end();
});

test('tabula.format: function-cell', function (t) {
    var items = [
        {foo: 'bar', func: function aFunc() {}}
    ];
    var table = tabula.format(items);
    t.equal(table, 'FOO  FUNC\nbar  [Function: aFunc]\n');
    t.end();
});

test('tabula.format: ansi-escapes in cell', function (t) {
    var items = [
        {"time":"23:59:15","level":"[37mTRACE[39m","after":"one"},
        {"time":"23:59:16","level":"WARN","after":"two"}
    ];
    var table = tabula.format(items);
    t.equal(table,
        'TIME      LEVEL  AFTER\n' +
        '23:59:15  \x1b[37mTRACE\x1b[39m  one\n' +
        '23:59:16  WARN   two\n');
    t.end();
});

    // XXX

// XXX tabula.Stream empty string
