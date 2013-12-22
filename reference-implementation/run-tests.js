"use strict";

require("./test/simple");
require("./test/evil-promises");
require("./test/all");
require("./test/race");
require("promises-aplus-tests").mocha(require("./lib/aplus-adapter"));
