var childProcess = require('child_process'),
    Stream = require('stream').Stream,
    util = require('util'),
    which = require('which'),
    memoizeAsync = require('memoizeasync');

function JpegTran(jpegTranArgs) {
    Stream.call(this);

    this.jpegTranArgs = jpegTranArgs;

    this.writable = this.readable = true;

    this.hasEnded = false;
}

util.inherits(JpegTran, Stream);

JpegTran.getBinaryPath = memoizeAsync(function (cb) {
    which('jpegtran', function (err, jpegTranBinaryPath) {
        if (err) {
            jpegTranBinaryPath = require('jpegtran-bin');
        }
        if (jpegTranBinaryPath) {
            cb(null, jpegTranBinaryPath);
        } else {
            cb(new Error('No jpegtran binary in PATH and jpegtran-bin does not provide a pre-built binary for your architecture'));
        }
    });
});

JpegTran.prototype._reportError = function (err) {
    if (!this.hasEnded) {
        this.hasEnded = true;
        this.emit('error', err);
    }
};

JpegTran.prototype.write = function (chunk) {
    if (this.jpegTranProcess) {
        this.jpegTranProcess.stdin.write(chunk);
    } else {
        if (!this.bufferedChunks) {
            this.bufferedChunks = [];
            JpegTran.getBinaryPath(function (err, jpegTranBinaryPath) {
                if (err) {
                    return this._reportError(err);
                }
                this.commandLine = jpegTranBinaryPath + (this.jpegTranArgs ? ' ' + this.jpegTranArgs.join(' ') : ''); // For debugging
                this.jpegTranProcess = childProcess.spawn(jpegTranBinaryPath, this.jpegTranArgs);

                this.seenDataOnStdout = false;

                this.jpegTranProcess.on('error', this._reportError.bind(this));

                // The child process might close its STDIN prematurely and emit EPIPE when the next chunk is written.
                // That's not necessarily an error, so prevent it from causing an exception:
                this.jpegTranProcess.stdin.on('error', function () {});

                this.jpegTranProcess.on('exit', function (exitCode) {
                    if (exitCode > 0 && !this.hasEnded) {
                        this._reportError(new Error('The jpegtran process exited with a non-zero exit code: ' + exitCode));
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
                            this._reportError(new Error('JpegTran: The stdout stream ended without emitting any data'));
                        }
                        this.hasEnded = true;
                    }
                }.bind(this));

                if (this.isPaused) {
                    this.jpegTranProcess.stdout.pause();
                }

                this.bufferedChunks.forEach(function (chunk) {
                    if (chunk === null) {
                        this.jpegTranProcess.stdin.end();
                    } else {
                        this.jpegTranProcess.stdin.write(chunk);
                    }
                }, this);
                this.bufferedChunks = null;
            }.bind(this));
        }
        this.bufferedChunks.push(chunk);
    }
};

JpegTran.prototype.destroy = function () {
    this.hasEnded = true;
    if (this.jpegTranProcess) {
        this.jpegTranProcess.kill();
        this.jpegTranProcess = null;
    }
    this.bufferedChunks = null;
};

JpegTran.prototype.end = function (chunk) {
    if (chunk) {
        this.write(chunk);
    }
    if (this.jpegTranProcess) {
        this.jpegTranProcess.stdin.end();
    } else {
        if (!this.bufferedChunks) {
            // .end called without an argument and with no preceeding .write calls. Make sure that we do create a process in that case:
            this.write(new Buffer(0));
        }
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
