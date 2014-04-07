"use strict";

var assert = require("assert");
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;
var Promise = require("../lib/testable-implementation");

describe("Evil promises should not be able to break invariants", function () {
    specify("resolving to a promise that calls onFulfilled twice", function (done) {
        var evilPromise = Promise.resolve();
        evilPromise.then = function (f) {
            f(1);
            f(2);
        };

        var calledAlready = false;
        var resolvedToEvil = OrdinaryConstruct(Promise, [function (resolve) { resolve(evilPromise); }]);
        resolvedToEvil.then(function (value) {
            assert.strictEqual(calledAlready, false);
            calledAlready = true;
            assert.strictEqual(value, 1);
        })
        .then(done, done);
    });

    specify("If resolved to a thenable which calls back with different values each time", function (done) {
        var thenable = {
            i: 0,
            then: function (f) {
                f(this.i++);
            }
        };
        var p = Promise.resolve(thenable);

        p.then(function (value) {
            assert.strictEqual(value, 0);

            p.then(function (value) {
                assert.strictEqual(value, 0);

                p.then(function (value) {
                    assert.strictEqual(value, 0);
                    done();
                });
            });
        });
    });
});
