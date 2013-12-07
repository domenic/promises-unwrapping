"use strict";
let assert = require("assert");

// NOTE: This is not meant to be used by real code; it's used as a sanity check for the spec. If you were writing a
// polyfill there are much simpler and more performant ways. This implementation's focus is on 100% correctness in all
// subtle details.

// ## Abstract Operations for Promise Objects

function GetDeferred(C) {
    if (IsConstructor(C) === false) {
        throw new TypeError("Tried to construct a promise from a non-constructor.");
    }

    let deferred = { "[[Promise]]": undefined, "[[Resolve]]": undefined, "[[Reject]]": undefined };

    let resolver = make_DeferredConstructionFunction();

    set_slot(resolver, "[[Deferred]]", deferred);

    let promise = ES6New(C, resolver);

    if (IsCallable(deferred["[[Resolve]]"]) === false) {
        throw new TypeError("Tried to construct a promise from a constructor which does not pass a callable resolve " +
                            "argument.");
    }

    if (IsCallable(deferred["[[Reject]]"]) === false) {
        throw new TypeError("Tried to construct a promise from a constructor which does not pass a callable reject " +
                            "argument.");
    }

    deferred["[[Promise]]"] = promise;

    return deferred;
}

function IsPromise(x) {
    if (!TypeIsObject(x)) {
        return false;
    }

    if (!has_slot(x, "[[PromiseStatus]]")) {
        return false;
    }

    if (get_slot(x, "[[PromiseStatus]]") === undefined) {
        return false;
    }

    return true;
}

function PromiseReject(promise, reason) {
    if (get_slot(promise, "[[PromiseStatus]]") !== "pending") {
        return;
    }

    let reactions = get_slot(promise, "[[RejectReactions]]");
    set_slot(promise, "[[Result]]", reason);
    set_slot(promise, "[[ResolveReactions]]", undefined);
    set_slot(promise, "[[RejectReactions]]", undefined);
    set_slot(promise, "[[PromiseStatus]]", "has-rejection");
    TriggerPromiseReactions(reactions, reason);
}

function PromiseResolve(promise, resolution) {
    if (get_slot(promise, "[[PromiseStatus]]") !== "pending") {
        return;
    }

    let reactions = get_slot(promise, "[[ResolveReactions]]");
    set_slot(promise, "[[Result]]", resolution);
    set_slot(promise, "[[ResolveReactions]]", undefined);
    set_slot(promise, "[[RejectReactions]]", undefined);
    set_slot(promise, "[[PromiseStatus]]", "has-resolution");
    TriggerPromiseReactions(reactions, resolution);
}

function TriggerPromiseReactions(reactions, argument) {
    reactions.forEach(function (reaction) {
        QueueMicrotask(Microtask_ExecutePromiseReaction, [reaction, argument]);
    });
}

function UpdateDeferredFromPotentialThenable(x, deferred) {
    if (!TypeIsObject(x)) {
        return "not a thenable";
    }

    let then;
    try {
        then = Get(x, "then");
    } catch (thenE) {
        deferred["[[Reject]]"].call(undefined, thenE);
        return;
    }

    if (IsCallable(then) === false) {
        return "not a thenable";
    }

    try {
        then.call(x, deferred["[[Resolve]]"], deferred["[[Reject]]"]);
    } catch (thenCallResultE) {
        deferred["[[Reject]]"].call(undefined, thenCallResultE);
    }
}

// ## Built-in Functions for Promise Objects

function make_DeferredConstructionFunction() {
    let F = function (resolve, reject) {
        let deferred = get_slot(F, "[[Deferred]]");

        deferred["[[Resolve]]"] = resolve;
        deferred["[[Reject]]"] = reject;
    };

    make_slots(F, ["[[Deferred]]"]);

    return F;
}

function make_IdentityFunction() {
    return function (x) {
        return x;
    };
}

function make_PromiseDotAllCountdownFunction() {
    let F = function (x) {
        let index = get_slot(F, "[[Index]]");
        let values = get_slot(F, "[[Values]]");
        let deferred = get_slot(F, "[[Deferred]]");
        let countdownHolder = get_slot(F, "[[CountdownHolder]]");

        try {
            Object.defineProperty(values, index, {
                value: x,
                writable: true,
                enumerable: true,
                configurable: true
            });
        } catch (resultE) {
            return RejectIfAbrupt(resultE, deferred);
        }

        countdownHolder["[[Countdown]]"] = countdownHolder["[[Countdown]]"] - 1;

        if (countdownHolder["[[Countdown]]"] === 0) {
            return deferred["[[Resolve]]"].call(undefined, values);
        }
    };

    make_slots(F, ["[[Index]]", "[[Values]]", "[[Deferred]]", "[[CountdownHolder]]"]);

    return F;
}

