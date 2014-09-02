#!/usr/bin/env node

var commander = require('commander');
var Promise = require('es6-promise').Promise;
var mkdirp = require('mkdirp');
var colors = require('colors');
var Fiber = require('fibers');
var exec = require('child_process').exec;
var path = require('path');
var fs = require('fs');

var program = commander
  .option('-c, --config <relpath>', 'config file', 'nebula.json')
  .parse(process.argv);

var configJson = {};
var configJsonPath = path.resolve(program.config);

var configLock = {};
var configLockPath = path.join(process.env.HOME, '.nebula', 'nebula.lock');

if (fs.existsSync(configJsonPath)) {
  configJson = JSON.parse(fs.readFileSync(configJsonPath).toString('utf8'));
}

if (fs.existsSync(configLockPath)) {
  configLock = JSON.parse(fs.readFileSync(configLockPath).toString('utf8'));
}

var pathToSource = path.join(process.env.HOME, '.nebula', 'source');
var pathToBuilds = path.join(process.env.HOME, '.nebula', 'builds');
var pathToAssets = path.join(process.env.HOME, '.nebula', 'assets'); // these files should have versions

mkdirp.sync(pathToSource);
mkdirp.sync(pathToAssets);
mkdirp.sync(pathToBuilds);

// make sure the asset repository is initialized
if (!fs.existsSync(path.join(pathToAssets, '.git'))) {
  exec('git init', {
    cwd: pathToAssets
  }, function (error, stdout, stderr) {
    if (!error) {
      console.log(('created git repo at ' + pathToAssets).green);
    }
  });
}

// TODO: make sure that app names are unique

Fiber(function () {

  var fiber = Fiber.current;

  Promise.all(
    Object.keys(configJson.apps).map(function (name) {
      return new Promise(function (resolve, reject) {
        var app = configJson.apps[name];
        console.log(name.cyan + ' -> ' + app.git.yellow);
        exec('git ls-remote ' + app.git, { cwd: null }, either(reject).or(function (stdout) {
          var match = /^([\da-f]+)\s+HEAD$/m.exec(stdout);
          if (match) {
            configJson.apps[name].sha = match[1];
            console.log(name.cyan + ' -> ' + match[1]);
          }
          resolve();
        }));
      });
    })
  ).then(function () {
    fiber.run();
  });

  Fiber.yield();

  fs.writeFileSync(configLockPath, JSON.stringify(configJson, undefined, 2));

}).run();


function either (first) {
  return {
    or: function (second) {
      return function (arg1, arg2) {
        return arg1 ? first(arg1) : second(arg2);
      };
    }
  };
};
