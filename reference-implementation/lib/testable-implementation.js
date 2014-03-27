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

function CreateRejectFunction(promise) {
    let reject = new_built_in_Promise_Reject_Function();
    set_slot(reject, "[[Promise]]", promise);
    return reject;
}

function new_built_in_Promise_Reject_Function() {
    let F = function (reason) {
        assert(Type(get_slot(F, "[[Promise]]")) === "Object");
        let promise = get_slot(F, "[[Promise]]");

        if (get_slot(promise, "[[PromiseStatus]]") !== "unresolved") {
            return undefined;
        }

        let reactions = get_slot(promise, "[[PromiseRejectReactions]]");
        set_slot(promise, "[[PromiseResult]]", reason);
        set_slot(promise, "[[PromiseResolveReactions]]", undefined);
        set_slot(promise, "[[PromiseRejectReactions]]", undefined);
        set_slot(promise, "[[PromiseStatus]]", "has-rejection");
        return TriggerPromiseReactions(reactions, reason);
    };

    make_slots(F, ["[[Promise]]"]);

    return F;
}

function CreateResolveFunction(promise) {
    let resolve = new_built_in_Promise_Resolve_Function();
    set_slot(resolve, "[[Promise]]", promise);
    return resolve;
}

function new_built_in_Promise_Resolve_Function() {
    let F = function (resolution) {
        assert(Type(get_slot(F, "[[Promise]]")) === "Object");
        let promise = get_slot(F, "[[Promise]]");

        if (get_slot(promise, "[[PromiseStatus]]") !== "unresolved") {
            return undefined;
        }

        let reactions = get_slot(promise, "[[PromiseResolveReactions]]");
        set_slot(promise, "[[PromiseResult]]", resolution);
        set_slot(promise, "[[PromiseResolveReactions]]", undefined);
        set_slot(promise, "[[PromiseRejectReactions]]", undefined);
        set_slot(promise, "[[PromiseStatus]]", "has-resolution");
        return TriggerPromiseReactions(reactions, resolution);
    };

    make_slots(F, ["[[Promise]]"]);

    return F;
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

function TriggerPromiseReactions(reactions, argument) {
    reactions.forEach(function (reaction) {
        EnqueueTask("PromiseTasks", PromiseReactionTask, [reaction, argument]);
    });

    return undefined;
}

function UpdateDeferredFromPotentialThenable(x, promiseCapability) {
    if (Type(x) !== "Object") {
        return "not a thenable";
    }

    let then;
    try {
        then = Get(x, "then");
    } catch (thenE) {
        promiseCapability["[[Reject]]"].call(undefined, thenE);
        return null;
    }

    if (IsCallable(then) === false) {
        return "not a thenable";
    }

    try {
        then.call(x, promiseCapability["[[Resolve]]"], promiseCapability["[[Reject]]"]);
    } catch (thenCallResultE) {
        promiseCapability["[[Reject]]"].call(undefined, thenCallResultE);
    }

    return null;
}

// ## Promise Tasks

function PromiseReactionTask(reaction, argument) {
    assert("[[Capabilities]]" in reaction && "[[Handler]]" in reaction);

    let promiseCapability = reaction["[[Capabilities]]"];
    let handler = reaction["[[Handler]]"];

    let handlerResult;
    try {
        handlerResult = handler.call(undefined, argument);
    } catch (handlerResultE) {
        return promiseCapability["[[Reject]]"].call(undefined, handlerResultE);
    }

    if (SameValue(handlerResult, promiseCapability["[[Promise]]"]) === true) {
        let selfResolutionError = new TypeError("Tried to resolve a promise with itself!");
        return promiseCapability["[[Reject]]"].call(undefined, selfResolutionError);
    }

    let updateResult = UpdateDeferredFromPotentialThenable(handlerResult, promiseCapability);
    if (updateResult === "not a thenable") {
        return promiseCapability["[[Resolve]]"].call(undefined, handlerResult);
    }
}

// ## The Promise Constructor

// ### Promise

function Promise(executor) {
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

    if (!IsCallable(executor)) {
        throw new TypeError("Promise constructor called with non-callable executor function");
    }

    return InitialisePromise(promise, executor);
}

function InitialisePromise(promise, executor) {
    assert(get_slot(promise, "[[PromiseStatus]]") === undefined);
    assert(IsCallable(executor) === true);

    set_slot(promise, "[[PromiseStatus]]", "unresolved");
    set_slot(promise, "[[PromiseResolveReactions]]", []);
    set_slot(promise, "[[PromiseRejectReactions]]", []);

    let resolve = CreateResolveFunction(promise);
    let reject = CreateRejectFunction(promise);

    try {
        executor.call(undefined, resolve, reject);
    } catch (completionE) {
        reject.call(undefined, completionE);
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
                                                ["[[PromiseStatus]]", "[[PromiseConstructor]]", "[[PromiseResult]]",
                                                "[[PromiseResolveReactions]]", "[[PromiseRejectReactions]]"]);

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

    let C = Get(promise, "constructor");
    let promiseCapability = NewPromiseCapability(C);

    let rejectionHandler;
    if (IsCallable(onRejected) === true) {
        rejectionHandler = onRejected;
    } else {
        rejectionHandler = new_built_in_ThrowerFunction();
    }

    let fulfillmentHandler;
    if (IsCallable(onFulfilled) === true) {
        fulfillmentHandler = onFulfilled;
    } else {
        fulfillmentHandler = new_built_in_IdentityFunction();
    }

    let resolutionHandler = new_built_in_PromiseResolutionHandlerFunction();
    set_slot(resolutionHandler, "[[Promise]]", promise);
    set_slot(resolutionHandler, "[[FulfillmentHandler]]", fulfillmentHandler);
    set_slot(resolutionHandler, "[[RejectionHandler]]", rejectionHandler);

    let resolveReaction = { "[[Capabilities]]": promiseCapability, "[[Handler]]": resolutionHandler };
    let rejectReaction = { "[[Capabilities]]": promiseCapability, "[[Handler]]": rejectionHandler };

    if (get_slot(promise, "[[PromiseStatus]]") === "unresolved") {
        get_slot(promise, "[[PromiseResolveReactions]]").push(resolveReaction);
        get_slot(promise, "[[PromiseRejectReactions]]").push(rejectReaction);
    } else if (get_slot(promise, "[[PromiseStatus]]") === "has-resolution") {
        let resolution = get_slot(promise, "[[PromiseResult]]");
        EnqueueTask("PromiseTasks", PromiseReactionTask, [resolveReaction, resolution]);
    } else if (get_slot(promise, "[[PromiseStatus]]") === "has-rejection") {
        let reason = get_slot(promise, "[[PromiseResult]]");
        EnqueueTask("PromiseTasks", PromiseReactionTask, [rejectReaction, reason]);
    }

    return promiseCapability["[[Promise]]"];
});

