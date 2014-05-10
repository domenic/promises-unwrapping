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

// Kudos to @Octane at https://github.com/getify/native-promise-only/issues/5 for this, and @getify for pinging me.
describe("Thenables should not be able to run code during assimilation", function () {
    specify("resolving to a thenable", function () {
        var thenCalled = false;
        var thenable = {
            then: function () {
                thenCalled = true;
            }
        };

        Promise.resolve(thenable);
        assert.strictEqual(thenCalled, false);
    });

    specify("resolving to an evil promise", function () {
        var thenCalled = false;
        var evilPromise = Promise.resolve();
        evilPromise.then = function () {
            thenCalled = true;
        };

        Promise.resolve(evilPromise);
        assert.strictEqual(thenCalled, false);
    });
});
