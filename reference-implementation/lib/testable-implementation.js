"use strict";

var assert = require("especially/meta").assert;
var get_slot = require("especially/meta").get_slot;
var set_slot = require("especially/meta").set_slot;
var has_slot = require("especially/meta").has_slot;
var make_slots = require("especially/meta").make_slots;
var define_built_in_data_property = require("especially/meta").define_built_in_data_property;

var Type = require("especially/abstract-operations").Type;
var IsCallable = require("especially/abstract-operations").IsCallable;
var IsConstructor = require("especially/abstract-operations").IsConstructor;
var Get = require("especially/abstract-operations").Get;
var SameValue = require("especially/abstract-operations").SameValue;
var ArrayCreate = require("especially/abstract-operations").ArrayCreate;
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;
var GetIterator = require("especially/abstract-operations").GetIterator;
var IteratorStep = require("especially/abstract-operations").IteratorStep;
var IteratorValue = require("especially/abstract-operations").IteratorValue;
var Invoke = require("especially/abstract-operations").Invoke;
var atAtCreate = require("especially/well-known-symbols")["@@create"];

module.exports = Promise;

// ## Abstract Operations for Promise Objects

function GetDeferred(C) {
    if (IsConstructor(C) === false) {
        throw new TypeError("Tried to construct a promise from a non-constructor.");
    }

    let resolver = make_DeferredConstructionFunction();

    // Assume C has an ordinary [[Construct]]
    let promise = OrdinaryConstruct(C, [resolver]);

    let resolve = get_slot(resolver, "[[Resolve]]");

    if (IsCallable(resolve) === false) {
        throw new TypeError("Tried to construct a promise from a constructor which does not pass a callable resolve " +
                            "argument.");
    }

    let reject = get_slot(resolver, "[[Reject]]");

    if (IsCallable(reject) === false) {
        throw new TypeError("Tried to construct a promise from a constructor which does not pass a callable reject " +
                            "argument.");
    }

    return { "[[Promise]]": promise, "[[Resolve]]": resolve, "[[Reject]]": reject };
}

function IsPromise(x) {
    if (Type(x) !== "Object") {
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
    return TriggerPromiseReactions(reactions, reason);
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
    return TriggerPromiseReactions(reactions, resolution);
}

function TriggerPromiseReactions(reactions, argument) {
    reactions.forEach(function (reaction) {
        QueueMicrotask(Microtask_ExecutePromiseReaction, [reaction, argument]);
    });

    return;
}

function UpdateDeferredFromPotentialThenable(x, deferred) {
    if (Type(x) !== "Object") {
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
        set_slot(F, "[[Resolve]]", resolve);
        set_slot(F, "[[Reject]]", reject);
    };

    make_slots(F, ["[[Resolve]]", "[[Reject]]"]);

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

        return;
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
        let deferred = GetDeferred(C);
        let updateResult = UpdateDeferredFromPotentialThenable(x, deferred);
        if (updateResult !== "not a thenable") {
            return Invoke(deferred["[[Promise]]"], "then", [fulfillmentHandler, rejectionHandler]);
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

function Promise(resolver) {
    let promise = this;

    if (Type(promise) !== "Object") {
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

Object.defineProperty(Promise, atAtCreate, {
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

define_built_in_data_property(Promise, "all", function (iterable) {
    let C = this;
    let deferred = GetDeferred(C);

    let iterator;
    try {
        iterator = GetIterator(iterable);
    } catch (iteratorE) {
        return RejectIfAbrupt(iteratorE, deferred);
    }

    let values = ArrayCreate(0);
    let countdownHolder = { "[[Countdown]]": 0 };
    let index = 0;

    while(true) {
        let next;
        try {
            next = IteratorStep(iterator);
        } catch (nextE) {
            return RejectIfAbrupt(nextE, deferred);
        }

        if (next === false) {
            if (index === 0) {
                deferred["[[Resolve]]"].call(undefined, values);
            }
            return deferred["[[Promise]]"];
        }

        let nextValue;
        try {
            nextValue = IteratorValue(next);
        } catch (nextValueE) {
            return RejectIfAbrupt(nextValueE, deferred);
        }

        let nextPromise;
        try {
            nextPromise = Invoke(C, "cast", [nextValue]);
        } catch (nextPromiseE) {
            return RejectIfAbrupt(nextPromiseE, deferred);
        }

        let countdownFunction = make_PromiseDotAllCountdownFunction();
        set_slot(countdownFunction, "[[Index]]", index);
        set_slot(countdownFunction, "[[Values]]", values);
        set_slot(countdownFunction, "[[Deferred]]", deferred);
        set_slot(countdownFunction, "[[CountdownHolder]]", countdownHolder);

        try {
            Invoke(nextPromise, "then", [countdownFunction, deferred["[[Reject]]"]]);
        } catch (resultE) {
            return RejectIfAbrupt(resultE, deferred);
        }

        index = index + 1;
        countdownHolder["[[Countdown]]"] = countdownHolder["[[Countdown]]"] + 1;
    }
});

define_built_in_data_property(Promise, "resolve", function (x) {
    let C = this;
    let deferred = GetDeferred(C);
    deferred["[[Resolve]]"].call(undefined, x);
    return deferred["[[Promise]]"];
});

define_built_in_data_property(Promise, "reject", function (r) {
    let C = this;
    let deferred = GetDeferred(C);
    deferred["[[Reject]]"].call(undefined, r);
    return deferred["[[Promise]]"];
});

define_built_in_data_property(Promise, "cast", function (x) {
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

define_built_in_data_property(Promise, "race", function (iterable) {
    let C = this;
    let deferred = GetDeferred(C);

    let iterator;
    try {
        iterator = GetIterator(iterable);
    } catch (iteratorE) {
        return RejectIfAbrupt(iteratorE, deferred);
    }

    while (true) {
        let next;
        try {
            next = IteratorStep(iterator);
        } catch (nextE) {
            return RejectIfAbrupt(nextE, deferred);
        }

        if (next === false) {
            return deferred["[[Promise]]"];
        }

        let nextValue;
        try {
            nextValue = IteratorValue(next);
        } catch (nextValueE) {
            return RejectIfAbrupt(nextValueE, deferred);
        }

        let nextPromise;
        try {
            nextPromise = Invoke(C, "cast", [nextValue]);
        } catch (nextPromiseE) {
            return RejectIfAbrupt(nextPromiseE, deferred);
        }

        try {
            Invoke(nextPromise, "then", [deferred["[[Resolve]]"], deferred["[[Reject]]"]]);
        } catch (resultE) {
            RejectIfAbrupt(resultE, deferred);
        }
    }
});

define_built_in_data_property(Promise.prototype, "then", function (onFulfilled, onRejected) {
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

define_built_in_data_property(Promise.prototype, "catch", function (onRejected) {
    return Invoke(this, "then", [undefined, onRejected]);
});

// ## Deltas to Other Areas of hte Spec

function QueueMicrotask(microtask, argumentsList) {
    process.nextTick(function () {
        microtask.apply(undefined, argumentsList);
    });
}

function RejectIfAbrupt(argument, deferred) {
    // Usage: pass it exceptions; it only handles that case.
    // Always use `return` before it, i.e. `try { ... } catch (e) { return RejectIfAbrupt(e, deferred); }`.
    deferred["[[Reject]]"].call(undefined, argument);
    return deferred["[[Promise]]"];
}
