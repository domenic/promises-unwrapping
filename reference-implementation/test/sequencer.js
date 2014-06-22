"use strict";
var assert = require("assert");
var Promise = require("../lib/testable-implementation");
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;
var iterableFromArray = require("./helpers").iterableFromArray;

function newPromise(func) {
    return OrdinaryConstruct(Promise, [func]);
}

describe("Promise.all sequence", function () {
    it("should should execute 'then' methods in sequence", function (done) {
        var p1 = Promise.resolve(100),
            p2 = Promise.resolve(200),
            iterable = iterableFromArray([p1, p2]),
            sequencer = [1];

        p1.then(function afterOne(resolved) {
            assert.deepEqual([1], sequencer);
            sequencer.push(2);
        }).catch(done);

        Promise.all(iterable).then(function afterAll() {
            assert.deepEqual([1, 2, 3], sequencer);
            sequencer.push(4);
        }).then(done).catch(done);

        p2.then(function afterTwo(resolved) {
            assert.deepEqual([1, 2], sequencer);
            sequencer.push(3);
        }).catch(done);

    });
});

describe("Promise.race sequence", function () {
    it("should reject immediately when second rejects", function (done) {
        var resolveP1, rejectP2,
            p1 = newPromise(function (resolve, reject) {
                resolveP1 = resolve;
            }),
            p2 = newPromise(function (resolve, reject) {
                rejectP2 = reject;
            }),
            iterable = iterableFromArray([p1, p2]);

        Promise.race(iterable).then(function (resolved) {
            throw new Error("Unexpected resolve " + resolved);
        }, function (rejected) {
            assert.equal(rejected, 2);
        }).then(done).catch(done);

        rejectP2(2);
        resolveP1(1);
    });

});

describe("Sequencing tests from promises-aplus/issue #61", function () {
    it("T1", function (done) {

        var resolveP1, rejectP2, sequencer = [];

        (newPromise(function (resolve, reject) {
            resolveP1 = resolve;
        })).then(function (msg) {
            sequencer.push(msg);
        }).then(function () {
            assert.deepEqual(["A", "B"], sequencer);
        }).then(done).catch(done);

        (newPromise(function (resolve, reject) {
            rejectP2 = reject;
        })).catch(function (msg) {
            sequencer.push(msg);
        });


        rejectP2("A");
        resolveP1("B");

    });

    // According to my understanding of the spec, and according to v8, the
    // print out should be "A B".

    // My unfixed library prints out "B A". When I correct my scheduler
    // bug, I get "A B" as I would expect.

    // The problem, as stated above and in #59, is that NPO is already
    // passing all 872 tests for its then(..) behavior, even with this
    // sequencing bug, because the test suite is apparently not asserting
    // anything about this expected sequencing (though it is clearly
    // implied by the spec).

    // What concerns me is that it seems like maybe this is more than
    // just one test that's missing, but potentially a whole class of
    // tests that make assertions about then-sequencing semantics
    // between independent promises.

    it("T2a", function (done) {
        var resolveP1, rejectP2, p1, p2,
            sequencer = [];

        p1 = newPromise(function (resolve, reject) {
            resolveP1 = resolve;
        });
        p2 = newPromise(function (resolve, reject) {
            rejectP2 = reject;
        });

        rejectP2("B");
        resolveP1("A");

        p1.then(function (msg) {
            sequencer.push(msg);
        });

        p2.catch(function (msg) {
            sequencer.push(msg);
        }).then(function () {
            assert.deepEqual(["A", "B"], sequencer);
        }).then(done).catch(done);
    });

    // Again, should print "A B". In mine, it prints "B A" at the
    // moment. [update: actually, not convinced what it should print, see
    // messages below]

    it("T2b", function (done) {

        var resolveP1, rejectP2, p1, p2,
            sequencer = [];

        p1 = newPromise(function (resolve, reject) {
            resolveP1 = resolve;
        });
        p2 = newPromise(function (resolve, reject) {
            rejectP2 = reject;
        });

        rejectP2("B");
        resolveP1("A");

        setTimeout(function () {
            p1.then(function (msg) {
                sequencer.push(msg);
            });

            p2.catch(function (msg) {
                sequencer.push(msg);
            }).then(function () {
                assert.deepEqual(["A", "B"], sequencer);
            }).then(done).catch(done);
        }, 0);

    });
});
