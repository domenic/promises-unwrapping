# Examples

Here are some examples of how the spec mechanisms work, mostly as smoke tests that they make sense.

## [[Following]], [[Value]], and [[Reason]]

Remember that only one can be set at a time, so only one is shown here in each test; the other two are unset.

### Resolve to a non-promise

```js
var p = Promise.resolve(5);

assert(p.[[Value]] === 5);
```

### Reject with a non-promise

```js
var p = Promise.reject(5);

assert(p.[[Reason]] === 5);
```

### Resolve to a fulfilled promise

```js
var p0 = Promise.resolve(5);
var p = Promise.resolve(p0);

assert(p.[[Value]] === 5);
```

### Resolve to a pending promise

```js
var p0 = new Promise(() => {});
var p = Promise.resolve(p0);

assert(p.[[Following]] === p0);
```

### Reject with a fulfilled promise

```js
var p0 = Promise.resolve(5);
var p = Promise.reject(p0);

assert(p.[[Reason]] === p0);
```

### Resolve to a promise-resolved-to-a-fulfilled-promise

```js
var p0 = Promise.resolve(5);
var p1 = Promise.resolve(p0);
var p = Promise.resolve(p1);

assert(p.[[Value]] === 5);
```

## `Then` Behavior

### Chain of Pending Promises, Collapsing

```js
var r0;
var p0 = new Promise(r => r0 = r);
var p1 = Promise.resolve(p0);
var p2 = Promise.resolve(p1);
var p = Promise.resolve(p2);

assert(p.[[Following]] === p0);

var r3;
var p3 = new Promise(r => r3 = r);

function f() {
    return p3;
}

var q = p.then(f);
// The above line calls `Then(p, f)`
// - Which calls `Then(p0, f)`
//   - Which adds `{ q, f, undefined }` to `p0.[[OutstandingThens]]`

assert()

var p4 = Promise.resolve(5);
r0.resolve(p4);
// The above line calls `Resolve(p0, p4)`
// - Which sets `p0.[[Value]] to `5`
// - And then calls `ProcessOutstandingThens(p0)`
//   - Which calls `UpdateFromValueOrReason(q, p0, f, undefined)`
//     - Which calls `CallHandler(q, f, 5)`
//       - Which calls `f(5)`, returning `p3`
//       - And then calls `Resolve(q, p3)`
//         - Which sets `q.[[Following]]` to `p3`.

assert(p0.[[Value]] === 5);
assert(q.[[Following]] === p3);

// Note that `p.[[Following]]` has not changed; it is still `p0`.
// I think maybe we want `p.[[Following]]` to have been unset, and then set `p.[[Value]]`?
// Is that what #2 means? Currently we have this situation:

function f2() {
    return 10;
}

var q2 = p.then(f2);
// The above line calls `Then(p, f2)`
// - Which calls `Then(p0, f2)`
//   - Which creates a new promise, call it `qq`,
//   - And then calls `UpdateFromValueOrReason(qq, p0, f2)
//     - Which calls `CallHandler(qq, f2, 5)`
//       - Which calls `f2(5)`, returning `10`
//       - And then calls `Resolve(qq, 10)`
//         - Which sets `qq.[[Value]]` to `10`
//         - And calls `ProcessOutstandingThens(qq)
//           - Which does nothing
//   - And then returns `qq` (which gets assigned to `q2`)

// I believe fixing #2 would be intended to remove the very first step here, i.e. the result would be
// The above line calls `Then(p, f2)`
// - Which creates a new promise, call it `qq`,
// - And then calls `UpdateFromValueOrReason(qq, p, f2)
//   - Which calls `CallHandler(qq, f2, 5)`
//     - Which calls `f2(5)`, returning `10`
//     - And then calls `Resolve(qq, 10)`
//       - Which sets `qq.[[Value]]` to `10`
//       - And calls `ProcessOutstandingThens(qq)
//         - Which does nothing
// - And then returns `qq` (which gets assigned to `q2`)
```
