
var crypto = require('crypto');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var Fiber = require('fibers');
var chalk = require('chalk');

exports.unicode: {
  mark : "\u2714",
  fail : "\u00D7",
  dot  : "\u00B7",
};

exports.randomHexString = function randomHexString (length) {
  return crypto.randomBytes(length / 2).toString('hex').slice(0, length);
};

exports.either = function either (first) {
  return {
    or: function (second) {
      return function (arg1, arg2) {
        return arg1 ? first(arg1) : second(arg2);
      };
    }
  };
};

exports.runScriptAsAsyncTask = function runScriptAsAsyncTask (pathToScrip) {
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
};

exports.requireFiber = function requireFiber () {
  var fiber = Fiber.current;

  if (!fiber) {
    throw new Error('must be runned within a fiber');
  }

  fiber.reject  = function (err) { fiber.throwInto(err); };
  fiber.resolve = function (res) { fiber.run(res); };

  return fiber;
};

exports.promise = function promise (inner) {
  return function (callback) {
    inner(function (res) {
      callback(null, res);
    }, function (err) {
      callback(err);
    });
  };
};

/**
 * Creates a nice banner containing the given text.
 *
 * @param {string} text
 * @param {object} options
 */
exports.banner = function banner (text, options) {
  
  var marginX     = options.marginX !== undefined ? options.marginX : 2;
  var marginY     = options.marginY !== undefined ? options.marginY : 1;
  var margin      = new Array(marginX+1).join(" ");
  var indent      = options.indent !== undefined ? options.indent :  "  ";
  var maxLength   = 0;
  var linesOfText = text.split('\n');

  var pattern = options.pattern || {
    T: "/", B: "/", TR: "//", BR: "//", TL: "//", BL: "//", R: "//", L: "//"
  };

  linesOfText.forEach(function (line) {
    maxLength = Math.max(maxLength, line.length);
  });

  var top    = pattern.TL + new Array(2 * marginX + maxLength + 1).join(pattern.T) + pattern.TR;
  var empty  = pattern.L  + new Array(2 * marginX + maxLength + 1).join(" ")       + pattern.R;
  var bottom = pattern.BL + new Array(2 * marginX + maxLength + 1).join(pattern.B) + pattern.BR;

  linesOfText = linesOfText.map(function (line) {
    while (line.length < maxLength) {
      line += " ";
    }
    return pattern.L + margin + line + margin + pattern.R;
  });

  // vertical margin
  for (var i=0; i<marginY; i++) {
    linesOfText.unshift(empty);
    linesOfText.push(empty);
  }

  // top and bottom lines
  linesOfText.unshift(top);
  linesOfText.push(bottom);

  return linesOfText.map(function (line) {
    return indent + line;
  }).join('\n');
};
