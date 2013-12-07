# Reference Implementation and Tests

This folder contains a reference implementation of the promises specification, inside `lib/testable-implementation.js`. It also allows you to run the [Promises/A+ tests](https://github.com/promises-aplus/promises-tests), as well as a few extra tests of my own devising, against that implementation.

## Reference Implementation

The reference implementation is meant to be a line-by-line transcription of the specification from ECMASpeak into JavaScript, as much as is possible.

Its purpose is to provide a 100%-fidelity implementation to run tests against in order to check the spec logic. In particular, it is *not* intended be a usable promise implementation or polyfill.

It uses [especially](https://npmjs.org/package/especially) to manifest a bunch of ES6 spec operations as JavaScript functions.

## Tests

Tests are meant to be run in Node.js 0.11.9+, since we depend on some bleeding edge V8 features to implement the reference implementation. To run them, make sure you have such a version of Node installed, then do

```js
$ npm install
$ npm test
```

in this directory. This will run a few tests found in the `test/` directory, and then the Promises/A+ tests.

These tests are written in the [Mocha](http://visionmedia.github.io/mocha/), and use Node's built-in [assert](http://nodejs.org/docs/latest/api/assert.html) API. We plan to transition them, and the Promises/A+ tests, to test-262 form eventually (see [#69](https://github.com/domenic/promises-unwrapping/issues/69)).
