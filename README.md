# Promise Objects

A Promise is an object that is used as a placeholder for the eventual results of a deferred (and possibly asynchronous) computation.

Any Promise object is in one of three mutually exclusive states: _fulfilled_, _rejected_, and _pending_:

- A promise `p` is fulfilled if `p.then(f, r)` will immediately enqueue a Task to call the function `f`.
- A promise `p` is rejected if `p.then(f, r)` will immediately enqueue a Task to call the function `r`.
- A promise is pending if it is neither fulfilled nor rejected.

A promise said to be _settled_ if it is not pending, i.e. if it is either fulfilled or rejected.

A promise is _resolved_ if it is settled or if it has been "locked in" match the state of another promise. Attempting to resolve or reject a resolved promise has no effect. A promise is _unresolved_ if it is not resolved. An unresolved promise is always in the pending state. A resolved promise may be pending, fullfilled, or rejected.

## Promise Abstract Operations

### PromiseCapability Records

A PromiseCapability is a Record value used to encapsulate a promise object along with the functions that are capable of resolving or rejecting that promise object. PromiseCapability records are produced by the NewPromiseCapability abstract operation.

PromiseCapability Records have the fields listed in this table.

<table>
    <caption>PromiseCapability Record Fields</caption>
    <thead>
        <tr>
            <th>Field Name</th>
            <th>Value</th>
            <th>Meaning</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>[[Promise]]</td>
            <td>An object</td>
            <td>An object that is usable as a promise.</td>
        </tr>
        <tr>
            <td>[[Resolve]]</td>
            <td>A function object</td>
            <td>The function that is used to resolve the given promise object.</td>
        </tr>
        <tr>
            <td>[[Reject]]</td>
            <td>A function object</td>
            <td>The function that is used to reject the given promise object.</td>
        </tr>
    </tbody>
</table>

####  IfAbruptRejectPromise ( value, capability )

IfAbruptRejectPromise is a short hand for a sequence of algorithm steps that use a PromiseCapability record. An algorithm step of the form:

1. IfAbruptRejectPromise(_value_, _capability_).

means the same things as:

1. If _value_ is an abrupt completion,
    1. Let _rejectResult_ be the result of calling the [[Call]] internal method of _capability_.[[Reject]] with **undefined** as _thisArgument_ and (_value_.[[value]]) as _argumentsList_.
    1. ReturnIfAbrupt(_rejectResult_).
    1. Return _capability_.[[Promise]].
1. Else if _value_ is a Completion Record, then let _value_ be _value_.[[value]].

### PromiseReaction Records

The PromiseReaction is a Record value used to store information about how a promise should react when it becomes resolved or rejected with a given value. PromiseReaction records are created by the `then` method of the Promise prototype, and are used by a PromiseReactionTask.

PromiseReaction records have the fields listed in this table.

<table>
    <caption>PromiseReaction Record Fields</caption>
    <thead>
        <tr>
            <th>Field Name</th>
            <th>Value</th>
            <th>Meaning</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>[[Capabilities]]</td>
            <td>A PromiseCapability record</td>
            <td>The capabilities of the promise for which this record provides a reaction handler.</td>
        </tr>
        <tr>
            <td>[[Handler]]</td>
            <td>A function object</td>
            <td>The function that should be applied to the incoming value, and whose return value will govern what happens to the derived promise.</td>
        </tr>
    </tbody>
</table>


### CreateRejectFunction ( promise )

When CreateRejectFunction is performed with argument _promise_, the following steps are taken:

1. Let _reject_ be a new built-in function object as defined in Promise Reject Functions.
1. Set the [[Promise]] internal slot of _reject_ to _promise_.
1. Return _reject_.

#### Promise Reject Functions

A promise reject function is an anonymous built-in function that has a [[Promise]] internal slot.

When a promise reject function _F_ is called with argument _reason_, the following steps are taken:

