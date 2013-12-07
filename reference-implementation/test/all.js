"use strict";

var assert = require("assert");
var Promise = require("../lib/testable-implementation");
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;

// In Node v0.11.7 --harmony, arrays are not iterable, but they have `.values()` methods that return iterables.
// In real life we should just use arrays and not need to do the silly `.values()` thing.
describe("Promise.all", function () {
    it("fulfills if passed an empty array", function (done) {
        rethrow(Promise.all([].values()).then(function (value) {
            assert(Array.isArray(value));
            assert.deepEqual(value, []);
            done();
        }));
    });

    it("fulfills if passed an array of mixed fulfilled promises and values", function (done) {
        rethrow(Promise.all([0, Promise.resolve(1), 2, Promise.resolve(3)].values()).then(function (value) {
            assert(Array.isArray(value));
            assert.deepEqual(value, [0, 1, 2, 3]);
            done();
        }));
    });

    it("rejects if any passed promise is rejected", function (done) {
        var foreverPending = OrdinaryConstruct(Promise, [function () { }]);
        var error = new Error("Rejected");
        var rejected = Promise.reject(error);

        rethrow(Promise.all([foreverPending, rejected].values()).then(
            function (value) {
                assert(false, "should never get here");
                done();
            },
            function (reason) {
                assert.strictEqual(reason, error);
                done();
            }
        ));
    });

    it("resolves foreign thenables", function (done) {
        var normal = Promise.resolve(1);
        var foreign = { then: function (f) { f(2); } };

        rethrow(Promise.all([normal, foreign].values()).then(function (value) {
            assert.deepEqual(value, [1, 2]);
            done();
        }));
    });

    it("fulfills when passed an sparse array, giving `undefined` for the omitted values", function (done) {
        rethrow(Promise.all([Promise.resolve(0), , , Promise.resolve(1)].values()).then(function (value) {
            assert.deepEqual(value, [0, undefined, undefined, 1]);
            done();
        }));
    });

    it("does not modify the input array", function (done) {
        var input = [0, 1].values();

        rethrow(Promise.all(input).then(function (value) {
            assert.notStrictEqual(input, value);
            done();
        }));
    });
});

function rethrow(promise) {
    promise.catch(function (reason) {
        process.nextTick(function () {
            throw reason;
        });
    });
}
