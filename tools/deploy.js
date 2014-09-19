var requireFiber = require('./common').requireFiber;
var runScriptAsPromise =require('./common').runScriptAsPromise;
var Connection = require('ssh2');
var config = require('./config');
var update = require('./update');
var mkdirp = require('mkdirp');
var Fiber = require('fibers');
var path = require('path');
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
    conn.shell(function (err, stream) {
      if (err) throw err; // may be unsafe

      // TODO: pipe stdin if password is required

      stream.on('close', function () {
        conn.end();
      }).on('data', function (data) {
        process.stdout.write(data);
      }).stderr.on('data', function(data) {
        process.stderr.write(data);
      });

      // get config from stdin and deploy locally
      stream.write("cat <<EOF | nebula deploy --local --config-from -\n");
      stream.write(JSON.stringify(settings, undefined, 2));
      stream.write('\nEOF\n');
      stream.end('exit\n');
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

  // run update to create the necessary assets
  update(null, options);

  runScriptAsPromise(path.join('.nebula', 'assets', 'rebuild.sh')).then(fiber.resolve, fiber.reject);

  Fiber.yield();

  if (options.buildOnly) {
    return;
  }

  runScriptAsPromise(path.join('.nebula', 'assets', 'restart.sh')).then(fiber.resolve, fiber.reject);

  Fiber.yield();
}
