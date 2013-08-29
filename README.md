# Promise Objects

This repository is meant to fully flesh out a subset of the "AP2" promise consensus developed over the last month on es-discuss. In particular, it provides the subset the DOM needs as soon as possible, omitting `flatMap` and `accept` for now but building a conceptual foundation that would allow them to be added at a later date.

It is meant to succeed the current [DOM Promises](http://dom.spec.whatwg.org/#promises) spec, and fixes a number of bugs in that spec while also changing some of the exposed APIs and behavior to make it more forward-compatible with the full AP2 consensus.

## Overview of Promise Objects and Definitions of Abstract Operations

### Promise Object Internal Data Properties

A promise carries several internal data properties:

- `[[IsPromise]]`: all promises are branded with this property, and no other objects are. Uninitialized promises have it set to `undefined`, whereas initialized ones have it set to `true`.
- `[[Following]]`: either unset, or a promise that `p` is following.
- `[[Value]]`: either unset, or promise's direct fulfillment value (derived by resolving it with a non-thenable).
- `[[Reason]]`: either unset, or a promise's direct rejection reason (derived by rejecting it).
- `[[Derived]]`: a list, initially empty, of derived promise transforms that need to be processed once the promise's `[[Value]]` or `[[Reason]]` are set.

### The Derived Promise Transform Specification Type

The Derived Promise Transform type is used to encapsulate promises which are derived from a given promise, optionally including fulfillment or rejection handlers that will be used to transform the derived promise relative to the originating promise. They are stored in a promise's `[[Derived]]` internal data property until the promise's `[[Value]]` or `[[Reason]]` are set, at which time changes propagate to all derived promise transforms in the list and the list is cleared.

Derived promise transforms are Records composed of three named fields:

- `[[DerivedPromise]]`: the derived promise in need of updating.
- `[[OnFulfilled]]`: the fulfillment handler to be used as a transformation, if the originating promise becomes fulfilled.
- `[[OnRejected]]`: the rejection handler to be used as a transformation, if the originating promise becomes rejected.

### `IsPromise(x)`

The operator `IsPromise` checks for the promise brand on an object.

1. Return `true` if `IsObject(x)` and `x.[[IsPromise]]` is `true`.
1. Otherwise, return `false`.

### `Resolve(p, x)`

The operator `Resolve` resolves a promise with a value.

1. If `p.[[Following]]`, `p.[[Value]]`, or `p.[[Reason]]` are set, terminate these steps.
1. If `IsPromise(x)`,
   1. If `SameValue(p, x)`,
      1. Let `selfResolutionError` be a newly-created `TypeError` object.
      1. Call `SetReason(p, selfResolutionError)`.
   1. Otherwise, if `x.[[Following]]` is set,
      1. Let `p.[[Following]]` be `x.[[Following]]`.
      1. Add `{ [[DerivedPromise]]: p, [[OnFulfilled]]: undefined, [[OnRejected]]: undefined }` to `x.[[Following]].[[Derived]]`.
   1. Otherwise, if `x.[[Value]]` is set, call `SetValue(p, x.[[Value]])`.
   1. Otherwise, if `x.[[Reason]]` is set, call `SetReason(p, x.[[Reason]])`.
   1. Otherwise,
      1. Let `p.[[Following]]` be `x`.
      1. Add `{ [[DerivedPromise]]: p, [[OnFulfilled]]: undefined, [[OnRejected]]: undefined }` to `x.[[Derived]]`.
1. Otherwise, call `SetValue(p, x)`.

### `Reject(p, r)`

The operator `Reject` rejects a promise with a reason.

1. If `p.[[Following]]`, `p.[[Value]]`, or `p.[[Reason]]` are set, terminate these steps.
1. Call `SetReason(p, r)`.

### `Then(p, onFulfilled, onRejected)`

The operator `Then` queues up fulfillment and/or rejection handlers on a promise for when it becomes fulfilled or rejected, or schedules them to be called in the next microtask if the promise is already fulfilled or rejected. It returns a derived promise, transformed by the passed handlers.

1. If `p.[[Following]]` is set,
   1. Return `Then(p.[[Following]], onFulfilled, onRejected)`.
1. Otherwise,
   1. Let `q` be a new promise.
   1. Let `derived` be `{ [[DerivedPromise]]: q, [[OnFulfilled]]: onFulfilled, [[OnRejected]]: onRejected }`.
   1. If `p.[[Value]]` or `p.[[Reason]]` is set, call `UpdateDerived(derived, p)`.
   1. Otherwise, add `derived` to `p.[[Derived]]`.
   1. Return `q`.

### `PropagateToDerived(p)`

The operator `PropagateToDerived` propagates a promise's `[[Value]]` or `[[Reason]]` to all of its derived promises.

1. Assert: exactly one of `p.[[Value]]` or `p.[[Reason]]` is set.
1. For each derived promise transform `derived` in `p.[[Derived]]`,
   1. Call `UpdateDerived(derived, p)`.
1. Clear `p.[[Derived]]`.

Note: step 2 is not strictly necessary, as preconditions prevent `p.[[Derived]]` from ever being used again after this point.

### `UpdateDerived(derived, originator)`

The operator `UpdateDerived` propagates a promise's state to a single derived promise using any relevant transforms.

1. Assert: exactly one of `originator.[[Value]]` or `originator.[[Reason]]` is set.
1. If `originator.[[Value]]` is set,
   1. If `IsObject(originator.[[Value]])`, queue a microtask to run the following:
      1. Let `then` be `Get(originator.[[Value]], "then")`.
      1. If retrieving the property throws an exception `e`, call `UpdateDerivedFromReason(derived, e)`.
      1. Otherwise, if `Type(then)` is `Function`,
         1. Let `coerced` be `CoerceThenable(originator.[[Value]], then)`.
         1. If `coerced.[[Value]]` or `coerced.[[Reason]]` is set, call `UpdateDerived(derived, coerced)`.
         1. Otherwise, add `derived` to `coerced.[[Derived]]`.
      1. Otherwise, call `UpdateDerivedFromValue(derived, originator.[[Value]])`.
   1. Otherwise, call `UpdateDerivedFromValue(derived, originator.[[Value]])`.
1. Otherwise, call `UpdateDerivedFromReason(derived, originator.[[Reason]])`.

### `UpdateDerivedFromValue(derived, value)`

The operator `UpdateDerivedFromValue` propagates a value to a derived promise, using the relevant `onFulfilled` transform if it is callable.

1. If `IsCallable(derived.[[OnFulfilled]])`, call `CallHandler(derived.[[DerivedPromise]], derived.[[OnFulfilled]], value)`.
1. Otherwise, call `SetValue(derived.[[DerivedPromise]], value)`.

### `UpdateFromReason(derived, reason)`

The operator `UpdateFromReason` propagates a reason to a derived promise, using the relevant `onRejected` transform if it is callable.

1. If `IsCallable(derived.[[OnRejected]])`, call `CallHandler(derived.[[DerivedPromise]], derived.[[OnRejected]], reason)`.
1. Otherwise, call `SetReason(derived.[[DerivedPromise]], reason)`.

### `CallHandler(derivedPromise, handler, argument)`

The operator `CallHandler` applies a transformation to a value or reason and uses it to update a derived promise.

Queue a microtask to do the following:

1. Let `v` be `handler(argument)`.
1. If this call throws an exception `e`, call `Reject(derivedPromise, e)`.
1. Otherwise, call `Resolve(derivedPromise, v)`.

### `SetValue(p, value)`

The operator `SetValue` encapsulates the process of setting a promise's value and then propagating this to any derived promises.

1. Assert: neither `p.[[Value]]` nor `p.[[Reason]]` are set.
1. Set `p.[[Value]]` to `value`.
1. Unset `p.[[Following]]`.
1. Call `PropagateToDerived(p)`.

Note: step 3 is not strictly necessary, as all code paths check `p.[[Value]]` before using `p.[[Following]]`.

### `SetReason(p, reason)`

The operator `SetReason` encapsulates the process of setting a promise's reason and then propagating this to any derived promises.

1. Assert: neither `p.[[Value]]` nor `p.[[Reason]]` are set.
1. Set `p.[[Reason]]` to `reason`.
1. Unset `p.[[Following]]`.
1. Call `PropagateToDerived(p)`.

Note: step 3 is not strictly necessary, as all code paths check `p.[[Reason]]` before using `p.[[Following]]`.

### `CoerceThenable(thenable, then)`

The operator `CoerceThenable` takes a "thenable" object whose `then` method has been extracted and creates a promise from it.

1. Assert: `IsObject(thenable)`.
1. Assert: `IsCallable(then)`.
1. Assert: the execution context stack is empty.
1. Let `p` be a new promise.
1. Let `resolve(x)` be an ECMAScript function that calls `Resolve(p, x)`.
1. Let `reject(r)` be an ECMAScript function that calls `Reject(p, r)`.
1. Call `then.[[Call]](thenable, [resolve, reject])`.
1. If calling the function throws an exception `e`, call `Reject(p, e)`.

## The `Promise` constructor

The `Promise` constructor is the `%Promise%` intrinsic object and the initial value of the `Promise` property of the global object. When `Promise` is called as a function rather than as a constructor, it initiializes its `this` value with the internal state necessary to support the `Promise.prototype` internal methods.

The `Promise` constructor is designed to be subclassable. It may be used as the value of an `extends` clause of a class declaration. Subclass constructors that intended to inherit the specified `Promise` behavior must include a `super` call to the `Promise` constructor to initialize the `[[IsPromise]]` state of subclass instances.

### `Promise(resolver)`

When `Promise` is called with the argument `resolver`, the following steps are taken. If being called to initialize an uninitialized promise object created by `Promise[@@create]`, `resolver` is assumed to be a function and is given the two arguments `resolve` and `reject` which will perform their eponymous operations on the promise.

1. Let `promise` be the `this` value.
1. If `Type(promise)` is not `Object`, throw a `TypeError` exception.
1. If `promise.[[IsPromise]]` is unset, then throw a `TypeError` exception.
1. If `promise.[[IsPromise]]` is not `undefined`, then throw a `TypeError` exception.
1. If `Type(resolver)` is not `Function`, then throw a `TypeError` exception.
1. Set `promise.[[IsPromise]]` to `true`.
1. Let `resolve(x)` be an ECMAScript function that calls `Resolve(promise, x)`.
1. Let `reject(r)` be an ECMAScript function that calls `Reject(promise, r)`.
1. Call `resolver.[[Call]](undefined, [resolve, reject])`.
1. If calling the function throws an exception `e`, call `Reject(promise, e)`.
1. Return `promise`.

### `new Promise(...argumentsList)`

`Promise` called as part of a `new` expression with argument list `argumentList` simply delegates to the usual ECMAScript spec mechanisms for creating new objects, triggering the initialization subsequence of the above `Promise(resolver)` procedure.

1. Return `OrdinaryConstructor(Promise, argumentsList)`.

## Properties of the `Promise` constructor

### `Promise[@@create]()`

`Promise[@@create]()` allocates a new uninitialized promise object, installing the unforgable brand `[[IsPromise]]` on the promise.

1. Return `OrdinaryCreateFromConstructor(Promise, "%PromisePrototype%", ([[IsPromise]]))`.

### `Promise.resolve(x)`

`Promise.resolve` returns a new promise resolved with the passed argument.

1. Let `p` be a newly-created promise.
1. Call `Resolve(p, x)`.
1. Return `p`.

### `Promise.reject(r)`

`Promise.reject` returns a new promise rejected with the passed argument.

1. Let `p` be a newly-created promise.
1. Call `Reject(p, r)`.
1. Return `p`.

## Properties of the `Promise` Prototype Object

The `Promise` prototype object is itself an ordinary object. It is not a `Promise` instance and does not have a `[[IsPromise]]` internal data property.

The value of the `[[Prototype]]` internal data property of the `Promise` prototype object is the standard built-in `Object` prototype object.

The methods of the `Promise` prototype object are not generic and the `this` value passed to them must be an object that has a `[[IsPromise]]` internal data property that has been initialized to `true`.

The intrinsic object `%PromisePrototype%` is the initial value of the `"prototype"` data property of the intrinsic `%Promise%`.

### `Promise.prototype.constructor`

The initial value of `Promise.prototype.constructor` is the built-in `Promise` constructor.

### `Promise.prototype.then(onFulfilled, onRejected)`

1. If `IsPromise(this)` is `false`, throw a `TypeError`.
1. Otherwise, return `Then(this, onFulfilled, onRejected)`.

### `Promise.prototype.catch(onRejected)`

1. If `IsPromise(this)` is `false`, throw a `TypeError`.
1. Otherwise, return `Then(this, undefined, onRejected)`.
