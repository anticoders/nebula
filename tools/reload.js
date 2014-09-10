var Connection = require('ssh2');
var Promise = require('es6-promise').Promise;
var colors = require('colors');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var path = require('path');
var fs = require('fs');

module.exports = function reload (configLockPath) {

  var configLock = {};

  if (fs.existsSync(configLockPath)) {
    configLock = JSON.parse(fs.readFileSync(configLockPath).toString('utf8'));
  }

  Promise.all(
  
    Object.keys(configLock.apps).map(function (name) {

      var app = configLock.apps[name];

      var pathToPullScript    = path.join(app.pathToAssets, 'pull.sh');
      var pathToBuildScript   = path.join(app.pathToAssets, 'build.sh');
      var pathToRespawnScript = path.join(app.pathToAssets, 'respawn.sh');


      return runScriptAsPromise(pathToPullScript)
        .then(function () {
          return runScriptAsPromise(pathToBuildScript);
        })
        .then(function () {
          return runScriptAsPromise(pathToRespawnScript);
        });


    })

  ).then(function () {
    return runScriptAsPromise(configLock.haproxyRestartScript);
  }, function (err) {
    console.log('FAILED'.red);
    console.log(err);
  });

}

function runScriptAsPromise(pathToScrip) {
  console.log('executing ' + pathToScrip.cyan);
  return new Promise(function (resolve, reject) {
    var child = spawn(pathToScrip, [], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', resolve);
  });
}

function either (first) {
  return {
    or: function (second) {
      return function (arg1) {
        return arg1 ? first(arg1) : second.apply(this, Array.prototype.slice.call(arguments, 1));
      };
    }
  };
};
