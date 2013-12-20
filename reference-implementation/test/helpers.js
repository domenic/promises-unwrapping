"use strict";

var atAtIterator = require("especially/well-known-symbols")["@@iterator"];
var OrdinaryConstruct = require("especially/abstract-operations").OrdinaryConstruct;
var Promise = require("../lib/testable-implementation");

exports.iterableFromArray = function (array) {
    var i = 0;
    var iterable = {};
    iterable[atAtIterator] = function () {
        return {
            next: function () {
                if (i === array.length) {
                    return { done: true };
                } else {
                    return { value: array[i++], done: false };
                }
            }
        };
    };

    return iterable;
};

exports.delayPromise = function (value, ms) {
    return OrdinaryConstruct(Promise, [function (resolve) {
        setTimeout(function () {
            resolve(value);
        }, ms);
    }]);
};
