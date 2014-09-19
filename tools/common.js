
var Promise = require('es6-promise').Promise;
var crypto = require('crypto');
var spawn = require('child_process').spawn;
var Fiber = require('fibers');

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

  runScriptAsPromise: function (pathToScrip) {
    console.log('executing ' + pathToScrip.cyan);
    return new Promise(function (resolve, reject) {
      var child = spawn(pathToScrip, [], { stdio: 'inherit' });
      child.on('error', reject);
      child.on('exit', resolve);
    });
  },

  requireFiber: function () {
    var fiber = Fiber.current;

    if (!fiber) {
      throw new Error('must be runned within a fiber');
    }

    fiber.reject  = function (err) { fiber.throwInto(err); };
    fiber.resolve = function (res) { fiber.run(res); };

    return fiber;
  }

}