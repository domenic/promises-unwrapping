"use strict";

var assert = require("assert");
var Promise = require("../lib/testable-implementation");
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;
var iterableFromArray = require("./helpers").iterableFromArray;
var delayPromise = require("./helpers").delayPromise;

describe("Promise.race", function () {
    it("should fulfill if all promises are settled and the ordinally-first is fulfilled", function (done) {
        var iterable = iterableFromArray([Promise.resolve(1), Promise.reject(2), Promise.resolve(3)]);

        Promise.race(iterable).then(function (value) {
            assert.strictEqual(value, 1);
            done();
        });
    });

    it("should reject if all promises are settled and the ordinally-first is rejected", function (done) {
        var iterable = iterableFromArray([Promise.reject(1), Promise.reject(2), Promise.resolve(3)]);

        Promise.race(iterable).then(
            function () {
                assert(false, "should never get here");
                done();
            },
            function (reason) {
                assert.strictEqual(reason, 1);
                done();
            }
        );
    });

    it("should reject immediately when a promise rejects", function (done) {
        var resolveP1, rejectP2;
        var p1 = OrdinaryConstruct(Promise, [function (resolve) { resolveP1 = resolve; }]);
        var p2 = OrdinaryConstruct(Promise, [function (resolve, reject) { rejectP2 = reject; }]);

        var iterable = iterableFromArray([p1, p2]);

        Promise.race(iterable).then(
            function () {
                throw new Error("should never fulfill");
            },
            function (reason) {
                assert.strictEqual(reason, 2);
            }
        ).then(done).catch(done);

        rejectP2(2);
        resolveP1(1);
    });

    it("should settle in the same way as the first promise to settle", function (done) {
        var iterable = iterableFromArray([delayPromise(1, 1000), delayPromise(2, 200), delayPromise(3, 500)]);

        Promise.race(iterable).then(function (value) {
            assert.strictEqual(value, 2);
            done();
        });
    });

    it("should never settle when given an empty iterable", function (done) {
        var iterable = iterableFromArray([]);
        var settled = false;

        Promise.race(iterable).then(
            function () { settled = true; },
            function () { settled = true; }
        );

        setTimeout(function () {
            assert.strictEqual(settled, false);
            done();
        }, 300);
    });

    it("should reject with a TypeError if given a non-iterable", function (done) {
        var notIterable = {};

        Promise.race(notIterable).then(
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
});
