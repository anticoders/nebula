#!/usr/bin/env node

var pjson = require('../package.json');
var program = require('commander');
var update = require('../lib/update');
var deploy = require('../lib/deploy');
var config = require('../lib/config');
var Fiber = require('fibers');
var path = require('path');
var logs = require('../lib/logs');

var defaultLockFilePath = path.join(process.env.HOME, '.nebula' , 'assets' ,'nebula.lock');

program
  .version(pjson.version)
  .option('-c, --config-from <path>', 'path to the config file')
  .option('-l, --local', 'deploy locally (can be used on the server)')
  .option('-b, --build-only', 'do not start any processes (useful for testing)');
  .option('-v, --verbose', 'show more detailed logs');

program
  .command("deploy [name]")
  .description("deploy project with the given config (will use `default` if name is not provided)")
  .action(wrap(function (name) {
    deploy(name, this.parent);
  }));

program
  .command('config [name]')
  .description('create or show (if it already exists) project configuration file')
  .action(wrap(function (name) {
    config(name, this.parent);
  }));

program
  .command('assets [appId]')
  .description("create server assets based on config files from .nebula/deploy directory")
  .action(wrap(function (appId) {
    update(appId, this.parent);
  }));

program
  .command('install <name>')
  .description("make sure that all necessary assets are installed one the specified server")
  .action(wrap(function () {
    console.log('this feature is not implemented yet');
  }));

program.parse(process.argv);

logs.setVerbose(program.verbose);

function wrap(action) {
  return function () {
    var self = this, args = arguments;
    Fiber(function () {
      action.apply(self, args);
    }).run();
  }
}

