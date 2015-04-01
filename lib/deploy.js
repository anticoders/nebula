
var config = require('./config');
var chalk = require('chalk');
var path = require('path');
var prompt = require('./prompt');
var fs = require('fs');
var Future = require('fibers/future');
var pty = require('pty');
var utils = require('./utils');

module.exports = utils.runInsideFiber(function deploy (name, options) {
  "use strict";

  var appConfig = Future.wrap(config)(name).wait();
  var appName   = appConfig.appName;

  var pathToConfigJSON   = path.resolve('.nebula', 'deploy', appName + '.json');
  var pathToDeployScript = path.resolve('.nebula', 'assets', appName, 'deploy.sh');

  try {
    appConfig = JSON.parse(fs.readFileSync(pathToConfigJSON, 'utf8'));
  } catch (err) {
    if (err.code = 'ENOENT') {
      console.log("The file ./nebula/deploy/" + appName
        + ".json does not exist. Run 'nebula update " + name + "' first.");
    }
    throw err;
  }

  var fields = [];

  if (!appConfig.username) {
    fields.push({ label: 'Username', name: 'username', type: 'text' });
  }

  if (!appConfig.password) {
    fields.push({
      name  : 'password',
      label : 'Password' + (appConfig.username ? ' for ' + appConfig.username : ''),
      type  : 'password',
    });
  }

  Future.wrap(prompt.form)(fields, {
    data: appConfig, transform: chalk.green
  }).wait();

  var deploy = pty.spawn(pathToDeployScript, [  ]);

  var questions = [
    { re: /^Password:/m,           save: false , type: 'password', answer: appConfig.password },
    { re: /^\[sudo\]\s+password/m, save: false , type: 'password', answer: appConfig.password },
    { re: /^Password for 'https/m, save: true  , type: 'password', answer: appConfig.repository.password },
    { re: /^Username for 'https/m, save: true  , type: 'text'    , answer: appConfig.repository.username },
  ];

  deploy.stdout.on('data', function (data) {
    var chunk = data.toString(), q = null;

    process.stdout.write(data);
    q = questions.filter(function (q) { return q.re.test(chunk); })[0];

    if (!q) {
      // ignore ...
    } else if (q.answer) {
      deploy.stdin.write(q.answer + '\n');
    } else { // as question
      form.input({ mask: q.type === 'password' ? '*' : '', transform: chalk.green }, function (err, answer) {
        if (q.save) { q.answer = answer }
        deploy.stdin.write(answer + '\n');
      });
    }

  });

});
