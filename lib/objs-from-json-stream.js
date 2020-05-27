/*
 * A stream transforming lines of JSON to a stream of objects.
 */

var assert = require('assert-plus');
var stream = require('stream');
var util = require('util');

// ---- constants

var ARRAY_CHECK_RE = /^\[\s*{\s*"/;
var ARRAY_CHECK_EMPTY_RE = /^\[\s*]$/;
var ARRAY_CHECK_MAX_LINES = 3;
var ARRAY_CHECK_MAX_LEN = 1024;

// ---- internal support stuff

// Internal debug logging via `console.warn`.
var _selfTrace = function selfTraceNoop() {};
if (process.env.TABULA_SELF_TRACE === '1') {
    _selfTrace = function selfTrace() {
        process.stderr.write('[tabula self-trace] ');
        console.warn.apply(null, arguments);
    }
}

// ---- ObjsFromJsonStream

/*
 * A transform stream taking lines (strings) of input and generating parsed
 * JSON objects.
 *
 * It primarily assumes that input is newline-separated JSON objects. However,
 * if the input is a single JSON array, it attempts to detect that and
 * support it. If the latter, the whole input string is buffered
 * in memory to parse the JSON array.
 *
 * Events:
 * - `lineParseErr` - emitted for each input line that is not parseable JSON.
 *   The argument is a VError with a "line" info value set to the input line
 *   text. This event allows the caller to decide if this is a fatal error.
 * - `inputIsArray` - emitted when it sniffing of the input has determined
 *   if it is a JSON array, or newline-separated JSON objects. The argument
 *   is `true` if the input is an array, `false` otherwise.
 */
function ObjsFromJsonStream(opts) {
    opts = opts || {};
    opts.objectMode = true;
    stream.Transform.call(this, opts);

    this._inputIsArray = null;  // if the input is a JSON array
    this._lines = null;
};
util.inherits(ObjsFromJsonStream, stream.Transform);


ObjsFromJsonStream.prototype._transform = function(line, encoding, next) {
    _selfTrace('ObjsFromJsonStream._transform: line=%j', line);

    line = line.trim();
    if (!line.length) {
        next();
        return;
    }

    if (this._inputIsArray === null) {
        if (this._lines === null) {
            if (line.length > 0 && line[0] !== '[') {
                this._setInputIsArray(false);
            } else {
                this._lines = [line];
            }
        } else {
            this._lines.push(line);
        }
    }

    if (this._inputIsArray === null) {
        this._checkInputIsArray();
    } else if (this._inputIsArray) {
        this._lines.push(line);
    } else {
        this._parseLine(line);
    }

    next();
};

ObjsFromJsonStream.prototype._setInputIsArray = function _setInputIsArray(val) {
    assert.bool(val, 'val');
    this._inputIsArray = val;
    this.emit('inputIsArray', val);
    _selfTrace('ObjsFromJsonStream._setInputIsArray: %j', val);
};

/*
 * Give a fair attempt to sniff if the input looks like an array of JSON
 * objects, and if so, set `this._inputIsArray = true`. If deciding this is
 * *not* an array, then handle the buffered `this._lines`. Note that this
 * may defer the decision if not enough data has been read yet.
 *
 * @param {Boolean} force - Force making a decision.
 */
ObjsFromJsonStream.prototype._checkInputIsArray = function _checkInputIsArray(force) {
    assert.optionalBool(force, 'force'); // Force making

    var leadingStr = this._lines ? this._lines.join('') : '';
    if (force || (this._lines && this._lines.length >= ARRAY_CHECK_MAX_LINES)
        || leadingStr.length >= ARRAY_CHECK_MAX_LEN) {
        if (!this._lines) {
            this._setInputIsArray(false);
        } else if (force && ARRAY_CHECK_EMPTY_RE.test(leadingStr)) {
            this._setInputIsArray(true);
        } else if (ARRAY_CHECK_RE.test(leadingStr)) {
            this._setInputIsArray(true);
        } else {
            this._setInputIsArray(false);
            for (var i = 0; i < this._lines.length; i++) {
                this._parseLine(this._lines[i]);
            }
            this._lines = null;
        }
    }
};

ObjsFromJsonStream.prototype._parseLine = function _parseLine(line) {
    var row;
    try {
        row = JSON.parse(line);
    } catch (lineParseErr) {
        this.emit('lineParseError', new VError({
            cause: lineParseErr,
            line: line
        }, 'invalid JSON input line %j', line));
    }
    if (row) {
        this.push(row);
    }
};

ObjsFromJsonStream.prototype._flush = function _flush(next) {
    _selfTrace('ObjsFromJsonStream._flush');

    if (this._inputIsArray === null) {
        this._checkInputIsArray(true);
    }

    if (this._inputIsArray) {
        var rows = JSON.parse(this._lines.join(''));
        assert.array(rows, 'rows');
        for (var i = 0; i < rows.length; i++) {
            this.push(rows[i]);
        }
    }
    next();
};


module.exports = ObjsFromJsonStream;
