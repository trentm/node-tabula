/*
 * tabula test of various input/output cases
 */

var util = require('util'),
    format = util.format;
var fs = require('fs');
var glob = require('glob');
var path = require('path');

// node-tap API
if (require.cache[__dirname + '/tap4nodeunit.js'])
    delete require.cache[__dirname + '/tap4nodeunit.js'];
var test = require('./tap4nodeunit.js').test;

var tabula = require('../lib/tabula');



// ---- globals

var DEBUG = false;
if (DEBUG) {
    var debug = console.warn;
} else {
    var debug = function () {};
}

var TEST_FILTER = process.env.TEST_FILTER;



// ---- tests

var caseFiles = glob.sync(path.resolve(__dirname, 'cases', '*.case'), {});
var cases = caseFiles.map(function (caseFile) {
    var data = fs.readFileSync(caseFile, 'utf8').split(/\n\n/g);
    debug('parse "%s": data:', caseFile, data);
    return {
        name: path.basename(caseFile).slice(0, -5),
        items: JSON.parse(data[0]),
        expect: {
            stdout: data[1].trim() + '\n'
        },
        options: (data[2] ? JSON.parse(data[2]) : undefined)
    };
});
debug('cases:', JSON.stringify(cases, null, 4));


cases.forEach(function (c) {
    var testName = format('case: %s', c.name);
    if (TEST_FILTER && !~testName.indexOf(TEST_FILTER)) {
        return;
    }
    test(testName, function (t) {
        debug('--', testName)
        debug('case: %s', JSON.stringify(c, null, 4))
        var table = tabula.format(c.items, c.options);
        t.equal(table, c.expect.stdout);
        t.end();
    });
});


test('manual case: function-cell', function (t) {
    var items = [
        {foo: 'bar', func: function aFunc() {}}
    ];
    var table = tabula.format(items);
    t.equal(table, 'FOO  FUNC\nbar  [Function: aFunc]\n');
    t.end();
});
