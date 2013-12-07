"use strict";

require("./test/simple");
require("./test/all");
require("promises-aplus-tests").mocha(require("./lib/aplus-adapter"));
