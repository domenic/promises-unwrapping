"use strict";

let assert = require("especially/meta").assert;
let get_slot = require("especially/meta").get_slot;
let set_slot = require("especially/meta").set_slot;
let has_slot = require("especially/meta").has_slot;
let make_slots = require("especially/meta").make_slots;
let define_built_in_data_property = require("especially/meta").define_built_in_data_property;

let Type = require("especially/abstract-operations").Type;
let IsCallable = require("especially/abstract-operations").IsCallable;
let IsConstructor = require("especially/abstract-operations").IsConstructor;
let Get = require("especially/abstract-operations").Get;
let SameValue = require("especially/abstract-operations").SameValue;
let ArrayCreate = require("especially/abstract-operations").ArrayCreate;
let ToString = require("especially/abstract-operations").ToString;
var CreateDataProperty = require("especially/abstract-operations").CreateDataProperty;
let CreateFromConstructor = require("especially/abstract-operations").CreateFromConstructor;
let OrdinaryCreateFromConstructor = require("especially/abstract-operations").OrdinaryCreateFromConstructor;
let OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;
let GetIterator = require("especially/abstract-operations").GetIterator;
let IteratorStep = require("especially/abstract-operations").IteratorStep;
let IteratorValue = require("especially/abstract-operations").IteratorValue;
let Invoke = require("especially/abstract-operations").Invoke;
let EnqueueTask = require("especially/abstract-operations").EnqueueTask;
let atAtCreate = require("especially/well-known-symbols")["@@create"];

module.exports = Promise;

// ## Promise Abstract Operations

function IfAbruptRejectPromise(value, capability) {
    // Usage: pass it exceptions; it only handles that case.
    // Always use `return` before it, i.e. `try { ... } catch (e) { return IfAbruptRejectPromise(e, capability); }`.
    capability["[[Reject]]"].call(undefined, value);
    return capability["[[Promise]]"];
}

function CreateResolvingFunctions(promise) {
    let alreadyResolved = { "[[value]]": false };

    let reject = new_built_in_Promise_Reject_Function();
    set_slot(reject, "[[Promise]]", promise);
    set_slot(reject, "[[AlreadyResolved]]", alreadyResolved);

    let resolve = new_built_in_Promise_Resolve_Function();
    set_slot(resolve, "[[Promise]]", promise);
    set_slot(resolve, "[[AlreadyResolved]]", alreadyResolved);

    return { "[[Resolve]]": resolve, "[[Reject]]": reject };
}

function new_built_in_Promise_Reject_Function() {
    let F = function (reason) {
        assert(Type(get_slot(F, "[[Promise]]")) === "Object");
        let promise = get_slot(F, "[[Promise]]");

        let alreadyResolved = get_slot(F, "[[AlreadyResolved]]");
        if (alreadyResolved["[[value]]"] === true) {
            return undefined;
        }
        alreadyResolved["[[value]]"] = true;

        RejectPromise(promise, reason);
    };

    make_slots(F, ["[[Promise]]", "[[AlreadyResolved]]"]);

    return F;
}

function new_built_in_Promise_Resolve_Function() {
    let F = function (resolution) {
        assert(Type(get_slot(F, "[[Promise]]")) === "Object");
        let promise = get_slot(F, "[[Promise]]");

        let alreadyResolved = get_slot(F, "[[AlreadyResolved]]");
        if (alreadyResolved["[[value]]"] === true) {
            return undefined;
        }
        alreadyResolved["[[value]]"] = true;

        if (SameValue(resolution, promise) === true) {
            let selfResolutionError = new TypeError("Tried to resolve a promise with itself!");
            return RejectPromise(promise, selfResolutionError);
        }

        if (Type(resolution) !== "Object") {
            return FulfillPromise(promise, resolution);
        }

        let then;
        try {
            then = Get(resolution, "then");
        } catch (thenE) {
            return RejectPromise(promise, thenE);
        }

        if (IsCallable(then) === false) {
            return FulfillPromise(promise, resolution);
        }

        EnqueueTask("PromiseTasks", ResolvePromiseViaThenableTask, [promise, resolution, then]);

        return undefined;
    };

    make_slots(F, ["[[Promise]]", "[[AlreadyResolved]]"]);

    return F;
}

function FulfillPromise(promise, value) {
    assert(get_slot(promise, "[[PromiseState]]") === "pending");

    let reactions = get_slot(promise, "[[PromiseFulfillReactions]]");
    set_slot(promise, "[[PromiseResult]]", value);
    set_slot(promise, "[[PromiseFulfillReactions]]", undefined);
    set_slot(promise, "[[PromiseRejectReactions]]", undefined);
    set_slot(promise, "[[PromiseState]]", "fulfilled");
    return TriggerPromiseReactions(reactions, value);
}

