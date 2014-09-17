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
  .action(function (name) {
    var buffer = "";
    var self = this;

    function consume(err, data) {
      if (!err) {
        self.settings = tryJSONorYAML(data ? data.toString() : buffer);
        if (self.settings) {
          config(null, self);
        } else {
          console.log('wrong data format'.red);
        }
      } else {
        console.log(err.toString().red);
      }
    }

    if (this.file) {
      if (this.file === '-') {
        process.stdin.on('data', function (data) {
          buffer += data.toString();
        });
        process.stdin.on('end', consume);
      } else {
        fs.readFile(this.file, consume);
      }
    } else {
      config(name, this);
    }
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

function tryJSONorYAML(string) {
  try {
    return JSON.parse(string);
  } catch (err1) {
    try {
      return yaml.safeLoad(string);
    } catch (err2) {
      return;
    }
  }
}