1. Assert: _F_ has a [[Promise]] internal slot whose value is an Object.
1. Let _promise_ be the value of _F_'s [[Promise]] internal slot.
1. If the value of _promise_'s internal slot [[PromiseStatus]] is not `"unresolved"`, then return **undefined**.
1. Let _reactions_ be the value of _promise_'s [[PromiseRejectReactions]] internal slot.
1. Set the value of _promise_'s [[PromiseResult]] internal slot to _reason_.
1. Set the value of _promise_'s [[PromiseResolveReactions]] internal slot to **undefined**.
1. Set the value of _promise_'s [[PromiseRejectReactions]] internal slot to **undefined**.
1. Set the value of _promise_'s [[PromiseStatus]] internal slot to `"has-rejection"`.
1. Return TriggerPromiseReactions(_reactions_, _reason_).

### CreateResolveFunction ( promise )

When CreateResolveFunction is performed with argument _promise_, the following steps are taken:

1. Let _resolve_ be a new built-in function object as defined in Promise Resolve Functions.
1. Set the [[Promise]] internal slot of _resolve_ to _promise_.
1. Return _resolve_.

#### Promise Resolve Functions

A promise resolve function is an anonymous built-in function that has a [[Promise]] internal slot.

When a promise resolve function _F_ is called with argument _resolution_, the following steps are taken:

1. Assert: _F_ has a [[Promise]] internal slot whose value is an Object.
1. Let _promise_ be the value of _F_'s [[Promise]] internal slot.
1. If the value of _promise_'s internal slot [[PromiseStatus]] is not `"unresolved"`, then return **undefined**.
1. Let _reactions_ be the value of _promise_'s [[PromiseResolveReactions]] internal slot.
1. Set the value of _promise_'s [[PromiseResult]] internal slot to _resolution_.
1. Set the value of _promise_'s [[PromiseResolveReactions]] internal slot to **undefined**.
1. Set the value of _promise_'s [[PromiseRejectReactions]] internal slot to **undefined**.
1. Set the value of _promise_'s [[PromiseStatus]] internal slot to `"has-resolution"`.
1. Return TriggerPromiseReactions(_reactions_, _resolution_).

###  NewPromiseCapability ( C )

The abstract operation NewPromiseCapability takes a constructor function, and attempts to use that constructor function in the fashion of the built-in `Promise` constructor to create a Promise object and extract its resolve and reject functions. The promise plus the resolve and reject functions are used to initialise a new PromiseCapability record which is returned as the value of this abstract operation. This is useful to support subclassing, as this operation is generic on any constructor that calls a passed executor argument in the same way as the Promise constructor. We use it to generalize static methods of the Promise constructor to any subclass.

1. If IsConstructor(_C_) is **false**, throw a **TypeError**.
1. Assert: _C_ is a constructor function that supports the parameter conventions of the `Promise` constructor.
1. Let _promise_ be CreateFromConstructor(_C_).
1. ReturnIfAbrupt(_promise_).
1. Return CreatePromiseCapabilityRecord(_promise_, _C_).

NOTE: This abstract operation supports Promise subclassing, as it is generic on any constructor that calls a passed executor function argument in the same way as the Promise constructor. It is used to generalize static methods of the Promise constructor to any subclass.

#### CreatePromiseCapabilityRecord ( promise, constructor )

1. Let _promiseCapability_ be a new PromiseCapability { [[Promise]]: _promise_, [[Resolve]]: **undefined**, [[Reject]]: **undefined** }.
1. Let _executor_ be a new built-in function object as defined in GetCapabilitiesExecutor Functions.
1. Set the [[Capability]] internal slot of _executor_ to _promiseCapability_.
1. Let _constructorResult_ be the result of calling the [[Call]] internal method of _constructor_, passing _promise_ and (_executor_) as the arguments.
1. ReturnIfAbrupt(_constructorResult_).
1. If IsCallable(_promiseCapability_.[[Resolve]]) is **false**, then throw a **TypeError** exception.
1. If IsCallable(_promiseCapability_.[[Reject]]) is **false**, then throw a **TypeError** exception.
1. If Type(_constructorResult_) is Object and SameValue(_promise_, _constructorResult_) is **false**, then throw a TypeError exception.
1. Return _promiseCapability_.

#### GetCapabilitiesExecutor Functions

A GetCapabilitiesExecutor function is an anonymous built-in function that has a [[Capability]] internal slot.

