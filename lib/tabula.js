/**
 * tabula - A light function for printing a table of data to stdout.
 */

var p = console.log;
var assert = require('assert-plus');
var util = require('util');

var format = util.format;



// ---- internal support stuff

function objCopy(obj) {
    var copy = {};
    Object.keys(obj).forEach(function (k) {
        copy[k] = obj[k];
    });
    return copy;
}

function assertOptionalPositiveInteger(arg, errname) {
    if (arg !== undefined) {
        var num = Number(arg);
        if (!/^[0-9]+$/.test(arg) || isNaN(num) || num === 0) {
            throw new AssertionError(errname + ' is not a positive integer');
        }
    }
}


// ---- exports

/**
 * Sort an array of objects (in-place).
 *
 * @param items {Array} The array of objects to sort.
 * @param fields {Array} Array of field names (lookups) on which to sort --
 *      higher priority to fields earlier in the array. The comparison may
 *      be reversed by prefixing the field with '-'. E.g.:
 *          ['-age', 'lastname', 'firstname']
 * @param options {Object} Optional.
 *      - dottedLookup {Boolean}
 */
function sortArrayOfObjects(items, fields, options) {
    assert.optionalObject(options, 'options');
    if (!options) {
        options = {};
    }
    assert.optionalBool(options.dottedLookup, 'options.dottedLookup');

    function cmp(a, b) {
        for (var i = 0; i < fields.length; i++) {
            var obj = fields[i];
            if (typeof (obj) !== 'object') {
                obj = {
                    field: obj
                };
            }
            assert.object(obj, 'obj');
            assert.string(obj.field, 'obj.field');
            assert.optionalFunc(obj.keyFunc, 'obj.keyFunc');

            var field = obj.field;
            var invert = false;
            if (field[0] === '-') {
                invert = true;
                field = field.slice(1);
            }
            assert.ok(field.length, 'zero-length sort field: ' + fields);
            var a_field, b_field;
            if (options.dottedLookup) {
                // This could be sped up by bring some processing out of `cmp`.
                try {
                    a_field = dottedLookup(a, field);
                } catch (e) {}
                try {
                    b_field = dottedLookup(b, field);
                } catch (e) {}
            } else {
                a_field = a[field];
                b_field = b[field];
            }

            var a_cmp;
            var b_cmp;
            if (obj.keyFunc) {
                a_cmp = obj.keyFunc(a_field);
                b_cmp = obj.keyFunc(b_field);
            } else {
                b_cmp = Number(b_field);
                a_cmp = Number(a_field);
                if (isNaN(a_cmp) || isNaN(b_cmp)) {
                    a_cmp = a_field;
                    b_cmp = b_field;
                }
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


/*
 * Calculate the display width of the given cell.
 *
 * Naively this is just `cell.length`. However: ANSI display codes. We'll
 * try to cope with them here.
 *
 * Note that at least the first impl of this will only cope with
 * "Select Graphic Rendition (SGR)" ANSI codes, and only using the two-byte
 * CSI (Control Sequence Indicator), i.e. those of the form:
 *          '\033[' + someCode + 'm'
 * See the "Sequence elements" section of
 * https://en.wikipedia.org/wiki/ANSI_escape_code for forms that this is
 * currently missing.
 *
 * @param cell {String}
 */
function displayWidthAnsi(cell) {
    if (typeof (cell) !== 'string') {
        cell = String(cell);
    }

    if (cell.indexOf('\033[') === -1) {
        return cell.length;
    } else {
        var stripped = cell.replace(/\033\[(.*?)m/g, '');
        return stripped.length;
    }
}

function displayWidthNoAnsi(cell) {
    return cell.toString().length;
}


// Adapted from node-extsprintf's `doPad()`.
function padStrNoAnsi(chr, width, left, str) {
    var ret = str;
    while (ret.length < width) {
        if (left)
            ret += chr;
        else
            ret = chr + ret;
    }
    return (ret);
}

function padStrAnsi(chr, width, left, str) {
    var ret = str;
    var chrLen = chr.length; // assuming no ANSI codes in 'chr'
    var len = displayWidthAnsi(ret);
    while (len < width) {
        if (left)
            ret += chr;
        else
            ret = chr + ret;
        len += chrLen;
    }
    return (ret);
}



/**
 * format a table of the given items.
 *
 * @params items {Array} of row objects.
 * @params options {Object}
 *      - `columns` {Array} Optional. Ordered array of table columns. Each
 *        column can be a string or an object. If a string, then it is
 *        the key or lookup (see `dottedLookup` option) into each item, and
 *        the printed column name is the string uppercased. If an object,
 *        then the following fields are supported:
 *          - lookup {String} Required.
 *          - name {String} Optional. Defaults to `lookup.toUpperCase()`.
 *          - align {String} Optional. Default 'left'. Supported values:
 *            'left', 'right'.
 *            TODO: support align=center, align=decimal for floats
 *          - width {Number} Optional. A hardcoded width to use for this column.
 *            If not given, the widest of the column name and all the row values
 *            for this column is used. It is an error for `width` to be
 *            less than the length of the column name.
 *          - maxWidth {Number} Optional. An upper limit on the column width
 *            if the width is being automatically determined from the row
 *            values (i.e. if `width` is NOT given). It is an error for `width`
 *            to be less than the length of the column name.
 *      - `skipHeader` {Boolean} Optional. Default false.
 *      - `sort` {Array} Optional. Ordered array of field names on which
 *        to sort. A field can be prefixed with '-' to reverse sort on that
 *        field. Note that the given `items` array is sorted *in-place*.
 *      - `validFields` {Array} Optional. Array of valid field names for
 *        `columns` and `sort`. If specified this is used for validating those
 *        inputs. This can be useful if `columns` and `sort` are passed in
 *        directly from user input, e.g. from "-o foo,bar" command line args.
 *      - `dottedLookup` {Boolean} Optional. If true, then fields (in columns
 *        and sort), will lookup sub-fields in row objects using dot notation.
 *        E.g. "foo.bar" will retrieve from `{"foo": {"bar": 42}, ...}`.
 *        Default is false.
 *      - `noAnsi` {Boolean} Optional. Set to true to have formatting skip
 *        checking for ANSI escape codes. Basically, this is a fast(er) path
 *        if you know your table data includes no ANSI escape codes.
 */
function tabulaFormat(items, options) {
    assert.arrayOfObject(items, 'items');
    assert.optionalObject(options, 'options');
    options = options || {};
    assert.optionalBool(options.skipHeader, 'options.skipHeader');
    assert.optionalArray(options.sort, 'options.sort');
    assert.optionalArrayOfString(options.validFields, 'options.validFields');
    assert.optionalBool(options.dottedLookup, 'options.dottedLookup');
    assert.optionalBool(options.noAnsi, 'options.noAnsi');

    if (!options.columns && items.length === 0) {
        return '';
    }

    var displayWidth = options.noAnsi ? displayWidthNoAnsi : displayWidthAnsi;
    var padStr = options.noAnsi ? padStrNoAnsi : padStrAnsi;
    var cellSep = '  ';  // TODO: could make this configurable

    var cols = [];
    (options.columns || Object.keys(items[0])).forEach(function (col, idx) {
        if (typeof (col) === 'string') {
            cols.push({
                lookup: col,
                name: col.toUpperCase(),
                align: 'left'
            });
        } else {
            assert.object(col, 'columns[' + idx + ']');
            assert.string(col.lookup, 'columns[' + idx + '].lookup');
            assert.optionalString(col.name, 'columns[' + idx + '].name');
            assertOptionalPositiveInteger(col.width,
                'columns[' + idx + '].width');
            assertOptionalPositiveInteger(col.maxWidth,
                'columns[' + idx + '].maxWidth');

            col = objCopy(col);
            if (!col.hasOwnProperty('name')) {
                col.name = col.lookup.toUpperCase();
            }
            if (col.hasOwnProperty('width')) {
                assert.ok(col.width >= col.name.length,
                    'columns[' + idx + '].width, ' + col.width
                    + ', is shorter than the column name, "'+ col.name + '"');
            }
            if (col.hasOwnProperty('maxWidth')) {
                assert.ok(col.maxWidth >= col.name.length,
                    'columns[' + idx + '].maxWidth, ' + col.maxWidth
                    + ', is shorter than the column name, "'+ col.name + '"');
                if (col.hasOwnProperty('width')) {
                    assert.ok(col.width <= col.maxWidth,
                        'columns[' + idx + '].width, ' + col.width
                        + ', cannot be greater than maxWidth, ' + col.maxWidth);
                }
            }
            if (!col.hasOwnProperty('align')) {
                col.align = 'left';
            }
            assert.ok(['left', 'right'].indexOf(col.align) !== -1,
                'invalid column "align": ' + col.align);
            cols.push(col);
        }
    });

    // Validate.
    var validFields = options.validFields;
    sort = options.sort || [];
    if (validFields) {
        cols.forEach(function (c) {
            if (validFields.indexOf(c.lookup) === -1) {
                throw new TypeError(format('invalid output field: "%s"',
                    c.lookup));
            }
        });
    }
    sort.forEach(function (s) {
        if (s[0] === '-') s = s.slice(1);
        if (validFields && validFields.indexOf(s) === -1) {
            throw new TypeError(format('invalid sort field: "%s"', s));
        }
    });

    // Function to lookup each column field in a row.
    var colFuncs = cols.map(function (col) {
        return function (o) {
            var cell;
            if (options.dottedLookup) {
                try {
                    cell = dottedLookup(o, col.lookup);
                } catch (e) {}
            } else {
                cell = o[col.lookup];
            }
            if (cell === null ||
                cell === undefined ||
                typeof (cell) === 'number' ||
                typeof (cell) === 'string') {
                return cell;
            } else if (typeof (cell) === 'function') {
                return util.inspect(cell);
            } else {
                return JSON.stringify(cell);
            }
        };
    });

    // Determine column widths.
    var indecesNeedingWidthCalc = [];
    var widths = [];
    var i, j, c;
    for (c = 0; c < cols.length; c++) {
        if (!cols[c].width) {
            widths[c] = displayWidth(cols[c].name);
            indecesNeedingWidthCalc.push(c);
        } else {
            widths[c] = cols[c].width;
        }
    }
    if (indecesNeedingWidthCalc.length > 0) {
        for (i = 0; i < items.length; i++) {
            var item = items[i];
            for (j = 0; j < indecesNeedingWidthCalc.length; j++) {
                var c = indecesNeedingWidthCalc[j]
                var col = cols[c];
                var cell = colFuncs[c](item);
                if (cell === null || cell === undefined) {
                    continue;
                }
                widths[c] = Math.max(
                    widths[c], (cell ? displayWidth(cell) : 0));
            }
        }
        for (j = 0; j < indecesNeedingWidthCalc.length; j++) {
            var c = indecesNeedingWidthCalc[j]
            var col = cols[c];
            if (col.maxWidth) {
                widths[c] = Math.min(widths[c], col.maxWidth);
            }
        }
    }

    var renderRow = function (row) {
        var bits = [];
        for (var i = 0; i < cols.length; i++) {
            if (cols[i].align === 'right') {
                bits.push(padStr(' ', widths[i], false, row[i]));
            } else if (i === cols.length - 1) {
                // Last column: don't want trailing whitespace.
                bits.push(row[i]);
            } else {
                // Align left.
                bits.push(padStr(' ', widths[i], true, row[i]));
            }
        }
        return bits.join(cellSep);
    }

    if (sort.length) {
        sortArrayOfObjects(items, sort, {dottedLookup: options.dottedLookup});
    }

    var lines = [];
    if (!options.skipHeader) {
        var header = cols.map(function (c) { return c.name; });
        lines.push(renderRow(header));
    }
    items.forEach(function (item) {
        var row = [];
        for (var j = 0; j < colFuncs.length; j++) {
            var cell = colFuncs[j](item);
            if (cell === null || cell === undefined) {
                row.push('-');
            } else {
                row.push(String(cell));
            }
        }
        lines.push(renderRow(row));
    });

    table = lines.join('\n');
    if (table) {
        table += '\n';
    }
    return table;
}


function tabulaPrint(items, options) {
    process.stdout.write(tabulaFormat(items, options));
}


/*
 * lookup the property "str" (given in dot-notation) in the object "obj".
 * "c" is optional and may be set to any delimiter (defaults to dot: ".")
 */
function dottedLookup(obj, str, c) {
    if (c === undefined)
        c = '.';
    var o = obj;
    var dots = str.split(c);
    var s = [];
    for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        s.push(dot);
        if (!o.hasOwnProperty(dot))
            throw new Error('no property ' + s.join(c) + ' found');
        o = o[dot];
    }
    return o;
}


// ---- exports

module.exports = tabulaPrint;
module.exports.format = tabulaFormat;
module.exports.sortArrayOfObjects = sortArrayOfObjects;
