# Examples

Here are some examples of how the spec mechanisms work. There used to be more, but they became outdated, and less necessary since we can now use the Promises/A+ tests to ensure the algorithms are sensible.

However, please feel free to pull request new examples; it would be helpful to have some illustrations of various workflows.

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
