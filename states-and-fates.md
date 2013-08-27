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

- A promise is *resolved* if trying to resolve or reject it has no effect, i.e. the promise has been "locked in" to either follow another promise, or has been fulfilled or rejected.
- A promise is *unresolved* if it is not resolved, i.e. if trying to resolve or reject it will have an impact on the promise.

A promise can be "resolved to" either a promise, in which case it follows the promise, or to a thenable, in which case it "accepts" the thenable for later unwrapping, or to a non-promise value, in which case it is fulfilled with that value.

### Relating States and Fates

A promise whose fate is resolved can be in any of the three states:

- Fulfilled, if it has been resolved to a non-promise value, or resolved to a thenable which will call any passed fulfillment handler back as soon as possible, or resolved to another promise that is fulfilled.
- Rejected, if it has been rejected directly, or resolved to a thenable which will call any passed rejection handler back as soon as possible, or resolved to another promise that is rejected.
- Pending, if it has been resolved to a thenable which will call neither handler back as soon as possible, or resolved to another promise that is pending.

A promise whose fate is unresolved is necessarily pending.

Note that these relations are recursive, e.g. a promise that has been resolved to a thenable which will call its fulfillment handler with a promise that has been rejected is itself rejected.

## Relation to the Spec

### Undeterminability of State

You cannot derive a promise's state directly from the [spec primitives](README.md) `[[Following]]`, `[[Value]]`, and `[[Reason]]`. For example, a promise may be fulfilled even if `p.[[Value]]` is unset, as long as `p.[[Following]].[[Value]]` is set. Or a promise may be rejected if `p.[[Value]]` is set to a thenable that will call any passed rejection handler. In fact, due to the impact of thenables, a promise's state cannot be determined until it has been measured at least once, by calling `promise.then(...)`, since it is only when the promise's `then` method is called that any unwrapping of "accepted" thenables takes place.

## Fates

- A promise `p` is resolved if `p.[[Value]]`, `p.[[Reason]]`, or `p.[[Following]]` are set.
- A promise `p` is unresolved if none of `p.[[Value]]`, `p.[[Reason]]`, or `p.[[Following]]` are set.
