#!/usr/bin/env node

var program = require('commander');
var update = require('../tools/update');
var deploy = require('../tools/deploy');
var colors = require('colors');
var path = require('path');
var fs = require('fs');

program
  .version('0.0.1')
  .option('-c, --config <relpath>', 'config file [default: nebula.json]', 'nebula.json');

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
  .command('restart')
  .description('restart server')
  .action(function () {
    //restart(this.config, 'nebula');
  });

program.parse(process.argv)
