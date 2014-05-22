"use strict";

var assert = require("assert");
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;
var atAtIterator = require("especially/well-known-symbols")["@@iterator"];
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

specify("An abrupt completion of the executor function should result in a rejected promise", function () {
    var promise;

    assert.doesNotThrow(function () {
        promise = OrdinaryConstruct(Promise, [function () { throw new Error(); }]);
    });

    promise.then(
        function () {
            assert(false, "Should not be fulfilled");
            done();
        },
        function (err) {
            assert(err instanceof Error);
            done();
        }
    );
});

specify("Stealing a resolver and using it to trigger possible reentrancy bug (#83)", function () {
    var stolenResolver;
    function StealingPromiseConstructor(resolver) {
        stolenResolver = resolver;
        resolver(function () { }, function () { });
    }

    var iterable = {};
    iterable[atAtIterator] = function () {
        stolenResolver(null, null);
        throw 0;
    };

    assert.doesNotThrow(function () {
        Promise.all.call(StealingPromiseConstructor, iterable);
    });
});
