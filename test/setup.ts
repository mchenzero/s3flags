import * as chai from "chai";

function setup() {
  registerChaiPlugins();
  registerMochaHelpers();
}

function registerChaiPlugins() {
  chai.use(require("sinon-chai"));
}

function registerMochaHelpers() {
  require("./helpers/sinon.helper");
  require("./helpers/fake-timer.helper");
  require("./helpers/s3mock.helper");
  require("./helpers/flag-files.helper");
}

setup();
