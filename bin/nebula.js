#!/usr/bin/env node

var program = require('commander');
var update = require('../tools/update');
var deploy = require('../tools/deploy');
var reload = require('../tools/reload');
var colors = require('colors');
var path = require('path');
var fs = require('fs');

var defaultLockFilePath = path.join(process.env.HOME, '.nebula' , 'assets' ,'nebula.lock');

program
  .version('0.0.1')
  .option('-c, --config <relpath>', 'config file [default: nebula.json]', 'nebula.json')
  .option('-l, --config-lock <relpath>', 'config file [default: nebula.lock]', defaultLockFilePath)

program
  .command('deploy')
  .description('deploy project')
  .action(function () {
    deploy(this.config, 'nebula');
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
