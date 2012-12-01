var childProcess = require('child_process'),
    Stream = require('stream').Stream,
    util = require('util');

function JpegTran(jpegTranArgs) {
    Stream.call(this);

    this.writable = this.readable = true;

    this.jpegTranProcess = childProcess.spawn('jpegtran', jpegTranArgs);

    this.hasEnded = false;
    this.seenDataOnStdout = false;

    this.jpegTranProcess.on('exit', function (exitCode) {
        if (exitCode > 0 && !this.hasEnded) {
            return this.emit('error', new Error('The jpegtran process exited with a non-zero exit code: ' + exitCode));
            this.hasEnded = true;
        }
    }.bind(this));

    this.jpegTranProcess.stdout.on('data', function (chunk) {
        this.seenDataOnStdout = true;
        this.emit('data', chunk);
    }.bind(this)).on('end', function () {
        if (!this.hasEnded) {
            if (this.seenDataOnStdout) {
                this.emit('end');
            } else {
                this.emit('error', new Error('JpegTran: The stdout stream ended without emitting any data'));
            }
            this.hasEnded = true;
        }
    }.bind(this));
}

util.inherits(JpegTran, Stream);

JpegTran.prototype.write = function (chunk) {
    this.jpegTranProcess.stdin.write(chunk);
};

JpegTran.prototype.end = function (chunk) {
    if (chunk) {
        this.write(chunk);
    }
    this.jpegTranProcess.stdin.end();
};

JpegTran.prototype.pause = function () {
    this.jpegTranProcess.stdout.pause();
};

JpegTran.prototype.resume = function () {
    this.jpegTranProcess.stdout.resume();
};

module.exports = JpegTran;
