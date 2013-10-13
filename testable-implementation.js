"use strict";
let assert = require("assert");

// NOTE: This is not meant to be used by real code; it's used as a sanity check for the spec. If you were writing a
// polyfill there are much simpler and more performant ways. This implementation's focus is on 100% correctness in all
// subtle details.

// ## The ThenableCoercions Weak Map

let ThenableCoercions = new WeakMap();

// ## Abstract Operations for Promise Objects

function GetDeferred(C) {
    if (IsConstructor(C) === false) {
        throw new TypeError("Tried to construct a promise from a non-constructor.");
    }

    let resolve, reject;
    let resolver = function (firstArgument, secondArgument) {
        resolve = firstArgument;
        reject = secondArgument;
    };

    let promise = ES6New(C, resolver);

    if (IsPromise(promise) === false) {
        throw new TypeError("Tried to construct a promise but the constructor returned a non-promise.");
    }

    return { "[[Promise]]": promise, "[[Resolve]]": resolve, "[[Reject]]": reject };
}

function IsPromise(x) {
    return TypeIsObject(x) && has_slot(x, "[[IsPromise]]") && get_slot(x, "[[IsPromise]]") === true;
}

function IsResolved(p) {
    if (get_slot(p, "[[Following]]") !== undefined) {
        return true;
    }
    if (get_slot(p, "[[HasValue]]") === true) {
        return true;
    }
    if (get_slot(p, "[[HasReason]]") === true) {
        return true;
    }
    return false;
}

function PropagateToDerived(p) {
    assert((get_slot(p, "[[HasValue]]") === true && get_slot(p, "[[HasReason]]") === false) ||
           (get_slot(p, "[[HasValue]]") === false && get_slot(p, "[[HasReason]]") === true));

    let deriveds = get_slot(p, "[[Derived]]");

    deriveds.forEach(function (derived) {
        UpdateDerived(derived, p);
    });

    set_slot(p, "[[Derived]]", []);
}

function Reject(p, r) {
    if (IsResolved(p)) {
        return;
    }

    SetReason(p, r);
}

function SetReason(p, reason) {
    assert(get_slot(p, "[[HasValue]]") === false);
    assert(get_slot(p, "[[HasReason]]") === false);

    set_slot(p, "[[Reason]]", reason);
    set_slot(p, "[[HasReason]]", true);
    set_slot(p, "[[Following]]", undefined);

    return PropagateToDerived(p);
}

function SetValue(p, value) {
    assert(get_slot(p, "[[HasValue]]") === false);
    assert(get_slot(p, "[[HasReason]]") === false);

    set_slot(p, "[[Value]]", value);
    set_slot(p, "[[HasValue]]", true);
    set_slot(p, "[[Following]]", undefined);

    return PropagateToDerived(p);
}

function Then(p, onFulfilled, onRejected) {
    let following = get_slot(p, "[[Following]]");
    if (following !== undefined) {
        return Then(following, onFulfilled, onRejected);
    }

    let C = Get(p, "constructor");
    let deferred = GetDeferred(C);
    let returnedPromise = deferred["[[Promise]]"];
    let derived = {
        "[[DerivedPromise]]": returnedPromise,
        "[[OnFulfilled]]": onFulfilled,
        "[[OnRejected]]": onRejected
    };

    UpdateDerivedFromPromise(derived, p);

    return returnedPromise;
}

function ToPromise(C, x) {
    if (IsPromise(x) === true) {
        let constructor = get_slot(x, "[[PromiseConstructor]]");
        if (SameValue(constructor, C) === true) {
            return x;
        }
    }

    let deferred = GetDeferred(C);
    let resolve = deferred["[[Resolve]]"];
    if (IsCallable(resolve) === false) {
        throw new TypeError("ToPromise called on a constructor which does not pass a callable resolve argument.");
    }

    resolve.call(undefined, x);
    return deferred["[[Promise]]"];
}

//////
// Of dubious quality (not yet fine-tooth--combed).



function Resolve(p, x) {
    if (IsResolved(p)) {
        return;
    }

    if (IsPromise(x)) {
        if (SameValue(p, x)) {
            let selfResolutionError = new TypeError("Tried to resolve a promise with itself!");
            SetReason(p, selfResolutionError);
        } else if (get_slot(x, "[[Following]]") !== undefined) {
            set_slot(p, "[[Following]]", get_slot(x, "[[Following]]"));
            get_slot(get_slot(x, "[[Following]]"), "[[Derived]]").push({
                "[[DerivedPromise]]": p,
                "[[OnFulfilled]]": undefined,
                "[[OnRejected]]": undefined
            });
        } else if (get_slot(x, "[[HasValue]]") === true) {
            SetValue(p, get_slot(x, "[[Value]]"));
        } else if (get_slot(x, "[[HasReason]]") === true) {
            SetReason(p, get_slot(x, "[[Reason]]"));
        } else {
            set_slot(p, "[[Following]]", x);
            get_slot(x, "[[Derived]]").push({
                "[[DerivedPromise]]": p,
                "[[OnFulfilled]]": undefined,
                "[[OnRejected]]": undefined
            });
        }
    } else {
        SetValue(p, x);
    }
}

