# Writing Promise-Using Specifications

Here are some tools and guidance for writing specifications that create, accept, or manipulate promises.

## Shorthand Phrases

When writing such specifications, it's convenient to be able to refer to common promise operations concisely. We define here a set of shorthands that allow you to do so.

### Creating Promises

**"A newly-created promise object"** gives a new, initialized-but-unresolved promise object to manipulate further.

**"A promise resolved with `x`"** is shorthand for the result of creating a promise `p`, then calling `Resolve(p, x)`.

**"A promise rejected with `x`"** is shorthand for the result of creating a promise `p`, then calling `Reject(p, x)`.

**"`x` cast to a promise"** is shorthand for the result of `ToPromise(x)`.

### Manipulating Promises

**"Resolve `p` with `x`"** is shorthand for calling `Resolve(p, x)`.

**"Reject `p` with `r`"** is shorthand for calling `Reject(p, r)`.

**"Transforming `p` with `onFulfilled` and `onRejected`"** is shorthand for the result of `Then(p, onFulfilled, onRejected)`.

### Aggregating Promises

**"Racing `p1`, `p2`, `p3`, …"** is shorthand for the result of `Promise.race([p1, p2, p3, …])`, using the initial value of `Promise.race`.

**"Racing `iterable`"** is shorthand for the result of `Promise.race(iterable)`, using the initial value of `Promise.race`.

**"Waiting for all of `p1`, `p2`, `p3`, …"** is shorthand for the result of `Promise.all([p1, p2, p3, …])`, using the initial value of `Promise.all`.

**"Waiting for all of `iterable`"** is shorthand for the result of `Promise.all(iterable)`, using the initial value of `Promise.all`.

## Guidance

### Promise Arguments Should Be Cast

In general, when an argument is expected to be a promise, you should also allow thenables and non-promise values by casting the argument to a promise before using it.

### Rejections Should Be `Error`s

Promise rejections should always be instances of the ECMAScript `Error` type, just like synchronously-thrown exceptions should always be instances of `Error` as well.

### Promise-Returning Functions Should Never Throw

Promise-returning functions should never synchronously throw errors, since that would force duplicate error-handling logic on the consumer. Even argument validation errors are not OK. Instead, they should return rejected promises.

## Examples

#### `assertIsObject(x)`

`assertIsObject` is a very simple function that returns a fulfilled promise if passed an object, and a rejected one if it is not an object.

1. If `Type(x)` is `Object`, return a promise resolved with `undefined`.
1. Otherwise, return a promise rejected with a `TypeError` having message `"Not an object!"`.

#### `environment.ready`

`environment.ready` is a property that signals when some part of some environment becomes "ready," e.g. a DOM document.

1. Let `Environment.ready` be a newly-created promise.
1. When/if the environment becomes ready, resolve `Environment.ready` with `undefined`.
1. When/if the environment fails to load, reject `Environment.ready` with an `Error` instance explaining the load failure.

#### `delay(ms)`

`delay` is a function that returns a promise that will be fulfilled in `ms` milliseconds.

1. Let `p` be a newly-created promise.
1. In `ms` milliseconds, resolve `p` with `undefined`.
1. Return `p`.

#### `addDelay(promise, ms)`

`addDelay` is a function that adds an extra `ms` milliseconds of delay between `promise` settling and the returned promise settling.

1. Let `p` be a newly-created promise.
1. Let `onFulfilled(v)` be a function that waits `ms` milliseconds, then resolves `p` with `v`.
1. Let `onRejected(r)` be a function that waits `ms` milliseconds, then rejects `p` with `r`.
1. Let `castToPromise` be the result of casting `promise` to a promise.
1. Transform `castToPromise` with `onFulfilled` and `onRejected`.
1. Return `p`.
