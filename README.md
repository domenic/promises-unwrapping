# Promise Objects

This repository is meant to fully flesh out a subset of the "AP2" promise consensus developed over the last month on es-discuss. In particular, it provides the subset the DOM needs as soon as possible, omitting `flatMap` and `accept` for now but building a conceptual foundation that would allow them to be added at a later date.

It is meant to succeed the current [DOM Promises](http://dom.spec.whatwg.org/#promises) spec, and fixes a number of bugs in that spec while also changing some of the exposed APIs and behavior to make it more forward-compatible with the full AP2 consensus.

## Overview of Promise Objects and Definitions of Abstract Operations

### The ThenableCoercions Weak Map

To successfully and consistently assimilate thenable objects into real promises, an implementation must maintain a weak map of thenables to promises. Notably, both the keys and values must be weakly stored. Since this weak map is not directly exposed, it does not need to be a true ECMAScript weak map, with the accompanying prototype and such. However, we refer to it using ECMAScript notation in this spec, i.e.:

- `ThenableCoercions.has(thenable)`
- `ThenableCoercions.get(thenable)`
- `ThenableCoercions.set(thenable, promise)`

### The Derived Promise Transform Specification Type

The Derived Promise Transform type is used to encapsulate promises which are derived from a given promise, optionally including fulfillment or rejection handlers that will be used to transform the derived promise relative to the originating promise. They are stored in a promise's `[[Derived]]` internal data property until one of `[[HasValue]]` or `[[HasReason]]` becomes `true`, at which time changes propagate to all derived promise transforms in the list and the list is cleared.

Derived promise transforms are Records composed of three named fields:

- `[[DerivedPromise]]`: the derived promise in need of updating.
- `[[OnFulfilled]]`: the fulfillment handler to be used as a transformation, if the originating promise becomes fulfilled.
- `[[OnRejected]]`: the rejection handler to be used as a transformation, if the originating promise becomes rejected.

### IsPromise ( x )

The operator `IsPromise` checks for the promise brand on an object.

1. Return `true` if `Type(x)` is `Object` and `x.[[IsPromise]]` is `true`.
1. Otherwise, return `false`.

### IsResolved ( p )

The operator `IsResolved` checks for whether a promise's fate is resolved.

1. If `p.[[Following]]` is not `undefined`, return `true`.
1. If `p.[[HasValue]]` is `true`, return `true`.
1. If `p.[[HasReason]]` is `true`, return `true`.
1. Return `false`.

### ToPromise ( C , x )

The operator `ToPromise` coerces its argument to a promise, ensuring it is of the specified constructor `C`, or returns the argument if it is already a promise matching that constructor.

1. If `IsPromise(x)` is `true` and `SameValue(x.[[PromiseConstructor]], C)` is `true`, return `x`.
1. Otherwise,
   1. Let `deferred` be `GetDeferred(C)`.
   1. Call `deferred.[[Resolve]].[[Call]](undefined, (x))`.
   1. Return `deferred.[[Promise]]`.

### Resolve ( p , x )

The operator `Resolve` resolves a promise with a value.

1. If `IsResolved(p)`, return.
1. If `IsPromise(x)` is `true`,
   1. If `SameValue(p, x)`,
      1. Let `selfResolutionError` be a newly-created `TypeError` object.
      1. Call `SetReason(p, selfResolutionError)`.
   1. Otherwise, if `x.[[Following]]` is not `undefined`,
      1. Set `p.[[Following]]` to `x.[[Following]]`.
      1. Append `{ [[DerivedPromise]]: p, [[OnFulfilled]]: undefined, [[OnRejected]]: undefined }` as the last element of `x.[[Following]].[[Derived]]`.
   1. Otherwise, if `x.[[HasValue]]` is `true`, call `SetValue(p, x.[[Value]])`.
   1. Otherwise, if `x.[[HasReason]]` is `true`, call `SetReason(p, x.[[Reason]])`.
   1. Otherwise,
      1. Set `p.[[Following]]` to `x`.
      1. Append `{ [[DerivedPromise]]: p, [[OnFulfilled]]: undefined, [[OnRejected]]: undefined }` as the last element of `x.[[Derived]]`.
1. Otherwise, call `SetValue(p, x)`.

### Reject ( p , r )

The operator `Reject` rejects a promise with a reason.

1. If `IsResolved(p)`, return.
1. Call `SetReason(p, r)`.

### Then ( p, onFulfilled, onRejected )

The operator `Then` queues up fulfillment and/or rejection handlers on a promise for when it becomes fulfilled or rejected, or schedules them to be called in the next microtask if the promise is already fulfilled or rejected. It returns a derived promise, transformed by the passed handlers.

1. If `p.[[Following]]` is not `undefined`,
   1. Return `Then(p.[[Following]], onFulfilled, onRejected)`.
1. Otherwise,
   1. Let `C` be `Get(p, "constructor")`.
   1. If `C` is an abrupt completion,
      1. Let `q` be the result of calling PromiseCreate().
      1. Call `Reject(q, C.[[value]])`.
   1. Otherwise,
      1. Let `q` be `GetDeferred(C.[[value]]).[[Promise]]`.
      1. Let `derived` be `{ [[DerivedPromise]]: q, [[OnFulfilled]]: onFulfilled, [[OnRejected]]: onRejected }`.
      1. Call `UpdateDerivedFromPromise(derived, p)`.
   1. Return `q`.

### PropagateToDerived ( p )

The operator `PropagateToDerived` propagates a promise's `[[Value]]` or `[[Reason]]` to all of its derived promises.

1. Assert: exactly one of `p.[[HasValue]]` and `p.[[HasReason]]` is `true`.
1. Repeat for each `derived` that is an element of `p.[[Derived]]`, in original insertion order
   1. Call `UpdateDerived(derived, p)`.
1. Set `p.[[Derived]]` to a new empty List.

Note: step 3 is not strictly necessary, as preconditions prevent `p.[[Derived]]` from ever being used again after this point.

### UpdateDerived ( derived , originator )

The operator `UpdateDerived` propagates a promise's state to a single derived promise using any relevant transforms.

1. Assert: exactly one of `originator.[[HasValue]]` and `originator.[[HasReason]]` is `true`.
1. If `originator.[[HasValue]]` is `true`,
   1. If `Type(originator.[[Value]])` is `Object`, queue a microtask to run the following:
      1. If `ThenableCoercions.has(originator.[[Value]])`,
         1. Let `coercedAlready` be `ThenableCoercions.get(originator.[[Value]])`.
         1. Call `UpdateDerivedFromPromise(derived, coercedAlready)`.
      1. Otherwise,
         1. Let `thenResult` be `Get(originator.[[Value]], "then")`.
         1. If `thenResult` is an abrupt completion, call `UpdateDerivedFromReason(derived, thenResult.[[value]])`.
         1. Otherwise, if `IsCallable(thenResult.[[value]])`,
             1. Let `coerced` be `CoerceThenable(originator.[[Value]], thenResult.[[value]])`.
             1. Call `UpdateDerivedFromPromise(derived, coerced)`.
         1. Otherwise, call `UpdateDerivedFromValue(derived, originator.[[Value]])`.
   1. Otherwise, call `UpdateDerivedFromValue(derived, originator.[[Value]])`.
1. Otherwise, call `UpdateDerivedFromReason(derived, originator.[[Reason]])`.

### UpdateDerivedFromValue ( derived , value )

The operator `UpdateDerivedFromValue` propagates a value to a derived promise, using the relevant `onFulfilled` transform if it is callable.

1. If `IsCallable(derived.[[OnFulfilled]])`, call `CallHandler(derived.[[DerivedPromise]], derived.[[OnFulfilled]], value)`.
1. Otherwise, call `SetValue(derived.[[DerivedPromise]], value)`.

### UpdateDerivedFromReason ( derived , reason )

The operator `UpdateDerivedFromReason` propagates a reason to a derived promise, using the relevant `onRejected` transform if it is callable.

1. If `IsCallable(derived.[[OnRejected]])`, call `CallHandler(derived.[[DerivedPromise]], derived.[[OnRejected]], reason)`.
1. Otherwise, call `SetReason(derived.[[DerivedPromise]], reason)`.

### UpdateDerivedFromPromise ( derived , promise )

The operator `UpdateDerivedFromPromise` propagates one promise's state to the derived promise, using the relevant transform if it is callable.

1. If `promise.[[HasValue]]` is `true` or `promise.[[HasReason]]` is `true`, call `UpdateDerived(derived, promise)`.
1. Otherwise, append `derived` as the last element of `promise.[[Derived]]`.

### CallHandler ( derivedPromise , handler , argument )

The operator `CallHandler` applies a transformation to a value or reason and uses it to update a derived promise.

1. Queue a microtask to do the following:
   1. Let `result` be `handler.[[Call]](undefined, (argument))`.
   1. If `result` is an abrupt completion, call `Reject(derivedPromise, result.[[value]])`.
   1. Otherwise, call `Resolve(derivedPromise, result.[[value]])`.

### SetValue ( p , value )

The operator `SetValue` encapsulates the process of setting a promise's value and then propagating this to any derived promises.

1. Assert: `p.[[HasValue]]` is `false` and `p.[[HasReason]]` is `false`.
1. Set `p.[[Value]]` to `value`.
1. Set `p.[[HasValue]]` to `true`.
1. Set `p.[[Following]]` to `undefined`.
1. Call `PropagateToDerived(p)`.

Note: step 4 is not strictly necessary, as all code paths check `p.[[HasValue]]` before using `p.[[Following]]`.

### SetReason ( p , reason )

The operator `SetReason` encapsulates the process of setting a promise's reason and then propagating this to any derived promises.

1. Assert: `p.[[HasValue]]` is `false` and `p.[[HasReason]]` is `false`.
1. Set `p.[[Reason]]` to `reason`.
1. Set `p.[[HasReason]]` to `true`.
1. Set `p.[[Following]]` to `undefined`.
1. Call `PropagateToDerived(p)`.

Note: step 4 is not strictly necessary, as all code paths check `p.[[HasReason]]` before using `p.[[Following]]`.

### CoerceThenable ( thenable , then )

The operator `CoerceThenable` takes a "thenable" object whose `then` method has been extracted and creates a promise from it. It memoizes its results so as to avoid getting inconsistent answers in the face of ill-behaved thenables; the memoized results are later checked by `UpdateDerived`.

1. Assert: `Type(thenable)` is `Object`.
1. Assert: `IsCallable(then)`.
1. Assert: the execution context stack is empty.
1. Let `p` be the result of calling PromiseCreate().
1. Let `resolve(x)` be an ECMAScript function that calls `Resolve(p, x)`.
1. Let `reject(r)` be an ECMAScript function that calls `Reject(p, r)`.
1. Let `result` be `then.[[Call]](thenable, (resolve, reject))`.
1. If `result` is an abrupt completion, call `Reject(p, result.[[value]])`.
1. Call `ThenableCoercions.set(thenable, p)`.
1. Return `p`.

### GetDeferred ( C )

The operator `GetDeferred` takes a potential constructor function, and attempts to use that constructor function in the fashion of the normal promise constructor to extract resolve and reject functions, returning the constructed promise along with those two functions controlling its state. This is useful to support subclassing, as this operation is generic on any constructor that calls a passed resolver argument in the same way as the `Promise` constructor. We use it to generalize static methods of `Promise` to any subclass.

1. If `IsConstructor(C)`,
   1. Let `resolver` be an ECMAScript function that:
      1. Lets `resolve` be the value `resolver` is passed as its first argument.
      1. Lets `reject` be the value `resolver` is passed as its second argument.
   1. Let `promise` be `C.[[Construct]]((resolver))`.
1. Otherwise,
   1. Let `promise` be the result of calling PromiseCreate().
   1. Let `resolve(x)` be an ECMAScript function that calls `Resolve(promise, x)`.
   1. Let `reject(r)` be an ECMAScript function that calls `Reject(promise, r)`.
1. Return the record `{ [[Promise]]: promise, [[Resolve]]: resolve, [[Reject]]: reject }`.

## The Promise Constructor

The `Promise` constructor is the %Promise% intrinsic object and the initial value of the `Promise` property of the global object. When `Promise` is called as a function rather than as a constructor, it initiializes its `this` value with the internal state necessary to support the `Promise.prototype` methods.

The `Promise` constructor is designed to be subclassable. It may be used as the value of an `extends` clause of a class declaration. Subclass constructors that intended to inherit the specified `Promise` behavior must include a `super` call to the `Promise` constructor to initialize the `[[IsPromise]]` state of subclass instances.

### Promise ( resolver )

1. Let _promise_ be the **this** value.
1. If Type(_promise_) is not Object, then throw a **TypeError** exception.
1. If _promise_ does not have an [[IsPromise]] internal data property, then throw a **TypeError** exception.
1. If _promise_'s [[IsPromise]] internal data property is not **undefined**, then throw a **TypeError** exception.
1. Return the result of calling PromiseInitialise(_promise_, _resolver_).

### new Promise ( ... argumentsList )

When `Promise` is called as part of a `new` expression it is a constructor: it initialises a newly created object.

`Promise` called as part of a new expression with argument list _argumentsList_ performs the following steps:

1. Let _F_ be the `Promise` function object on which the `new` operator was applied.
1. Let _argumentsList_ be the _argumentsList_ argument of the [[Construct]] internal method that was invoked by the `new` operator.
1. Return the result of OrdinaryConstruct(_F_, _argumentsList_).

If Promise is implemented as an ordinary function object, its [[Construct]] internal method will perform the above steps.

### Abstract Operations for the Promise Constructor

#### PromiseAlloc ( constructor )

1. Let _obj_ be the result of calling OrdinaryCreateFromConstructor(_constructor_, "%PromisePrototype%", ([[IsPromise]], [[PromiseConstructor]], [[Derived]], [[Following]], [[Value]], [[HasValue]], [[Reason]], [[HasReason]])).
1. Set _obj_'s [[PromiseConstructor]] internal data property to _constructor_.
1. Return _obj_.

#### PromiseInitialise ( obj, resolver )

1. If IsCallable(_resolver_) is **false**, then throw a **TypeError** exception.
1. Set _obj_'s [[IsPromise]] internal data property to **true**.
1. Set _obj_'s [[Derived]] internal data property to a new empty List.
1. Set _obj_'s [[HasValue]] internal data property to **false**.
1. Set _obj_'s [[HasReason]] internal data property to **false**.
1. Let `resolve(x)` be an ECMAScript function that calls `Resolve(obj, x)`.
1. Let `reject(r)` be an ECMAScript function that calls `Reject(obj, r)`.
1. Let _result_ be the result of calling the [[Call]] internal method of _resolver_ with **undefined** as _thisArgument_ and a List containing _resolve_ and _reject_ as _argumentsList_.
1. If _result_ is an abrupt completion, call Reject(obj, _result_.[[value]]).
1. Return _obj_.

#### PromiseCreate ( )

The abstract operation PromiseCreate is used by the specification to create new promise objects in the pending state.

1. Let _obj_ be the result of calling PromiseAlloc(%Promise%).
1. ReturnIfAbrupt(_obj_).
1. Let _resolver_ be a new, empty ECMAScript function object.
1. Return the result of calling PromiseInitialise(_obj_, _resolver_).

## Properties of the Promise Constructor

### Promise \[ @@create \] ( )

1. Let _F_ be the **this** value.
1. Return the result of calling PromiseAlloc(_F_).

This property has the attributes `{ [[Writable]]: false, [[Enumerable]]: false, [[Configurable]]: true }`.

### Promise.resolve ( x )

`Promise.resolve` returns a new promise resolved with the passed argument.

1. Let `deferred` be `GetDeferred(this)`.
1. Call `deferred.[[Resolve]].[[Call]](undefined, (x))`.
1. Return `deferred.[[Promise]]`.

Note: The `resolve` function is an intentionally generic factory method; it does not require that its `this` value be the Promise constructor. Therefore, it can be transferred to or inherited by any other constructors that may be called with a single function argument.

### Promise.reject ( r )

`Promise.reject` returns a new promise rejected with the passed argument.

1. Let `deferred` be `GetDeferred(this)`.
1. Call `deferred.[[Reject]].[[Call]](undefined, (r))`.
1. Return `deferred.[[Promise]]`.

Note: The `reject` function is an intentionally generic factory method; it does not require that its `this` value be the Promise constructor. Therefore, it can be transferred to or inherited by any other constructors that may be called with a single function argument.

### Promise.cast ( x )

`Promise.cast` coerces its argument to a promise, or returns the argument if it is already a promise.

1. Return `ToPromise(this, x)`.

Note: The `cast` function is an intentionally generic utility method; it does not require that its `this` value be the Promise constructor. Therefore, it can be transferred to or inherited by any other constructors that may be called with a single function argument.

### Promise.race ( iterable )

`Promise.race` returns a new promise which is settled in the same way as the first passed promise to settle. It casts all elements of the passed iterable to promises as it runs this algorithm.

1. Let `deferred` be `GetDeferred(this)`.
1. Repeat
   1. Let `next` be `IteratorStep(iterable)`.
   1. If `next` is an abrupt completion,
      1. Call `deferred.[[Reject]].[[Call]](undefined, (next.[[value]]))`.
      1. Return `deferred.[[Promise]]`.
   1. Otherwise, if `next` is `false`, return `deferred.[[Promise]]`.
   1. Otherwise,
      1. Let `nextValue` be `IteratorValue(next)`.
      1. If `nextValue` is an abrupt completion,
         1. Call `deferred.[[Reject]].[[Call]](undefined, (nextValue.[[value]]))`.
         1. Return `deferred.[[Promise]]`.
      1. Otherwise,
         1. Let `nextPromise` be `ToPromise(this, nextValue)`.
         1. Call `Then(nextPromise, deferred.[[Resolve]], deferred.[[Reject]])`.

Note: The `race` function is an intentionally generic utility method; it does not require that its `this` value be the Promise constructor. Therefore, it can be transferred to or inherited by any other constructors that may be called with a single function argument.

### Promise.all ( iterable )

`Promise.all` returns a new promise which is fulfilled with an array of fulfillment values for the passed promises, or rejects with the reason of the first passed promise that rejects. It casts all elements of the passed iterable to promises as it runs this algorithm.

1. Let `deferred` be `GetDeferred(this)`.
1. Let `values` be `ArrayCreate(0)`.
1. Let `countdown` be `0`.
1. Let `index` be `0`.
1. Repeat
   1. Let `next` be `IteratorStep(iterable)`.
   1. If `next` is an abrupt completion,
      1. Call `deferred.[[Reject]].[[Call]](undefined, (next.[[value]]))`.
      1. Return `deferred.[[Promise]]`.
   1. Otherwise, if `next` is `false`,
      1. If `index` is `0`, call `deferred.[[Resolve]].[[Call]](undefined, (values))`.
      1. Return `deferred.[[Promise]]`.
   1. Otherwise,
      1. Let `nextValue` be `IteratorValue(next)`.
      1. If `nextValue` is an abrupt completion,
         1. Call `deferred.[[Reject]].[[Call]](undefined, (nextValue.[[value]]))`.
         1. Return `deferred.[[Promise]]`.
      1. Otherwise,
         1. Let `nextPromise` be `ToPromise(this, nextValue)`.
         1. Let `currentIndex` be the current value of `index`.
         1. Let `onFulfilled(v)` be an ECMAScript function that:
            1. Calls `values.[[DefineOwnProperty]](currentIndex, { [[Value]]: v, [[Writable]]: true, [[Enumerable]]: true, [[Configurable]]: true }`.
            1. Sets `countdown` to `countdown - 1`.
            1. If `countdown` is `0`, calls `deferred.[[Resolve]].[[Call]](undefined, (values))`.
         1. Call `Then(nextPromise, onFulfilled, deferred.[[Reject]])`.
         1. Set `index` to `index + 1`.
         1. Set `countdown` to `countdown + 1`.

Note: The `all` function is an intentionally generic utility method; it does not require that its `this` value be the Promise constructor. Therefore, it can be transferred to or inherited by any other constructors that may be called with a single function argument.

## Properties of the Promise Prototype Object

The `Promise` prototype object is itself an ordinary object. It is not a `Promise` instance and does not have any of the promise instances' internal data properties, such as `[[IsPromise]]`.

The value of the `[[Prototype]]` internal data property of the `Promise` prototype object is the standard built-in `Object` prototype object.

The intrinsic object `%PromisePrototype%` is the initial value of the `"prototype"` data property of the intrinsic `%Promise%`.

### Promise.prototype.constructor

The initial value of `Promise.prototype.constructor` is the built-in `Promise` constructor.

### Promise.prototype.then ( onFulfilled , onRejected )

1. If `IsPromise(this)` is `false`, throw a `TypeError`.
1. Otherwise, return `Then(this, onFulfilled, onRejected)`.

Note: The `then` function is not generic. If the `this` value is not an object with a `[[IsPromise]]` internal data property initialized to `true`, a `TypeError` exception is immediately thrown when it is called.

### Promise.prototype.catch ( onRejected )

1. Return `Invoke(this, "then", (undefined, onRejected))`.

Note: The `catch` function is intentionally generic; it does not require that its `this` value be a Promise object. Therefore, it can be transferred to other kinds of objects for use as a method.

## Properties of Promise Instances

Promise instances are ordinary objects that inherit properties from the Promise prototype (the intrinsic, `%PromisePrototype%`). Promise instances are initially created with the internal properties described in this table.

<table>
    <caption>Internal Data Properties of Promise Instances</caption>
    <thead>
        <tr>
            <th>Internal Data Property Name</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>[[IsPromise]]</td>
            <td>A branding property given to all promises at allocation-time. Uninitialized promises have it set to `undefined`, whereas initialized ones have it set to `true`.</td>
        </tr>
        <tr>
            <td>[[PromiseConstructor]]</td>
            <td>The function object that was used to construct this promise. Checked by `Promise.cast`.</td>
        </tr>
        <tr>
            <td>[[Derived]]</td>
            <td>A List of derived promise transforms that need to be processed once the promise's `[[HasValue]]` or `[[HasReason]]` become `true`.</td>
        </tr>
        <tr>
            <td>[[Following]]</td>
            <td>Another promise that this one is following, or `undefined`.</td>
        </tr>
        <tr>
            <td>[[Value]]</td>
            <td>The promise's direct fulfillment value (from resolving it with a non-thenable). Only meaningful if `[[HasValue]]` is `true`.</td>
        </tr>
        <tr>
            <td>[[HasValue]]</td>
            <td>Whether the promise has a direct fulfillment value or not. This allows distinguishing between no direct fulfillment value, and one of `undefined`.</td>
        </tr>
        <tr>
            <td>[[Reason]]</td>
            <td>The promise's direct rejection reason (from rejecting it). Only meaningful if `[[HasReason]]` is `true`.</td>
        </tr>
        <tr>
            <td>[[HasReason]]</td>
            <td>Whether the promise has a direct rejection reason or not. This allows distinguishing between no direct rejection reason, and one of `undefined`.</td>
        </tr>
    </tbody>
</table>