function make_PromiseResolutionHandlerFunction() {
    let F = function (x) {
        let promise = get_slot(F, "[[Promise]]");
        let fulfillmentHandler = get_slot(F, "[[FulfillmentHandler]]");
        let rejectionHandler = get_slot(F, "[[RejectionHandler]]");

        if (SameValue(x, promise) === true) {
            let selfResolutionError = new TypeError("Tried to resolve a promise with itself!");
            return rejectionHandler.call(undefined, selfResolutionError);
        }

        let C = get_slot(promise, "[[PromiseConstructor]]");

        if (IsPromise(x)) {
            let xConstructor = get_slot(x, "[[PromiseConstructor]]");
            if (SameValue(xConstructor, C) === true) {
                return x.then(fulfillmentHandler, rejectionHandler);
            }
        }

        let deferred = GetDeferred(C);
        let updateResult = UpdateDeferredFromPotentialThenable(x, deferred);
        if (updateResult !== "not a thenable") {
            return deferred["[[Promise]]"].then(fulfillmentHandler, rejectionHandler);
        }
        return fulfillmentHandler.call(undefined, x);
    };

    make_slots(F, ["[[Promise]]", "[[FulfillmentHandler]]", "[[RejectionHandler]]"]);

    return F;
}

function make_RejectPromiseFunction() {
    let F = function (reason) {
        let promise = get_slot(F, "[[Promise]]");

        return PromiseReject(promise, reason);
    };

    make_slots(F, ["[[Promise]]"]);

    return F;
}

function make_ResolvePromiseFunction() {
    let F = function (resolution) {
        let promise = get_slot(F, "[[Promise]]");

        return PromiseResolve(promise, resolution);
    };

    make_slots(F, ["[[Promise]]"]);

    return F;
}

function make_ThrowerFunction() {
    return function (e) {
        throw e;
    };
}

// ## Microtasks for Promise Objects

function Microtask_ExecutePromiseReaction(reaction, argument) {
    let deferred = reaction["[[Deferred]]"];
    let handler = reaction["[[Handler]]"];

    let handlerResult;
    try {
        handlerResult = handler.call(undefined, argument);
    } catch (handlerResultE) {
        return deferred["[[Reject]]"].call(undefined, handlerResultE);
    }

    if (SameValue(handlerResult, deferred["[[Promise]]"]) === true) {
        let selfResolutionError = new TypeError("Tried to resolve a promise with itself!");
        return deferred["[[Reject]]"].call(undefined, selfResolutionError);
    }

    let updateResult = UpdateDeferredFromPotentialThenable(handlerResult, deferred);
    if (updateResult === "not a thenable") {
        return deferred["[[Resolve]]"].call(undefined, handlerResult);
    }
}

// ## The Promise Constructor

// ### Promise

let PercentPromisePercent = Promise;

function Promise(resolver) {
    let promise = this;

    if (!TypeIsObject(promise)) {
        throw new TypeError("Promise constructor called on non-object");
    }

    if (!has_slot(promise, "[[PromiseStatus]]")) {
        throw new TypeError("Promise constructor called on an object not initialized as a promise.");
    }

    if (get_slot(promise, "[[PromiseStatus]]") !== undefined) {
        throw new TypeError("Promise constructor called on a promise that has already been constructed.");
    }

    if (!IsCallable(resolver)) {
        throw new TypeError("Promise constructor called with non-callable resolver function");
    }

    set_slot(promise, "[[PromiseStatus]]", "pending");
    set_slot(promise, "[[ResolveReactions]]", []);
    set_slot(promise, "[[RejectReactions]]", []);

    let resolve = make_ResolvePromiseFunction();
    set_slot(resolve, "[[Promise]]", promise);

    let reject = make_RejectPromiseFunction();
    set_slot(reject, "[[Promise]]", promise);

    try {
        resolver.call(undefined, resolve, reject);
    } catch (e) {
        PromiseReject(promise, e);
    }

    return promise;
}

// ## Properties of the Promise constructor

Object.defineProperty(Promise, "@@create", {
    value: function () {
        let F = this;

        // This is basically OrdinaryCreateFromConstructor(...).
        let obj = Object.create(Promise.prototype);

        make_slots(obj, ["[[PromiseStatus]]", "[[PromiseConstructor]]", "[[Result]]",  "[[ResolveReactions]]",
                         "[[RejectReactions]]"]);

        set_slot(obj, "[[PromiseConstructor]]", F);

        return obj;
    },
    writable: false,
    enumerable: false,
    configurable: true
});

