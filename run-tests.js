"use strict";

var adapter = require("./test-abstract-implementation");
var assert = require("assert");

var sentinel = { sentinel: "SENTINEL" };

function fulfilledThenable(value) {
    var thenable = {
        timesCalled: 0,
        timesGotten: 0
    };

    Object.defineProperty(thenable, "then", {
        get: function () {
            ++thenable.timesGotten;
            return function (onFulfilled, onRejected) {
                ++this.timesCalled;
                onFulfilled(value);
            };
        }
    });

    return thenable;
}

describe("Memoization of thenables", function () {
    specify("retrieving a value twice, in parallel, should only call `then` once.", function (done) {
        var tuple = adapter.pending();
        var thenable = fulfilledThenable(sentinel);
        var derived = tuple.promise.then(function () { return thenable; });

        tuple.fulfill();

        setTimeout(function () {
            assert.strictEqual(thenable.timesCalled, 0);
            assert.strictEqual(thenable.timesGotten, 0);
            var valuesGotten = 0;

            derived.done(function (value) {
                assert.strictEqual(thenable.timesCalled, 1);
                assert.strictEqual(thenable.timesGotten, 1);
                assert.strictEqual(value, sentinel);
                ++valuesGotten;
            });

            derived.done(function (value) {
                assert.strictEqual(thenable.timesCalled, 1);
                assert.strictEqual(thenable.timesGotten, 1);
                assert.strictEqual(value, sentinel);
                ++valuesGotten;
            });

            setTimeout(function () {
                assert.strictEqual(thenable.timesCalled, 1);
                assert.strictEqual(thenable.timesGotten, 1);
                assert.strictEqual(valuesGotten, 2);
                done();
            }, 50);
        }, 50);
    });

    specify("retrieving a value twice, in sequence, should only call `then` once.", function (done) {
        var tuple = adapter.pending();
        var thenable = fulfilledThenable(sentinel);
        var derived = tuple.promise.then(function () { return thenable; });

        tuple.fulfill();

        setTimeout(function () {
            assert.strictEqual(thenable.timesCalled, 0);
            assert.strictEqual(thenable.timesGotten, 0);
            var valuesGotten = 0;

            derived.done(function (value) {
                assert.strictEqual(thenable.timesCalled, 1);
                assert.strictEqual(thenable.timesGotten, 1);
                assert.strictEqual(value, sentinel);
                ++valuesGotten;
            });

            setTimeout(function () {
                derived.done(function (value) {
                    assert.strictEqual(thenable.timesCalled, 1);
                    assert.strictEqual(thenable.timesGotten, 1);
                    assert.strictEqual(value, sentinel);
                    ++valuesGotten;
                });

                setTimeout(function () {
                    assert.strictEqual(thenable.timesCalled, 1);
                    assert.strictEqual(thenable.timesGotten, 1);
                    assert.strictEqual(valuesGotten, 2);
                    done();
                }, 50);
            }, 50);
        }, 50);
    });

    specify("when multiple promises are resolved to the thenable", function (done) {
        var tuple1 = adapter.pending();
        var tuple2 = adapter.pending();
        var thenable = fulfilledThenable(sentinel);
        var derived1 = tuple1.promise.then(function () { return thenable; });
        var derived2 = tuple2.promise.then(function () { return thenable; });

        tuple1.fulfill();
        tuple2.fulfill();

        var valuesGotten = 0;
        derived1.done(function (value) {
            assert.strictEqual(thenable.timesCalled, 1);
            assert.strictEqual(thenable.timesGotten, 1);
            assert.strictEqual(value, sentinel);
            ++valuesGotten;
        });

        derived2.done(function (value) {
            assert.strictEqual(thenable.timesCalled, 1);
            assert.strictEqual(thenable.timesGotten, 1);
            assert.strictEqual(value, sentinel);
            ++valuesGotten;
        });

        setTimeout(function () {
            assert.strictEqual(valuesGotten, 2);
            done();
        }, 50);
    });
});

require("promises-aplus-tests").mocha(adapter);
