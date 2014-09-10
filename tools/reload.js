var Connection = require('ssh2');
var Promise = require('es6-promise').Promise;
var colors = require('colors');
var exec = require('child_process').exec;
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

      return new Promise(function (resolve, reject) {
        console.log('pulling the latest version from repo'.blue);
        exec(pathToPullScript, either(reject).or(function (stdout, stderr) {
          console.log('building meteor app'.blue);
          process.stdout.write(stdout.green); process.stdout.write(stderr.red);
          exec(pathToBuildScript, either(reject).or(function (stdout, stderr) {
            process.stdout.write(stdout.green); process.stdout.write(stderr.red);
            exec(pathToRespawnScript, either(reject).or(function (stdout) {
              process.stdout.write(stdout.green); process.stdout.write(stderr.red);
              console.log(stdout);
              resolve();
            }));
          }));
        }));
      });

    })

  ).then(function () {
    console.log('restarting haproxy'.blue);
    exec(configLock.haproxyRestartScript, function (stdout, stderr) {
      process.stdout.write(stdout.green); process.stdout.write(stderr.red);
    });
  }, function (err) {
    console.log(err);
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
