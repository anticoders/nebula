var chalk = require('chalk');

var keypress = require('keypress');

keypress(process.stdin);

module.exports = function(title, options, callback) {

  var self = this, buffer = "", index = 0;

  if (arguments.length < 3) {
    callback = options; options = {};
  }

  function nTimes(n, c) {
    return new Array(n + 1).join(c);
  }

  options.transform = options.transform || function (str) {
    return options.mask ? nTimes(str.length, str.mask[0]) : str;
  }

  function showPlaceholder() {
    options.placeholder && process.stdout.write(options.placeholder + 
      nTimes(chalk.stripColor(options.placeholder).length, '\b'));
  }

  function clearPlaceholder() {
    options.placeholder && process.stdout.write(
      nTimes(chalk.stripColor(options.placeholder).length, ' ') +
        nTimes(chalk.stripColor(options.placeholder).length, '\b'));
  }

  process.stdout.write(title + ' ');
  showPlaceholder();

  process.stdin.setRawMode(true);

  // keypress
  process.stdin.on('keypress', function(chunk, key) {

    // make sure chunk is a string
    chunk = chunk && chunk.toString();

    if (key && ['tab', 'return'].indexOf(key.name) >= 0) {

      // restore stdin
      process.stdout.write('\n\r');
      process.stdin.removeAllListeners('keypress');
      process.stdin.setRawMode(false);
      process.stdin.pause();

      // finally return the result
      return callback(buffer);
    }

    if (key && key.ctrl && 'c' === key.name) {

      process.exit();

    } else if (key && key.name === 'escape') {

      process.stdout.write(nTimes(index, '\b'));
      process.stdout.write(nTimes(buffer.length, ' '));
      process.stdout.write(nTimes(buffer.length, '\b'));
      buffer = '';
      index  = 0;

      showPlaceholder();

    } else if (key && key.name === 'backspace') {

      if (index > 0) {

        process.stdout.write('\b');
        process.stdout.write(options.transform(buffer.substr(index)) + ' ');
        process.stdout.write(nTimes(buffer.length - index + 1, '\b'));

        buffer = buffer.substr(0, index - 1) + buffer.substr(index);
        index -= 1;
      }

    } else if (key && key.name === 'left') {

      if (index > 0) {
        process.stdout.write(key.sequence);
        index -= 1;
      }

    } else if (key && key.name === 'right') {

      if (index < buffer.length) {
        process.stdout.write(key.sequence);
        index += 1;
      }

    } else if (chunk) {

      process.stdout.write(options.transform(chunk));
      process.stdout.write(options.transform(buffer.substr(index)));
      process.stdout.write(nTimes(buffer.length - index, '\b'));

      if (buffer.length === 0 && chunk.length > 0) {
        clearPlaceholder();
      }

      buffer = buffer.substr(0, index) + chunk + buffer.substr(index);
      index += chunk.length;
    }

    if (buffer.length === 0) {
      showPlaceholder();
    }

  });
  
  // start listening on stdin
  process.stdin.resume();
};
