const expect = require('unexpected')
  .clone()
  .use(require('unexpected-stream'))
  .use(require('unexpected-sinon'));
const sinon = require('sinon');
const JpegTran = require('../lib/JpegTran');
const Path = require('path');
const fs = require('fs');
const semver = require('semver');

it.skipIf = function (condition) {
  (condition ? it.skip : it).apply(
    it,
    Array.prototype.slice.call(arguments, 1)
  );
};

describe('JpegTran', () => {
  it('should produce a smaller file when run with -grayscale', () =>
    expect(
      fs.createReadStream(Path.resolve(__dirname, 'turtle.jpg')),
      'when piped through',
      new JpegTran(['-grayscale']),
      'to yield output satisfying',
      expect.it((resultJpegBuffer) => {
        expect(resultJpegBuffer.length, 'to be within', 0, 105836);
      })
    ));

  it.skipIf(
    semver.satisfies(process.version.replace(/^v/, ''), '>=0.12.0'),
    'should not emit data events while paused',
    (done) => {
      const jpegTran = new JpegTran(['-grayscale']);

      function fail() {
        done(new Error('JpegTran emitted data while it was paused!'));
      }
      jpegTran.pause();
      jpegTran.on('data', fail).on('error', done);

      fs.createReadStream(Path.resolve(__dirname, 'turtle.jpg')).pipe(jpegTran);

      setTimeout(() => {
        jpegTran.removeListener('data', fail);
        const chunks = [];

        jpegTran
          .on('data', (chunk) => {
            chunks.push(chunk);
          })
          .on('end', () => {
            expect(Buffer.concat(chunks).length, 'to be within', 0, 105836);
            done();
          });

        jpegTran.resume();
      }, 1000);
    }
  );

  it('should emit an error if an invalid image is processed', (done) => {
    const jpegTran = new JpegTran();
    jpegTran
      .on('error', () => {
        done();
      })
      .on('data', (chunk) => {
        done(new Error('JpegTran emitted data when an error was expected'));
      })
      .on('end', (chunk) => {
        done(new Error('JpegTran emitted end when an error was expected'));
      });

    jpegTran.end(Buffer.from('qwvopeqwovkqvwiejvq', 'utf-8'));
  });

  it('should emit a single error if an invalid command line is specified', (done) => {
    const jpegTran = new JpegTran(['-optimize', 'qcwecqweqbar']);

    let seenError = false;
    jpegTran
      .on('error', () => {
        if (seenError) {
          done(new Error('More than one error event was emitted'));
        } else {
          seenError = true;
          setTimeout(done, 100);
        }
      })
      .on('data', (chunk) => {
        done(new Error('JpegTran emitted data when an error was expected'));
      })
      .on('end', (chunk) => {
        done(new Error('JpegTran emitted end when an error was expected'));
      });

    jpegTran.end(Buffer.from('qwvopeqwovkqvwiejvq', 'utf-8'));
  });

  describe('#destroy', () => {
    it('should kill the underlying child process', () => {
      const jpegTran = new JpegTran(['-grayscale']);

      return expect.promise((run) => {
        jpegTran.write('JFIF');
        setTimeout(
          run(function waitForJpegTranProcess() {
            const jpegTranProcess = jpegTran.jpegTranProcess;
            if (jpegTran.jpegTranProcess) {
              sinon.spy(jpegTranProcess, 'kill');
              jpegTran.destroy();
              sinon.spy(jpegTran, 'emit');
              expect(jpegTranProcess.kill, 'to have calls satisfying', () => {
                jpegTranProcess.kill();
              });
              expect(jpegTran.jpegTranProcess, 'to be falsy');
              expect(jpegTran.bufferedChunks, 'to be falsy');
              setTimeout(
                run(() => {
                  expect(jpegTran.emit, 'to have calls satisfying', []);
                }),
                10
              );
            } else {
              setTimeout(run(waitForJpegTranProcess), 0);
            }
          }),
          0
        );
      });
    });
  });
});
