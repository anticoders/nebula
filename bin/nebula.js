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
  .option('-b, --build-only', 'do not start any processes (useful for testing)')
  .option('-v, --verbose', 'show more detailed logs')

program
  .command("deploy [name]")
  .description("deploy app using the given config (will use `default` if name is not provided)")
  .action(function (name) {
    setTimeout(function () {
      deploy(name, this.parent);
    });
  });

program
  .command('create [name]')
  .description('create a new configuration file')
  .action(function (name) {
    setTimeout(function () {
      config(name, this.parent);
    });
  });

program
  .command('update [name]')
  .description("update all app assets based on the given configuration file")
  .action(function (name) {
    setTimeout(function () {
      update(name, this.parent);
    });
  });

program.parse(process.argv);
logs.setVerbose(program.verbose);

