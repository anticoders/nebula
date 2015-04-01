
var version = require('../package.json').version;
var Connection = require('ssh2');
var crypto = require('crypto');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var Fiber = require('fibers');
var chalk = require('chalk');

exports.unicode = {
  mark : "\u2714",
  fail : "\u00D7",
  dot  : "\u00B7",
};

exports.runInsideFiber = function runInsideFiber (func) {
  return function wrapped () {
    var that = this;
    var args = Array.prototype.slice.call(arguments, 0);
    var cb   = args[args.length-1];

    if (typeof cb !== 'function') {
      cb = function (err) {
        if (err) {
          throw err;
        }
      }
    }

    Fiber(function () {
      try {
        cb(null, func.apply(that, args));
      } catch (err) {
        cb(err);
      }
    }).run();
  }
}

exports.checkSshCredentials = function checkSshCredentials (data, cb) {
  var conn = new Connection();

  conn
    .on('ready', function () {
      conn.end(); cb(null);
    })
    .on('error', function (err) {
       cb(err);
    })
    .connect(data);
}

exports.getGitRemoteUrl = function getGitRemoteUrl (cb) {
  exec('git remote -v', function (err, stdout) {
    var match;
    if (err) {
      cb(err);
    } else {
      match = /origin\s+(http[^\s]*)/m.exec(stdout);
      cb(null, match && match[1]);
    }
  });
}

exports.initGitRepo = function initGitRepo (pathToRepo, cb) {
  exec('git init', {
    cwd: pathToRepo
  }, function (err, stdout, stderr) {
    cb(err);
  });  
}

exports.updateGitConfig = function initGitRepo (pathToRepo, cb) {
  exec('git config user.name nebula@' + version, {
    cwd: pathToRepo
  }, function (err, stdout, stderr) {
    cb(err);
  });  
}

exports.getTheLatestCommitSha = function getTheLatestCommitSha(repoUrl, cb) {
  exec('git ls-remote ' + repoUrl, { cwd: null }, function (err, stdout) {
    if (err) {
      return cb(err);
    }
    var match = /^([\da-f]+)\s+HEAD$/m.exec(stdout);
    if (match) {
      cb(null, match[1]);
    } else {
      cb(new Error('cannot determine the latest commit sha for ' + repoUrl));
    }
  });
}

exports.commitToGitRepo = function commitToGitRepo (pathToRepo, files, message, cb) {
  exec("git add " + files.join(' ') + " && git commit -a -m " +
    JSON.stringify(message), { cwd: pathToRepo }, function (err, stdout, stderr) {

    if (err) {
      // ignore error caused by the fact that there are no real changes
      if (!/nothing to commit\, working directory clean/.test(stdout)) {
        return cb(err);
      }
    }
    cb();
  });  
}

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

