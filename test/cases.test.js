/*
 * tabula test of various input/output cases
 */

var format = require('util').format;
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var stream = require('stream');
var test = require('tape');

var LinesFromTextStream = require('../lib/lines-from-text-stream');
var ObjsFromJsonStream = require('../lib/objs-from-json-stream');
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
        // XXX
        //items: JSON.parse(data[0]),
        text: data[0],
        expect: {
            stdout: (data[1] ? data[1].trim() + '\n' : '')
        },
        options: (data[2] ? eval(';(_=' + data[2] + ');') : undefined)
    };
});
debug('cases:', JSON.stringify(cases, null, 4));


cases.forEach(function (c) {
    var testName = format('case: %s', c.name);
    if (TEST_FILTER && !~testName.indexOf(TEST_FILTER)) {
        return;
    }

    test(testName, function (t) {
        debug('--', testName);
        debug('case: %s', JSON.stringify(c, null, 4));

        // Setup a pipeline of the test case "text" through to `tabula.Stream`.
        var inputStream = new stream.Readable();
        var lineStream = new LinesFromTextStream({encoding: 'utf8'});
        var objStream = new ObjsFromJsonStream();
        var renderStream = new tabula.Stream(c.options);
        objStream.on('inputIsArray', function updateBuffering(inputIsArray) {
            if (inputIsArray) {
                renderStream.numBufferRows = Infinity;
            }
        });
        inputStream
            .pipe(lineStream)
            .pipe(objStream)
            .pipe(renderStream);

        // Gather the rendered table.
        var tableBits = [];
        renderStream.on('readable', function renderReadable() {
            var tableBit;
            while (null !== (tableBit = renderStream.read())) {
                tableBits.push(tableBit);
            }
        });

        // Also gather the parsed items with which to test `tabula.format(...)`.
        var items = [];
        var itemsStream = new ObjsFromJsonStream();
        lineStream.pipe(itemsStream);
        itemsStream.on('readable', function itemsReadable() {
            var item;
            while (null !== (item = itemsStream.read())) {
                items.push(item);
            }
        });

        renderStream.on('end', function () {
            var table = tableBits.join('');
            debug('got: %j', table);
            t.equal(table, c.expect.stdout, 'tabula.Stream matches expected');

            var fTable = tabula.format(items, c.options);
            t.equal(fTable, c.expect.stdout, 'tabula.format matches expected');

            t.end();
        });

        c.text.split(/\n/g).forEach(function (line) {
            inputStream.push(line + '\n');
        });
        inputStream.push(null);
    });

});
