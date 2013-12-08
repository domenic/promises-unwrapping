# Writing Promise-Using Specifications

Here are some tools and guidance for writing specifications that create, accept, or manipulate promises.

## Shorthand Phrases

When writing such specifications, it's convenient to be able to refer to common promise operations concisely. We define here a set of shorthands that allow you to do so.

### Creating Promises

**"A newly-created promise"** gives a new, initialized-but-unresolved promise object to manipulate further. It is equivalent to calling `new Promise(() => {})`, using the initial value of `Promise`.

**"A promise resolved with _x_"** is shorthand for the result of `Promise.resolve(x)`, using the initial value of `Promise.resolve`.

**"A promise rejected with _r_"** is shorthand for the result of `Promise.reject(r)`, using the initial value of `Promise.reject`.

**"_x_ cast to a promise"** is shorthand for the result of `Promise.cast(x)`, using the initial value of `Promise.cast`.

### Manipulating Promises

**"Resolve _p_ with _x_"** is shorthand for calling ResolvePromise(_p_, _x_).

**"Reject _p_ with _r_"** is shorthand for calling RejectPromise(_p_, _r_).

**"Transforming _p_ with _onFulfilled_ and _onRejected_"** is shorthand for the result of `p.then(onFulfilled, onRejected)`, using the initial value of `Promise.prototype.then`.

### Aggregating Promises

**"Racing _p1_, _p2_, _p3_, …"** is shorthand for the result of `Promise.race([p1, p2, p3, …])`, using the initial value of `Promise.race`.

**"Racing _iterable_"** is shorthand for the result of `Promise.race(iterable)`, using the initial value of `Promise.race`.

**"Waiting for all of _p1_, _p2_, _p3_, …"** is shorthand for the result of `Promise.all([p1, p2, p3, …])`, using the initial value of `Promise.all`.

**"Waiting for all of _iterable_"** is shorthand for the result of `Promise.all(iterable)`, using the initial value of `Promise.all`.

## Guidance

### Promise Arguments Should Be Cast

In general, when an argument is expected to be a promise, you should also allow thenables and non-promise values by casting the argument to a promise before using it.

### Rejections Should Be `Error`s

Promise rejections should always be instances of the ECMAScript `Error` type, just like synchronously-thrown exceptions should always be instances of `Error` as well.

### Promise-Returning Functions Should Never Throw

Promise-returning functions should never synchronously throw errors, since that would force duplicate error-handling logic on the consumer. Even argument validation errors are not OK. Instead, they should return rejected promises.

## Examples

#### assertIsObject( x )

`assertIsObject` is a very simple function that returns a fulfilled promise if passed an object, and a rejected one if it is not an object.

1. If Type(_x_) is Object, return a promise resolved with **undefined**.
1. Otherwise, return a promise rejected with a **TypeError** having message `"Not an object!"`.

#### environment.ready

environment.ready is a property that signals when some part of some environment becomes "ready," e.g. a DOM document.

1. Let Environment.ready be a newly-created promise.
1. When/if the environment becomes ready, resolve Environment.ready with **undefined**.
1. When/if the environment fails to load, reject Environment.ready with an **Error** instance explaining the load failure.

#### delay( ms )

`delay` is a function that returns a promise that will be fulfilled in _ms_ milliseconds.

1. Let _p_ be a newly-created promise.
1. In _ms_ milliseconds, resolve _p_ with **undefined**.
1. Return _p_.

#### addDelay( promise, ms )

`addDelay` is a function that adds an extra _ms_ milliseconds of delay between _promise_ settling and the returned promise settling.

1. Let _p_ be a newly-created promise.
1. Let onFulfilled(_v_) be a function that waits _ms_ milliseconds, then resolves _p_ with _v_.
1. Let onRejected(_r_) be a function that waits _ms_ milliseconds, then rejects _p_ with _r_.
1. Let _castToPromise_ be the result of casting _promise_ to a promise.
1. Transform _castToPromise_ with _onFulfilled_ and _onRejected_.
1. Return _p_.
