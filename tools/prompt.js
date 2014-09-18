var chalk = require('chalk');

var keypress = require('keypress');

keypress(process.stdin);

module.exports = function form (fields, options, callback) {

  var index = -1;
  var formData = {};
  var width = Math.max.apply(null, fields.map(function (field) { return field.label && field.label.length; }));

  next();

  function next() {
    var field;
    index += 1;
    if (index > fields.length - 1) {
      process.stdout.write('\n\r');
      callback(null, formData);
    } else {
      // use default options
      field = Object.create(options);
      for (k in fields[index]) {
        field[k] = fields[index][k];
      }
      if (field.type === 'password') {
        field.mask = '*';
      }
      if (formData[field.name]) {
        field.value = formData[field.name];
      }
      //--------------------------------------------------------
      process.stdout.write('\n\r' + align(field.label) + ' : ');
      module.exports.input(field, function (err, value) {
        formData[field.name] = value;
        setTimeout(next);
      });
    }
  }

  function align(str) {
    //console.log(str, width);
    return new Array(width - str.length + 1).join(' ') + chalk.underline(str);
  }

}

module.exports.input = function (options, callback) {

  var mask        = options.mask;
  var size        = options.size;
  var space       = options.space || " ";
  var value       = chalk.stripColor(options.value || "");
  var placeholder = chalk.stripColor(options.placeholder || "");

  var right = '\u001b[C';
  var left  = '\u001b[D';
  var begin = '\u001b[0G';

  var _transform = options.transform || function (str) {
    return mask ? nTimes(str.length, mask[0]) : str;
  }

  if (size && placeholder) {
    placeholder = placeholder.substr(0, size);
  }

  if (size && value) {
    value = value.substr(0, size);
  }

  var buffer = value || "";
  var index  = buffer.length;

  function nTimes(n, c) {
    return new Array(n + 1).join(c);
  }

  function transform(str) {
    return _transform(str).replace(/ /g, space);
  }

  function showPlaceholder(placeholder, style) {
    style = style || function (str) { return str };
    placeholder && process.stdout.write(style(placeholder) + nTimes(placeholder.length, left));
  }

  function hidePlaceholder(placeholder) {
    placeholder && process.stdout.write(
      nTimes(placeholder.length, space) +
        nTimes(placeholder.length, left));
  }

  if (size) {
    showPlaceholder(nTimes(size, space));
  }

  if (buffer) {
    process.stdout.write(transform(buffer));
  } else {
    showPlaceholder(placeholder, chalk.grey);
  }

  process.stdin.setRawMode(true);

  // keypress
  process.stdin.on('keypress', function(chunk, key) {

    // make sure chunk is a string
    chunk = chunk && chunk.toString();

    if (key && ['tab', 'return'].indexOf(key.name) >= 0) {

      process.stdout.write(nTimes(index, left));

      // restore stdin
      process.stdin.removeAllListeners('keypress'); // TODO: only remove this listener
      process.stdin.setRawMode(false);
      process.stdin.pause();

      // finally return the result
      return callback(null, buffer);
    }

    if (key && key.ctrl && 'c' === key.name) {

      process.stdout.write('\n\r');
      process.exit();

    } else if (key && key.name === 'escape') {

      process.stdout.write(nTimes(index, left));
      process.stdout.write(nTimes(buffer.length, space));
      process.stdout.write(nTimes(buffer.length, left));
      buffer = '';
      index  = 0;

      showPlaceholder(placeholder, chalk.grey);

    } else if (key && key.name === 'backspace') {

      if (index > 0) {

        process.stdout.write(left);
        process.stdout.write(transform(buffer.substr(index)) + space);
        process.stdout.write(nTimes(buffer.length - index + 1, left));

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

      if (size && buffer.length >= size) {
        return;
      }

      process.stdout.write(transform(chunk));
      process.stdout.write(transform(buffer.substr(index)));
      process.stdout.write(nTimes(buffer.length - index, left));

      if (buffer.length === 0 && chunk.length > 0) {
        hidePlaceholder(placeholder);
      }

      buffer = buffer.substr(0, index) + chunk + buffer.substr(index);
      index += chunk.length;
    }

    if (buffer.length === 0) {
      showPlaceholder(placeholder, chalk.grey);
    }

  });
  
  // start listening on stdin
  process.stdin.resume();
}
