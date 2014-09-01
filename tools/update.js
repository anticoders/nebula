#!/usr/bin/env node

var commander = require('commander');
var mkdirp = require('mkdirp');
var colors = require('colors');
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

configJson.apps.forEach(function (app) {
  console.log(app.name.blue + ' -> ' + app.git.yellow);
});

var pathToSource = path.join(process.env.HOME, '.nebula', 'source');
var pathToBuilds = path.join(process.env.HOME, '.nebula', 'builds');
var pathToAssets = path.join(process.env.HOME, '.nebula', 'assets'); // these files should have versions

mkdirp.sync(pathToSource);
mkdirp.sync(pathToAssets);
mkdirp.sync(pathToBuilds);
