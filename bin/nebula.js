#!/usr/bin/env node

var program = require('commander');
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
    console.log('deploying'.green);
  });

program
  .command('update')
  .description('update config')
  .action(function () {
    console.log('updating'.green);
  });

program.parse(process.argv)