function NewPromiseCapability(C) {
    if (IsConstructor(C) === false) {
        throw new TypeError("Tried to construct a promise from a non-constructor.");
    }

    let promise = CreateFromConstructor(C);

    if (Type(promise) !== "Object") {
        throw new TypeError("Non-object created via supposed promise constructor.");
    }

    return CreatePromiseCapabilityRecord(promise, C);
}

function CreatePromiseCapabilityRecord(promise, constructor) {
    let promiseCapability = { "[[Promise]]": promise, "[[Resolve]]": undefined, "[[Reject]]": undefined };
    let executor = new_built_in_GetCapabilitiesExecutor_Function();
    set_slot(executor, "[[Capability]]", promiseCapability);

    let constructorResult = constructor.call(promise, executor);

    if (IsCallable(promiseCapability["[[Resolve]]"]) === false) {
        throw new TypeError("Tried to construct a promise from a constructor which does not pass a callable resolve " +
                            "argument.");
    }

    if (IsCallable(promiseCapability["[[Reject]]"]) === false) {
        throw new TypeError("Tried to construct a promise from a constructor which does not pass a callable reject " +
                            "argument.");
    }

    if (Type(constructorResult) === "Object" && SameValue(promise, constructorResult) === false) {
        throw new TypeError("Inconsistent result from constructing the promise.");
    }

    return promiseCapability;
}

function new_built_in_GetCapabilitiesExecutor_Function() {
    let F = function (resolve, reject) {
        assert(has_slot(F, "[[Capability]]"));
        let promiseCapability = get_slot(F, "[[Capability]]");

        if (promiseCapability["[[Resolve]]"] !== undefined) {
            throw new TypeError("Re-entrant call to get capabilities executor function");
        }

        if (promiseCapability["[[Reject]]"] !== undefined) {
            throw new TypeError("Re-entrant call to get capabilities executor function");
        }

        promiseCapability["[[Resolve]]"] = resolve;
        promiseCapability["[[Reject]]"] = reject;
        return undefined;
    };

    make_slots(F, ["[[Capability]]"]);

    return F;
}

function RejectPromise(promise, reason) {
    assert(get_slot(promise, "[[PromiseState]]") === "pending");

    let reactions = get_slot(promise, "[[PromiseRejectReactions]]");
    set_slot(promise, "[[PromiseResult]]", reason);
    set_slot(promise, "[[PromiseFulfillReactions]]", undefined);
    set_slot(promise, "[[PromiseRejectReactions]]", undefined);
    set_slot(promise, "[[PromiseState]]", "rejected");
    return TriggerPromiseReactions(reactions, reason);
}

function IsPromise(x) {
    if (Type(x) !== "Object") {
        return false;
    }

    if (!has_slot(x, "[[PromiseState]]")) {
        return false;
    }

    if (get_slot(x, "[[PromiseState]]") === undefined) {
        return false;
    }

    return true;
}

function TriggerPromiseReactions(reactions, argument) {
    reactions.forEach(function (reaction) {
        EnqueueTask("PromiseTasks", PromiseReactionTask, [reaction, argument]);
    });

    return undefined;
}

// ## Promise Tasks

function PromiseReactionTask(reaction, argument) {
    assert("[[Capabilities]]" in reaction && "[[Handler]]" in reaction);

    let promiseCapability = reaction["[[Capabilities]]"];
    let handler = reaction["[[Handler]]"];

    let handlerResult;
    try {
        if (handler === "Identity") {
            handlerResult = argument;
        } else if (handler === "Thrower") {
            throw argument;
        } else {
            assert(IsCallable(handler) === true);
            handlerResult = handler.call(undefined, argument);
        }
    } catch (handlerResultE) {
        let status = promiseCapability["[[Reject]]"].call(undefined, handlerResultE);
        return status;
    }

    let status = promiseCapability["[[Resolve]]"].call(undefined, handlerResult);
    return status;
}

function ResolvePromiseViaThenableTask(promiseToResolve, thenable, then) {
    let resolvingFunctions = CreateResolvingFunctions(promiseToResolve);

    try {
        return then.call(thenable, resolvingFunctions["[[Resolve]]"], resolvingFunctions["[[Reject]]"]);
    } catch (thenCallResultE) {
        return resolvingFunctions["[[Reject]]"].call(undefined, thenCallResultE);
    }
}