function new_built_in_IdentityFunction() {
    return function (x) {
        return x;
    };
}

function new_built_in_PromiseResolutionHandlerFunction() {
    let F = function (x) {
        let promise = get_slot(F, "[[Promise]]");
        let fulfillmentHandler = get_slot(F, "[[FulfillmentHandler]]");
        let rejectionHandler = get_slot(F, "[[RejectionHandler]]");

        if (SameValue(x, promise) === true) {
            let selfResolutionError = new TypeError("Tried to resolve a promise with itself!");
            return rejectionHandler.call(undefined, selfResolutionError);
        }

        let C = get_slot(promise, "[[PromiseConstructor]]");
        let promiseCapability = NewPromiseCapability(C);
        let updateResult = UpdateDeferredFromPotentialThenable(x, promiseCapability);
        if (updateResult !== "not a thenable") {
            return Invoke(promiseCapability["[[Promise]]"], "then", [fulfillmentHandler, rejectionHandler]);
        }
        return fulfillmentHandler.call(undefined, x);
    };

    make_slots(F, ["[[Promise]]", "[[FulfillmentHandler]]", "[[RejectionHandler]]"]);

    return F;
}

function new_built_in_ThrowerFunction() {
    return function (e) {
        throw e;
    };
}


// ## Deltas to Other Areas of the Spec

require("especially/intrinsics")["%Promise%"] = Promise;
require("especially/intrinsics")["%PromisePrototype%"] = Promise.prototype;
