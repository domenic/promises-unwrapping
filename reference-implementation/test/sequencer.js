"use strict";
var assert = require("assert");
var Promise = require("../lib/testable-implementation");
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;
var iterableFromArray = require("./helpers").iterableFromArray;

describe("Promise.all sequence", function () {
    it("should should execute 'then' methods in sequence", function(done) {
	var p1 = Promise.resolve(100),
	    p2 = Promise.resolve(200),
            iterable = iterableFromArray([p1, p2]);

	var sequencer = [1];

	p1.then(function afterOne(resolved) {
	    assert.deepEqual([1], sequencer);
	    sequencer.push(2);
	}).catch(done);

	Promise.all(iterable).then(function afterAll(resolved) {
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
    it("should reject immediately when second rejects", function(done) {
	var resolveP1, rejectP2,
	    p1 = OrdinaryConstruct(Promise, [function(resolve, reject) {
		resolveP1 = resolve;
	    }]),
	    p2 = OrdinaryConstruct(Promise, [function(resolve, reject) {
		rejectP2 = reject;
	    }]),
            iterable = iterableFromArray([p1, p2]);

	Promise.race(iterable).then(function(resolved) {
	    throw new Error("Unexpected resolve " + resolved);
	}, function(rejected) {
	    assert.equal(rejected, 2);
	}).then(done).catch(done);

	rejectP2(2);
	resolveP1(1);
    });

});
