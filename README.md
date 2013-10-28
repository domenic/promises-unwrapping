# Promise Objects

This repository is meant to fully flesh out a subset of the "AP2" promise consensus developed over the last month on es-discuss. In particular, it provides the subset the DOM needs as soon as possible, omitting `flatMap` for now but building a conceptual foundation that would allow it to be added at a later date.

It is meant to succeed the current [DOM Promises](http://dom.spec.whatwg.org/#promises) spec, and fixes a number of bugs in that spec while also changing some of the exposed APIs and behavior to make it more forward-compatible with the full AP2 consensus.

## Record Types for Promise Objects

### The Deferred Specification Type

The Deffered type is used to encapsulate newly-created promise objects along with functions that resolve or reject them. Deferred objects are derived by the GetDeferred abstract operation from either the Promise constructor itself or from a constructor that subclasses the Promise constructor. This mechanism allows promise subclasses to install custom resolve and reject behavior by creating constructors that pass appropriate functions to their resolver argument.

Deferreds are Records composed of three named fields:

- [[Promise]]: the newly-created promise object
- [[Resolve]]: a function that is presumed to resolve the given promise object
- [[Reject]]: a function that is presumed to reject the given promise object

## Abstract Operations for Promise Objects

### GetDeferred ( C )

The abstract operation GetDeferred takes a potential constructor function, and attempts to use that constructor function in the fashion of the normal promise constructor to extract resolve and reject functions, returning the constructed promise along with those two functions controlling its state. This is useful to support subclassing, as this operation is generic on any constructor that calls a passed resolver argument in the same way as the Promise constructor. We use it to generalize static methods of the Promise constructor to any subclass.

1. If IsConstructor(_C_) is **false**, throw a **TypeError**.
1. Let _deferred_ be the Deferred { [[Promise]]: **undefined**, [[Resolve]]: **undefined**, [[Reject]]: **undefined** }.
1. Let _resolver_ be a new built-in function object as defined in Deferred Construction Functions.
1. Set the value of _resolver_'s [[Deferred]] internal slot to _deferred_.
1. Let _promise_ be the result of calling the [[Construct]] internal method of _C_ with an argument list containing the single item _resolver_.
1. ReturnIfAbrupt(_promise_).
1. If IsCallable(_deferred_.[[Resolve]]) is **false**, throw a **TypeError**.
1. If IsCallable(_deferred_.[[Reject]]) is **false**, throw a **TypeError**.
1. Set _deferred_.[[Promise]] to _promise_.
1. Return _deferred_.

### IsPromise ( x )

The abstract operation IsPromise checks for the promise brand on an object.

1. If Type(_x_) is not Object, return **false**.
1. If _x_ does not have a [[PromiseStatus]] internal slot, return **false**.
1. If the value of _x_'s [[PromiseStatus]] internal slot is **undefined**, return **false**.
1. Return **true**.

### MakePromiseReactionFunction ( deferred, handler )

The abstract operation MakePromiseReactionFunction creates a promise reaction function with internal slots initialized to the passed arguments.

1. Let _F_ be a new built-in function object as defined in Promise Reaction Functions.
1. Set the [[Deferred]] internal slot of _F_ to _deferred_.
1. Set the [[Handler]] internal slot of _F_ to _handler_.
1. Return _F_.

### PromiseReject ( promise, reason )

The abstract operation PromiseReject rejects a promise with a reason.

1. If the value of _promise_'s internal slot [[PromiseStatus]] is not `"unresolved"`, return.
1. Let _reactions_ be the value of _promise_'s [[RejectReactions]] internal slot.
1. Set the value of _promise_'s [[Result]] internal slot to _reason_.
1. Set the value of _promise_'s [[ResolveReactions]] internal slot to **undefined**.
1. Set the value of _promise_'s [[RejectReactions]] internal slot to **undefined**.
1. Set the value of _promise_'s [[PromiseStatus]] internal slot to `"has-rejection"`.
1. Call TriggerPromiseReactions(_reactions_, _reason_).

### PromiseResolve ( promise, resolution )

The abstract operation PromiseResolve resolves a promise with a value.

1. If the value of _promise_'s internal slot [[PromiseStatus]] is not `"unresolved"`, return.
1. Let _reactions_ be the value of _promise_'s [[ResolveReactions]] internal slot.
1. Set the value of _promise_'s [[Result]] internal slot to _resolution_.
1. Set the value of _promise_'s [[ResolveReactions]] internal slot to **undefined**.
1. Set the value of _promise_'s [[RejectReactions]] internal slot to **undefined**.
1. Set the value of _promise_'s [[PromiseStatus]] internal slot to `"has-resolution"`.
1. Call TriggerPromiseReactions(_reactions_, _resolution_).

### ThenableToPromise ( C, x )

The abstract operation ThenableToPromise takes a value _x_ and tests if it is a non-promise thenable. If so, it returns a promise derived from that thenable and constructed with the constructor _C_; otherwise, it returns the value back.

1. If IsPromise(_x_) is **true**, return _x_.
1. If Type(_x_) is not Object, return _x_.
1. Let _deferred_ be the result of calling GetDeferred(_C_).
1. ReturnIfAbrupt(_C_).
1. Let _then_ be the result of calling Get(_x_, `"then"`).
1. RejectIfAbrupt(_then_, _deferred_).
1. If IsCallable(_then_) is **false**, return _x_.
1. Let _thenCallResult_ be the result of calling the [[Call]] internal method of _then_ passing _x_ as _thisArgument_ and a list containing _deferred_.[[Resolve]] and _deferred_.[[Reject]] as _argumentsList_.
1. RejectIfAbrupt(_thenCallResult_, _deferred_).
1. Return _deferred_.[[Promise]].

### TriggerPromiseReactions ( reactions, argument )

The abstract operation TriggerPromiseReactions takes a collection of functions to trigger in the next microtask, and calls them, passing each the given argument. Typically, these reactions will modify a previously-returned promise, possibly calling in to a user-supplied handler before doing so.

1. Repeat for each _reaction_ in _reactions_, in original insertion order
    1. Queue a microtask to:
        1. Call(_reaction_, _argument_).

## Built-in Functions for Promise Objects

### Deferred Construction Functions

A deferred construction function is an anonymous function that stores its arguments on a supplied Deferred record instance.

Each deferred construction function has a [[Deferred]] internal slot.

When a deferred construction function _F_ is called with arguments _resolve_ and _reject_, the following steps are taken:

1. Let _deferred_ be the value of _F_'s [[Deferred]] internal slot.
1. Set _deferred_.[[Resolve]] to _resolve_.
1. Set _deferred_.[[Reject]] to _reject_.

### Promise.all Countdown Functions

A Promise.all countdown function is an anonymous function that handles fulfillment of any promises passed to the `all` method of the Promise constructor.

Each Promise.all countdown function has [[Index]], [[Values]], [[Deferred]], and [[CountdownHolder]] internal slots.

When a Promise.all countdown function _F_ is called with argument _x_, the following steps are taken:

1. Let _index_ be the value of _F_'s [[Index]] internal slot.
1. Let _values_ be the value of _F_'s [[Values]] internal slot.
1. Let _deferred_ be the value of _F_'s [[Deferred]] internal slot.
1. Let _countdownHolder_ be the value of _F_'s [[CountdownHolder]] internal slot.
1. Let _result_ be the result of calling the [[DefineOwnProperty]] internal method of _values_ with arguments _index_ and Property Descriptor { [[Value]]: _x_, [[Writable]]: **true**, [[Enumerable]]: **true**, [[Configurable]]: **true** }.
1. RejectIfAbrupt(_result_, _deferred_).
1. Set _countdownHolder_.[[Countdown]] to _countdownHolder_.[[Countdown]] - 1.
1. If _countdownHolder_.[[Countdown]] is 0,
    1. Call(_deferred_.[[Resolve]], _values_).

### Promise Reaction Functions

A promise reaction function is an anonymous function that applies the appropriate handler to the incoming value, and uses the handler's return value to resolve or reject the derived promise associated with that handler.

Each promise reaction function has [[Deferred]] and [[Handler]] internal slots.

When a promise reaction function _F_ is called with argument _x_, the following steps are taken:

1. Let _deferred_ be the value of _F_'s [[Deferred]] internal slot.
1. Let _handler_ be the value of _F_'s [[Handler]] internal slot.
1. Let _handlerResult_ be the result of calling the [[Call]] internal method of _handler_ passing **undefined** as _thisArgument_ and a list containing _x_ as _argumentsList_.
1. If _handlerResult_ is an abrupt completion,
    1. Call(_deferred_.[[Reject]], _handlerResult_.[[value]]).
    1. Return.
1. Let _handlerResult_ be _handlerResult_.[[value]].
1. If Type(_handlerResult_) is not Object,
    1. Call(_deferred_.[[Resolve]], _handlerResult_).
    1. Return.
1. If SameValue(_handlerResult_, _deferred_.[[Promise]]) is **true**,
    1. Let _selfResolutionError_ be a newly-created **TypeError** object.
    1. Call(_deferred_.[[Reject]], _selfResolutionError_).
1. Let _then_ be the result of calling Get(_handlerResult_, `"then"`).
1. If _then_ is an abrupt completion,
    1. Call(_deferred_.[[Reject]], _then_.[[value]]).
    1. Return.
1. Let _then_ be _then_.[[value]].
1. If IsCallable(_then_) is **false**,
    1. Call(_deferred_.[[Resolve]], _handlerResult_).
    1. Return.
1. Let _thenCallResult_ be the result of calling the [[Call]] internal method of _then_ passing _handlerResult_ as _thisArgument_ and a list containing _deferred_.[[Resolve]] and _deferred_.[[Reject]] as _argumentsList_.
1. If _thenCallResult_ is an abrupt completion,
    1. Call(_deferred_.[[Reject]], _then_.[[value]]).
    1. Return.

### Promise Resolution Handler Functions

A promise resolution handler function is an anonymous function that has the ability to handle a promise being resolved, by "unwrapping" any incoming values until they are no longer promises or thenables and can be passed to the appropriate fulfillment handler.

Each promise resolution handler function has [[PromiseConstructor]], [[FulfillmentHandler]], and [[RejectionHandler]] internal slots.

When a promise resolution handler function _F_ is called with argument _x_, the following steps are taken:

1. Let _C_ be the value of _F_'s [[PromiseConstructor]] internal slot.
1. Let _fulfillmentHandler_ be the value of _F_'s [[FulfillmentHandler]] internal slot.
1. Let _rejectionHandler_ be the value of _F_'s [[RejectionHandler]] internal slot.
1. Let _coerced_ be the result of calling ThenableToPromise(_C_, _x_).
1. If IsPromise(_coerced_) is **true**, return the result of calling Invoke(_coerced_, `"then"`, (_fulfillmentHandler_, _rejectionHandler_)).
1. Return the result of calling the [[Call]] internal method of _fulfillmentHandler_ with **undefined** as _thisArgument_ and a list containing _x_ as _argumentsList_.

### Reject Promise Functions

A reject promise function is an anonymous function that has the ability to reject a promise with a given reason.

Each reject promise function has a [[Promise]] internal slot.

When a reject promise function _F_ is called with argument _reason_, the following steps are taken:

1. Let _promise_ be the value of _F_'s [[Promise]] internal slot.
1. Return the result of calling PromiseReject(_promise_, _reason_).

### Resolve Promise Functions

A resolve promise function is an anonymous function that has the ability to resolve a promise with a given resolution.

Each resolve promise function has a [[Promise]] internal slot.

When a resolve promise function _F_ is called with argument _resolution_, the following steps are taken:

1. Let _promise_ be the value of _F_'s [[Promise]] internal slot.
1. Return the result of calling PromiseResolve(_promise_, _resolution_).

## The Promise Constructor

The Promise constructor is the %Promise% intrinsic object and the initial value of the `Promise` property of the global object. When `Promise` is called as a function rather than as a constructor, it initializes its **this** value with the internal state necessary to support the `Promise.prototype` methods.

The `Promise` constructor is designed to be subclassable. It may be used as the value of an `extends` clause of a class declaration. Subclass constructors that intended to inherit the specified `Promise` behavior must include a `super` call to the `Promise` constructor.

### Promise ( resolver )

1. Let _promise_ be the **this** value.
1. If Type(_promise_) is not Object, then throw a **TypeError** exception.
1. If _promise_ does not have a [[PromiseStatus]] internal slot, then throw a **TypeError** exception.
1. If _promise_'s [[PromiseStatus]] internal slot is not **undefined**, then throw a **TypeError** exception.
1. If IsCallable(_resolver_) is **false**, then throw a **TypeError** exception.
1. Set _promise_'s [[PromiseStatus]] internal slot to `"unresolved"`.
1. Set _promise_'s [[ResolveReactions]] internal slot to a new empty List.
1. Set _promise_'s [[RejectReactions]] internal slot to a new empty List.
1. Let _resolve_ be a new built-in function object as defined in Resolve Promise Functions.
1. Set the [[Promise]] internal slot of _resolve_ to _promise_.
1. Let _reject_ be a new built-in function object as defined in Reject Promise Functions.
1. Set the [[Promise]] internal slot of _reject_ to _promise_.
1. Let _result_ be the result of calling the [[Call]] internal method of _resolver_ with **undefined** as _thisArgument_ and a List containing _resolve_ and _reject_ as _argumentsList_.
1. If _result_ is an abrupt completion, call PromiseReject(_promise_, _result_.[[value]]).
1. Return _promise_.

### new Promise ( ... argumentsList )

When `Promise` is called as part of a `new` expression it is a constructor: it initialises a newly created object.

`Promise` called as part of a new expression with argument list _argumentsList_ performs the following steps:

1. Let _F_ be the `Promise` function object on which the `new` operator was applied.
1. Let _argumentsList_ be the _argumentsList_ argument of the [[Construct]] internal method that was invoked by the `new` operator.
1. Return the result of OrdinaryConstruct(_F_, _argumentsList_).

If Promise is implemented as an ordinary function object, its [[Construct]] internal method will perform the above steps.

## Properties of the Promise Constructor

### Promise \[ @@create \] ( )

1. Let _F_ be the **this** value.
1. Let _obj_ be the result of calling OrdinaryCreateFromConstructor(_constructor_, "%PromisePrototype%", ([[PromiseStatus]], [[PromiseConstructor]], [[Result]], [[ResolveReactions]], [[RejectReactions]])).
1. Set _obj_'s [[PromiseConstructor]] internal slot to _F_.
1. Return _obj_.

This property has the attributes { [[Writable]]: **false**, [[Enumerable]]: **false**, [[Configurable]]: **true** }.

### Promise.all ( iterable )

`all` returns a new promise which is fulfilled with an array of fulfillment values for the passed promises, or rejects with the reason of the first passed promise that rejects. It casts all elements of the passed iterable to promises as it runs this algorithm.

1. Let _C_ be the **this** value.
1. Let _deferred_ be the result of calling GetDeferred(_C_).
1. ReturnIfAbrupt(_deferred_).
1. Let _iterator_ be the result of calling GetIterator(_iterable_).
1. RejectIfAbrupt(_iterator_, _deferred_).
1. Let _values_ be the result of calling ArrayCreate(0).
1. Let _countdownHolder_ be Record { [[Countdown]]: 0 }.
1. Let _index_ be 0.
1. Repeat
    1. Let _next_ be the result of calling IteratorStep(_iterator_).
    1. RejectIfAbrupt(_next_, _deferred_).
    1. If _next_ is **false**,
        1. If _index_ is 0,
            1. Call(_deferred_.[[Resolve]], _values_).
        1. Return _deferred_.[[Promise]].
    1. Let _nextValue_ be the result of calling IteratorValue(_next_).
    1. RejectIfAbrupt(_nextValue_, _deferred_).
    1. Let _nextPromise_ be the result of calling Invoke(_C_, `"cast"`, (_nextValue_)).
    1. RejectIfAbrupt(_nextPromise_, _deferred_).
    1. Let _countdownFunction_ be a new built-in function object as defined in Promise.all Countdown Functions.
    1. Set the [[Index]] internal slot of _countdownFunction_ to _index_.
    1. Set the [[Values]] internal slot of _countdownFunction_ to _values_.
    1. Set the [[Deferred]] internal slot of _countdownFunction_ to _deferred_.
    1. Set the [[CountdownHolder]] internal slot of _countdownFunction_ to _countdownHolder_.
    1. Let _result_ be the result of calling Invoke(_nextPromise_, `"then"`, (_countdownFunction_, _deferred_.[[Reject]])).
    1. RejectIfAbrupt(_result_, _deferred_).
    1. Set _index_ to _index_ + 1.
    1. Set _countdownHolder_.[[Countdown]] to _countdownHolder_.[[Countdown]] + 1.

Note: The `all` function is an intentionally generic utility method; it does not require that its **this** value be the Promise constructor. Therefore, it can be transferred to or inherited by any other constructors that may be called with a single function argument.

### Promise.cast ( x )

`cast` coerces its argument to a promise, or returns the argument if it is already a promise.

1. Let _C_ be the **this** value.
1. If IsPromise(_x_) is **true**,
    1. Let _constructor_ be the value of _x_'s [[PromiseConstructor]] internal slot.
    1. If SameValue(_constructor_, _C_) is **true**, return _x_.
1. Let _deferred_ be the result of calling GetDeferred(_C_).
1. ReturnIfAbrupt(_deferred_).
1. Call(_deferred_.[[Resolve]], _x_).
1. Return _deferred_.[[Promise]].

Note: The `cast` function is an intentionally generic utility method; it does not require that its **this** value be the Promise constructor. Therefore, it can be transferred to or inherited by any other constructors that may be called with a single function argument.

### Promise.race ( iterable )

`race` returns a new promise which is settled in the same way as the first passed promise to settle. It casts all elements of the passed iterable to promises as it runs this algorithm.

1. Let _C_ be the **this** value.
1. Let _deferred_ be the result of calling GetDeferred(_C_).
1. ReturnIfAbrupt(_deferred_).
1. Let _iterator_ be the result of calling GetIterator(_iterable_).
1. RejectIfAbrupt(_iterator_, _deferred_).
1. Repeat
    1. Let _next_ be the result of calling IteratorStep(_iterator_).
    1. RejectIfAbrupt(_next_, _deferred_).
    1. If _next_ is **false**, return _deferred_.[[Promise]].
    1. Let _nextValue_ be the result of calling IteratorValue(_next_).
    1. RejectIfAbrupt(_nextValue_, _deferred_).
    1. Let _nextPromise_ be the result of calling Invoke(_C_, `"cast"`, (_nextValue_)).
    1. RejectIfAbrupt(_nextPromise_, _deferred_).
    1. Let _result_ be the result of calling Invoke(_nextPromise_, `"then"`, (_deferred_.[[Resolve]], _deferred_.[[Reject]])).
    1. RejectIfAbrupt(_result_, _deferred_).

Note: The `race` function is an intentionally generic utility method; it does not require that its **this** value be the Promise constructor. Therefore, it can be transferred to or inherited by any other constructors that may be called with a single function argument.

### Promise.reject ( r )

`reject` returns a new promise rejected with the passed argument.

1. Let _C_ be the **this** value.
1. Let _deferred_ be the result of calling GetDeferred(_C_).
1. ReturnIfAbrupt(_deferred_).
1. Call(_deferred_.[[Reject]], _r_).
1. Return _deferred_.[[Promise]].

Note: The `reject` function is an intentionally generic factory method; it does not require that its **this** value be the Promise constructor. Therefore, it can be transferred to or inherited by any other constructors that may be called with a single function argument.

### Promise.resolve ( x )

`resolve` returns a new promise resolved with the passed argument.

1. Let _C_ be the **this** value.
1. Let _deferred_ be the result of calling GetDeferred(_C_).
1. ReturnIfAbrupt(_deferred_).
1. Call(_deferred_.[[Resolve]], _x_).
1. Return _deferred_.[[Promise]].

Note: The `resolve` function is an intentionally generic factory method; it does not require that its **this** value be the Promise constructor. Therefore, it can be transferred to or inherited by any other constructors that may be called with a single function argument.

## Properties of the Promise Prototype Object

The Promise prototype object is itself an ordinary object. It is not a Promise instance and does not have any of the promise instances' internal slots, such as [[PromiseStatus]].

The value of the [[Prototype]] internal slot of the Promise prototype object is the standard built-in Object prototype object.

### Promise.prototype.constructor

The initial value of `Promise.prototype.constructor` is the built-in `Promise` constructor.

### Promise.prototype.catch ( onRejected )

1. Let _promise_ be the **this** value.
1. Return the result of calling Invoke(_promise_, `"then"`, (**undefined**, _onRejected_)).

Note: The `catch` function is intentionally generic; it does not require that its **this** value be a Promise object. Therefore, it can be transferred to other kinds of objects for use as a method.

### Promise.prototype.then ( onFulfilled , onRejected )

1. Let _promise_ be the **this** value.
1. If IsPromise(_promise_) is **false**, throw a **TypeError** exception.
1. Let _C_ be the result of calling Get(_promise_, "constructor").
1. ReturnIfAbrupt(_C_).
1. Let _deferred_ be the result of calling GetDeferred(_C_).
1. ReturnIfAbrupt(_deferred_).
1. Let _rejectionHandler_ be _deferred_.[[Reject]].
1. If IsCallable(_onRejected_), set _rejectionHandler_ to _onRejected_.
1. Let _fulfillmentHandler_ be _deferred_.[[Resolve]].
1. If IsCallable(_onFulfilled_), set _fulfillmentHandler_ to _onFulfilled_.
1. Let _resolutionHandler_ be a new built-in function object as defined in Promise Resolution Handler Functions.
1. Set the [[PromiseConstructor]] internal slot of _resolutionHandler_ to _C_.
1. Set the [[FulfillmentHandler]] internal slot of _resolutionHandler_ to _fulfillmentHandler_.
1. Set the [[RejectionHandler]] internal slot of _resolutionHandler_ to _rejectionHandler_.
1. Let _resolveReaction_ be the result of calling MakePromiseReactionFunction(_deferred_, _resolutionHandler_).
1. Let _rejectReaction_ be the result of calling MakePromiseReactionFunction(_deferred_, _rejectionHandler_).
1. If the value of _promise_'s [[PromiseStatus]] internal slot is `"unresolved"`,
     1. Append _resolveReaction_ as the last element of _promise_'s [[ResolveReactions]] internal slot.
     1. Append _rejectReaction_ as the last element of _promise_'s [[RejectReactions]] internal slot.
1. If the value of _promise_'s [[PromiseStatus]] internal slot is `"has-resolution"`, queue a microtask to do the following:
     1. Let _resolution_ be the value of _promise_'s [[Result]] internal slot.
     1. Call(_resolveReaction_, _resolution_).
1. If the value of _promise_'s [[PromiseStatus]] internal slot is `"has-rejection"`, queue a microtask to do the following:
     1. Let _resolution_ be the value of _promise_'s [[Rejection]] internal slot.
     1. Call(_rejectReaction_, _reason_).
1. Return _deferred_.[[Promise]].

Note: The `then` function is not generic. If the **this** value is not an object with an [[PromiseStatus]] internal slot initialized to **true**, a **TypeError** exception is immediately thrown when it is called.

## Properties of Promise Instances

Promise instances are ordinary objects that inherit properties from the Promise prototype (the intrinsic, %PromisePrototype%). Promise instances are initially created with the internal slots described in this table.

<table>
    <caption>Internal Slots of Promise Instances</caption>
    <thead>
        <tr>
            <th>Internal Slot Name</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
         <tr>
            <td>[[PromiseStatus]]</td>
            <td>A string value that governs how a promise will react to incoming calls to its <code>then</code> method. The possible values are: <code>"unresolved"</code>, <code>"has-resolution"</code>, and <code>"has-rejection"</code>.</td>
         </tr>
         <tr>
            <td>[[PromiseConstructor]]</td>
            <td>The function object that was used to construct this promise. Checked by the <code>cast</code> method of the <code>Promise</code> constructor.</td>
         </tr>
         <tr>
            <td>[[Result]]</td>
            <td>The value with which the promise has been resolved or rejected, if any. Only meaningful if [[PromiseStatus]] is not <code>"unresolved"</code>.</td>
         </tr>
         <tr>
            <td>[[ResolveReactions]]</td>
            <td>A List of functions to be processed when/if the promise transitions from being unresolved to having a resolution.</td>
         </tr>
         <tr>
            <td>[[RejectReactions]]</td>
            <td>A List of functions to be processed when/if the promise transitions from being unresolved to having a rejection.</td>
         </tr>
    </tbody>
</table>

# Deltas to Other Areas of the Spec

## Well-Known Intrinsic Objects Table

Add the following rows:

<table>
   <tr>
      <td>%Promise%</td>
      <td>The initial value of the global object property named <code>"Promise"</code>.</td>
   </tr>
   <tr>
      <td>%PromisePrototype%</td>
      <td>The initial value of the <code>"prototype"</code> data property of the intrinsic %Promise%.</td>
   </tr>
</table>

## The Completion Record Specification Type

Add the following section:

### RejectIfAbrupt

Algorithm steps that say

1. RejectIfAbrupt(_argument_, _deferred_).

mean the same things as:

1. If _argument_ is an abrupt completion,
    1. Call(_deferred_.[[Reject]], _argument_.[[value]]).
    1. Return _deferred_.[[Promise]].
1. Else if _argument_ is a Completion Record, then let _argument_ be _argument_.[[value]].

### Call

Algorithm steps that say

1. Call(_function_, _argument_).

Mean the same things as:

1. Let _result_ be the result of calling the [[Call]] internal method of _function_ with **undefined** as _thisArgument_ and a list containing _argument_ as _argumentsList_.
1. ReturnIfAbrupt(_result_).

---

<p xmlns:dct="http://purl.org/dc/terms/" xmlns:vcard="http://www.w3.org/2001/vcard-rdf/3.0#">
    <a rel="license"
       href="http://creativecommons.org/publicdomain/zero/1.0/">
        <img src="http://i.creativecommons.org/p/zero/1.0/88x31.png" style="border-style: none;" alt="CC0" />
    </a>
    <br />
    To the extent possible under law,
    <a rel="dct:publisher" href="http://domenicdenicola.com"><span property="dct:title">Domenic Denicola</span></a>
    has waived all copyright and related or neighboring rights to
    <span property="dct:title">promises-unwrapping</span>.

    This work is published from:
    <span property="vcard:Country" datatype="dct:ISO3166" content="US" about="http://domenicdenicola.com">
      United States
    </span>.
</p>
