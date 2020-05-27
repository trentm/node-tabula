/**
 * tabula - Light functionality for formatting and printing a text table
 * from an array or stream of objects.
 */

var assert = require('assert-plus');
var stream = require('stream');
var util = require('util');

var format = util.format;

// ---- constants

var DEFAULT_NUM_BUFFER_ROWS = 100;

// ---- internal support stuff

// Internal debug logging via `console.warn`.
var _selfTrace = function selfTraceNoop() {};
if (process.env.TABULA_SELF_TRACE === '1') {
    _selfTrace = function selfTrace() {
        process.stderr.write('[tabula self-trace] ');
        console.warn.apply(null, arguments);
    }
}

function objCopy(obj, target) {
    assert.optionalObject(obj, 'obj');
    assert.optionalObject(obj, 'target');

    if (target === undefined) {
        target = {};
    }
    if (obj) {
        Object.keys(obj).forEach(function (k) {
            target[k] = obj[k];
        });
    }
    return target;
}

function assertOptionalPositiveInteger(arg, errname) {
    if (arg !== undefined) {
        var num = Number(arg);
        if (!/^[0-9]+$/.test(arg) || isNaN(num) || num === 0) {
            throw new Error(errname + ' is not a positive integer');
        }
    }
}

/*
 * lookup the property "str" (given in dot-notation) in the object "obj".
 * "c" is optional and may be set to any delimiter (defaults to dot: ".")
 */
function dottedLookup(obj, str, c) {
    if (c === undefined) {
        c = '.';
    }
    var o = obj;
    var dots = str.split(c);
    var s = [];
    for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        s.push(dot);
        if (!o.hasOwnProperty(dot)) {
            throw new Error('no property ' + s.join(c) + ' found');
        }
        o = o[dot];
    }
    return o;
}

// ---- exports

/**
 * Sort an array of objects (in-place).
 *
 * @param items {Array} The array of objects to sort.
 * @param fields {Array} Array of ordered fields on which to sort -- higher
 *      priority to fields earlier in the array. Each element of the array
 *      may one of:
 *
 *      - A field name, optionally prefixed with a '-' to indicate reverse
 *        sorting. E.g.: The following would sort first by 'age' in reverse
 *        order, then sub-sort by lastname, then by firstname
 *              ['-age', 'lastname', 'firstname']
 *      - An object providing the field and other options:
 *              {
 *                  field: <the field name (or dotted lookup) on which to sort>,
 *                  reverse: <optional boolean, `true` to reverse the sort>,
 *                  keyFunc: <optional function used to extract a comparison
 *                      value from each array element, e.g.
 *                      `keyFunc: function (val) { return val.toLowerCase(); }`>
 *              }
 *
 * @param options {Object} Optional.
 *      - dottedLookup {Boolean} - If `true`, then a field name can be a
 *        dotted name to lookup sub-fields in elements of `items`.
 */
