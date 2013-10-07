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
- `[[Derived]]`: a List, initially empty, of derived promise transforms that need to be processed once the promise's `[[Value]]` or `[[Reason]]` are set.
- `[[PromiseConstructor]]`: the function object that was used to construct this promise. Used for branding checks in `Promise.cast`.

### The `ThenableCoercions` Weak Map

To successfully and consistently assimilate thenable objects into real promises, an implementation must maintain a weak map of thenables to promises. Notably, both the keys and values must be weakly stored. Since this weak map is not directly exposed, it does not need to be a true ECMAScript weak map, with the accompanying prototype and such. However, we refer to it using ECMAScript notation in this spec, i.e.:

- `ThenableCoercions.has(thenable)`
- `ThenableCoercions.get(thenable)`
- `ThenableCoercions.set(thenable, promise)`

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

### `ToPromise(C, x)`

The operator `ToPromise` coerces its argument to a promise, ensuring it is of the specified constructor `C`, or returns the argument if it is already a promise matching that constructor.

1. If `IsPromise(x)` and `SameValue(x.[[PromiseConstructor]], C)` is `true`, return `x`.
1. Otherwise,
   1. Let `deferred` be `GetDeferred(C)`.
   1. Call `deferred.[[Resolve]].[[Call]](undefined, (x))`.
   1. Return `deferred.[[Promise]]`.

### `Resolve(p, x)`

The operator `Resolve` resolves a promise with a value.

1. If `p.[[Following]]`, `p.[[Value]]`, or `p.[[Reason]]` are set, return.
1. If `IsPromise(x)`,
   1. If `SameValue(p, x)`,
      1. Let `selfResolutionError` be a newly-created `TypeError` object.
      1. Call `SetReason(p, selfResolutionError)`.
   1. Otherwise, if `x.[[Following]]` is set,
      1. Let `p.[[Following]]` be `x.[[Following]]`.
      1. Append `{ [[DerivedPromise]]: p, [[OnFulfilled]]: undefined, [[OnRejected]]: undefined }` as the last element of `x.[[Following]].[[Derived]]`.
   1. Otherwise, if `x.[[Value]]` is set, call `SetValue(p, x.[[Value]])`.
   1. Otherwise, if `x.[[Reason]]` is set, call `SetReason(p, x.[[Reason]])`.
   1. Otherwise,
      1. Let `p.[[Following]]` be `x`.
      1. Append `{ [[DerivedPromise]]: p, [[OnFulfilled]]: undefined, [[OnRejected]]: undefined }` as the last element of `x.[[Derived]]`.
1. Otherwise, call `SetValue(p, x)`.

### `Reject(p, r)`

The operator `Reject` rejects a promise with a reason.

1. If `p.[[Following]]`, `p.[[Value]]`, or `p.[[Reason]]` are set, return.
1. Call `SetReason(p, r)`.

### `Then(p, onFulfilled, onRejected)`

The operator `Then` queues up fulfillment and/or rejection handlers on a promise for when it becomes fulfilled or rejected, or schedules them to be called in the next microtask if the promise is already fulfilled or rejected. It returns a derived promise, transformed by the passed handlers.

1. If `p.[[Following]]` is set,
   1. Return `Then(p.[[Following]], onFulfilled, onRejected)`.
1. Otherwise,
   1. Let `C` be `Get(p, "constructor")`.
   1. If retrieving the property throws an exception `e`,
      1. Let `q` be a newly-created promise object.
      1. Call `Reject(q, e)`.
   1. Otherwise,
      1. Let `q` be `GetDeferred(C).[[Promise]]`.
      1. Let `derived` be `{ [[DerivedPromise]]: q, [[OnFulfilled]]: onFulfilled, [[OnRejected]]: onRejected }`.
      1. Call `UpdateDerivedFromPromise(derived, p)`.
   1. Return `q`.

### `PropagateToDerived(p)`

The operator `PropagateToDerived` propagates a promise's `[[Value]]` or `[[Reason]]` to all of its derived promises.

1. Assert: exactly one of `p.[[Value]]` or `p.[[Reason]]` is set.
1. Repeat for each `derived` that is an element of `p.[[Derived]]`, in original insertion order
   1. Call `UpdateDerived(derived, p)`.
1. Set `p.[[Derived]]` to a new empty List.

Note: step 3 is not strictly necessary, as preconditions prevent `p.[[Derived]]` from ever being used again after this point.

### `UpdateDerived(derived, originator)`

The operator `UpdateDerived` propagates a promise's state to a single derived promise using any relevant transforms.

