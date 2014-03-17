"use strict";

var assert = require("assert");
var Promise = require("../lib/testable-implementation");
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;
var iterableFromArray = require("./helpers").iterableFromArray;

describe("Promise.all", function () {
    it("fulfills if passed an empty array", function (done) {
        var iterable = iterableFromArray([]);

        Promise.all(iterable).then(function (value) {
            assert(Array.isArray(value));
            assert.deepEqual(value, []);
            done();
        });
    });

    it("fulfills if passed an array of mixed fulfilled promises and values", function (done) {
        var iterable = iterableFromArray([0, Promise.resolve(1), 2, Promise.resolve(3)]);

        Promise.all(iterable).then(function (value) {
            assert(Array.isArray(value));
            assert.deepEqual(value, [0, 1, 2, 3]);
            done();
        });
    });

    it("rejects if any passed promise is rejected", function (done) {
        var foreverPending = OrdinaryConstruct(Promise, [function () { }]);
        var error = new Error("Rejected");
        var rejected = Promise.reject(error);

        var iterable = iterableFromArray([foreverPending, rejected]);

        Promise.all(iterable).then(
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

        var iterable = iterableFromArray([normal, foreign]);

        Promise.all(iterable).then(function (value) {
            assert.deepEqual(value, [1, 2]);
            done();
        });
    });

    it("fulfills when passed an sparse array, giving `undefined` for the omitted values", function (done) {
        var iterable = iterableFromArray([Promise.resolve(0), , , Promise.resolve(1)]);

        Promise.all(iterable).then(function (value) {
            assert.deepEqual(value, [0, undefined, undefined, 1]);
            done();
        });
    });

    it("does not modify the input array", function (done) {
        var input = [0, 1];
        var iterable = iterableFromArray(input);

        Promise.all(iterable).then(function (value) {
            assert.notStrictEqual(input, value);
            done();
        });
    });


    it("should reject with a TypeError if given a non-iterable", function (done) {
        var notIterable = {};

        Promise.all(notIterable).then(
            function () {
                assert(false, "should never get here");
                done();
            },
            function (reason) {
                assert(reason instanceof TypeError);
                done();
            }
        );
    });

    describe("Using a promise that calls onFulfilled twice to trigger incorrect behavior", function () {
        var badPromise;

        beforeEach(function () {
            badPromise = Promise.resolve();
            badPromise.then = function (onFulfilled, onRejected) {
                onFulfilled();
                return Promise.prototype.then.call(this, onFulfilled, onRejected);
            };
        });

        it("should not be able to prevent the countdown from reaching zero", function (done) {
            var iterable = iterableFromArray([badPromise]);

            Promise.all(iterable).then(function (result) {
                assert.deepEqual(result, [undefined]);
            })
            .then(done, done);
        });

        it("should not be able to cause the returned promise to settle before all arguments", function (done) {
            var returnedPromiseIsFulfilled = false;
            var testFailed = false;

            var iterable = iterableFromArray([
                Promise.resolve(),
                badPromise,
                Promise.resolve()
                    .then(function () {
                        assert(!returnedPromiseIsFulfilled, "Should be fulfilled before returned promise");
                    })
                    .then(function () {
                        assert(!returnedPromiseIsFulfilled, "Should be fulfilled before returned promise");
                    })
                    .catch(function (err) {
                        testFailed = true;
                        done(err);
                    })
            ]);

            Promise.all(iterable)
                .then(function () {
                    returnedPromiseIsFulfilled = true;
                })
                .then(function () {
                    setTimeout(function () {
                        if (!testFailed) {
                            done();
                        }
                    }, 50);
                });
        });

        it("should not be able to return a fulfilled promise despite a rejected argument", function (done) {
            var iterable = iterableFromArray([Promise.resolve(), badPromise, Promise.reject("reason")]);

            Promise.all(iterable)
                .then(
                    function () {
                        assert(false, "Should not be fulfilled");
                    },
                    function (r) {
                        assert.strictEqual(r, "reason");
                    }
                )
                .then(done, done);
        });

        it("should not be able to call a misbehaved subclass executor twice", function (done) {
            var isInstrumented = true;
            var resolveValues = [];

            function PromiseWithBadStaticResolve(executor) {
                if (isInstrumented) {
                    isInstrumented = false;
                    Promise.call(this, function (resolve, reject) {
                        return executor(instrumentedResolve, reject);

                        function instrumentedResolve(value) {
                            resolveValues.push(value.slice());
                            return resolve(value);
                        }
                    });
                } else {
                    Promise.call(this, executor);
                }
            }
            PromiseWithBadStaticResolve.prototype = Object.create(Promise.prototype);
            PromiseWithBadStaticResolve.prototype.constructor = PromiseWithBadStaticResolve;
            PromiseWithBadStaticResolve.__proto__ = Promise;

            PromiseWithBadStaticResolve.resolve = function (p) {
                return p;
            };

            var iterable = iterableFromArray([Promise.resolve(0), badPromise, Promise.resolve(2)]);

            PromiseWithBadStaticResolve.all(iterable).catch(done);

            Promise.resolve().then(function () {
                setTimeout(function () {
                    assert.deepEqual(resolveValues, [[0, undefined, 2]]);
                    done();
                }, 50);
            });
        });
    });
});
