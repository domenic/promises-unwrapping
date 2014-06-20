"use strict";
var assert = require("assert");
var Promise = require("../lib/testable-implementation");
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;
var iterableFromArray = require("./helpers").iterableFromArray;

describe("Handler execution order", function () {
    it("should happen in the order they are queued, when added before resolution", function (done) {
        var calls = [];

        var resolveP1, rejectP2;
        var p1 = OrdinaryConstruct(Promise, [function (resolve) { resolveP1 = resolve; }]);
        var p2 = OrdinaryConstruct(Promise, [function (resolve, reject) { rejectP2 = reject; }]);

        p1.then(function () {
            calls.push(1);
        }).then(function () {
            assert.deepEqual(calls, [2, 1]);
        }).then(done).catch(done);

        p2.catch(function () {
            calls.push(2);
        });

        rejectP2();
        resolveP1();
    });

    it("should happen in the order they are queued, when added after resolution", function (done) {
        var calls = [];

        var resolveP1, rejectP2;
        var p1 = OrdinaryConstruct(Promise, [function (resolve) { resolveP1 = resolve; }]);
        var p2 = OrdinaryConstruct(Promise, [function (resolve, reject) { rejectP2 = reject; }]);

        rejectP2();
        resolveP1();

        p1.then(function () {
            calls.push(1);
        });

        p2.catch(function () {
            calls.push(2);
        }).then(function () {
            assert.deepEqual(calls, [1, 2]);
        }).then(done).catch(done);
    });

    it("should happen in the order they are queued, when added asynchronously after resolution", function (done) {
        var calls = [];

        var resolveP1, rejectP2;
        var p1 = OrdinaryConstruct(Promise, [function (resolve) { resolveP1 = resolve; }]);
        var p2 = OrdinaryConstruct(Promise, [function (resolve, reject) { rejectP2 = reject; }]);

        rejectP2();
        resolveP1();

        setTimeout(function () {
            p1.then(function () {
                calls.push(1);
            });

            p2.catch(function () {
                calls.push(2);
            }).then(function () {
                assert.deepEqual(calls, [1, 2]);
            }).then(done).catch(done);
        }, 0);
    });
});