1. Assert: exactly one of `originator.[[Value]]` or `originator.[[Reason]]` is set.
1. If `originator.[[Value]]` is set,
   1. If `IsObject(originator.[[Value]])`, queue a microtask to run the following:
      1. If `ThenableCoercions.has(originator.[[Value]])`,
         1. Let `coercedAlready` be `ThenableCoercions.get(originator.[[Value]])`.
         1. Call `UpdateDerivedFromPromise(derived, coercedAlready)`.
      1. Otherwise,
         1. Let `then` be `Get(originator.[[Value]], "then")`.
         1. If retrieving the property throws an exception `e`, call `UpdateDerivedFromReason(derived, e)`.
         1. Otherwise, if `IsCallable(then)`,
             1. Let `coerced` be `CoerceThenable(originator.[[Value]], then)`.
             1. Call `UpdateDerivedFromPromise(derived, coerced)`.
         1. Otherwise, call `UpdateDerivedFromValue(derived, originator.[[Value]])`.
   1. Otherwise, call `UpdateDerivedFromValue(derived, originator.[[Value]])`.
1. Otherwise, call `UpdateDerivedFromReason(derived, originator.[[Reason]])`.

### `UpdateDerivedFromValue(derived, value)`

The operator `UpdateDerivedFromValue` propagates a value to a derived promise, using the relevant `onFulfilled` transform if it is callable.

1. If `IsCallable(derived.[[OnFulfilled]])`, call `CallHandler(derived.[[DerivedPromise]], derived.[[OnFulfilled]], value)`.
1. Otherwise, call `SetValue(derived.[[DerivedPromise]], value)`.

### `UpdateDerivedFromReason(derived, reason)`

The operator `UpdateDerivedFromReason` propagates a reason to a derived promise, using the relevant `onRejected` transform if it is callable.

1. If `IsCallable(derived.[[OnRejected]])`, call `CallHandler(derived.[[DerivedPromise]], derived.[[OnRejected]], reason)`.
1. Otherwise, call `SetReason(derived.[[DerivedPromise]], reason)`.

### `UpdateDerivedFromPromise(derived, promise)`

The operator `UpdateDerivedFromPromise` propagates one promise's state to the derived promise, using the relevant transform if it is callable.

1. If `promise.[[Value]]` or `promise.[[Reason]]` is set, call `UpdateDerived(derived, promise)`.
1. Otherwise, append `derived` as the last element of `promise.[[Derived]]`.

### `CallHandler(derivedPromise, handler, argument)`

The operator `CallHandler` applies a transformation to a value or reason and uses it to update a derived promise.

1. Queue a microtask to do the following:
   1. Let `v` be `handler.[[Call]](undefined, (argument))`.
   1. If calling the function throws an exception `e`, call `Reject(derivedPromise, e)`.
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

The operator `CoerceThenable` takes a "thenable" object whose `then` method has been extracted and creates a promise from it. It memoizes its results so as to avoid getting inconsistent answers in the face of ill-behaved thenables; the memoized results are later checked by `UpdateDerived`.

1. Assert: `IsObject(thenable)`.
1. Assert: `IsCallable(then)`.
1. Assert: the execution context stack is empty.
1. Let `p` be a newly-created promise object.
1. Let `resolve(x)` be an ECMAScript function that calls `Resolve(p, x)`.
1. Let `reject(r)` be an ECMAScript function that calls `Reject(p, r)`.
1. Call `then.[[Call]](thenable, (resolve, reject))`.
1. If calling the function throws an exception `e`, call `Reject(p, e)`.
1. Call `ThenableCoercions.set(thenable, p)`.
1. Return `p`.

### `GetDeferred(C)`

The operator `GetDeferred` takes a potential constructor function, and attempts to use that constructor function in the fashion of the normal promise constructor to extract resolve and reject functions, returning the constructed promise along with those two functions controlling its state. This is useful to support subclassing, as this operation is generic on any constructor that calls a passed resolver argument in the same way as the `Promise` constructor. We use it to generalize static methods of `Promise` to any subclass.

1. If `IsConstructor(C)`,
   1. Let `resolver` be an ECMAScript function that:
      1. Lets `resolve` be the value `resolver` is passed as its first argument.
      1. Lets `reject` be the value `resolver` is passed as its second argument.
   1. Let `promise` be `C.[[Construct]]((resolver))`.
1. Otherwise,
   1. Let `promise` be a newly-created promise object.
   1. Let `resolve(x)` be an ECMAScript function that calls `Resolve(promise, x)`.
   1. Let `reject(r)` be an ECMAScript function that calls `Reject(promise, r)`.
1. Return the record `{ [[Promise]]: promise, [[Resolve]]: resolve, [[Reject]]: reject }`.

## The `Promise` constructor

The `Promise` constructor is the `%Promise%` intrinsic object and the initial value of the `Promise` property of the global object. When `Promise` is called as a function rather than as a constructor, it initiializes its `this` value with the internal state necessary to support the `Promise.prototype` internal methods.

