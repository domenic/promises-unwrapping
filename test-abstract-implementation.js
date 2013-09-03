"use strict";
var assert = require("assert");

var UNSET = { "unset": "UNSET" };

// NOTE!!! This is not normal JavaScript; it's used as a sanity check for the spec. JavaScript promises do not work this
// way, e.g. they have methods instead of these capitalized functions! Do not use this for anything real!

var ThenableCoercions = new WeakMap();

function NewlyCreatedPromiseObject() {
    // The specs say "newly-created X object" to basically mean "`X[@@create]()`, or fall back to the default." We don't
    // want to re-create the entire @@create spec mechanism, but we can produce something more or less the same.
    var promise = Object.create(Promise.prototype);
    promise._isPromise = true;
    promise._following = UNSET;
    promise._value = UNSET;
    promise._reason = UNSET;
    promise._derived = [];
    return promise;
}

function IsPromise(x) {
    return IsObject(x) && x._isPromise;
}

function Resolve(p, x) {
    if (is_set(p._following) || is_set(p._value) || is_set(p._reason)) {
        return;
    }

    if (IsPromise(x)) {
        if (SameValue(p, x)) {
            var selfResolutionError = new TypeError("Tried to resolve a promise with itself!");
            SetReason(p, selfResolutionError);
        } else if (is_set(x._following)) {
            p._following = x._following;
            x._following._derived.push({ derivedPromise: p, onFulfilled: undefined, onRejected: undefined });
        } else if (is_set(x._value)) {
            SetValue(p, x._value);
        } else if (is_set(x._reason)) {
            SetReason(p, x._reason);
        } else {
            p._following = x;
            x._derived.push({ derivedPromise: p, onFulfilled: undefined, onRejected: undefined });
        }
    } else {
        SetValue(p, x);
    }
}

function Reject(p, r) {
    if (is_set(p._following) || is_set(p._value) || is_set(p._reason)) {
        return;
    }

    SetReason(p, r);
}

function Then(p, onFulfilled, onRejected) {
    if (is_set(p._following)) {
        return Then(p._following, onFulfilled, onRejected);
    } else {
        var q = NewlyCreatedPromiseObject();
        var derived = { derivedPromise: q, onFulfilled: onFulfilled, onRejected: onRejected };
        UpdateDerivedFromPromise(derived, p);
        return q;
    }
}

function PropagateToDerived(p) {
    assert((is_set(p._value) && !is_set(p._reason)) || (is_set(p._reason) && !is_set(p._value)));

    p._derived.forEach(function (derived) {
        UpdateDerived(derived, p);
    });

    // As per the note in the spec, this is not necessary, as we can verify by commenting it out.
    p._derived = [];
}

function UpdateDerived(derived, originator) {
    assert((is_set(originator._value) && !is_set(originator._reason)) || (is_set(originator._reason) && !is_set(originator._value)));

    if (is_set(originator._value)) {
        if (IsObject(originator._value)) {
            QueueAMicrotask(function () {
                if (ThenableCoercions.has(originator._value)) {
                    var coercedAlready = ThenableCoercions.get(originator._value);
                    UpdateDerivedFromPromise(derived, coercedAlready);
                } else {
                    var then = UNSET;
                    try {
                        then = originator._value.then;
                    } catch (e) {
                        UpdateDerivedFromReason(derived, e);
                    }

                    if (is_set(then)) {
                        if (typeof then === "function") {
                            var coerced = CoerceThenable(originator._value, then);
                            UpdateDerivedFromPromise(derived, coerced);
                        } else {
                            UpdateDerivedFromValue(derived, originator._value);
                        }
                    }
                }
            });
        } else {
            UpdateDerivedFromValue(derived, originator._value);
        }
    } else if (is_set(originator._reason)) {
        UpdateDerivedFromReason(derived, originator._reason);
    }
}

function UpdateDerivedFromValue(derived, value) {
    if (IsCallable(derived.onFulfilled)) {
        CallHandler(derived.derivedPromise, derived.onFulfilled, value);
    } else {
        SetValue(derived.derivedPromise, value);
    }
}

