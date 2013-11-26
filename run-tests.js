"use strict";

var adapter = require("./testable-implementation");
var Promise = adapter.Promise;
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

describe("Self-resolution errors", function () {
    specify("directly resolving the promise with itself", function (done) {
        var deferred = adapter.deferred();
        deferred.resolve(deferred.promise);

        deferred.promise.then(
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

describe("Memoization of thenables", function () {
    specify("retrieving a value twice, in parallel, should only call `then` once.", function (done) {
        var deferred = adapter.deferred();
        var thenable = fulfilledThenable(sentinel);
        var derived = deferred.promise.then(function () { return thenable; });

        deferred.resolve();

        setTimeout(function () {
            assert.strictEqual(thenable.timesCalled, 1);
            assert.strictEqual(thenable.timesGotten, 1);
            var valuesGotten = 0;

            adapter.done(derived, function (value) {
                assert.strictEqual(thenable.timesCalled, 1);
                assert.strictEqual(thenable.timesGotten, 1);
                assert.strictEqual(value, sentinel);
                ++valuesGotten;
            });

            adapter.done(derived, function (value) {
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
        var deferred = adapter.deferred();
        var thenable = fulfilledThenable(sentinel);
        var derived = deferred.promise.then(function () { return thenable; });

        deferred.resolve();

        setTimeout(function () {
            assert.strictEqual(thenable.timesCalled, 1);
            assert.strictEqual(thenable.timesGotten, 1);
            var valuesGotten = 0;

            adapter.done(derived, function (value) {
                assert.strictEqual(thenable.timesCalled, 1);
                assert.strictEqual(thenable.timesGotten, 1);
                assert.strictEqual(value, sentinel);
                ++valuesGotten;
            });

            setTimeout(function () {
                adapter.done(derived, function (value) {
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
        var deferred1 = adapter.deferred();
        var deferred2 = adapter.deferred();
        var thenable = fulfilledThenable(sentinel);
        var derived1 = deferred1.promise.then(function () { return thenable; });
        var derived2 = deferred2.promise.then(function () { return thenable; });

        deferred1.resolve();
        deferred2.resolve();

        var valuesGotten = 0;
        adapter.done(derived1, function (value) {
            assert.strictEqual(thenable.timesCalled, 1);
            assert.strictEqual(thenable.timesGotten, 1);
            assert.strictEqual(value, sentinel);
            ++valuesGotten;
        });

        adapter.done(derived2, function (value) {
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

// In Node v0.11.7 --harmony, arrays are not iterable, but they have `.values()` methods that return iterables.
// In real life we should just use arrays and not need to do the silly `.values()` thing.
describe("Promise.all", function () {
    it("fulfills if passed an empty array", function (done) {
        adapter.done(Promise.all([].values()), function (value) {
            assert(Array.isArray(value));
            assert.deepEqual(value, []);
            done();
        });
    });

    it("fulfills if passed an array of mixed fulfilled promises and values", function (done) {
        adapter.done(Promise.all([0, Promise.resolve(1), 2, Promise.resolve(3)].values()), function (value) {
            assert(Array.isArray(value));
            assert.deepEqual(value, [0, 1, 2, 3]);
            done();
        });
    });

    it("rejects if any passed promise is rejected", function (done) {
        var foreverPending = adapter.deferred().promise;
        var error = new Error("Rejected");
        var rejected = Promise.reject(error);

        adapter.done(Promise.all([foreverPending, rejected].values()),
            function (value) {
                assert(false, "should never get here");
                done();
            },
            function (reason) {
                assert.strictEqual(reason, error);
                done();
            }
        );
    });

    it("resolves foreign thenables", function (done) {
        var normal = Promise.resolve(1);
        var foreign = { then: function (f) { f(2); } };

        adapter.done(Promise.all([normal, foreign].values()), function (value) {
            assert.deepEqual(value, [1, 2]);
            done();
        });
    });

    it("fulfills when passed an sparse array, giving `undefined` for the omitted values", function (done) {
        adapter.done(Promise.all([Promise.resolve(0), , , Promise.resolve(1)].values()), function (value) {
            assert.deepEqual(value, [0, undefined, undefined, 1]);
            done();
        });
    });

    it("does not modify the input array", function (done) {
        var input = [0, 1].values();

        adapter.done(Promise.all(input), function (value) {
            assert.notStrictEqual(input, value);
            done();
        });
    });
});

require("promises-aplus-tests").mocha(adapter);
