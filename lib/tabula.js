/**
 * tabula - A light function for printing a table of data to stdout.
 */

var p = console.log;
var assert = require('assert-plus');
var sprintf = require('extsprintf').sprintf;
var util = require('util');



// ---- internal support stuff

function sortArrayOfObjects(items, fields) {
    function cmp(a, b) {
        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];
            var invert = false;
            if (field[0] === '-') {
                invert = true;
                field = field.slice(1);
            }
            assert.ok(field.length, 'zero-length sort field: ' + fields);
            var a_cmp = Number(a[field]);
            var b_cmp = Number(b[field]);
            if (isNaN(a_cmp) || isNaN(b_cmp)) {
                a_cmp = a[field];
                b_cmp = b[field];
            }
            // Comparing < or > to `undefined` with any value always
            // returns false.
            if (a_cmp === undefined && b_cmp === undefined) {
                // pass
            } else if (a_cmp === undefined) {
                return (invert ? 1 : -1);
            } else if (b_cmp === undefined) {
                return (invert ? -1 : 1);
            } else if (a_cmp < b_cmp) {
                return (invert ? 1 : -1);
            } else if (a_cmp > b_cmp) {
                return (invert ? -1 : 1);
            }
        }
        return 0;
    }
    items.sort(cmp);
}



// ---- tabula

/**
 * format a table of the given items.
 *
 * @params items {Array} of row objects.
 * @params options {Object}
 *      - `columns` {String} Optional. Ordered array of table columns. The
 *        header row will be the uppercased names.
 *      - `skipHeader` {Boolean} Optional. Default false.
 *      - `sort` {Array} Optional. Ordered array of field names on which
 *        to sort. A field can be prefixed with '-' to reverse sort on that
 *        field. Note that the given `items` array is sorted *in-place*.
 *      - `validFields` {Array} Optional. Array of valid field names for
 *        `columns` and `sort`. If specified this is used for validating those
 *        inputs. This case be useful if `columns` and `sort` are passed in
 *        directly from user input, e.g. from "-o foo,bar" command line args.
 */
function tabulaFormat(items, options) {
    assert.arrayOfObject(items, 'items');
    assert.optionalObject(options, 'options');
    options = options || {};
    assert.optionalArrayOfString(options.columns, 'options.columns');
    assert.optionalBool(options.skipHeader, 'options.skipHeader');
    assert.optionalArrayOfString(options.sort, 'options.sort');
    assert.optionalArrayOfString(options.validFields, 'options.validFields');

    if (items.length === 0) {
        return;
    }
    var columns = options.columns || Object.keys(items[0]);

    // Validate.
    var validFields = options.validFields;
    sort = options.sort || [];
    if (validFields) {
        columns.forEach(function (c) {
            if (validFields.indexOf(c) === -1) {
                throw new TypeError(sprintf('invalid output field: "%s"', c));
            }
        });
    }
    sort.forEach(function (s) {
        if (s[0] === '-') s = s.slice(1);
        if (validFields && validFields.indexOf(s) === -1) {
            throw new TypeError(sprintf('invalid sort field: "%s"', s));
        }
    });

    // Function to lookup each column field in a row.
    var colFuncs = columns.map(function (lookup) {
        return new Function(
            'try {\n' +
            '    var cell = this["' + lookup + '"];\n' +
            '    if (typeof(cell) === "string"\n' +
            '        || typeof(cell) === "number"\n' +
            '        || cell === null\n' +
            '        || cell === undefined) {\n' +
            '        return cell;\n' +
            '    } else if (typeof(cell) === "function") {\n' +
            '        return (cell.name \n' +
            '            ? "[Function: "+cell.name+"]" : "[Function]")\n' +
            '    } else {\n' +
            '        return JSON.stringify(cell);\n' +
            '    }\n' +
            '} catch (e) { }');
    });

    // Determine columns and widths.
    var widths = {};
    columns.forEach(function (c) { widths[c] = c.length; });
    items.forEach(function (item) {
        for (var j = 0; j < columns.length; j++) {
            var col = columns[j];
            var cell = colFuncs[j].call(item);
            if (cell === null || cell === undefined) {
                continue;
            }
            widths[col] = Math.max(
                widths[col], (cell ? String(cell).length : 0));
        }
    });

    var template = '';
    for (var i = 0; i < columns.length; i++) {
        if (i === columns.length - 1) {
            // Last column, don't have trailing whitespace.
            template += '%s';
        } else {
            template += '%-' + String(widths[columns[i]]) + 's  ';
        }
    }

    if (sort.length) {
        sortArrayOfObjects(items, sort);
    }

    var lines = [];
    if (!options.skipHeader) {
        var header = columns.map(function (c) { return c.toUpperCase(); });
        header.unshift(template);
        lines.push(sprintf.apply(null, header));
    }
    items.forEach(function (item) {
        var row = [];
        for (var j = 0; j < colFuncs.length; j++) {
            var cell = colFuncs[j].call(item);
            if (cell === null || cell === undefined) {
                row.push('-');
            } else {
                row.push(String(cell));
            }
        }
        row.unshift(template);
        lines.push(sprintf.apply(null, row));
    });

    return lines.join('\n') + '\n';
}


function tabulaPrint(items, options) {
    process.stdout.write(tabulaFormat(items, options));
}



// ---- exports

module.exports = tabulaPrint;
module.exports.format = tabulaFormat;
module.exports.sortArrayOfObjects = sortArrayOfObjects;
