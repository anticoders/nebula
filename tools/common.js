
var crypto = require('crypto');

module.exports = {

  unicode: {
    mark: "\u2714",
    fail: "\u00D7",
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

}