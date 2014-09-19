
var crypto = require('crypto');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var Fiber = require('fibers');
var chalk = require('chalk');

module.exports = {

  unicode: {
    mark : "\u2714",
    fail : "\u00D7",
    dot  : "\u00B7",
  },

  randomHexString: function (length) {
    return crypto.randomBytes(length / 2).toString('hex').slice(0, length);
  },

  either: function (first) {
    return {
      or: function (second) {
        return function (arg1, arg2) {
          return arg1 ? first(arg1) : second(arg2);
        };
      }
    };
  },

  runScriptAsAsyncTask: function (pathToScrip) {
    return function (callback) {
      console.log('executing ' + chalk.cyan(pathToScrip));

      var child = spawn(pathToScrip, [], { stdio: 'inherit' });

      child.on('error', function (err) {
        callback(err);
      });

      child.on('exit', function (code) {
        console.log('exited with code', code);
        callback(null);
      });
    };
  },

  requireFiber: function () {
    var fiber = Fiber.current;

    if (!fiber) {
      throw new Error('must be runned within a fiber');
    }

    fiber.reject  = function (err) { fiber.throwInto(err); };
    fiber.resolve = function (res) { fiber.run(res); };

    return fiber;
  },

  promise: function (inner) {
    return function (callback) {
      inner(function (res) {
        callback(null, res);
      }, function (err) {
        callback(err);
      });
    };
  },

}