// ## The Promise Constructor

// ### Promise

function Promise(executor) {
    let promise = this;

    if (Type(promise) !== "Object") {
        throw new TypeError("Promise constructor called on non-object");
    }

    if (!has_slot(promise, "[[PromiseState]]")) {
        throw new TypeError("Promise constructor called on an object not initialized as a promise.");
    }

    if (get_slot(promise, "[[PromiseState]]") !== undefined) {
        throw new TypeError("Promise constructor called on a promise that has already been constructed.");
    }

    if (!IsCallable(executor)) {
        throw new TypeError("Promise constructor called with non-callable executor function");
    }

    return InitialisePromise(promise, executor);
}

function InitialisePromise(promise, executor) {
    assert(get_slot(promise, "[[PromiseState]]") === undefined);
    assert(IsCallable(executor) === true);

    set_slot(promise, "[[PromiseState]]", "pending");
    set_slot(promise, "[[PromiseFulfillReactions]]", []);
    set_slot(promise, "[[PromiseRejectReactions]]", []);

    let resolvingFunctions = CreateResolvingFunctions(promise);

    try {
        executor.call(undefined, resolvingFunctions["[[Resolve]]"], resolvingFunctions["[[Reject]]"]);
    } catch (completionE) {
        resolvingFunctions["[[Reject]]"].call(undefined, completionE);
    }

    return promise;
}

// ## Properties of the Promise Constructor

define_built_in_data_property(Promise, "all", function (iterable) {
    let C = this;
    let promiseCapability = NewPromiseCapability(C);

    let iterator;
    try {
        iterator = GetIterator(iterable);
    } catch (iteratorE) {
        return IfAbruptRejectPromise(iteratorE, promiseCapability);
    }

    let values = ArrayCreate(0);
    let remainingElementsCount = { "[[value]]": 1 };
    let index = 0;

    while(true) {
        let next;
        try {
            next = IteratorStep(iterator);
        } catch (nextE) {
            return IfAbruptRejectPromise(nextE, promiseCapability);
        }

        if (next === false) {
            remainingElementsCount["[[value]]"] = remainingElementsCount["[[value]]"] - 1;
            if (remainingElementsCount["[[value]]"] === 0) {
                promiseCapability["[[Resolve]]"].call(undefined, values);
            }

            return promiseCapability["[[Promise]]"];
        }

        let nextValue;
        try {
            nextValue = IteratorValue(next);
        } catch (nextValueE) {
            return IfAbruptRejectPromise(nextValueE, promiseCapability);
        }

        let nextPromise;
        try {
            nextPromise = Invoke(C, "resolve", [nextValue]);
        } catch (nextPromiseE) {
            return IfAbruptRejectPromise(nextPromiseE, promiseCapability);
        }

        let resolveElement = new_built_in_PromiseDotAllResolveElement_Function();
        set_slot(resolveElement, "[[AlreadyCalled]]", false);
        set_slot(resolveElement, "[[Index]]", index);
        set_slot(resolveElement, "[[Values]]", values);
        set_slot(resolveElement, "[[Capabilities]]", promiseCapability);
        set_slot(resolveElement, "[[RemainingElements]]", remainingElementsCount);

        remainingElementsCount["[[value]]"] = remainingElementsCount["[[value]]"] + 1;

        try {
            Invoke(nextPromise, "then", [resolveElement, promiseCapability["[[Reject]]"]]);
        } catch (resultE) {
            return IfAbruptRejectPromise(resultE, promiseCapability);
        }

        index = index + 1;
    }
});

function new_built_in_PromiseDotAllResolveElement_Function() {
    let F = function (x) {
        if (get_slot(F, "[[AlreadyCalled]]") === true) {
            return undefined;
        }
        set_slot(F, "[[AlreadyCalled]]", true);

        let index = get_slot(F, "[[Index]]");
        let values = get_slot(F, "[[Values]]");
        let promiseCapability = get_slot(F, "[[Capabilities]]");
        let remainingElementsCount = get_slot(F, "[[RemainingElements]]");

        try {
            CreateDataProperty(values, ToString(index), x);
        } catch (resultE) {
            return IfAbruptRejectPromise(resultE, promiseCapability);
        }

        remainingElementsCount["[[value]]"] = remainingElementsCount["[[value]]"] - 1;

        if (remainingElementsCount["[[value]]"] === 0) {
            return promiseCapability["[[Resolve]]"].call(undefined, values);
        }

        return undefined;
    };

    make_slots(F, ["[[Index]]", "[[Values]]", "[[Capabilities]]", "[[RemainingElements]]", "[[AlreadyCalled]]"]);

    return F;
}

