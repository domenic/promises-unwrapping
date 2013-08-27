# Promise Objects

## Overview of Promise Objects and Definitions of Abstract Operations

### Promise Object Internal Data Properties

A promise `p` carries several internal data properties:

- `p.[[IsPromise]]`: all promises are branded with this property, and no other objects are. Uninitialized promises have it set to `undefined`, whereas initialized ones have it set to `true`.
- `p.[[Following]]`: either unset, or a promise that `p` is following.
- `p.[[Value]]`: either unset, or promise's direct fulfillment value (derived by resolving it with a non-thenable).
- `p.[[Reason]]`: either unset, or a promise's direct rejection reason (derived by rejecting it).
- `p.[[OutstandingThens]]`: a list, initially empty, of `{ promise, onFulfilled, onRejected }` tuples that need to be processed once one of the above three properties is set.

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
      1. Add `{ p, undefined, undefined }` to `x.[[Following]].[[OutstandingThens]]`.
   1. Otherwise, if `x.[[Value]]` is set, call `SetValue(p, x.[[Value]])`.
   1. Otherwise, if `x.[[Reason]]` is set, call `SetReason(p, x.[[Reason]])`.
   1. Otherwise,
      1. Let `p.[[Following]]` be `x`.
      1. Add `{ p, undefined, undefined }` to `x.[[OutstandingThens]]`.
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
   1. If `p.[[Value]]` or `p.[[Reason]]` is set, call `UpdateDerived(q, p, onFulfilled, onRejected)`.
   1. Otherwise, add `{ q, onFulfilled, onRejected }` to `p.[[OutstandingThens]]`.
   1. Return `q`.

### `PropagateToDerived(p)`

The operator `PropagateToDerived` propagates a promise's `[[Value]]` or `[[Reason]]` to all of its derived promises.

1. Assert: exactly one of `p.[[Value]]` or `p.[[Reason]]` is set.
1. For each tuple `{ derivedPromise, onFulfilled, onRejected }` in `p.[[OutstandingThens]]`,
   1. Call `UpdateDerived(derivedPromise, p, onFulfilled, onRejected)`.
1. Clear `p.[[OutstandingThens]]`.

Note: step 2 is not strictly necessary, as preconditions prevent `p.[[OutstandingThens]]` from ever being used again after this point.

### `UpdateDerived(toUpdate, p, onFulfilled, onRejected)`

The operator `UpdateDerived` propagates a promise's state to a single derived promise.

1. Assert: exactly one of `p.[[Value]]` or `p.[[Reason]]` is set.
1. If `p.[[Value]]` is set,
   1. If `IsObject(p.[[Value]])`,
      1. Let `then` be `Get(p.[[Value]], "then")`.
      1. If retrieving the property throws an exception `e`, call `UpdateFromReason(toUpdate, e, onRejected)`.
      1. Otherwise, if `Type(then)` is `Function`,
         1. Let `coerced` be `CoerceThenable(p.[[Value]], then)`.
         1. Add `{ toUpdate, onFulfilled, onRejected }` to `coerced.[[OutstandingThens]]`.
      1. Otherwise, call `UpdateFromValue(toUpdate, p.[[Value]], onFulfilled)`.
   1. Otherwise, call `UpdateFromValue(toUpdate, p.[[Value]], onFulfilled)`
1. Otherwise, if `p.[[Reason]]` is set, call `UpdateFromReason(toUpdate, p.[[Reason]], onRejected)`.

### `UpdateFromValue(toUpdate, value, onFulfilled)`

The operator `UpdateFromValue` propagates a value to a promise whose state is changing, with a possible transformation via the given fulfillment handler.

1. If `IsCallable(onFulfilled)`, call `CallHandler(toUpdate, onFulfilled, value)`.
1. Otherwise, call `SetValue(toUpdate, value)`.

### `UpdateFromReason(toUpdate, reason, onRejected)`

The operator `UpdateFromReason` propagates a reason to a promise whose state is changing, with a possible transformation via the given rejection handler.

