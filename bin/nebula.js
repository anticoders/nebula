#!/usr/bin/env node

var program = require('commander');
var update = require('../tools/update');
var deploy = require('../tools/deploy');
var reload = require('../tools/reload');
var rebuild = require('../tools/rebuild');
var config = require('../tools/config');
var colors = require('colors');
var Fiber = require('fibers');
var chalk = require('chalk');
var form = require('../tools/prompt');
var yaml = require('js-yaml');
var path = require('path');
var fs = require('fs');

var defaultLockFilePath = path.join(process.env.HOME, '.nebula' , 'assets' ,'nebula.lock');

program
  .version('0.0.1')
  .option('-c, --config <path>', 'config file [default: nebula.json]', 'nebula.json')
  .option('-a, --assets <path>', 'path to directory containing assets', path.join('.nebula', 'assets'))
  .option('-l, --config-lock <path>', 'config file [default: nebula.lock]', defaultLockFilePath)
  .option('-f, --file <path>', 'load config from a specified file')
  .option('-s, --save', 'save config file to nebula cache');

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
  .action(wrap(function (name) {

    var buffer = "";
    var fiber = Fiber.current;
    var self = this;

    function consume(err, data) {
      if (err) fiber.throwInto(err);
      try {
        fiber.run(tryJSONorYAML(data ? data.toString() : buffer));
      } catch (err) {
        fiber.throwInto(err);
      }
    }

    if (this.file) {
      if (this.file === '-') {
        process.stdin.on('data', function (data) { buffer += data.toString(); });
        process.stdin.on('end', consume);
      } else {
        fs.readFile(this.file, consume);
      }
      this.settings = Fiber.yield();
    }

    config(name, this);
  }));

program
  .command('update')
  .description('update config')
  .action(function () {
    update(this.config, 'nebula');
  });

program
  .command('rebuild')
  .description('rebuild apps')
  .action(function () {
    rebuild(this.assets);
  });

program
  .command('reload')
  .description('reload server')
  .action(function () {
    reload(this.assets);
  });

program.parse(process.argv)

function wrap(action) {
  return function () {
    var self = this, args = arguments;
    Fiber(function () {
      action.apply(self, arguments);
    }).run();
  }
}

function tryJSONorYAML(string) {
  try {
    return JSON.parse(string);
  } catch (err1) {
    try {
      return yaml.safeLoad(string);
    } catch (err2) {
      throw new Error('wrong data format:\n\n'
        + 'JSON: ' + err1.toString() + '\n\n'
        + err2.toString());
    }
  }
}