function sortArrayOfObjects(items, fields, options) {
    assert.optionalObject(options, 'options');
    if (!options) {
        options = {};
    }
    assert.optionalBool(options.dottedLookup, 'options.dottedLookup');

    function cmp(a, b) {
        for (var i = 0; i < fields.length; i++) {
            var fo = fields[i];
            if (typeof fo === 'string') {
                if (fo.length > 0 && fo[0] === '-') {
                    fo = {
                        field: fo.slice(1),
                        reverse: true
                    };
                } else {
                    fo = {
                        field: fo,
                        reverse: false
                    };
                }
            }
            assert.object(fo, 'fo');
            assert.string(fo.field, 'fo.field');
            assert.optionalBool(fo.reverse, 'fo.reverse');
            assert.optionalFunc(fo.keyFunc, 'fo.keyFunc');

            var invert = Boolean(fo.reverse);
            var field = fo.field;
            assert.ok(field.length, 'zero-length sort field: ' + fields);
            var a_field, b_field;
            if (options.dottedLookup) {
                // This could be sped up by bring some processing out of `cmp`.
                try {
                    a_field = dottedLookup(a, field);
                } catch (_ignoreThisErr) {
                    // ignore
                }
                try {
                    b_field = dottedLookup(b, field);
                } catch (_ignoreThisErr) {
                    // ignore
                }
            } else {
                a_field = a[field];
                b_field = b[field];
            }

            var a_cmp;
            var b_cmp;
            if (fo.keyFunc) {
                a_cmp = fo.keyFunc(a_field);
                b_cmp = fo.keyFunc(b_field);
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
                return invert ? 1 : -1;
            } else if (b_cmp === undefined) {
                return invert ? -1 : 1;
            } else if (a_cmp < b_cmp) {
                return invert ? 1 : -1;
            } else if (a_cmp > b_cmp) {
                return invert ? -1 : 1;
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
    if (typeof cell !== 'string') {
        cell = String(cell);
    }

    if (cell.indexOf('\u001b[') === -1) {
        return cell.length;
    } else {
        var stripped = cell.replace(/\u001b\[(.*?)m/g, '');
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
        if (left) {
            ret += chr;
        } else {
            ret = chr + ret;
        }
    }
    return ret;
}

function padStrAnsi(chr, width, left, str) {
    var ret = str;
    var chrLen = chr.length; // assuming no ANSI codes in 'chr'
    var len = displayWidthAnsi(ret);
    while (len < width) {
        if (left) {
            ret += chr;
        } else {
            ret = chr + ret;
        }
        len += chrLen;
    }
    return ret;
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
 *      - `sort` {Array} Optional. Ordered array of fields on which
 *        to sort. See the `fields` argument to `sortArrayOfObjects` for
 *        details. Note that the given `items` array is sorted *in-place*.
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
    var cellSep = '  '; // TODO: could make this configurable

    var cols = [];
    (options.columns || Object.keys(items[0])).forEach(function onCol(
        col,
        idx
    ) {
        if (typeof col === 'string') {
            cols.push({
                lookup: col,
                name: col.toUpperCase(),
                align: 'left'
            });
        } else {
            assert.object(col, 'columns[' + idx + ']');
            assert.string(col.lookup, 'columns[' + idx + '].lookup');
            assert.optionalString(col.name, 'columns[' + idx + '].name');
            assertOptionalPositiveInteger(
                col.width,
                'columns[' + idx + '].width'
            );
            assertOptionalPositiveInteger(
                col.maxWidth,
                'columns[' + idx + '].maxWidth'
            );

            col = objCopy(col);
            if (!col.hasOwnProperty('name')) {
                col.name = col.lookup.toUpperCase();
            }
            if (col.hasOwnProperty('width')) {
                assert.ok(
                    col.width >= col.name.length,
                    'columns[' +
                        idx +
                        '].width, ' +
                        col.width +
                        ', is shorter than the column name, "' +
                        col.name +
                        '"'
                );
            }
            if (col.hasOwnProperty('maxWidth')) {
                assert.ok(
                    col.maxWidth >= col.name.length,
                    'columns[' +
                        idx +
                        '].maxWidth, ' +
                        col.maxWidth +
                        ', is shorter than the column name, "' +
                        col.name +
                        '"'
                );
                if (col.hasOwnProperty('width')) {
                    assert.ok(
                        col.width <= col.maxWidth,
                        'columns[' +
                            idx +
                            '].width, ' +
                            col.width +
                            ', cannot be greater than maxWidth, ' +
                            col.maxWidth
                    );
                }
            }
            if (!col.hasOwnProperty('align')) {
                col.align = 'left';
            }
            assert.ok(
                ['left', 'right'].indexOf(col.align) !== -1,
                'invalid column "align": ' + col.align
            );
            cols.push(col);
        }
    });

    // Validate.
    var validFields = options.validFields;
    var sort = options.sort || [];
    if (validFields) {
        cols.forEach(function onCol(c) {
            if (validFields.indexOf(c.lookup) === -1) {
                throw new TypeError(
                    format('invalid output field: "%s"', c.lookup)
                );
            }
        });
    }
    sort.forEach(function onItem(s) {
        if (s[0] === '-') {
            s = s.slice(1);
        }
        if (validFields && validFields.indexOf(s) === -1) {
            throw new TypeError(format('invalid sort field: "%s"', s));
        }
    });

    // Function to lookup each column field in a row.
    var colFuncs = cols.map(function onCol(col) {
        return function onObj(o) {
            var cell;
            if (options.dottedLookup) {
                try {
                    cell = dottedLookup(o, col.lookup);
                } catch (_ignoreThisErr) {
                    // ignore
                }
            } else {
                cell = o[col.lookup];
            }
            if (
                cell === null ||
                cell === undefined ||
                typeof cell === 'number' ||
                typeof cell === 'string'
            ) {
                return cell;
            } else if (typeof cell === 'function') {
                return util.inspect(cell);
            } else {
                return JSON.stringify(cell);
            }
        };
    });

    var cell;
    var col;
    var header;
    var indecesNeedingWidthCalc = [];
    var i, j, c;
    var item;
    var lines;
    var row;
    var table;
    var widths = [];

    // Determine column widths.
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
            item = items[i];
            for (j = 0; j < indecesNeedingWidthCalc.length; j++) {
                c = indecesNeedingWidthCalc[j];
                col = cols[c];
                cell = colFuncs[c](item);
                if (cell === null || cell === undefined) {
                    continue;
                }
                widths[c] = Math.max(widths[c], cell ? displayWidth(cell) : 0);
            }
        }
        for (j = 0; j < indecesNeedingWidthCalc.length; j++) {
            c = indecesNeedingWidthCalc[j];
            col = cols[c];
            if (col.maxWidth) {
                widths[c] = Math.min(widths[c], col.maxWidth);
            }
        }
    }

    var renderRow = function onRow(row_) {
        var bits = [];
        for (i = 0; i < cols.length; i++) {
            if (cols[i].align === 'right') {
                bits.push(padStr(' ', widths[i], false, row_[i]));
            } else if (i === cols.length - 1) {
                // Last column: don't want trailing whitespace.
                bits.push(row_[i]);
            } else {
                // Align left.
                bits.push(padStr(' ', widths[i], true, row_[i]));
            }
        }
        return bits.join(cellSep);
    };

    if (sort.length) {
        sortArrayOfObjects(items, sort, {dottedLookup: options.dottedLookup});
    }

    lines = [];
    if (!options.skipHeader) {
        header = cols.map(function onCol(col_) {
            return col_.name;
        });
        lines.push(renderRow(header));
    }
    items.forEach(function onItem(item_) {
        row = [];
        for (j = 0; j < colFuncs.length; j++) {
            cell = colFuncs[j](item_);
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

function tabulaFormat(items, options) {
    var bits = [];
    var streamOpts = objCopy(options, {numBufferRows: Infinity});
    var stream = new TabulaStream(streamOpts);

    stream.on('readable', function streamIsReadable() {
        var bit;
        while (null !== (bit = stream.read())) {
            bits.push(bit);
        }
    });

    for (var i = 0; i < items.length; i++) {
        stream.write(items[i]);
    }
    stream.end();

    return bits.join('');
}

function tabulaPrint(items, options) {
    // XXX TODO stream to stdout
    process.stdout.write(tabulaFormat(items, options));
}


/*
 * A transform stream that takes "row" objects and emits rendered text table
 * rows.
 *
 * XXX docs
 */
function TabulaStream(opts) {
    opts = opts || {};
    assert.optionalBool(opts.skipHeader, 'opts.skipHeader');
    assert.optionalArray(opts.sort, 'opts.sort');
    assert.optionalArray(opts.columns, 'opts.columns');
    // XXX still supporting validFields?
    assert.optionalArrayOfString(opts.validFields, 'opts.validFields');
    assert.optionalBool(opts.dottedLookup, 'opts.dottedLookup');
    assert.optionalBool(opts.noAnsi, 'opts.noAnsi');
    assert.optionalNumber(opts.numBufferRows, 'opts.numBufferRows');

    this.numBufferRows = opts.hasOwnProperty('numBufferRows') ? opts.numBufferRows : DEFAULT_NUM_BUFFER_ROWS;

    this._opts = opts;
    this._buffering = true;
    this._rows = [];
    //this._firstRowTime = null;   // XXX TODO
    this._sortFields = (opts.sort && opts.sort.length > 0 ? opts.sort : null);

    // Table formatting data.
    this._cellSep = '  '; // TODO: could make this configurable
    this._padStr = opts.noAnsi ? padStrNoAnsi : padStrAnsi;
    // ... updated by `this._calcColumns()`:
    this._cols = null;
    this._colFuncs = null;
    this._widths = null;

    stream.Transform.call(this, {objectMode: true});
};
util.inherits(TabulaStream, stream.Transform);

TabulaStream.prototype._calcColumns = function _calcColumns() {
    _selfTrace('TabulaStream._calcColumns');

    var cols = this._cols = [];
    var rawColumns = this._opts.columns ||
        (this._rows.length > 0 && Object.keys(this._rows[0])) ||
        [];
    rawColumns.forEach(function onCol(col, idx) {
        if (typeof col === 'string') {
            cols.push({
                lookup: col,
                name: col.toUpperCase(),
                align: 'left'
            });
        } else {
            assert.object(col, 'columns[' + idx + ']');
            assert.string(col.lookup, 'columns[' + idx + '].lookup');
            assert.optionalString(col.name, 'columns[' + idx + '].name');
            assertOptionalPositiveInteger(
                col.width,
                'columns[' + idx + '].width'
            );
            assertOptionalPositiveInteger(
                col.maxWidth,
                'columns[' + idx + '].maxWidth'
            );

            col = objCopy(col);
            if (!col.hasOwnProperty('name')) {
                col.name = col.lookup.toUpperCase();
            }
            if (col.hasOwnProperty('width')) {
                assert.ok(
                    col.width >= col.name.length,
                    'columns[' +
                        idx +
                        '].width, ' +
                        col.width +
                        ', is shorter than the column name, "' +
                        col.name +
                        '"'
                );
            }
            if (col.hasOwnProperty('maxWidth')) {
                assert.ok(
                    col.maxWidth >= col.name.length,
                    'columns[' +
                        idx +
                        '].maxWidth, ' +
                        col.maxWidth +
                        ', is shorter than the column name, "' +
                        col.name +
                        '"'
                );
                if (col.hasOwnProperty('width')) {
                    assert.ok(
                        col.width <= col.maxWidth,
                        'columns[' +
                            idx +
                            '].width, ' +
                            col.width +
                            ', cannot be greater than maxWidth, ' +
                            col.maxWidth
                    );
                }
            }
            if (!col.hasOwnProperty('align')) {
                col.align = 'left';
            }
            assert.ok(
                ['left', 'right'].indexOf(col.align) !== -1,
                'invalid column "align": ' + col.align
            );
            cols.push(col);
        }
    });

    // Function to lookup each column field in a row.
    this._colFuncs = cols.map(function onCol(col) {
        return function onObj(o) {
            var cell;
            try {
                cell = dottedLookup(o, col.lookup);
            } catch (_ignoreThisErr) {
                // ignore
            }
            if (
                cell === null ||
                cell === undefined ||
                typeof cell === 'number' ||
                typeof cell === 'string'
            ) {
                return cell;
            } else if (typeof cell === 'function') {
                return util.inspect(cell);
            } else {
                return JSON.stringify(cell);
            }
        };
    });

    var cell;
    var col;
    var displayWidth = this._opts.noAnsi ? displayWidthNoAnsi : displayWidthAnsi;
    var indecesNeedingWidthCalc = [];
    var i, j, c;
    var lines;
    var row;
    var widths = this._widths = [];

    // Determine column widths.
    for (c = 0; c < cols.length; c++) {
        if (!cols[c].width) {
            widths[c] = displayWidth(cols[c].name);
            indecesNeedingWidthCalc.push(c);
        } else {
            widths[c] = cols[c].width;
        }
    }
    if (indecesNeedingWidthCalc.length > 0) {
        for (i = 0; i < this._rows.length; i++) {
            row = this._rows[i];
            for (j = 0; j < indecesNeedingWidthCalc.length; j++) {
                c = indecesNeedingWidthCalc[j];
                col = cols[c];
                cell = this._colFuncs[c](row);
                if (cell === null || cell === undefined) {
                    continue;
                }
                widths[c] = Math.max(widths[c], cell ? displayWidth(cell) : 0);
            }
        }
        for (j = 0; j < indecesNeedingWidthCalc.length; j++) {
            c = indecesNeedingWidthCalc[j];
            col = cols[c];
            if (col.maxWidth) {
                widths[c] = Math.min(widths[c], col.maxWidth);
            }
        }
    }

    _selfTrace('TabulaStream._calcColumns: cols:', cols);
    _selfTrace('TabulaStream._calcColumns: widths:', widths);
};

TabulaStream.prototype._renderCells = function _renderCells(cells) {
    var cellSep = this._cellSep;
    var cols = this._cols;
    var padStr = this._padStr;
    var widths = this._widths;

    var bits = [];
    for (i = 0; i < cols.length; i++) {
        if (cols[i].align === 'right') {
            bits.push(padStr(' ', widths[i], false, cells[i]));
        } else if (i === cols.length - 1) {
            // Last column: don't want trailing whitespace.
            bits.push(cells[i]);
        } else {
            // Align left.
            bits.push(padStr(' ', widths[i], true, cells[i]));
        }
    }
    return bits.join(cellSep) + '\n';
};

TabulaStream.prototype._pushRow = function _pushRow(row) {
    var self = this;
    var colFuncs = this._colFuncs;

    var cell;
    var rowCells = [];
    for (j = 0; j < colFuncs.length; j++) {
        cell = colFuncs[j](row);
        if (cell === null || cell === undefined) {
            rowCells.push('-');
        } else {
            rowCells.push(String(cell));
        }
    }
    this.push(this._renderCells(rowCells));
};

TabulaStream.prototype._transform = function(row, encoding, done) {
    _selfTrace('TabulaStream._transform: row=%j', row);

    if (this._buffering) {
        this._rows.push(row);
        if (!this._sortFields && this._rows.length >= this.numBufferRows) {
            this._calcAndFlush();
        }
    } else {
        this._pushRow(row);
    }

    done();
};

TabulaStream.prototype._handleHeader = function _handleHeader() {
    if (!this._opts.skipHeader && this._cols.length > 0) {
        var headerCells = this._cols.map(function onCol(col) {
            return col.name;
        });
        this.push(this._renderCells(headerCells));
    }
};

TabulaStream.prototype._calcAndFlush = function _calcAndFlush() {
    _selfTrace('TabulaStream._calcAndFlush');
    if (this._sortFields) {
        sortArrayOfObjects(this._rows, this._sortFields, {dottedLookup: true});
    }
    this._calcColumns();
    this._handleHeader();
    for (var i = 0; i < this._rows.length; i++) {
        this._pushRow(this._rows[i]);
    }
    this._buffering = false;
    delete this._rows;
};

TabulaStream.prototype._flush = function(done) {
    _selfTrace('TabulaStream._flush');
    if (this._buffering) {
        this._calcAndFlush();
    }
    done();
};

// ---- exports

module.exports = tabulaPrint;
module.exports.format = tabulaFormat;
module.exports.sortArrayOfObjects = sortArrayOfObjects;
module.exports.Stream = TabulaStream;