1. If `IsCallable(onRejected)`, call `CallHandler(toUpdate, onRejected, reason)`.
1. Otherwise, call `SetReason(toUpdate, reason)`.

### `CallHandler(returnedPromise, handler, argument)`

The operator `CallHandler` applies a transformation to a value or reason and uses it to update a promise whose state is changing.

Queue a microtask to do the following:

1. Let `v` be `handler(argument)`.
1. If this call throws an exception `e`, do `Reject(returnedPromise, e)`.
1. Otherwise, call `Resolve(returnedPromise, v)`.

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
1. Let `p` be a new promise.
1. Queue a microtask to the do the following:
   1. Let `resolve(x)` be an ECMAScript function that calls `Resolve(p, x)`.
   1. Let `reject(r)` be an ECMAScript function that calls `Reject(p, r)`.
   1. Call `then.[[Call]](thenable, [resolve, reject])`.
   1. If calling the function throws an exception `e`, call `Reject(p, e)`.

## The `Promise` constructor

The `Promise` constructor is the `%Promise%` intrinsic object and the initial value of the `Promise` property of the global object. When `Promise` is called as a function rather than as a constructor, it performs a coercion, leaving promises unchanged but coercing thenables to real promises and non-thenable values to promises fulfilled with that value. However, if the `this` value passed in the call is an `Object` with an uninitialized `[[IsPromise]]` internal data property, it initializes the `this` value using the argument value. This permits `Promise` to be used both to perform coercion and to perform constructor instance initialization.

The `Promise` constructor is designed to be subclassable. It may be used as the value of an `extends` clause of a class declaration. Subclass constructors that intended to inherit the specified `Promise` behavior must include a `super` call to the `Promise` constructor to initialize the `[[IsPromise]]` state of subclass instances.

### `Promise(arg)`

When `Promise` is called with the argument `arg`, the following steps are taken. If being called to initialize an uninitialized promise object created by `Promise[@@create]`, it uses the signature `Promise(resolver)`, where `resolver` is given the two arguments `resolve` and `reject` which will perform their eponymous operations on the promise. If called as a normal function, it will coerce its argument to a promise.

1. Let `func` be this `Promise` function object.
1. Let `O` be the `this` value.
1. If `Type(O)` is `Object` and `O` has a `[[IsPromise]]` internal data property and the value of `[[IsPromise]]` is `undefined`,
   1. Set `O.[[IsPromise]]` to `true`.
   1. If `Type(arg)` is not `Function`,
      1. Let `resolverMustBeFunctionError` be a newly-created `TypeError`.
      1. Call `SetReason(O, resolveMustBeFunctionError)`.
   1. Otherwise,
      1. Let `resolve(x)` be an ECMAScript function that calls `Resolve(O, x)`.
      1. Let `reject(r)` be an ECMAScript function that calls `Reject(O, r)`.
      1. Call `arg.[[Call]](undefined, [resolve, reject])`.
      1. If calling the function throws an exception `e`, call `Reject(O, e)`.
   1. Return `O`.
1. Otherwise,
   1. If `IsPromise(arg), return `arg`.
   1. Otherwise,
      1. Let `p` be a newly-created promise.
      1. Call `Resolve(p, arg)`.
      1. Return `p`.

1. If `Type(O)` is not `Object` or `Type(O)` is `Object` and `O.[[IsPromise]]` is unset,
   1. If `Type(x)` is `Object` and `x.[[IsPromise]]` is set, return `x`.
   1. Otherwise,
      1. Let `O` be the result of calling `PromiseAlloc(func)`.
      1. `ReturnIfAbrupt(O)`.
1. Return `PromiseInitialize(O, x)`.

### `new Promise(...argumentsList)`

`Promise` called as part of a `new` expression with argument list `argumentList` simply delegates to the usual ECMAScript spec mechanisms for creating new objects, triggering the initialization subsequence of the above `Promise(arg)` procedure.

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
