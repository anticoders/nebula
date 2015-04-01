
var prompt = require('./prompt');
var chalk = require('chalk');
var pty = require('pty.js');

exports.runAndWatchForPasswords = function runAndWatchForPasswords (command, args, options, creds, cb) {

  var stderr = "";
  var stdout = "";
  var script;

  try {
    script = pty.spawn(command, args, options);
  } catch (err) {
    return cb(err);
  }

  var questions = [
    { re: /^Password:/m,           save: false , type: 'password', answer: creds.password },
    { re: /^\[sudo\]\s+password/m, save: false , type: 'password', answer: creds.password },
    { re: /^Password for 'https/m, save: true  , type: 'password', answer: creds.repository.password },
    { re: /^Username for 'https/m, save: true  , type: 'text'    , answer: creds.repository.username },
  ];

  script.stdout.on('data', function (data) {
    var chunk = data.toString(), q = null;

    stdout += data.toString();

    process.stdout.write(data);
    q = questions.filter(function (q) { return q.re.test(chunk); })[0];

    if (!q) {
      // ignore ...
    } else if (q.answer) {
      script.stdin.write(q.answer + '\n');
    } else { // as question
      prompt.input({ mask: q.type === 'password' ? '*' : '', transform: chalk.green }, function (err, answer) {
        if (q.save) { q.answer = answer }
        script.stdin.write(answer + '\n');
      });
    }

  });

  //script.stderr.on('data', function (data) {
  //  stderr += data.toString();
  //});

  script.on('exit', function (code) {
    if (code) {
      process.stdout.write("\n\n" + chalk.red(stderr) + "\n\n");
      return cb(new Error('script exited with code ' + code));
    }
    cb(null, stdout);
  });

  script.on('error', function (err) {
    cb(err);
  });

}
