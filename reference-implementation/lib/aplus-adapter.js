"use strict";

var Promise = require("./testable-implementation");
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;

exports.deferred = function () {
    let resolvePromise, rejectPromise;
    let promise = OrdinaryConstruct(Promise, [function (resolve, reject) {
        resolvePromise = resolve;
        rejectPromise = reject;
    }]);

    return {
        promise: promise,
        resolve: resolvePromise,
        reject: rejectPromise
    };
};

exports.resolved = Promise.resolve.bind(Promise);

exports.rejected = Promise.reject.bind(Promise);
