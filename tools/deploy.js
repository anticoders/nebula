var requireFiber = require('./common').requireFiber;
var runScriptAsAsyncTask =require('./common').runScriptAsAsyncTask;
var randomHexString = require('./common').randomHexString;
var Connection = require('ssh2');
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

module.exports = function deploy (name, options) {
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

    var isPassword = [
      /^\[sudo\]\s+password/, // sudo
      /^Password for 'https/, // github
    ];

    var isUsername = [
      /^Username for 'https/, // github
    ];

    function matches(chunk) {
      return function (re) {
        return re.test(chunk);
      }
    }

    conn.shell(function (err, stream) {
      if (err) throw err; // may be unsafe

      stream.on('close', function () {
        conn.end();

      }).on('data', function (data) {
        var chunk = data.toString();

        if (chunk.indexOf(uniqueTag) === 0) { // this was the last command
          stream.end('exit\n');
        } else {
          if ( isPassword.some(matches(chunk)) ) {
            form.input({ mask: '*', transform: chalk.green }, function (err, password) {
              stream.stdin.write(password + '\n');
            });
          } else if (isUsername.some(matches(chunk))) {
            form.input({ transform: chalk.green }, function (err, password) {
              stream.stdin.write(password + '\n');
            });
          }
          process.stdout.write(data);
        }
      }).stderr.on('data', function(data) {
        process.stderr.write(data);
      });

      // get config from stdin and deploy locally
      stream.write("cat <<EOF | nebula deploy --local --config-from - && echo \"" + uniqueTag + "\"\n");
      stream.write(JSON.stringify(settings, undefined, 2));
      stream.write('\nEOF\n');
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
