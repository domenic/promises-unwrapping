# Promise Unwrapping Algorithm

In a world with only `resolve`, `reject`, and `then`, what is the *exact* algorithm for how these interact? We want to maintain forward-compatibility with a full "AP2" proposal that includes `accept` and `flatMap`, in particular by doing only one level of unwrapping in `resolve` and leaving the rest for `then`.

## States and Fates

Promises have three possible mutually exclusive states: fulfilled, rejected, and pending.

- A promise is fulfilled if `promise.then(f)` will call `f` "as soon as possible."
- A promise is rejected if `promise.then(undefined, r)` will call `r` "as soon as possible."
- A promise is pending if it is neither fulfilled nor rejected.

We say that a promise is settled if it is not pending, i.e. if it is either fulfilled or rejected. Being settled is not a state, just a linguistic convenience.

Promises have two possible mutually exclusive fates: resolved, and unresolved.

- A promise is resolved if calling any of its resolver's methods has no effect, i.e. the promise has been "locked in" to either follow another promise, or has been fulfilled or rejected.
- A promise is unresolved if it is not resolved, i.e. if calling `resolver.resolve` or `resolver.reject` will impact the promise.

A promise can be "resolved to" either a promise, in which case it follows the promise, or a non-promise value, in which case it is fulfilled with that value.

A promise whose fate is resolved can be in any of the three states:

- Fulfilled, if its resolver's `resolve` has been called with a non-promise value, or if its resolver's `resolve` has been called with another promise that is fulfilled.
- Rejected, if its resolver's `reject` has been called with a non-promise value, or if its resolver's `resolve` has been called with another promise that is rejected.
- Pending, if its resolver's `resolve` has been called with another promise that is pending.

Note that these definitions are recursive, e.g. a promise that has been resolved to a promise that has been resolved to a promise that has been fulfilled is itself fulfilled.

## Operations, Pure Promises Version

This version does not contain the concept of promise-likes, and is thus simpler since it does not have to compensate for malicious behavior.

### Basics

A promise `p` carries several internal properties:

- `p.[[Following]]`: either unset, or a promise that `p` is following.
- `p.[[Value]]`: either unset, or promise's direct fulfillment value (derived by calling its resolver's `resolve` with a non-promise).
- `p.[[Reason]]`: either unset, or a promise's direct rejection reason (derived by calling its resolver's `reject`).
- `p.[[OustandingThens]]`: a list, initially empty, of `{ promise, onFulfilled, onRejected }` tuples that need to be processed once one of the above three properties is set.

There is an abstract operation `IsPromise(x)` which checks that `x` is a promise; this could be as simple as `x instanceof Promise` or a more complex branding mechanism.

### Abstract Operation `Resolve(p, x)`

1. If `p.[[Following]]`, `p.[[Value]]`, or `p.[[Reason]]` are set, terminate these steps.
1. If `IsPromise(x)`,
   1. If `x.[[Following]]` is set, let `p.[[Following]]` be `x.[[Following]]`.
   1. Otherwise, if `x.[[Value]]` is set, let `p.[[Value]]` be `x.[[Value]]` and call `ProcessOutstandingThens(p)`.
   1. Otherwise, if `x.[[Reason]]` is set, let `p.[[Reason]]` be `x.[[Reason]]` and call `ProcessOutstandingThens(p)`.
   1. Otherwise, let `p.[[Following]]` be `x`.
1. Otherwise, let `p.[[Value]]` be `x`.

### Abstract Operation `Reject(p, r)`

1. If `p.[[Following]]`, `p.[[Value]]`, or `p.[[Reason]]` are set, terminate these steps.
1. Let `p.[[Reason]]` be `r`. and call `ProcessOutstandingThens(p)`.

### Abstract Operation `Then(p, onFulfilled, onRejected)`

1. If `p.[[Following]]` is set,
   1. Return `Then(p.[[Following]], onFulfilled, onRejected)`. (Note that this could recurse, if `p.[[Following]].[[Following]]` is set.)
1. Otherwise, let `q` be a new promise.
1. If `p.[[Value]]` or `p.[[Reason]]` is set,
   1. Call `UpdateFromValueOrReason(q, p, onFulfilled, onRejected)`.
1. Otherwise, add `{ q, onFulfilled, onRejected }` to `p.[[OutstandingThens]]`.
1. Return `q`.

### Abstract Operation `CallHandler(returnedPromise, handler, argument)`

Queue a microtask to do the following:

1. Call `handler(argument)`.
1. If this call throws an exception `e`, do `Reject(returnedPromise, e)`.
1. Otherwise, let `v` be its return value, and call `Resolve(returnedPromise, v)`.

### Abstract Operation `ProcessOutstandingThens(p)`

1. For each tuple `{ derivedPromise, onFulfilled, onRejected }` in `p.[[OutstandingThens]]`,
   1. Call `UpdateFromValueOrReason(derivedPromise, p, onFulfilled, onRejected)`.
   1. Call `ProcessOutstandingThens(derivedPromise)`.
1. Clear `p.[[OutstandingThens]]`. (Note: this is not strictly necessary, as preconditions prevent `p.[[OustandingThens]]` from ever being used again after this point.)

### Abstract Operation `UpdateFromValueOrReason(toUpdate, p, onFulfilled, onRejected)`

1. Assert: exactly one of `p.[[Value]]` or `p.[[Reason]]` is set.
1. If `p.[[Value]]` is set,
   1. If `onFulfilled` is a function, perform abstract operation `CallHandler(toUpdate, onFulfilled, p.[[Value]])`.
   1. Otherwise, let `toUpdate.[[Value]]` be `settledPromise.[[Value]]`.
1. Otherwise, if `p.[[Reason]]` is set,
   1. If `onRejected` is a function, perform abstract operation `CallHandler(toUpdate, onRejected, p.[[Reason]])`.
   1. Otherwise, let `toUpdate.[[Reason]]` be `settledPromise.[[Reason]]`.

### Manifestation As Methods

As you'd expect:

- `p.then(onFulfilled, onRejected)` calls the abstract operation `Then(p, onFulfilled, onRejected)`
- For a promise `p` with resolver `r`,
  - `r.resolve(x)` calls the abstract operation `Resolve(p, x)`
  - `r.reject(r)` calls the abstract operation `Reject(p, r)`

The reason we don't express the algorithms above in terms of exact method calls is so that the side effects are not observable, and thus implementations can optimize as long as they follow these semantics. E.g. they could inline part of the recursion of the `Then` abstract operation, instead of necessarily triggering any overwritten `then` methods and possibly messing up internal state. This may be unnecessary and overcautious though; thoughts?

## Cursory Explanation

The recursion happens in two ways:

- In `Then`, if the chain ends in settled promises, it just recurses `Then` into `Then` into `Then` until it hits `Then(terminalSettledPromise, ...)`.
- In `Resolve` and `Reject`, if the promise becomes settled and there are `[[OutstandingThens]]` queued up on it, `ProcessOutstandingThens` will process those outstanding `then` calls, recursively processing any other `then` calls on promises derived from those promises.

The above does not memoize the results of recursive `then`ing. That is, after traversing the chain of followed promises to finally find a settled one, you could theoretically overwrite the original promise's `[[Value]]` or `[[Reason]]` so that future `Then` calls on that promise do not need to do the chain traversal. But, this should not matter for the pure-promises case; the result should always be the same.