When a GetCapabilitiesExecutor function _F_ is called with arguments _resolve_ and _reject_ the following steps are taken:

1. Assert: _F_ has a [[Capability]] internal slot whose value is a PromiseCapability Record.
1. Let _promiseCapability_ be the value of _F_'s [[Capability]] internal slot.
1. If _promiseCapability_.[[Resolve]] is not **undefined**, then throw a **TypeError** exception.
1. If _promiseCapability_.[[Reject]] is not **undefined**, then throw a **TypeError** exception.
1. Set _promiseCapability_.[[Resolve]] to _resolve_.
1. Set _promiseCapability_.[[Reject]] to _reject_.
1. Return **undefined**.

### IsPromise ( x )

The abstract operation IsPromise checks for the promise brand on an object.

1. If Type(_x_) is not Object, return **false**.
1. If _x_ does not have a [[PromiseStatus]] internal slot, return **false**.
1. If the value of _x_'s [[PromiseStatus]] internal slot is **undefined**, return **false**.
1. Return **true**.

### TriggerPromiseReactions ( reactions, argument )

The abstract operation TriggerPromiseReactions takes a collection of functions to trigger in the next Task, and calls them, passing each the given argument. Typically, these reactions will modify a previously-returned promise, possibly calling in to a user-supplied handler before doing so.

1. Repeat for each _reaction_ in _reactions_, in original insertion order
    1. Perform EnqueueTask(`"PromiseTasks"`, PromiseReactionTask, (_reaction_, _argument_)).
1. Return **undefined**.

### UpdatePromiseFromPotentialThenable ( x, promiseCapability )

The abstract operation UpdateDeferredFromPotentialThenable takes a value _x_ and tests if it is a thenable. If so, it tries to use _x_'s `then` method to resolve the promised accessed through _promiseCapability_. Otherwise, it returns `"not a thenable"`.

1. If Type(_x_) is not Object, return `"not a thenable"`.
1. Let _then_ be Get(_x_, `"then"`).
1. If _then_ is an abrupt completion,
    1. Let _rejectResult_ be the result of calling the [[Call]] internal method of _promiseCapability_.[[Reject]] with **undefined** as _thisArgument_ and (_then_.[[value]]) as _argumentsList_.
    1. ReturnIfAbrupt(_rejectResult_).
    1. Return **null**.
1. Let _then_ be _then_.[[value]].
1. If IsCallable(_then_) is **false**, return `"not a thenable"`.
1. Let _thenCallResult_ be the result of calling the [[Call]] internal method of _then_ passing _x_ as _thisArgument_ and (_promiseCapability_.[[Resolve]], _promiseCapability_.[[Reject]]) as _argumentsList_.
1. If _thenCallResult_ is an abrupt completion,
    1. Let _rejectResult_ be the result of calling the [[Call]] internal method of _capability_.[[Reject]] with **undefined** as _thisArgument_ and (_thenCallResult_.[[value]]) as _argumentsList_.
    1. ReturnIfAbrupt(_rejectResult_).
1. Return **null**.

## Promise Tasks

### PromiseReactionTask ( reaction, argument )

The task PromiseReactionTask with parameters _reaction_ and _argument_ applies the appropriate handler to the incoming value, and uses the handler's return value to resolve or reject the derived promise associated with that handler.

1. Assert: _reaction_ is a PromiseReaction Record.
1. Let _promiseCapability_ be _reaction_.[[Capabilities]].
1. Let _handler_ be _reaction_.[[Handler]].
1. Let _handlerResult_ be the result of calling the [[Call]] internal method of _handler_ passing **undefined** as _thisArgument_ and (_argument_) as _argumentsList_.
1. If _handlerResult_ is an abrupt completion, then
    1. Let _status_ be the result of calling the [[Call]] internal method of _promiseCapability_.[[Reject]] passing **undefined** as _thisArgument_ and (_handlerResult_.[[value]]) as _argumentsList_.
    1. NextTask _status_.
