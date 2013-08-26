# Promise Unwrapping Algorithm

In a world with only `resolve`, `reject`, and `then`, what is the *exact* algorithm for how these interact? We want to maintain forward-compatibility with a full "AP2" proposal that includes `accept` and `flatMap`, in particular by doing only one level of unwrapping in `resolve` and leaving the rest for `then`.

## Specification Primitives (Pure Promises Version)

This version does not contain the concept of thenables, and is thus simpler since it does not have to compensate for malicious behavior.

### Promise Internal Properties

A promise `p` carries several internal properties:

- `p.[[IsPromise]]`: all promises have this property, and no other objects do.
- `p.[[Following]]`: either unset, or a promise that `p` is following.
- `p.[[Value]]`: either unset, or promise's direct fulfillment value (derived by calling its resolver's `resolve` with a non-promise).
- `p.[[Reason]]`: either unset, or a promise's direct rejection reason (derived by calling its resolver's `reject`).
- `p.[[OutstandingThens]]`: a list, initially empty, of `{ promise, onFulfilled, onRejected }` tuples that need to be processed once one of the above three properties is set.

### Abstract Operation `IsPromise(x)`

1. Return `true` if `IsObject(x)` and `x.[[IsPromise]]` is set.
1. Otherwise, return `false`.

### Abstract Operation `Resolve(p, x)`

1. If `p.[[Following]]`, `p.[[Value]]`, or `p.[[Reason]]` are set, terminate these steps.
1. If `IsPromise(x)`,
   1. If `x.[[Following]]` is set, let `p.[[Following]]` be `x.[[Following]]`.
   1. Otherwise, if `x.[[Value]]` is set, call `SetValue(p, x.[[Value]])`.
   1. Otherwise, if `x.[[Reason]]` is set, call `SetReason(p, x.[[Reason]])`.
   1. Otherwise,
      1. Let `p.[[Following]]` be `x`.
      1. Add `{ p, undefined, undefined }` to `x.[[OutstandingThens]]`.
1. Otherwise, call `SetValue(p, x)`.

### Abstract Operation `Reject(p, r)`

1. If `p.[[Following]]`, `p.[[Value]]`, or `p.[[Reason]]` are set, terminate these steps.
1. Call `SetReason(p, r)`.

### Abstract Operation `Then(p, onFulfilled, onRejected)`

1. If `p.[[Following]]` is set,
   1. Return `Then(p.[[Following]], onFulfilled, onRejected)`.
1. Otherwise,
   1. Let `q` be a new promise.
   1. If `p.[[Value]]` or `p.[[Reason]]` is set, call `UpdateFromValueOrReason(q, p, onFulfilled, onRejected)`.
   1. Otherwise, add `{ q, onFulfilled, onRejected }` to `p.[[OutstandingThens]]`.
   1. Return `q`.

### Abstract Operation `ProcessOutstandingThens(p)`

1. For each tuple `{ derivedPromise, onFulfilled, onRejected }` in `p.[[OutstandingThens]]`,
   1. Call `UpdateFromValueOrReason(derivedPromise, p, onFulfilled, onRejected)`.
1. Clear `p.[[OutstandingThens]]`.

Note: step 2 is not strictly necessary, as preconditions prevent `p.[[OutstandingThens]]` from ever being used again after this point.

### Abstract Operation `UpdateFromValueOrReason(toUpdate, p, onFulfilled, onRejected)`

1. Assert: exactly one of `p.[[Value]]` or `p.[[Reason]]` is set.
1. If `p.[[Value]]` is set,
   1. If `IsCallable(onFulfilled)`, call `CallHandler(toUpdate, onFulfilled, p.[[Value]])`.
   1. Otherwise, call `SetValue(toUpdate, p.[[Value]])`.
1. Otherwise, if `p.[[Reason]]` is set,
   1. If `IsCallable(onRejected)`, call `CallHandler(toUpdate, onRejected, p.[[Reason]])`.
   1. Otherwise, call `SetReason(toUpdate, p.[[Reason]])`.

### Abstract Operation `CallHandler(returnedPromise, handler, argument)`

Queue a microtask to do the following:

1. Let `v` be `handler(argument)`.
1. If this call throws an exception `e`, do `Reject(returnedPromise, e)`.
1. Otherwise, call `Resolve(returnedPromise, v)`.

### Abstract Operation `SetValue(p, value)`

1. Assert: neither `p.[[Value]]` nor `p.[[Reason]]` are set.
1. Set `p.[[Value]]` to `value`.
1. Unset `p.[[Following]]`. (Note: this is not strictly necessary, as all code paths check `p.[[Value]]` before using `p.[[Following]]`.)
1. Call `ProcessOutstandingThens(p)`.

### Abstract Operation `SetReason(p, reason)`

1. Assert: neither `p.[[Value]]` nor `p.[[Reason]]` are set.
1. Set `p.[[Reason]]` to `reason`.
1. Unset `p.[[Following]]`.
1. Call `ProcessOutstandingThens(p)`.

Note: step 3 is not strictly necessary, as all code paths check `p.[[Reason]]` before using `p.[[Following]]`.

## Manifestation As Methods

As you'd expect:

- `promise.then(onFulfilled, onRejected)` calls the abstract operation `Then(promise, onFulfilled, onRejected)`
- For a promise `promise` with resolver `resolver`,
  - `resolver.resolve(x)` calls the abstract operation `Resolve(promise, x)`
  - `resolver.reject(r)` calls the abstract operation `Reject(promise, r)`

The reason we express the abstract operations first, and define the methods only indirectly in terms of that, is so that the above algorithms can call the abstract operations without fear of triggering overwritten or trapped versions of the methods. This also guarantees that side effects are not observable, and thus implementations can optimize as long as they follow these semantics. E.g. they could inline part of the recursion of the `Then` abstract operation, and avoid being forced to trigger any overwritten `then` methods and possibly messing up internal state.

## Cursory Explanation

The recursion happens in two ways:

- In `Then`, if the chain ends in a settled promise, it just recurses `Then` into `Then` into `Then` until it hits `Then(terminalSettledPromise, ...)`.
- In `Resolve` and `Reject`, if the promise becomes settled and there are `[[OutstandingThens]]` queued up on it, `ProcessOutstandingThens` will process those outstanding `then` calls, recursively processing any other `then` calls on promises derived from those promises.

The above does not memoize the results of recursive `then`ing. That is, after traversing the chain of followed promises to finally find a settled one, you could theoretically overwrite the original promise's `[[Value]]` or `[[Reason]]` so that future `Then` calls on that promise do not need to do the chain traversal. But, this should not matter for the pure-promises case; the result should always be the same.
