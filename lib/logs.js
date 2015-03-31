var chalk = require('chalk');
var verbose = true;

exports.setVerbose = function (value) {
  verbose = !!value;
}

exports.system = function system (data, options) {
  if (!verbose) {
    return;
  }
  var color = options && options.isError ? chalk.bgRed.white : chalk.bgCyan.black;
  //------------------------------------------------------------------------------
  process.stdout.write(indent(data.toString(), color(' system '), chalk.inverse));
  if (!options || !options.raw) {
    process.stdout.write('\n');
  }
}

function indent(text, prefix, color) {
  if (!color) {
    color = function (x) { return x; }
  }
  return text.toString().split('\n').map(function (line) {
    var length = chalk.stripColor(prefix + " " + line).length;
    if (line === '\r') {
      return;
    }
    if (line.length === 0) {
      return "";
    }
    if (length < process.stdout.columns) {
      line += new Array(process.stdout.columns - length + 1).join(' ');
    }
    return prefix + color(" " + line);
  }).join('\n');
}
