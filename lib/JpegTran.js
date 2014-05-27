var childProcess = require('child_process'),
    Stream = require('stream').Stream,
    util = require('util'),
    which = require('which'),
    memoizeAsync = require('memoizeasync');

function JpegTran(jpegTranArgs) {
    Stream.call(this);

    this.writable = this.readable = true;

    JpegTran.getBinaryPath(function (err, jpegTranBinaryPath) {
        if (err) {
            return this.emit('error', err);
        }
        this.commandLine = jpegTranBinaryPath + (jpegTranArgs ? ' ' + jpegTranArgs.join(' ') : ''); // For debugging
        this.jpegTranProcess = childProcess.spawn(jpegTranBinaryPath, jpegTranArgs);

        this.hasEnded = false;
        this.seenDataOnStdout = false;

        this.jpegTranProcess.on('error', function (err) {
            this.emit('error', err);
        }.bind(this));

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

        if (this.isPaused) {
            this.jpegTranProcess.stdout.pause();
        }

        if (this.bufferedChunks) {
            this.bufferedChunks.forEach(function (chunk) {
                if (chunk === null) {
                    this.jpegTranProcess.stdin.end();
                } else {
                    this.jpegTranProcess.stdin.write(chunk);
                }
            }, this);
            this.bufferedChunks = null;
        }
    }.bind(this));
}

util.inherits(JpegTran, Stream);

JpegTran.getBinaryPath = memoizeAsync(function (cb) {
    which('jpegtran', function (err, jpegTranBinaryPath) {
        if (err) {
            jpegTranBinaryPath = require('jpegtran-bin').path;
        }
        if (jpegTranBinaryPath) {
            cb(null, jpegTranBinaryPath);
        } else {
            cb(new Error('No jpegtran binary in PATH and jpegtran-bin does not provide a pre-built binary for your architecture'));
        }
    });
});

JpegTran.prototype.write = function (chunk) {
    if (this.jpegTranProcess) {
        this.jpegTranProcess.stdin.write(chunk);
    } else {
        (this.bufferedChunks = this.bufferedChunks || []).push(chunk);
    }
};

JpegTran.prototype.end = function (chunk) {
    if (chunk) {
        this.write(chunk);
    }
    if (this.jpegTranProcess) {
        this.jpegTranProcess.stdin.end();
    } else {
        this.bufferedChunks.push(null);
    }
};

JpegTran.prototype.pause = function () {
    if (this.jpegTranProcess) {
        this.jpegTranProcess.stdout.pause();
    }
    this.isPaused = true;
};

JpegTran.prototype.resume = function () {
    if (this.jpegTranProcess) {
        this.jpegTranProcess.stdout.resume();
    }
    this.isPaused = false;
};

module.exports = JpegTran;