define_built_in_data_property(Promise, "race", function (iterable) {
    let C = this;
    let promiseCapability = NewPromiseCapability(C);

    let iterator;
    try {
        iterator = GetIterator(iterable);
    } catch (iteratorE) {
        return IfAbruptRejectPromise(iteratorE, promiseCapability);
    }

    while (true) {
        let next;
        try {
            next = IteratorStep(iterator);
        } catch (nextE) {
            return IfAbruptRejectPromise(nextE, promiseCapability);
        }

        if (next === false) {
            return promiseCapability["[[Promise]]"];
        }

        let nextValue;
        try {
            nextValue = IteratorValue(next);
        } catch (nextValueE) {
            return IfAbruptRejectPromise(nextValueE, promiseCapability);
        }

        let nextPromise;
        try {
            nextPromise = Invoke(C, "resolve", [nextValue]);
        } catch (nextPromiseE) {
            return IfAbruptRejectPromise(nextPromiseE, promiseCapability);
        }

        try {
            Invoke(nextPromise, "then", [promiseCapability["[[Resolve]]"], promiseCapability["[[Reject]]"]]);
        } catch (resultE) {
            IfAbruptRejectPromise(resultE, promiseCapability);
        }
    }
});

define_built_in_data_property(Promise, "reject", function (r) {
    let C = this;
    let promiseCapability = NewPromiseCapability(C);
    promiseCapability["[[Reject]]"].call(undefined, r);
    return promiseCapability["[[Promise]]"];
});

define_built_in_data_property(Promise, "resolve", function (x) {
    let C = this;
    if (IsPromise(x) === true) {
        let constructor = get_slot(x, "[[PromiseConstructor]]");
        if (SameValue(constructor, C) === true) {
            return x;
        }
    }
    let promiseCapability = NewPromiseCapability(C);
    promiseCapability["[[Resolve]]"].call(undefined, x);
    return promiseCapability["[[Promise]]"];
});

Object.defineProperty(Promise, atAtCreate, {
    value: function () {
        let F = this;
        return AllocatePromise(F);
    },
    writable: false,
    enumerable: false,
    configurable: true
});

function AllocatePromise(constructor) {
    let obj = OrdinaryCreateFromConstructor(constructor, "%PromisePrototype%",
                                            ["[[PromiseState]]", "[[PromiseConstructor]]", "[[PromiseResult]]",
                                             "[[PromiseFulfillReactions]]", "[[PromiseRejectReactions]]"]);

    set_slot(obj, "[[PromiseConstructor]]", constructor);

    return obj;
}

// ## Properties of the Promise Prototype Object

define_built_in_data_property(Promise.prototype, "catch", function (onRejected) {
    let promise = this;
    return Invoke(promise, "then", [undefined, onRejected]);
});

define_built_in_data_property(Promise.prototype, "then", function (onFulfilled, onRejected) {
    let promise = this;
    if (IsPromise(promise) === false) {
        throw new TypeError("Promise.prototype.then called on a non-promise.");
    }

    if (IsCallable(onFulfilled) === false) {
        onFulfilled = "Identity";
    }

    if (IsCallable(onRejected) === false) {
        onRejected = "Thrower";
    }

    let C = Get(promise, "constructor");
    let promiseCapability = NewPromiseCapability(C);

    let fulfillReaction = { "[[Capabilities]]": promiseCapability, "[[Handler]]": onFulfilled };
    let rejectReaction = { "[[Capabilities]]": promiseCapability, "[[Handler]]": onRejected };

    if (get_slot(promise, "[[PromiseState]]") === "pending") {
        get_slot(promise, "[[PromiseFulfillReactions]]").push(fulfillReaction);
        get_slot(promise, "[[PromiseRejectReactions]]").push(rejectReaction);
    } else if (get_slot(promise, "[[PromiseState]]") === "fulfilled") {
        let value = get_slot(promise, "[[PromiseResult]]");
        EnqueueTask("PromiseTasks", PromiseReactionTask, [fulfillReaction, value]);
    } else if (get_slot(promise, "[[PromiseState]]") === "rejected") {
        let reason = get_slot(promise, "[[PromiseResult]]");
        EnqueueTask("PromiseTasks", PromiseReactionTask, [rejectReaction, reason]);
    }

    return promiseCapability["[[Promise]]"];
});


// ## Deltas to Other Areas of the Spec

require("especially/intrinsics")["%Promise%"] = Promise;
require("especially/intrinsics")["%PromisePrototype%"] = Promise.prototype;
