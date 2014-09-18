
var Promise = require('es6-promise').Promise;
var chalk = require('chalk');
var path = require('path');
var fs = require('fs');
var runScriptAsPromise = require('./common').runScriptAsPromise;

module.exports = function reload (pathToAssets) {

 pathToAssets = path.resolve(pathToAssets);

  if (!fs.existsSync(pathToAssets)) {
    throw new Error('directory ' + pathToAssets + ' does not exist');
  }

  var haproxyRestartScript = path.join(pathToAssets, 'haproxy-restart.sh');

  Promise.all(
    fs.readdirSync(pathToAssets).map(function (appId) {

      var pathToRespawnScript = path.join(pathToAssets, appId, 'respawn.sh');
      return runScriptAsPromise(pathToRespawnScript);

    })
  ).then(function () {
    return runScriptAsPromise(haproxyRestartScript);

  }, function (err) {

    console.log(chalk.red('FAILED'));
    console.log(err);
  });

}
