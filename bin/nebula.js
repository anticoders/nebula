#!/usr/bin/env node

var program = require('commander');
var update = require('../tools/update');
var deploy = require('../tools/deploy');
var reload = require('../tools/reload');
var config = require('../tools/config');
var colors = require('colors');
var yaml = require('js-yaml');
var path = require('path');
var fs = require('fs');

var defaultLockFilePath = path.join(process.env.HOME, '.nebula' , 'assets' ,'nebula.lock');

program
  .version('0.0.1')
  .option('-c, --config <relpath>', 'config file [default: nebula.json]', 'nebula.json')
  .option('-l, --config-lock <relpath>', 'config file [default: nebula.lock]', defaultLockFilePath)
  .option('-o, --output <relpath>', 'path to save output data');

program
  .command('deploy [name]')
  .description('deploy project')
  .action(function (name) {
    var settings = config(name, this);
    if (settings) {
      deploy(settings, 'nebula');
    }
  });

program
  .command('config [name]')
  .description('configure project')
  .action(function (name) {
    config(name, this);
  });

program
  .command('update')
  .description('update config')
  .action(function () {
    update(this.config, 'nebula');
  });

program
  .command('reload')
  .description('reload server')
  .action(function () {
    reload(path.resolve(this.configLock), 'nebula');
  });

program.parse(process.argv)