1. Let _handlerResult_ be _handlerResult_.[[value]].
1. If SameValue(_handlerResult_, _promiseCapability_.[[Promise]]) is **true**, then
    1. Let _selfResolutionError_ be a newly-created **TypeError** object.
    1. Let _status_ be the result of calling the [[Call]] internal method of _promiseCapability_.[[Reject]] passing **undefined** as _thisArgument_ and (_selfResolutionError_) as _argumentsList_
    1. NextTask _status_.
1. Let _status_ be UpdatePromiseFromPotentialThenable(_handlerResult_, _promiseCapability_).
1. If _status_ is an abrupt completion, then NextTask _status_.
1. Let _updateResult_ be _status_.[[value]].
1. If _updateResult_ is `"not a thenable"`,
    1. Let _status_ be the result of calling the [[Call]] internal method of _promiseCapability_.[[Resolve]] passing **undefined** as _thisArgument_ and (_handlerResult_) as _argumentsList_.
1. NextTask _status_.

## The Promise Constructor

The Promise constructor is the %Promise% intrinsic object and the initial value of the `Promise` property of the global object. When `Promise` is called as a function rather than as a constructor, it initialises its **this** value with the internal state necessary to support the `Promise.prototype` methods.

The `Promise` constructor is designed to be subclassable. It may be used as the value in an `extends` clause of a class definition. Subclass constructors that intend to inherit the specified `Promise` behaviour must include a `super` call to `Promise`.

### Promise ( executor )

When the `Promise` function is called with argument _executor_ the following steps are taken:

1. Let _promise_ be the **this** value.
1. If Type(_promise_) is not Object, then throw a **TypeError** exception.
1. If _promise_ does not have a [[PromiseStatus]] internal slot, then throw a **TypeError** exception.
1. If _promise_'s [[PromiseStatus]] internal slot is not **undefined**, then throw a **TypeError** exception.
1. If IsCallable(_executor_) is **false**, then throw a **TypeError** exception.
1. Return InitialisePromise(_promise_, _executor_).

NOTE

The _executor_ argument must be a function object. It is called for initiating and reporting completion of the possibly deferred action represented by this Promise object. The executor is called with two arguments: _resolve_ and _reject_. These are functions that may be used by the _executor_ function to report eventual completion or failure of the deferred computation. Returning from the executor function does not mean that the deferred action has been completed but only that the request to eventually perform the deferred action has been accepted.

The _resolve_ function that is passed to an executor function accepts a single argument. The executor code may eventually call the _resolve_ function to indicate that it wishes to resolve the associated Promise object. The argument passed to the _resolve_ function represents the eventual value of the deferred action and can be either the actual fulfillment value or another Promise object which will provide the value if it is fullfilled.

The _reject_ function that is passed to an executor function accepts a single argument. The executor code may eventually call the _reject_ function to indicate that the associated Promise is rejected and will never be fulfilled. The argument passed to the reject function is used as the rejection value of the promise. Typically it will be an `Error` object.

The resolve and reject functions passed to an _executor_ function by the Promise constructor have the capability to actually resolve and reject the associated promise. Subclasses may have different constructor behaviour that passes in customized values for resolve and reject.

####  InitialisePromise ( promise, executor )

The abstract operation InitialisePromise initialises a newly allocated _promise_ object using an _executor_ function.

1. Assert: _promise_ has a [[PromiseStatus]] internal slot and its value is **undefined**.
1. Assert: IsCallable(_executor_) is **true**.
1. Set _promise_'s [[PromiseStatus]] internal slot to `"unresolved"`.
1. Set _promise_'s [[PromiseResolveReactions]] internal slot to a new empty List.
1. Set _promise_'s [[PromiseRejectReactions]] internal slot to a new empty List.
1. Let _resolve_ be CreateResolveFunction(_promise_).
1. Let _reject_ be CreateRejectFunction(_promise_).
1. Let _completion_ be the result of calling the [[Call]] internal method of _executor_ with **undefined** as _thisArgument_ and (_resolve_, _reject_) as _argumentsList_.
1. If _completion_ is an abrupt completion, then
    1. Let _status_ be the result of calling the [[Call]] internal method of _reject_ with **undefined** as _thisArgument_ and (_completion_.[[value]]) as _argumentsList_.
    1. ReturnIfAbrupt(_status_).
