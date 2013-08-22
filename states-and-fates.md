# States and Fates

## Overview and Operational Definitions

### States

Promises have three possible mutually exclusive states: fulfilled, rejected, and pending.

- A promise is *fulfilled* if `promise.then(f)` will call `f` "as soon as possible."
- A promise is *rejected* if `promise.then(undefined, r)` will call `r` "as soon as possible."
- A promise is *pending* if it is neither fulfilled nor rejected.

We say that a promise is *settled* if it is not pending, i.e. if it is either fulfilled or rejected. Being settled is not a state, just a linguistic convenience.

### Fates

Promises have two possible mutually exclusive fates: resolved, and unresolved.

- A promise is *resolved* if calling any of its resolver's methods has no effect, i.e. the promise has been "locked in" to either follow another promise, or has been fulfilled or rejected.
- A promise is *unresolved* if it is not resolved, i.e. if calling `resolver.resolve` or `resolver.reject` will impact the promise.

A promise can be "resolved to" either a promise, in which case it follows the promise, or a non-promise value, in which case it is fulfilled with that value.

### Relating States and Fates

A promise whose fate is resolved can be in any of the three states:

- Fulfilled, if its resolver's `resolve` has been called with a non-promise value, or if its resolver's `resolve` has been called with another promise that is fulfilled.
- Rejected, if its resolver's `reject` has been called with a value, or if its resolver's `resolve` has been called with another promise that is rejected.
- Pending, if its resolver's `resolve` has been called with another promise that is pending.

A promise whose fate is unresolved is necessarily pending.

Note that these relations are recursive, e.g. a promise that has been resolved to a promise that has been resolved to a promise that has been fulfilled is itself fulfilled.

## Definitions in Spec Terms

Note that you cannot derive a promise's state directly from the [spec primitives](README.md) `[[Following]]`, `[[Value]]`, and `[[Reason]]`. For example, a promise may be fulfilled even if `p.[[Value]]` is unset, as long as `p.[[Following]].[[Value]]` or `p.[[Following]].[[Following]].[[Value]]` or ... is set. Instead, we have these definitions:

### States

- A promise `p` is fulfilled if `p.[[Value]]` is set, or if `p.[[Following]]` is fulfilled.
- A promise `p` is rejected if `p.[[Reason]]` is set, or if `p.[[Following]]` is rejected.
- A promise `p` is pending if `p.[[Value]]` and `p.[[Reason]]` are unset, and either `p.[[Following]]` is unset or `p.[[Following]]` is pending.

### Fates

- A promise `p` is resolved if `p.[[Value]]`, `p.[[Reason]]`, or `p.[[Following]]` are set.
- A promise `p` is unresolved if none of `p.[[Value]]`, `p.[[Reason]]`, or `p.[[Following]]` are set.
