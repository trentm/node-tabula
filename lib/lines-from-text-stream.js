/*
 * A stream transforming input text into lines.
 */

var assert = require('assert-plus');
var stream = require('stream');
var util = require('util');

function LinesFromTextStream(opts) {
    opts = opts || {};
    opts.objectMode = true;
    stream.Transform.call(this, opts);
    this._buff = '';
};
util.inherits(LinesFromTextStream, stream.Transform);

LinesFromTextStream.prototype._transform = function(chunk, encoding, next) {
    var data = this._buff + chunk.toString('utf8');
    var lines = data.split(/\r?\n|\r(?!\n)/);
    this._buff = lines.pop();

    for (var i = 0; i < lines.length; i++) {
        this.push(lines[i]);
    }

    next();
};

LinesFromTextStream.prototype._flush = function(next) {
    if (this._buff) {
        this.push(this._buff);
    }
    next();
};

module.exports = LinesFromTextStream;