1. Return _promise_.

### new Promise ( ... argumentsList )

When `Promise` is called as part of a `new` expression it is a constructor: it initialises a newly created object.

`Promise` called as part of a new expression with argument list _argumentsList_ performs the following steps:

1. Let _F_ be the `Promise` function object on which the `new` operator was applied.
1. Let _argumentsList_ be the _argumentsList_ argument of the [[Construct]] internal method that was invoked by the `new` operator.
1. Return Construct(_F_, _argumentsList_).

If Promise is implemented as an ECMAScript function object, its [[Construct]] internal method will perform the above steps.

##  Properties of the Promise Constructor

The value of the [[Prototype]] internal slot of the `Promise` constructor is the `Function` prototype object.

Besides the `length` property (whose value is 1), the Promise constructor has the following properties:

### Promise.all ( iterable )

The `all` function returns a new promise which is fulfilled with an array of fulfillment values for the passed promises, or rejects with the reason of the first passed promise that rejects. It casts all elements of the passed iterable to promises as it runs this algorithm.

1. Let _C_ be the **this** value.
1. Let _promiseCapability_ be NewPromiseCapability(_C_).
1. ReturnIfAbrupt(_promiseCapability_).
1. Let _iterator_ be GetIterator(_iterable_).
1. IfAbruptRejectPromise(_iterator_, _promiseCapability_).
1. Let _values_ be ArrayCreate(0).
1. Let _remainingElementsCount_ be a new Record { [[value]]: 0 }.
1. Let _index_ be 0.
1. Repeat
    1. Let _next_ be IteratorStep(_iterator_).
    1. IfAbruptRejectPromise(_next_, _promiseCapability_).
    1. If _next_ is **false**,
        1. If _index_ is 0,
            1. Let _resolveResult_ be the result of calling the [[Call]] internal method of _promiseCapability_.[[Resolve]] with **undefined** as _thisArgument_ and (_values_) as _argumentsList_.
            1. ReturnIfAbrupt(_resolveResult_).
        1. Return _promiseCapability_.[[Promise]].
    1. Let _nextValue_ be IteratorValue(_next_).
    1. IfAbruptRejectPromise(_nextValue_, _promiseCapability_).
    1. Let _nextPromise_ be Invoke(_C_, `"cast"`, (_nextValue_)).
    1. IfAbruptRejectPromise(_nextPromise_, _promiseCapability_).
    1. Let _resolveElement_ be a new built-in function object as defined in Promise.all Resolve Element Functions.
    1. Set the [[Index]] internal slot of _resolveElement_ to _index_.
    1. Set the [[Values]] internal slot of _resolveElement_ to _values_.
    1. Set the [[Capabilities]] internal slot of _resolveElement_ to _promiseCapabilities_.
    1. Set the [[RemainingElements]] internal slot of _resolveElement_ to _remainingElementsCount_.
    1. Let _result_ be Invoke(_nextPromise_, `"then"`, (_resolveElement_, _promiseCapability_.[[Reject]])).
    1. IfAbruptRejectPromise(_result_, _promiseCapability_).
    1. Set _index_ to _index_ + 1.
    1. Set _remainingElementsCount_.[[value]] to _remainingElementsCount_.[[value]] + 1.

Note: The `all` function requires its **this** value to be a constructor function that supports the parameter conventions of the `Promise` constructor.

#### Promise.all Resolve Element Functions

A Promise.all resolve element function is an anonymous built-in function that is used to resolve a specific Promise.all element. Each Promise.all resolve element function has [[Index]], [[Values]], [[Capabilities]], and [[RemainingElements]] internal slots.

When a Promise.all resolve element function _F_ is called with argument _x_, the following steps are taken:

1. Let _index_ be the value of _F_'s [[Index]] internal slot.
1. Let _values_ be the value of _F_'s [[Values]] internal slot.
1. Let _promiseCapability_ be the value of _F_'s [[Capabilities]] internal slot.
1. Let _remainingElementsCount_ be the value of _F_'s [[RemainingElements]] internal slot.
1. Let _result_ be CreateDataProperty(_values_, ToString(_index_), _x_).
1. IfAbruptRejectPromise(_result_, _promiseCapability_).
1. Set _remainingElementsCount_.[[value]] to _remainingElementsCount_.[[value]] - 1.
1. If _remainingElementsCount_.[[value]] is 0,
    1. Return the result of calling the [[Call]] internal method of _promiseCapability_.[[Resolve]] with **undefined** as _thisArgument_ and (_values_) as _argumentsList_.