The `Promise` constructor is designed to be subclassable. It may be used as the value of an `extends` clause of a class declaration. Subclass constructors that intended to inherit the specified `Promise` behavior must include a `super` call to the `Promise` constructor to initialize the `[[IsPromise]]` state of subclass instances.

### `Promise(resolver)`

When `Promise` is called with the argument `resolver`, the following steps are taken. If being called to initialize an uninitialized promise object created by `Promise[@@create]`, `resolver` is assumed to be a function and is given the two arguments `resolve` and `reject` which will perform their eponymous operations on the promise.

1. Let `promise` be the `this` value.
1. If `Type(promise)` is not `Object`, throw a `TypeError` exception.
1. If `promise.[[IsPromise]]` is unset, then throw a `TypeError` exception.
1. If `promise.[[IsPromise]]` is not `undefined`, then throw a `TypeError` exception.
1. If not `IsCallable(resolver)`, throw a `TypeError` exception.
1. Set `promise.[[IsPromise]]` to `true`.
1. Set `promise.[[Derived]]` to a new empty List. 
1. Let `resolve(x)` be an ECMAScript function that calls `Resolve(promise, x)`.
1. Let `reject(r)` be an ECMAScript function that calls `Reject(promise, r)`.
1. Call `resolver.[[Call]](undefined, (resolve, reject))`.
1. If calling the function throws an exception `e`, call `Reject(promise, e)`.
1. Return `promise`.

### `new Promise(...argumentsList)`

`Promise` called as part of a `new` expression with argument list `argumentList` simply delegates to the usual ECMAScript spec mechanisms for creating new objects, triggering the initialization subsequence of the above `Promise(resolver)` procedure.

1. Return `OrdinaryConstruct(Promise, argumentsList)`.

## Properties of the `Promise` constructor

### `Promise[@@create]()`

`Promise[@@create]()` allocates a new uninitialized promise object, installing the unforgable brand `[[IsPromise]]` on the promise.

1. Let `p` be `OrdinaryCreateFromConstructor(this, "%PromisePrototype%", ([[IsPromise]]))`.
1. Set `p.[[PromiseConstructor]]` to `this`.
1. Return `p`.

### `Promise.resolve(x)`

`Promise.resolve` returns a new promise resolved with the passed argument.

1. Let `deferred` be `GetDeferred(this)`.
1. Call `deferred.[[Resolve]].[[Call]](undefined, (x))`.
1. Return `deferred.[[Promise]]`.

### `Promise.reject(r)`

`Promise.reject` returns a new promise rejected with the passed argument.

1. Let `deferred` be `GetDeferred(this)`.
1. Call `deferred.[[Reject]].[[Call]](undefined, (r))`.
1. Return `deferred.[[Promise]]`.

### `Promise.cast(x)`

`Promise.cast` coerces its argument to a promise, or returns the argument if it is already a promise.

1. Return `ToPromise(this, x)`.

### `Promise.race(iterable)`

`Promise.race` returns a new promise which is settled in the same way as the first passed promise to settle. It casts all elements of the passed iterable to promises before running this algorithm.

1. Let `deferred` be `GetDeferred(this)`.
1. For each value `nextValue` of `iterable`,
   1. Let `nextPromise` be `ToPromise(this, nextValue)`.
   1. Call `Then(nextPromise, deferred.[[Resolve]], deferred.[[Reject]])`.
1. Return `deferred.[[Promise]]`.

### `Promise.all(iterable)`

`Promise.all` returns a new promise which is fulfilled with an array of fulfillment values for the passed promises, or rejects with the reason of the first passed promise that rejects. It casts all elements of the passed iterable to promises before running this algorithm.

1. Let `deferred` be `GetDeferred(this)`.
1. Let `values` be `ArrayCreate(0)`.
1. Let `countdown` be `0`.
1. Let `index` be `0`.
1. For each value `nextValue` of `iterable`,
   1. Let `currentIndex` be the current value of `index`.
   1. Let `nextPromise` be `ToPromise(this, nextValue)`.
   1. Let `onFulfilled(v)` be an ECMAScript function that:
      1. Calls `values.[[DefineOwnProperty]](currentIndex, { [[Value]]: v, [[Writable]]: true, [[Enumerable]]: true, [[Configurable]]: true }`.
      1. Lets `countdown` be `countdown - 1`.
      1. If `countdown` is `0`, calls `deferred.[[Resolve]].[[Call]](undefined, (values))`.
   1. Call `Then(nextPromise, onFulfilled, deferred.[[Reject]])`.
   1. Let `index` be `index + 1`.
   1. Let `countdown` be `countdown + 1`.
1. If `index` is `0`,
   1. Call `deferred.[[Resolve]].[[Call]](undefined, (values))`.
1. Return `deferred.[[Promise]]`.

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

1. Return `Invoke(this, "then", (undefined, onRejected))`.
