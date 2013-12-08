# States and Fates

This document helps clarify the different adjectives surrounding promises, by dividing them up into two categories: *states* and *fates*.

## Overview and Operational Definitions

### States

Promises have three possible mutually exclusive states: fulfilled, rejected, and pending.

- A promise is *fulfilled* if `promise.then(f)` will call `f` "as soon as possible."
- A promise is *rejected* if `promise.then(undefined, r)` will call `r` "as soon as possible."
- A promise is *pending* if it is neither fulfilled nor rejected.

We say that a promise is *settled* if it is not pending, i.e. if it is either fulfilled or rejected. Being settled is not a state, just a linguistic convenience.

### Fates

Promises have two possible mutually exclusive fates: resolved, and unresolved.

- A promise is *resolved* if trying to resolve or reject it has no effect, i.e. the promise has been "locked in" to either follow another promise, or has been fulfilled or rejected.
- A promise is *unresolved* if it is not resolved, i.e. if trying to resolve or reject it will have an impact on the promise.

A promise can be "resolved to" either a promise or thenable, in which case it will store the promise or thenable for later unwrapping; or it can be resolved to a non-promise value, in which case it is fulfilled with that value.

### Relating States and Fates

A promise whose fate is resolved can be in any of the three states:

- Fulfilled, if it has been resolved to a non-promise value, or resolved to a thenable which will call any passed fulfillment handler back as soon as possible, or resolved to another promise that is fulfilled.
- Rejected, if it has been rejected directly, or resolved to a thenable which will call any passed rejection handler back as soon as possible, or resolved to another promise that is rejected.
- Pending, if it has been resolved to a thenable which will call neither handler back as soon as possible, or resolved to another promise that is pending.

A promise whose fate is unresolved is necessarily pending.

Note that these relations are recursive, e.g. a promise that has been resolved to a thenable which will call its fulfillment handler with a promise that has been rejected is itself rejected.

## Relation to the Spec

## Fates

- A promise _p_ is resolved if the value of _p_'s [[PromiseStatus]] internal slot is `"has-resolution"` or `"has-rejection"`.
- A promise _p_ is unresolved if the value of _p_'s [[PromiseStatus]] internal slot is `"unresolved"`.

### Undeterminability of State

You cannot derive a promise's state directly from its internal slots. For example, a promise may be pending even if its [[PromiseStatus]] is `"has-resolution"`, if its [[Result]] is another pending promise. Or, a promise may be rejected if its [[Result]] is set to a thenable that will call any passed rejection handler. In fact, due to the way promises can be resolved with other promises or with thenables, a promise's state cannot be determined until it has been measured at least once, by calling `promise.then(...)`, since it is only when the promise's `then` method is called that any unwrapping of its resolution takes place.