1. Return **undefined**.

### Promise.cast ( x )

The `cast` function called with argument _x_ performs the following steps:

1. Let _C_ be the **this** value.
1. If IsPromise(_x_) is **true**,
    1. Let _constructor_ be the value of _x_'s [[PromiseConstructor]] internal slot.
    1. If SameValue(_constructor_, _C_) is **true**, return _x_.
1. Let _promiseCapability_ be NewPromiseCapability(_C_).
1. ReturnIfAbrupt(_promiseCapability_).
1. Let _resolveResult_ be the result of calling the [[Call]] internal method of _promiseCapability_.[[Resolve]] with **undefined** as _thisArgument_ and (_x_) as _argumentsList_.
1. ReturnIfAbrupt(_resolveResult_).
1. Return _promiseCapability_.[[Promise]].

Note: The `cast` function requires its **this** value to be a constructor function that supports the parameter conventions of the `Promise` constructor.

### Promise.prototype

The initial value of `Promise.prototype` is the Promise prototype object.

This property has the attributes { [[Writable]]: **false**, [[Enumerable]]: **false**, [[Configurable]]: **false** }.

### Promise.race ( iterable )

The `race` function returns a new promise which is settled in the same way as the first passed promise to settle. It casts all elements of the passed iterable to promises as it runs this algorithm.

1. Let _C_ be the **this** value.
1. Let _promiseCapability_ be NewPromiseCapability(_C_).
1. ReturnIfAbrupt(_promiseCapability_).
1. Let _iterator_ be GetIterator(_iterable_).
1. IfAbruptRejectPromise(_iterator_, _promiseCapability_).
1. Repeat
    1. Let _next_ be IteratorStep(_iterator_).
    1. IfAbruptRejectPromise(_next_, _promiseCapability_).
    1. If _next_ is **false**, return _promiseCapability_.[[Promise]].
    1. Let _nextValue_ be IteratorValue(_next_).
    1. IfAbruptRejectPromise(_nextValue_, _promiseCapability_).
    1. Let _nextPromise_ be Invoke(_C_, `"cast"`, (_nextValue_)).
    1. IfAbruptRejectPromise(_nextPromise_, _promiseCapability_).
    1. Let _result_ be Invoke(_nextPromise_, `"then"`, (_promiseCapability_.[[Resolve]], _promiseCapability_.[[Reject]])).
    1. IfAbruptRejectPromise(_result_, _promiseCapability_).

Note: The `race` function requires its **this** value to be a constructor function that supports the parameter conventions of the `Promise` constructor. It also requires that its **this** value provides a `cast` method.

### Promise.reject ( r )

The `reject` function returns a new promise rejected with the passed argument.

1. Let _C_ be the **this** value.
1. Let _promiseCapability_ be NewPromiseCapability(_C_).
1. ReturnIfAbrupt(_promiseCapability_).
1. Let _rejectResult_ be the result of calling the [[Call]] internal method of _promiseCapability_.[[Reject]] with **undefined** as _thisArgument_ and (_r_) as _argumentsList_.
1. ReturnIfAbrupt(_rejectResult_).
1. Return _promiseCapability_.[[Promise]].

Note: The `reject` function requires its **this** value to be a constructor function that supports the parameter conventions of the `Promise` constructor.

### Promise.resolve ( x )

The `resolve` function returns a new promise resolved with the passed argument.

1. Let _C_ be the **this** value.
1. Let _promiseCapability_ be NewPromiseCapability(_C_).
1. ReturnIfAbrupt(_promiseCapability_).
1. Let _resolveResult_ be the result of calling the [[Call]] internal method of _promiseCapability_.[[Resolve]] with **undefined** as _thisArgument_ and (_x_) as _argumentsList_.
1. ReturnIfAbrupt(_resolveResult_).
1. Return _promiseCapability_.[[Promise]].

