var expect = require('expect.js'),
    JpegTran = require('../lib/JpegTran'),
    Path = require('path'),
    fs = require('fs');

describe('JpegTran', function () {
    it('should produce a smaller file when run with -grayscale', function (done) {
        var jpegTran = new JpegTran(['-grayscale']),
            chunks = [];
        fs.createReadStream(Path.resolve(__dirname, 'turtle.jpg'))
            .pipe(jpegTran)
            .on('data', function (chunk) {
                chunks.push(chunk);
            })
            .on('end', function () {
                var resultJpegBuffer = Buffer.concat(chunks);
                expect(resultJpegBuffer.length).to.be.greaterThan(0);
                expect(resultJpegBuffer.length).to.be.lessThan(105836);
                done();
            })
            .on('error', done);
    });

    it('should not emit data events while paused', function (done) {
        var jpegTran = new JpegTran(['-grayscale']);

        function fail() {
            done(new Error('JpegTran emitted data while it was paused!'));
        }
        jpegTran.pause();
        jpegTran.on('data', fail).on('error', done);

        fs.createReadStream(Path.resolve(__dirname, 'turtle.jpg')).pipe(jpegTran);

        setTimeout(function () {
            jpegTran.removeListener('data', fail);
            var chunks = [];

            jpegTran
                .on('data', function (chunk) {
                    chunks.push(chunk);
                })
                .on('end', function () {
                    var resultJpegBuffer = Buffer.concat(chunks);
                    expect(resultJpegBuffer.length).to.be.greaterThan(0);
                    expect(resultJpegBuffer.length).to.be.lessThan(105836);
                    done();
                });

            jpegTran.resume();
        }, 1000);
    });

    it('should emit an error if an invalid image is processed', function (done) {
        var jpegTran = new JpegTran();

        jpegTran.on('error', function (err) {
            done();
        }).on('data', function (chunk) {
            done(new Error('JpegTran emitted data when an error was expected'));
        }).on('end', function (chunk) {
            done(new Error('JpegTran emitted end when an error was expected'));
        });

        jpegTran.end(new Buffer('qwvopeqwovkqvwiejvq', 'utf-8'));
    });
});
