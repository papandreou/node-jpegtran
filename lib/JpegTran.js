const childProcess = require('child_process');
const Stream = require('stream').Stream;
const util = require('util');
const which = require('which');
const memoizeAsync = require('memoizeasync');

function JpegTran(jpegTranArgs) {
  Stream.call(this);

  this.jpegTranArgs = jpegTranArgs;
  this.writable = this.readable = true;
  this.hasEnded = false;
}

util.inherits(JpegTran, Stream);

JpegTran.getBinaryPath = memoizeAsync((cb) => {
  which('jpegtran', (err, jpegTranBinaryPath) => {
    if (err) {
      jpegTranBinaryPath = require('jpegtran-bin');
    }
    if (jpegTranBinaryPath) {
      cb(null, jpegTranBinaryPath);
    } else {
      cb(
        new Error(
          'No jpegtran binary in PATH and jpegtran-bin does not provide a pre-built binary for your architecture'
        )
      );
    }
  });
});

JpegTran.prototype._error = function (err) {
  if (!this.hasEnded) {
    this.hasEnded = true;
    this.cleanUp();
    this.emit('error', err);
  }
};

JpegTran.prototype.write = function (chunk) {
  if (this.hasEnded) {
    return;
  }
  if (this.jpegTranProcess) {
    this.jpegTranProcess.stdin.write(chunk);
  } else {
    if (!this.bufferedChunks) {
      this.bufferedChunks = [];
      JpegTran.getBinaryPath((err, jpegTranBinaryPath) => {
        if (this.hasEnded) {
          return;
        }
        if (err) {
          return this._error(err);
        }
        this.commandLine =
          jpegTranBinaryPath +
          (this.jpegTranArgs ? ` ${this.jpegTranArgs.join(' ')}` : ''); // For debugging
        this.jpegTranProcess = childProcess.spawn(
          jpegTranBinaryPath,
          this.jpegTranArgs,
          { windowsHide: true }
        );

        this.seenDataOnStdout = false;

        this.jpegTranProcess.on('error', this._error.bind(this));

        // The child process might close its STDIN prematurely and emit EPIPE when the next chunk is written.
        // That's not necessarily an error, so prevent it from causing an exception:
        this.jpegTranProcess.stdin.on('error', () => {});

        this.jpegTranProcess.on('exit', (exitCode) => {
          if (exitCode > 0 && !this.hasEnded) {
            this._error(
              new Error(
                `The jpegtran process exited with a non-zero exit code: ${exitCode}`
              )
            );
            this.hasEnded = true;
          }
        });

        this.jpegTranProcess.stdout
          .on('data', (chunk) => {
            this.seenDataOnStdout = true;
            this.emit('data', chunk);
          })
          .on('end', () => {
            this.jpegTranProcess = null;
            if (!this.hasEnded) {
              if (this.seenDataOnStdout) {
                this.emit('end');
              } else {
                this._error(
                  new Error(
                    'JpegTran: The stdout stream ended without emitting any data'
                  )
                );
              }
              this.hasEnded = true;
            }
          });

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
      });
    }
    this.bufferedChunks.push(chunk);
  }
};

JpegTran.prototype.cleanUp = function () {
  if (this.jpegTranProcess) {
    this.jpegTranProcess.kill();
    this.jpegTranProcess = null;
  }
  this.bufferedChunks = null;
};

JpegTran.prototype.destroy = function () {
  if (!this.hasEnded) {
    this.hasEnded = true;
    this.cleanUp();
    this.bufferedChunks = null;
  }
};

JpegTran.prototype.end = function (chunk) {
  if (chunk) {
    this.write(chunk);
  }
  if (this.jpegTranProcess) {
    this.jpegTranProcess.stdin.end();
  } else {
    if (this.bufferedChunks) {
      this.bufferedChunks.push(null);
    } else {
      // .end called without an argument and with no preceeding .write calls. Make sure that we do create a process in that case:
      this.write(Buffer.alloc(0));
    }
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