Note: The `resolve` function requires its **this** value to be a constructor function that supports the parameter conventions of the `Promise` constructor.

### Promise \[ @@create \] ( )

The @@create method of a Promise function object _F_ performs the following steps:

1. Let _F_ be the **this** value.
1. Return AllocatePromise(_F_).

The value of the `name` property of this function is `"[Symbol.create]"`.

This property has the attributes { [[Writable]]: **false**, [[Enumerable]]: **false**, [[Configurable]]: **true** }.

#### AllocatePromise ( constructor )

The abstract operation AllocatePromise allocates a new promise object using the _constructor_ argument.

1. Let _obj_ be OrdinaryCreateFromConstructor(_constructor_, `"%PromisePrototype%"`, ([[PromiseStatus]], [[PromiseConstructor]], [[PromiseResult]], [[PromiseResolveReactions]], [[PromiseRejectReactions]])).
1. Set _obj_'s [[PromiseConstructor]] internal slot to _constructor_.
1. Return _obj_.

## Properties of the Promise Prototype Object

The value of the [[Prototype]] internal slot of the Promise prototype object is the standard built-in Object prototype object. The Promise prototype object is an ordinary object. It does not have a [[PromiseStatus]] internal slot or any of the other internal slots of Promise instances.

### Promise.prototype.catch ( onRejected )

When the `catch` method is called with argument _onRejected_ the following steps are taken:

1. Let _promise_ be the **this** value.
1. Return Invoke(_promise_, `"then"`, (**undefined**, _onRejected_)).

### Promise.prototype.constructor

The initial value of `Promise.prototype.constructor` is the standard built-in `Promise` constructor.

### Promise.prototype.then ( onFulfilled , onRejected )

When the `then` method is called with arguments _onFulfilled_ and _onRejected_ the following steps are taken:

1. Let _promise_ be the **this** value.
1. If IsPromise(_promise_) is **false**, throw a **TypeError** exception.
1. Let _C_ be Get(_promise_, "constructor").
1. ReturnIfAbrupt(_C_).
1. Let _promiseCapability_ be NewPromiseCapability(_C_).
1. ReturnIfAbrupt(_promiseCapability_).
1. If IsCallable(_onRejected_) is **true**, then
    1. Let _rejectionHandler_ be _onRejected_.
1. Else,
    1. Let _rejectionHandler_ be a new Thrower Function.
1. If IsCallable(_onFulfilled_) is **true**, then
    1. Let _fulfillmentHandler_ be _onFulfilled_.
1. Else,
    1. Let _fulfillmentHandler_ be a new Identity Function.
1. Let _resolutionHandler_ be a new Promise Resolution Handler Function.
1. Set the [[Promise]] internal slot of _resolutionHandler_ to _promise_.
1. Set the [[FulfillmentHandler]] internal slot of _resolutionHandler_ to _fulfillmentHandler_.
1. Set the [[RejectionHandler]] internal slot of _resolutionHandler_ to _rejectionHandler_.
1. Let _resolveReaction_ be the PromiseReaction { [[Capabilities]]: _promiseCapability_, [[Handler]]: _resolutionHandler_ }.
1. Let _rejectReaction_ be the PromiseReaction { [[Capabilities]]: _promiseCapability_, [[Handler]]: _rejectionHandler_ }.
1. If the value of _promise_'s [[PromiseStatus]] internal slot is `"unresolved"`,
    1. Append _resolveReaction_ as the last element of the List that is the value of _promise_'s [[PromiseResolveReactions]] internal slot.
    1. Append _rejectReaction_ as the last element of the List that is the value of _promise_'s [[PromiseRejectReactions]] internal slot.
1. Else if the value of _promise_'s [[PromiseStatus]] internal slot is `"has-resolution"`,
    1. Let _resolution_ be the value of _promise_'s [[PromiseResult]] internal slot.
    1. Call EnqueueTask(`"PromiseTasks"`, PromiseReactionTask, (_resolveReaction_, _resolution_)).
