"use strict";
var assert = require("assert");

var UNSET = { "unset": "UNSET" };

// NOTE!!! This is not normal JavaScript; it's used as a sanity check for the spec. JavaScript promises do not work this
// way, e.g. they have methods instead of these capitalized functions! Do not use this for anything real!

function Promise() {
    this._isPromise = true;
    this._following = UNSET;
    this._value = UNSET;
    this._reason = UNSET;
    this._outstandingThens = [];
}

function IsPromise(x) {
    return IsObject(x) && x._isPromise;
}

function Resolve(p, x) {
    if (is_set(p._following) || is_set(p._value) || is_set(p._reason)) {
        return;
    }

    if (IsPromise(x)) {
        if (is_set(x._following)) {
            p._following = x._following;
        } else if (is_set(x._value)) {
            p._value = x._value;
            ProcessOutstandingThens(p);
        } else if (is_set(x._reason)) {
            p._reason = x._reason;
            ProcessOutstandingThens(p);
        } else {
            p._following = x;
        }
    } else {
        p._value = x;
        ProcessOutstandingThens(p);
    }
}

function Reject(p, r) {
    if (is_set(p._following) || is_set(p._value) || is_set(p._reason)) {
        return;
    }

    p._reason = r;
    ProcessOutstandingThens(p);
}

function Then(p, onFulfilled, onRejected) {
    if (is_set(p._following)) {
        return Then(p._following, onFulfilled, onRejected);
    } else {
        var q = new Promise();
        if (is_set(p._value) || is_set(p._reason)) {
            UpdateFromValueOrReason(q, p, onFulfilled, onRejected);
        } else {
            p._outstandingThens.push({ derivedPromise: q, onFulfilled: onFulfilled, onRejected: onRejected });
        }
        return q;
    }
}

function ProcessOutstandingThens(p) {
    p._outstandingThens.forEach(function (tuple) {
        UpdateFromValueOrReason(tuple.derivedPromise, p, tuple.onFulfilled, tuple.onRejected);
    });

    // TODO: test claim that this is not necessary by commenting it out.
    p._outstandingThens = [];
}

function UpdateFromValueOrReason(toUpdate, p, onFulfilled, onRejected) {
    assert((is_set(p._value) && !is_set(p._reason)) || (is_set(p._reason) && !is_set(p._value)));

    if (is_set(p._value)) {
        if (IsCallable(onFulfilled)) {
            CallHandler(toUpdate, onFulfilled, p._value);
        } else {
            toUpdate._value = p._value;
            ProcessOutstandingThens(toUpdate);
        }
    } else if (is_set(p._reason)) {
        if (IsCallable(onRejected)) {
            CallHandler(toUpdate, onRejected, p._reason);
        } else {
            toUpdate._reason = p._reason;
            ProcessOutstandingThens(toUpdate);
        }
    }
}

function CallHandler(returnedPromise, handler, argument) {
    QueueAMicrotask(function () {
        var v = UNSET;

        try {
            v = handler(argument);
        } catch (e) {
            Reject(returnedPromise, e);
        }

        if (is_set(v)) {
            Resolve(returnedPromise, v);
        }
    });
}

//////
// ES/environment functions

function IsObject(x) {
    return typeof x === "object" && x !== null;
}

function IsCallable(x) {
    return typeof x === "function";
}

function QueueAMicrotask(func) {
    // Whatever, same semantics. I don't want to break out the MutationObservers just for this. Don't test me though!
    // If you start asking stupid questions, I'll totally do it! I'll break out the MutationObservers!!
    setTimeout(function () {
        func();
    }, 0);
}

//////
// Internal helpers (for clarity)

function is_set(internalPropertyValue) {
    return internalPropertyValue !== UNSET;
}

//////
// Promises/A+ specification test adapter

function addThenMethod(specificationPromise) {
    specificationPromise.then = function (onFulfilled, onRejected) {
        return addThenMethod(Then(specificationPromise, onFulfilled, onRejected));
    };
    return specificationPromise;
}

exports.pending = function () {
    var promise = addThenMethod(new Promise());

    return {
        promise: promise,
        fulfill: function (value) {
            // NB: Promises/A+ tests never pass promises (or thenables) to the adapter's `fulfill` method, so using
            // `Resolve` is equivalent.
            Resolve(promise, value);
        },
        reject: function (reason) {
            Reject(promise, reason);
        }
    };
};
