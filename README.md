# node-jpegtran

[![NPM version](https://badge.fury.io/js/jpegtran.svg)](http://badge.fury.io/js/jpegtran)
[![Build Status](https://travis-ci.org/papandreou/node-jpegtran.svg?branch=master)](https://travis-ci.org/papandreou/node-jpegtran)
[![Coverage Status](https://coveralls.io/repos/papandreou/node-jpegtran/badge.svg)](https://coveralls.io/r/papandreou/node-jpegtran)
[![Dependency Status](https://david-dm.org/papandreou/node-jpegtran.svg)](https://david-dm.org/papandreou/node-jpegtran)

The jpegtran command line utility as a readable/writable stream.

If you don't have a `jpegtran` binary in your PATH, `node-jpegtran`
will try to use one of the binaries provided by <a
href="https://github.com/yeoman/node-jpegtran-bin">the node-jpegtran-bin
package</a>.

The constructor optionally takes an array of command line options for
the `jpegtran` binary:

```javascript
var JpegTran = require('jpegtran'),
  myJpegTranslator = new JpegTran(['-rotate', 90, '-progressive']);

sourceStream.pipe(myJpegTranslator).pipe(destinationStream);
```

JpegTran as a web service (sends back a horizontally flipped grayscale
version of the request body):

```javascript
var JpegTran = require('jpegtran'),
  http = require('http');

http
  .createServer(function (req, res) {
    if (req.headers['content-type'] === 'image/jpeg') {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      req.pipe(new JpegTran(['-grayscale', '-flip', 'horizontal'])).pipe(res);
    } else {
      res.writeHead(400);
      res.end('Feed me a JPEG!');
    }
  })
  .listen(1337);
```

## Installation

Make sure you have node.js and npm installed, then run:

```
npm install jpegtran
```

## Releases

[Changelog](https://github.com/papandreou/node-jpegtran/blob/master/CHANGELOG.md)

## License

3-clause BSD license -- see the `LICENSE` file for details.
