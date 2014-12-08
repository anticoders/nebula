var Connection = require('ssh2');
var handlebars = require('handlebars');
var config = require('./config');
var update = require('./update');
var mkdirp = require('mkdirp');
var async = require('async');
var Fiber = require('fibers');
var chalk = require('chalk');
var path = require('path');
var form = require('./prompt');
var yaml = require('js-yaml');
var fs = require('fs');

var common = require('./common');
var requireFiber = common.requireFiber;
var runScriptAsAsyncTask = common.runScriptAsAsyncTask;
var randomHexString = common.randomHexString;
var either = common.either;

module.exports = function deploy (name, options) {
  var fiber = requireFiber();
  var settings;

  if (options.configFrom) {
    settings = grabConfig(options.configFrom);
  } else {
    settings = config(name, options);
  }

  if (!settings) {
    // TODO: do something more clever
    throw new Error('no settings provided');
  } else {
    options.settings = settings;
  }

  var fields = [];

  if (!settings.username && !options.local) {
    fields.push({ label: 'Username', name: 'username', type: 'text' });
  }

  if (!settings.password) {
    fields.push({
      name  : 'password',
      label : 'Password' + (settings.username ? ' for ' + settings.username : ''),
      type  : 'password',
    });
  }

  form(fields, { data: settings, transform: chalk.green }, either(fiber.reject).or(fiber.resolve));

  Fiber.yield();

  // TODO: probably it's better to test locally than throw errors on the server
  //if (!settings.appId) {
  //  throw new Error('settings appId must be provided');
  //}

  if (options.local) {
    // note that settings are passed along with options
    return deployLocally(options);
  }

  // remote deploy
  var conn = new Connection();

  conn.on('ready', function () {

    var uniqueTag = randomHexString(8);

    var questions = [
      { re: /^\[sudo\]\s+password/m, save: false , type: 'password', answer: settings.password },
      { re: /^Password for 'https/m, save: true  , type: 'password', answer: settings.repository.password },
      { re: /^Username for 'https/m, save: true  , type: 'text'    , answer: settings.repository.username },
    ];

    conn.shell(function (err, stream) {
      if (err) throw err; // may be unsafe

      stream.on('close', function () {
        conn.end();
      }).on('data', function (data) {
        var chunk = data.toString(), q = null;

        if (chunk.indexOf(uniqueTag) === 0) { // this was the last command
          stream.end('exit\n');
        } else {
          process.stdout.write(data);
          q = questions.filter(function (q) { return q.re.test(chunk); })[0];
          if (!q) {
            // ignore ...
          } else if (q.answer) {
            stream.stdin.write(q.answer + '\n');
          } else { // as question
            form.input({ mask: q.type === 'password' ? '*' : '', transform: chalk.green }, function (err, answer) {
              if (q.save) { q.answer = answer }
              stream.stdin.write(answer + '\n');
            });
          }
        }
      }).stderr.on('data', function(data) {
        process.stderr.write(data);
      });

      var pathToScriptTemplate = path.join(__dirname, 'templates', 'deploy.sh');
      var template = handlebars.compile(fs.readFileSync(pathToScriptTemplate, 'utf8'), { noEscape: true });

      stream.write(template({
        uniqueTag : uniqueTag,
        settings  : JSON.stringify(settings, undefined, 2)
      }));

    });

  }).connect({
    username : settings.username,
    password : settings.password,
    host     : settings.host,
    port     : settings.port || 22,
  });

} // deploy

function tryJSONorYAML(string) {
  try {
    return JSON.parse(string);
  } catch (err1) {
    try {
      return yaml.safeLoad(string);
    } catch (err2) {
      throw new Error('wrong data format:\n\n'
        + 'JSON: ' + err1.toString() + '\n\n'
        + err2.toString());
    }
  }
}

function grabConfig(fromFile) {
  var fiber = requireFiber();
  var buffer = "";
  var settings;

  function consume(err, data) {
    if (err) fiber.throwInto(err);
    try {
      fiber.run(tryJSONorYAML(data ? data.toString() : buffer));
    } catch (err) {
      fiber.throwInto(err);
    }
  }

  if (fromFile === '-') { // read from stdin
    process.stdin.on('data', function (data) { buffer += data.toString(); });
    process.stdin.on('end', consume);
  } else {
    fs.readFile(fromFile, consume);
  }

  return Fiber.yield();
}

function deployLocally(options) {

  var pathToDeploy = path.resolve(path.join('.nebula', 'deploy'));
  var pathToAssets = path.resolve(path.join('.nebula', 'assets'));
  var settings = options.settings;
  var fiber = requireFiber();

  // make sure the directory exists
  mkdirp.sync(pathToDeploy);

  if (!settings.appId) {
    throw new Error('settings appId must be provided');
  }

  // save settings to deploy directory
  fs.writeFileSync(path.join(pathToDeploy, settings.appId + '.json'), JSON.stringify(settings, undefined, 2));

  // later use appId as a constraint
  update(null, options);

  var tasks = [];

  tasks.push(runScriptAsAsyncTask(path.join('.nebula', 'assets', 'rebuild.sh')));

  if (!options.buildOnly) {
    tasks.push(runScriptAsAsyncTask(path.join('.nebula', 'assets', 'restart.sh')));
  }

  async.series(tasks, function (err) {
    if (err) return fiber.throwInto(err);
    fiber.run();
  });

  Fiber.yield();

  console.log('done');
}
