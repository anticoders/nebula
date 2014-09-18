
var Promise = require('es6-promise').Promise;
var chalk = require('chalk');
var path = require('path');
var fs = require('fs');
var runScriptAsPromise = require('./common').runScriptAsPromise;

module.exports = function rebuild (pathToAssets) {

  pathToAssets = path.resolve(pathToAssets);

  if (!fs.existsSync(pathToAssets)) {
    throw new Error('directory ' + pathToAssets + ' does not exist');
  }

  Promise.all(
  
    fs.readdirSync(pathToAssets).map(function (appId) {

      var pathToPullScript  = path.join(pathToAssets, appId, 'pull.sh');
      var pathToBuildScript = path.join(pathToAssets, appId, 'build.sh');

      return runScriptAsPromise(pathToPullScript).then(function () {
        return runScriptAsPromise(pathToBuildScript);
      });

    })

  ).catch(function (err) {
    console.log(chalk.red('FAILED'));
    console.log(err);
  });

}

