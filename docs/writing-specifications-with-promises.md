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

You should *never* do a type-detection on the incoming value, or overload between promises and other values, or put promises in a union type.

### Rejections Should Be `Error`s

Promise rejections should always be instances of the ECMAScript `Error` type, just like synchronously-thrown exceptions should always be instances of `Error` as well.

In particular, for DOM or other web platform specs, this means you should never use `DOMError`, but instead use `DOMException`, which [per WebIDL](http://heycam.github.io/webidl/#es-exceptions) extends `Error`.

### Rejections Should Be Used for Exceptional Situations

What exactly you consider "exceptional" is up for debate, as always. But, you should always ask, before rejecting a promise: if this function was synchronous, would I expect a thrown exception under this circumstance? Or perhaps a failure value (like `null` or `false`)?

For example, perhaps a user denying permission to use an API shouldn't be considered exceptional. Or perhaps it should! Just think about which behavior is more useful for consumers of your API, and if you're not sure, pretend your API is synchronous and then think if your users would want a thrown exception or not.

### Promise-Returning Functions Should Never Throw

Promise-returning functions should never synchronously throw errors, since that would force duplicate error-handling logic on the consumer. Even argument validation errors are not OK. Instead, they should return rejected promises.

For WebIDL-based specs, this will require [fixes to WebIDL](https://www.w3.org/Bugs/Public/show_bug.cgi?id=24000), which are underway. (See also [W3C bug #21740](https://www.w3.org/Bugs/Public/show_bug.cgi?id=21740).)

### No Need to Create Callbacks

Another guideline geared toward WebIDL-based specs. Unlike in the old world of callbacks, there's no need to create separate callback types for your success and error cases. Instead, just use the verbiage above. Create _promise_ as one of your first steps, using "let _promise_ be a newly-created promise," then later, when it's time to resolve or reject it, say e.g. "resolve _promise_ with _value_" or "reject _promise_ with a new DOMException whose name is `"AbortError"`."

### Maintain a Normal Control Flow

An antipattern that has been prevalent in async web specifications has been returning a value, then "continue running these steps asynchronously." This is hard to deal with for readers, because JavaScript doesn't let you do anything after returning from a function! Use promises to simplify your control flow into a normal linear sequence of steps:

- First, create the promise
- Then, describe how you'll perform the async operation—these are often "magic," e.g. asking for user input or appealing to the network stack. Say that if the operation succeeds, you'll resolve the promise, possibly with an appropriate value, and that if it fails, you'll reject it with an appropriate error.
- Finally, return the created promise.

### Do Not Queue Needless Tasks

Sometimes specs explicitly [queue a task](http://www.whatwg.org/specs/web-apps/current-work/#task-queue) to perform async work. This is never necessary with promises! Promises ensure all invariants you would otherwise gain by doing this. Instead, just appeal to environmental asynchrony (like user input or the network stack), and from there resolve the promise.

## Examples

#### delay( ms )

`delay` is a function that returns a promise that will be fulfilled in _ms_ milliseconds. It illustrates how simply you can resolve a promise, with one line of prose.

1. Let _p_ be a newly-created promise.
1. In _ms_ milliseconds, resolve _p_ with **undefined**.
1. Return _p_.

#### environment.ready

environment.ready is a property that signals when some part of some environment becomes "ready," e.g. a DOM document. Notice how it appeals to environmental asynchrony.

1. Let Environment.ready be a newly-created promise.
1. When/if the environment becomes ready, resolve Environment.ready with **undefined**.
1. When/if the environment fails to load, reject Environment.ready with an **Error** instance explaining the load failure.

#### addDelay( promise, ms )

`addDelay` is a function that adds an extra _ms_ milliseconds of delay between _promise_ settling and the returned promise settling. Notice how it casts the incoming argument to a promise, so that you could pass it a non-promise value or a thenable.

1. Let _p_ be a newly-created promise.
1. Let onFulfilled(_v_) be a function that waits _ms_ milliseconds, then resolves _p_ with _v_.
1. Let onRejected(_r_) be a function that waits _ms_ milliseconds, then rejects _p_ with _r_.
1. Let _castToPromise_ be the result of casting _promise_ to a promise.
1. Transform _castToPromise_ with _onFulfilled_ and _onRejected_.
1. Return _p_.

#### addBookmark ( )

`addBookmark` is a function that requests that the user add the current web page as a bookmark. It's drawn from some iterative design work in [#85](https://github.com/domenic/promises-unwrapping/issues/85).

1. If this method was not invoked as a result of explicit user action, return a promise rejected with a new `DOMException` whose name is `"SecurityError"`.
1. If the document's mode of operation is standalone, return a promise rejected with a new `DOMException` whose name is `"NotSupported"`.
1. Let _promise_ be a newly-created promise.
1. Let _info_ be the result of getting a web application's metadata.
1. Using _info_, and in a manner that is user-agent specific, allow the end user to make a choice as to whether they want to add the bookmark.
    1. If the end-user aborts the request to add the bookmark (e.g., they hit escape, or press a "cancel" button), reject _promise_ with a new `DOMException` whose name is `"AbortError"`.
    1. Otherwise, resolve _promise_ with **undefined**.
1. Return _promise_.