function UpdateDerived(derived, originator) {
    assert((get_slot(originator, "[[HasValue]]") === true && get_slot(originator, "[[HasReason]]") === false) ||
           (get_slot(originator, "[[HasValue]]") === false && get_slot(originator, "[[HasReason]]") === true));

    if (get_slot(originator, "[[HasValue]]") === true) {
        if (TypeIsObject(get_slot(originator, "[[Value]]"))) {
            QueueAMicrotask(function () {
                if (ThenableCoercions.has(get_slot(originator, "[[Value]]"))) {
                    let coercedAlready = ThenableCoercions.get(get_slot(originator, "[[Value]]"));
                    UpdateDerivedFromPromise(derived, coercedAlready);
                } else {
                    let then = UNSET;
                    try {
                        then = Get(get_slot(originator, "[[Value]]"), "then");
                    } catch (e) {
                        UpdateDerivedFromReason(derived, e);
                    }

                    if (then !== UNSET) {
                        if (IsCallable(then)) {
                            let coerced = CoerceThenable(get_slot(originator, "[[Value]]"), then);
                            UpdateDerivedFromPromise(derived, coerced);
                        } else {
                            UpdateDerivedFromValue(derived, get_slot(originator, "[[Value]]"));
                        }
                    }
                }
            });
        } else {
            UpdateDerivedFromValue(derived, get_slot(originator, "[[Value]]"));
        }
    } else {
        UpdateDerivedFromReason(derived, get_slot(originator, "[[Reason]]"));
    }
}

function UpdateDerivedFromValue(derived, value) {
    if (IsCallable(derived["[[OnFulfilled]]"])) {
        CallHandler(derived["[[DerivedPromise]]"], derived["[[OnFulfilled]]"], value);
    } else {
        SetValue(derived["[[DerivedPromise]]"], value);
    }
}

function UpdateDerivedFromReason(derived, reason) {
    if (IsCallable(derived["[[OnRejected]]"])) {
        CallHandler(derived["[[DerivedPromise]]"], derived["[[OnRejected]]"], reason);
    } else {
        SetReason(derived["[[DerivedPromise]]"], reason);
    }
}

function UpdateDerivedFromPromise(derived, promise) {
    if (get_slot(promise, "[[HasValue]]") === true || get_slot(promise, "[[HasReason]]") === true) {
        UpdateDerived(derived, promise);
    } else {
        get_slot(promise, "[[Derived]]").push(derived);
    }
}

function CoerceThenable(thenable, then) {
    // Missing assert: execution context stack is empty. Very hard to test; maybe could use `(new Error()).stack`?

    let p = PromiseCreate();

    let resolve = function (x) {
        Resolve(p, x);
    }
    let reject = function (r) {
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
        let v = UNSET;

        try {
            v = handler(argument);
        } catch (e) {
            Reject(derivedPromise, e);
        }

        if (v !== UNSET) {
            Resolve(derivedPromise, v);
        }
    });
}

// ## The Promise Constructor

// ### Promise

let PercentPromisePercent = Promise;

function Promise(resolver) {
    let promise = this;

    if (!TypeIsObject(promise)) {
        throw new TypeError("Promise constructor called on non-object");
    }

    if (!has_slot(promise, "[[IsPromise]]")) {
        throw new TypeError("Promise constructor called on an object not initialized as a promise.");
    }

    if (get_slot(promise, "[[IsPromise]]") !== undefined) {
        throw new TypeError("Promise constructor called on a promise that has already been constructed.");
    }

    return PromiseInitialise(promise, resolver);
}

// ### Abstract Operations for the Promise Constructor

function PromiseAlloc(constructor) {
    // This is basically OrdinaryCreateFromConstructor(...).
    let obj = Object.create(Promise.prototype);
    make_slots(obj, ["[[IsPromise]]", "[[PromiseConstructor]]", "[[Derived]]", "[[Following]]", "[[Value]]",
                     "[[HasValue]]", "[[Reason]]", "[[HasReason]]"]);

    set_slot(obj, "[[PromiseConstructor]]", constructor);

    return obj;
}

function PromiseInitialise(obj, resolver) {
    if (!IsCallable(resolver)) {
        throw new TypeError("Promise constructor called with non-callable resolver function");
    }

    set_slot(obj, "[[IsPromise]]", true);
    set_slot(obj, "[[Derived]]", []);
    set_slot(obj, "[[HasValue]]", false);
    set_slot(obj, "[[HasReason]]", false);

    let resolve = function (x) {
        Resolve(obj, x);
    };
    let reject = function (r) {
        Reject(obj, r);
    };

    try {
        resolver.call(undefined, resolve, reject);
    } catch (e) {
        Reject(obj, e);
    }

    return obj;
}

function PromiseCreate() {
    let obj = PromiseAlloc(PercentPromisePercent);
    let resolver = function () { };
    return PromiseInitialise(obj, resolver);
}

// ## Properties of the Promise constructor

