
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

  var pathToDeploy = path.resolve('.nebula', 'deploy');
  var pathToSource = path.resolve('.nebula', 'source');
  var pathToBuilds = path.resolve('.nebula', 'builds');
  var pathToAssets = path.resolve('.nebula', 'assets'); // these files should have versions

  logs.system('received config file for app "' + appName + '"');

  var appScripts = [ "build.sh", "pull.sh", "respawn.sh", "upstart.conf" ].map(function (name) {
    return {
      name     : name,
      template : common.getTemplate(name),
    };
  });

  var commonScripts = [ "haproxy.cfg", "restart.sh", "rebuild.sh" ].map(function (name) {
    return {
      name     : name,
      template : common.getTemplate(name),
    };
  });
  
  mkdirp.sync(pathToDeploy);
  mkdirp.sync(pathToSource);
  mkdirp.sync(pathToAssets);
  mkdirp.sync(pathToBuilds);

  logs.system('make sure asset dirs exists');

  fs.writeFileSync(path.join(pathToDeploy, appName + '.json'), JSON.stringify(appConfig, undefined, 2));

  var appsByName = {};

  // read all .json files from "deploy" directory
  fs.readdirSync(pathToDeploy).filter(function (file) {
    return path.extname(file) === '.json';

  }).forEach(function (file) {
    var appName = path.basename(file, '.json');
    appsByName[appName] = JSON.parse(fs.readFileSync(path.join(pathToDeploy, file), 'utf8'));
  });

  // we want these two objects to "stay in sync"
  appConfig = appsByName[appName];

  var listOfNames = Object.keys(appsByName);
  var listOfApps  = listOfNames.map(function (appName) { return appsByName[appName]; });

  logs.system('the list of deployed apps is ' + JSON.stringify(listOfNames));

  // make sure the asset repository is initialized
  if (!fs.existsSync(path.join(pathToAssets, '.git'))) {
    Future.wrap(utils.initGitRepo)(pathToAssets).wait();
  }

  // TODO: verify if app config have all necessary data

  appConfig.sha =
    Future.wrap(utils.getTheLatestCommitSha)(appConfig.repository.url).wait();

  logs.system('the latest commit sha for "' + appName + '" is ' + appConfig.sha);

  var lastFreePort = 3000;

  listOfNames.forEach(function (appName) {
    var app = appsByName[appName];

    app.port = lastFreePort++;
    app.user = process.env.USER;
  });

  appConfig.pathToAssets = path.join(pathToAssets, appName);
  appConfig.pathToSource = path.join(pathToSource, appName);
  appConfig.pathToBuilds = path.join(pathToBuilds, appName);

  mkdirp.sync(appConfig.pathToAssets);
  
  if (appConfig.environment && !appConfig.environment.MONGO_URL) {
    appConfig.environment.MONGO_URL = "mongodb://127.0.0.1/" + appName; // development mode
  }

  // environment variables
  fs.writeFileSync(path.join(appConfig.pathToAssets, 'variables'), Object.keys(appConfig.environment).map(function (key) {
    return key + '=' + (typeof appConfig.environment[key] === 'object'
      ? JSON.stringify(appConfig.environment[key]) : appConfig.environment[key].toString());
  }).join('\n'));

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
    "haproxy.cfg", "restart.sh", "rebuild.sh"
  ].concat(listOfNames), 'updated assets').wait();

  logs.system('done updating');

});