function UpdateDerivedFromReason(derived, reason) {
    if (IsCallable(derived.onRejected)) {
        CallHandler(derived.derivedPromise, derived.onRejected, reason);
    } else {
        SetReason(derived.derivedPromise, reason);
    }
}

function UpdateDerivedFromPromise(derived, promise) {
    if (is_set(promise._value) || is_set(promise._reason)) {
        UpdateDerived(derived, promise);
    } else {
        promise._derived.push(derived);
    }
}

function CoerceThenable(thenable, then) {
    // Missing assert: execution context stack is empty. Very hard to test; maybe could use `(new Error()).stack`?

    var p = NewlyCreatedPromiseObject();

    var resolve = function (x) {
        Resolve(p, x);
    }
    var reject = function (r) {
        Reject(p, r);
    }

    try {
        then.call(thenable, resolve, reject);
    } catch (e) {
        Reject(p, e);
    }

    ThenableCoercions.set(thenable, p);

    return p;
}

function CallHandler(derivedPromise, handler, argument) {
    QueueAMicrotask(function () {
        var v = UNSET;

        try {
            v = handler(argument);
        } catch (e) {
            Reject(derivedPromise, e);
        }

        if (is_set(v)) {
            Resolve(derivedPromise, v);
        }
    });
}

function SetValue(p, value) {
    assert(!is_set(p._value) && !is_set(p._reason));

    p._value = value;
    p._following = UNSET;
    PropagateToDerived(p);
}

function SetReason(p, reason) {
    assert(!is_set(p._value) && !is_set(p._reason));

    p._reason = reason;
    p._following = UNSET;
    PropagateToDerived(p);
}

//////
// ES/environment functions

function IsObject(x) {
    return (typeof x === "object" && x !== null) || typeof x === "function";
}

function IsCallable(x) {
    return typeof x === "function";
}

function SameValue(x, y) {
    return Object.is(x, y);
}

function QueueAMicrotask(func) {
    process.nextTick(function () {
        func();
    });
}

//////
// Internal helpers (for clarity)

function is_set(internalPropertyValue) {
    return internalPropertyValue !== UNSET;
}

function define_method(object, methodName, method) {
    Object.defineProperty(object, methodName, {
        value: method,
        configurable: true,
        writable: true
    });
}

//////
// ES manifestation

function Promise(resolver) {
    // Because we don't want to implement the whole @@create mechanism, this doesn't work quite the same as is specced;
    // we take a shortcut by using `NewlyCreatedPromiseObject`. But the result is roughly the same, modulo some
    // subtleties when it comes to subclassing and the like.

    if (!IsCallable(resolver)) {
        throw new TypeError("non-callable resolver function");
    }

    var promise = NewlyCreatedPromiseObject();
    var resolve = function (x) {
        Resolve(promise, x);
    };
    var reject = function (r) {
        Reject(promise, r);
    };

    try {
        resolver.call(undefined, resolve, reject);
    } catch (e) {
        Reject(promise, e);
    }

    return promise;
}

define_method(Promise.prototype, "then", function (onFulfilled, onRejected) {
    return Then(this, onFulfilled, onRejected);
});

define_method(Promise.prototype, "catch", function (onRejected) {
    return Then(this, undefined, onRejected);
});

//////
// Promises/A+ specification test adapter

// A `done` function is useful for tests, to ensure no assertion errors are ignored.
exports.done = function (promise, onFulfilled, onRejected) {
    promise.then(onFulfilled, onRejected).catch(function (reason) {
        process.nextTick(function () {
            throw reason;
        });
    });
};

exports.pending = function () {
    var resolvePromise, rejectPromise;
    var promise = new Promise(function (resolve, reject) {
        resolvePromise = resolve;
        rejectPromise = reject;
    });

    // NB: Promises/A+ tests never pass promises (or thenables) to the adapter's `fulfill` method, so using
    // `resolvePromise` is equivalent to some hypothetical fulfiller.
    return {
        promise: promise,
        fulfill: resolvePromise,
        reject: rejectPromise
    };
};
