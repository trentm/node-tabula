/*
 * test some basic things
 */

var format = require('util').format;

// node-tap API
if (require.cache[__dirname + '/tap4nodeunit.js'])
    delete require.cache[__dirname + '/tap4nodeunit.js'];
var test = require('./tap4nodeunit.js').test;

var tabula = require('../lib/tabula');



// ---- tests

test('exports', function (t) {
    t.ok(tabula, 'tabula');
    t.ok(tabula.format, 'tabula.format');
    t.end();
});

test('empty table no columns', function (t) {
    var s = tabula.format([]);
    t.equal(s, '');
    t.end();
});

test('empty table with columns', function (t) {
    var s = tabula.format([], {columns: ['foo', 'bar']});
    t.equal(s, 'FOO  BAR\n');
    t.end();
});
