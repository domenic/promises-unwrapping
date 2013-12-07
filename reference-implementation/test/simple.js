"use strict";

var assert = require("assert");
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;
var Promise = require("../lib/testable-implementation");

describe("Easy-to-debug sanity check", function () {
    specify("a fulfilled promise calls its fulfillment handler", function (done) {
        Promise.resolve(5).then(function (value) {
            assert.strictEqual(value, 5);
            done();
        });
    });
});

describe("Self-resolution errors", function () {
    specify("directly resolving the promise with itself", function (done) {
        var resolvePromise;
        var promise = OrdinaryConstruct(Promise, [function (resolve) { resolvePromise = resolve; }]);

        resolvePromise(promise);

        promise.then(
            function () {
                assert(false, "Should not be fulfilled");
                done();
            },
            function (err) {
                assert(err instanceof TypeError);
                done();
            }
        );
    });
});
