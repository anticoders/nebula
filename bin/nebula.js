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
  .option('-B, --build-only' , 'do not respawn, only build')
  .option('-l, --latest'     , 'fetch the latest commit')
//  .option('-c, --commit'     , 'fetch the given commit')
//  .option('-b, --branch'     , 'fetch the given branch')
  .option('-v, --verbose'    , 'show more detailed logs')

program
  .command("deploy [name]")
  .description("deploy app using the given config (will use `default` if name is not provided)")
  .action(function (name) {
    var options = this.parent;
    setTimeout(function () {
      deploy(name, options);
    });
  });

program
  .command('create [name]')
  .description('create a new configuration file')
  .action(function (name) {
    var options = this.parent;
    setTimeout(function () {
      config(name, options);
    });
  });

program
  .command('update [name]')
  .description("update all app assets based on the given configuration file")
  .action(function (name) {
    var options = this.parent;
    setTimeout(function () {
      update(name, options);
    });
  });

program.parse(process.argv);
logs.setVerbose(program.verbose);