define_method(Promise, "all", function (iterable) {
    let C = this;
    let deferred = GetDeferred(C);

    let values = ArrayCreate(0);
    let countdownHolder = { "[[Countdown]]": 0 };
    let index = 0;

    for (let nextValue of iterable) {
        let nextPromise = C.cast(nextValue);

        let countdownFunction = make_PromiseDotAllCountdownFunction();
        set_slot(countdownFunction, "[[Index]]", index);
        set_slot(countdownFunction, "[[Values]]", values);
        set_slot(countdownFunction, "[[Deferred]]", deferred);
        set_slot(countdownFunction, "[[CountdownHolder]]", countdownHolder);

        nextPromise.then(countdownFunction, deferred["[[Reject]]"]);

        index = index + 1;
        countdownHolder["[[Countdown]]"] = countdownHolder["[[Countdown]]"] + 1;
    }

    if (index === 0) {
        deferred["[[Resolve]]"].call(undefined, values);
    }

    return deferred["[[Promise]]"];
});

define_method(Promise, "resolve", function (x) {
    let C = this;
    let deferred = GetDeferred(C);
    deferred["[[Resolve]]"].call(undefined, x);
    return deferred["[[Promise]]"];
});

define_method(Promise, "reject", function (r) {
    let C = this;
    let deferred = GetDeferred(C);
    deferred["[[Reject]]"].call(undefined, r);
    return deferred["[[Promise]]"];
});

define_method(Promise, "cast", function (x) {
    let C = this;
    if (IsPromise(x) === true) {
        let constructor = get_slot(x, "[[PromiseConstructor]]");
        if (SameValue(constructor, C) === true) {
            return x;
        }
    }
    let deferred = GetDeferred(C);
    deferred["[[Resolve]]"].call(undefined, x);
    return deferred["[[Promise]]"];
});

define_method(Promise, "race", function (iterable) {
    let C = this;
    let deferred = GetDeferred(C);

    for (let nextValue of iterable) {
        let nextPromise = C.cast(nextValue);
        nextPromise.then(deferred["[[Resolve]]"], deferred["[[Reject]]"]);
    }

    return deferred["[[Promise]]"];
});

define_method(Promise.prototype, "then", function (onFulfilled, onRejected) {
    let promise = this;
    let C = Get(promise, "constructor");
    let deferred = GetDeferred(C);

    let rejectionHandler = make_ThrowerFunction();
    if (IsCallable(onRejected)) {
        rejectionHandler = onRejected;
    }

    let fulfillmentHandler = make_IdentityFunction();
    if (IsCallable(onFulfilled)) {
        fulfillmentHandler = onFulfilled;
    }
    let resolutionHandler = make_PromiseResolutionHandlerFunction();
    set_slot(resolutionHandler, "[[Promise]]", promise);
    set_slot(resolutionHandler, "[[FulfillmentHandler]]", fulfillmentHandler);
    set_slot(resolutionHandler, "[[RejectionHandler]]", rejectionHandler);

    let resolutionReaction = { "[[Deferred]]": deferred, "[[Handler]]": resolutionHandler };
    let rejectionReaction = { "[[Deferred]]": deferred, "[[Handler]]": rejectionHandler };

    if (get_slot(promise, "[[PromiseStatus]]") === "pending") {
        get_slot(promise, "[[ResolveReactions]]").push(resolutionReaction);
        get_slot(promise, "[[RejectReactions]]").push(rejectionReaction);
    }

    if (get_slot(promise, "[[PromiseStatus]]") === "has-resolution") {
        let resolution = get_slot(promise, "[[Result]]");
        QueueMicrotask(Microtask_ExecutePromiseReaction, [resolutionReaction, resolution]);
    }

    if (get_slot(promise, "[[PromiseStatus]]") === "has-rejection") {
        let reason = get_slot(promise, "[[Result]]");
        QueueMicrotask(Microtask_ExecutePromiseReaction, [rejectionReaction, reason]);
    }

    return deferred["[[Promise]]"];
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

function QueueMicrotask(microtask, argumentsList) {
    process.nextTick(function () {
        microtask.apply(undefined, argumentsList);
    });
}

function ES6New(Constructor) {
    return Constructor.apply(Constructor["@@create"](), Array.prototype.slice.call(arguments, 1));
}

function RejectIfAbrupt(argument, deferred) {
    // Usage: pass it exceptions; it only handles that case.
    // Always use `return` before it, i.e. `try { ... } catch (e) { return RejectIfAbrupt(e, deferred); }`.
    deferred["[[Reject]]"].call(undefined, argument);
    return deferred["[[Promise]]"];
}

//////
// Internal helpers (for clarity)

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