Object.defineProperty(Promise, "@@create", {
    value: function () {
        let F = this;
        return PromiseAlloc(F);
    },
    writable: false,
    enumerable: false,
    configurable: true
});

define_method(Promise, "resolve", function (x) {
    let C = this;
    let deferred = GetDeferred(C);
    let resolve = deferred["[[Resolve]]"];
    if (IsCallable(resolve) === false) {
        throw new TypeError("Tried to construct a resolved promise from a constructor which does not pass a callable " +
                            "resolve argument.");
    }
    resolve.call(undefined, x);
    return deferred["[[Promise]]"];
});

define_method(Promise, "reject", function (r) {
    let C = this;
    let deferred = GetDeferred(C);
    let reject = deferred["[[Reject]]"];
    if (IsCallable(reject) === false) {
        throw new TypeError("Tried to construct a rejected promise from a constructor which does not pass a callable " +
                            "reject argument.");
    }
    reject.call(undefined, r);
    return deferred["[[Promise]]"];
});

define_method(Promise, "cast", function (x) {
    let C = this;
    return ToPromise(C, x);
});

define_method(Promise, "race", function (iterable) {
    let C = this;
    let deferred = GetDeferred(C);

    for (let nextValue of iterable) {
        let nextPromise = ToPromise(C, nextValue);
        Then(nextPromise, deferred["[[Resolve]]"], deferred["[[Reject]]"]);
    }

    return deferred["[[Promise]]"];
});

define_method(Promise, "all", function (iterable) {
    let C = this;
    let deferred = GetDeferred(C);

    let values = ArrayCreate(0);
    let countdown = 0;
    let index = 0;

    let resolve = deferred["[[Resolve]]"];
    if (IsCallable(resolve) === false) {
        throw new TypeError("Cannot perform the all operation on a promise constructor which does not pass a " +
                            "callable resolve argument.");
    }

    for (let nextValue of iterable) {
        let nextPromise = ToPromise(C, nextValue);
        let currentIndex = index;

        let onFulfilled = function (v) {
            Object.defineProperty(values, currentIndex, {
                value: v,
                writable: true,
                enumerable: true,
                configurable: true
            });
            countdown = countdown - 1;
            if (countdown === 0) {
                resolve.call(undefined, values);
            }
        };

        Then(nextPromise, onFulfilled, deferred["[[Reject]]"]);

        index = index + 1;
        countdown = countdown + 1;
    }

    if (index === 0) {
        resolve.call(undefined, values);
    }

    return deferred["[[Promise]]"];
});

define_method(Promise.prototype, "then", function (onFulfilled, onRejected) {
    return Then(this, onFulfilled, onRejected);
});

define_method(Promise.prototype, "catch", function (onRejected) {
    return this.then(undefined, onRejected);
});


//////
// ES/environment functions

function TypeIsObject(x) {
    return (typeof x === "object" && x !== null) || typeof x === "function";
}

function IsCallable(x) {
    return typeof x === "function";
}

function IsConstructor(x) {
    // The actual steps include testing whether `x` has a `[[Construct]]` internal method.
    // This is NOT possible to determine in pure JS, so this is just an approximation.
    return typeof x === "function";
}

function Get(obj, prop) {
    return obj[prop];
}

function SameValue(x, y) {
    return Object.is(x, y);
}

function ArrayCreate(n) {
    return new Array(n);
}

function QueueAMicrotask(func) {
    process.nextTick(function () {
        func();
    });
}

function ES6New(Constructor) {
    return Constructor.apply(Constructor["@@create"](), Array.prototype.slice.call(arguments, 1));
}

//////
// Internal helpers (for clarity)

let UNSET = {};

function define_method(object, methodName, method) {
    Object.defineProperty(object, methodName, {
        value: method,
        configurable: true,
        writable: true
    });
}

let internalDataProperties = new WeakMap();

// Using "slot" since it is shorter and since per recent es-discuss emails Allen will probably rename internal data
// property to slot, or similar.
function get_slot(obj, name) {
    assert(internalDataProperties.has(obj));
    assert(name in internalDataProperties.get(obj));

    return internalDataProperties.get(obj)[name];
}

function set_slot(obj, name, value) {
    assert(internalDataProperties.has(obj));
    assert(name in internalDataProperties.get(obj));

    internalDataProperties.get(obj)[name] = value;
}

function has_slot(obj, name) {
    return internalDataProperties.has(obj) && name in internalDataProperties.get(obj);
}

function make_slots(obj, names) {
    assert(!internalDataProperties.has(obj));

    let slots = Object.create(null);
    names.forEach(function (name) {
        slots[name] = undefined;
    });

    internalDataProperties.set(obj, slots);
}

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

exports.deferred = function () {
    let resolvePromise, rejectPromise;
    let promise = ES6New(Promise, function (resolve, reject) {
        resolvePromise = resolve;
        rejectPromise = reject;
    });

    return {
        promise: promise,
        resolve: resolvePromise,
        reject: rejectPromise
    };
};

exports.resolved = Promise.resolve.bind(Promise);

exports.rejected = Promise.reject.bind(Promise);

exports.Promise = Promise;
