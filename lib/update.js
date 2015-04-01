
var mkdirp = require('mkdirp');
var utils = require('./utils');
var Future = require('fibers/future');
var path = require('path');
var fs = require('fs');
var common = require('./common');
var config = require('./config');
var logs = require('./logs');

module.exports = utils.runInsideFiber(function update (name, options) {
  "use strict";

  // first, we need settings for the corresponding name
  var appConfig = Future.wrap(config)(name).wait();
  var appName   = appConfig.appName;

  if (!/[\w\d]+/.test(appName)) {
    throw new Error('appName must only contain letters, digits and "_"')
  }

  var pathToDeploy = path.resolve('.nebula', 'deploy');
  var pathToSource = path.resolve('.nebula', 'source');
  var pathToBuilds = path.resolve('.nebula', 'builds');
  var pathToAssets = path.resolve('.nebula', 'assets'); // these files should have versions

  logs.system('received config file for app "' + appName + '"');

  var appScripts = [ "deploy.sh", "run.sh", "upstart.conf" ].map(function (name) {
    return {
      name     : name,
      template : common.getTemplate(name),
    };
  });

  var commonScripts = [ "haproxy.cfg" ].map(function (name) {
    return {
      name     : name,
      template : common.getTemplate(name),
    };
  });

  logs.system('make sure the assets directories exist');
  
  mkdirp.sync(pathToDeploy);
  mkdirp.sync(pathToSource);
  mkdirp.sync(pathToAssets);
  mkdirp.sync(pathToBuilds);

  var appsByName = {};

  // read all .json files from "deploy" directory
  fs.readdirSync(pathToDeploy).filter(function (file) {
    return path.extname(file) === '.json';

  }).forEach(function (file) {
    var appName = path.basename(file, '.json');
    appsByName[appName] = JSON.parse(fs.readFileSync(path.join(pathToDeploy, file), 'utf8'));
  });

  var listOfNames = Object.keys(appsByName);
  var listOfApps  = listOfNames.map(function (appName) { return appsByName[appName]; });

  logs.system('the list of deployed apps is ' + JSON.stringify(listOfNames));

  // make sure the asset repository is initialized
  if (!fs.existsSync(path.join(pathToAssets, '.git'))) {
    Future.wrap(utils.initGitRepo)(pathToAssets).wait();
  }

  logs.system('git config user.name nebula');

  Future.wrap(utils.updateGitConfig)(pathToAssets).wait();

  // TODO: verify if app config have all necessary data

  appConfig.sha =
    Future.wrap(utils.getTheLatestCommitSha)(appConfig.repository.url, appConfig).wait();

  logs.system('the latest commit sha for "' + appName + '" is ' + appConfig.sha);

  // find ports that are already taken by the other applications

  var portsAlreadyTaken = {};

  listOfNames.forEach(function (thisAppName) {
    var app = appsByName[thisAppName];
    if (thisAppName === appName) {
      // we will need to rewrite this deploy config anyway
      return;
    }
    portsAlreadyTaken[app.port] = app;
  });

  function findAvailablePort() {
    var port = 3000;
    while (portsAlreadyTaken[port]) {
      port += 1;
    }
    return port;
  }

  // figure out a better way to do it ...
  appConfig.user = process.env.USER;
  appConfig.port = findAvailablePort();

  appConfig.pathToAssets = path.join(pathToAssets, appName);
  appConfig.pathToSource = path.join(pathToSource, appName);
  appConfig.pathToBuilds = path.join(pathToBuilds, appName);

  mkdirp.sync(appConfig.pathToAssets);

  if (appConfig.environment && !appConfig.environment.MONGO_URL) {
    appConfig.environment.MONGO_URL = "mongodb://127.0.0.1/" + appName; // development mode
  }

  // convert environment object into flat list of name/value pairs

  appConfig.variables = [];

  Object.keys(appConfig.environment).forEach(function (name) {

    function stringify (value) {
      return typeof value === 'object' ? JSON.stringify(value) : value.toString()
    }

    appConfig.variables.push({
      name  : name,
      value : JSON.stringify(stringify(appConfig.environment[name])),
    });
  });

  appConfig.variables.push({
    name  : 'PORT',
    value : JSON.stringify(appConfig.port.toString()),
  });

  logs.system('saving deploy config');

  fs.writeFileSync(path.join(pathToDeploy, appName + '.json'), JSON.stringify(appConfig, undefined, 2)); 

  logs.system('saving scripts for app "' + appName + '"');

  // scripts
  appScripts.forEach(function (script) {
    fs.writeFileSync(path.join(appConfig.pathToAssets, script.name), script.template(appConfig));
    if (/\.sh/.test(script.name)) {
      fs.chmodSync(path.join(appConfig.pathToAssets, script.name), "744");
    }
  });

  logs.system('saving common scripts');

  commonScripts.forEach(function (script) {
    fs.writeFileSync(path.join(pathToAssets, script.name), script.template({
      pathToAssets : pathToAssets,
      listOfApps   : listOfApps,
      listOfIds    : listOfNames,
    }));
    if (/\.sh/.test(script.name)) {
      fs.chmodSync(path.join(pathToAssets, script.name), "744");
    }
  });

  // commit to repository

  logs.system('commiting to git repository');

  Future.wrap(utils.commitToGitRepo)(pathToAssets, [
    "haproxy.cfg", appName
  ], 'updated assets for ' + appName).wait();

  logs.system('done updating');

});