1. Else if the value of _promise_'s [[PromiseStatus]] internal slot is `"has-rejection"`,
    1. Let _reason_ be the value of _promise_'s [[PromiseResult]] internal slot.
    1. Call EnqueueTask(`"PromiseTasks"`, (_rejectReaction_, _reason_)).
1. Return _promiseCapability_.[[Promise]].

#### Identity Functions

An identify function is an anonymous built-in function that when called with argument _x_, performs the following steps:

1. Return _x_.

#### Promise Resolution Handler Functions

A promise resolution handler function is an anonymous built-in function that has the ability to handle a promise being resolved, by "unwrapping" any incoming values until they are no longer promises or thenables and can be passed to the appropriate fulfillment handler.

Each promise resolution handler function has [[Promise]], [[FulfillmentHandler]], and [[RejectionHandler]] internal slots.

When a promise resolution handler function _F_ is called with argument _x_, the following steps are taken:

1. Let _promise_ be the value of _F_'s [[Promise]] internal slot.
1. Let _fulfillmentHandler_ be the value of _F_'s [[FulfillmentHandler]] internal slot.
1. Let _rejectionHandler_ be the value of _F_'s [[RejectionHandler]] internal slot.
1. If SameValue(_x_, _promise_) is **true**, then
    1. Let _selfResolutionError_ be a newly-created **TypeError** object.
    1. Return the result of calling the [[Call]] internal method of _rejectionHandler_ with **undefined** as _thisArgument_ and (_selfResolutionError_) as _argumentsList_.
1. Let _C_ be the value of _promise_'s [[PromiseConstructor]] internal slot.
1. Let _promiseCapability_ be NewPromiseCapability(_C_).
1. ReturnIfAbrupt(_promiseCapability_).
1. Let _updateResult_ be UpdateDeferredFromPotentialThenable(_x_, _promiseCapability_).
1. ReturnIfAbrupt(_updateResult_).
1. If _updateResult_ is not `"not a thenable"`, then
    1. Return Invoke(_promiseCapability_.[[Promise]], `"then"`, (_fulfillmentHandler_, _rejectionHandler_)).
1. Return the result of calling the [[Call]] internal method of _fulfillmentHandler_ with **undefined** as _thisArgument_ and (_x_) as _argumentsList_.

#### Thrower Functions

A thrower function is an anonymous built-in function that when called with argument _e_, performs the following steps:

1. Return Completion{[[type]]: throw, [[value]]: e, [[target]]:empty}.

### Promise.prototype \[ @@toStringTag \]

The initial value of the @@toStringTag property is the string value `"Promise"`.

This property has the attributes { [[Writable]]: **false**, [[Enumerable]]: **false**, [[Configurable]]: **true** }.

## Properties of Promise Instances

Promise instances are ordinary objects that inherit properties from the Promise prototype object (the intrinsic, %PromisePrototype%). Promise instances are initially created with the internal slots described in this table.

<table>
    <caption>Internal Slots of Promise Instances</caption>
    <thead>
        <tr>
            <th>Internal Slot</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
         <tr>
            <td>[[PromiseStatus]]</td>
            <td>A string value that governs how a promise will react to incoming calls to its then method. The possible values are: <b>undefined</b>, <code>"unresolved"</code>, <code>"has-resolution"</code>, and <code>"has-rejection"</code>.</td>
         </tr>
         <tr>
            <td>[[PromiseConstructor]]</td>
            <td>The function object that was used to construct this promise. Checked by the <code>cast</code> method of the <code>Promise</code> constructor.</td>
         </tr>
         <tr>
            <td>[[PromiseResult]]</td>
            <td>The value with which the promise has been resolved or rejected, if any. Only meaningful if [[PromiseStatus]] is not <code>"unresolved"</code>.</td>
         </tr>
         <tr>
            <td>[[PromiseResolveReactions]]</td>
            <td>A List of PromiseReaction records to be processed when/if the promise transitions from being unresolved to having a resolution.</td>
         </tr>
         <tr>
            <td>[[PromiseRejectReactions]]</td>
            <td>A List of PromiseReaction records to be processed when/if the promise transitions from being unresolved to having a rejection.</td>
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
