var handlebars = require('handlebars');
var commander = require('commander');
var Promise = require('es6-promise').Promise;
var mkdirp = require('mkdirp');
var common = require('./common');
var colors = require('colors');
var Fiber = require('fibers');
var exec = require('child_process').exec;
var path = require('path');
var fs = require('fs');
var either = common.either;

module.exports = function update (configJsonPath, prefix) {

  if (!fiber) {
    throw new Error('update must be runned within a fiber');
  }

  var fiber = Fiber.current;

  // TODO: use this prefix in place of hardcoded "nebula"
  prefix = prefix || 'nebula';

  var pathToConfig = path.resolve(path.join('.nebula', 'config'));
  var pathToSource = path.resolve(path.join('.nebula', 'source'));
  var pathToBuilds = path.resolve(path.join('.nebula', 'builds'));
  var pathToAssets = path.resolve(path.join('.nebula', 'assets')); // these files should have versions

  var pathToHaproxyConfig = path.resolve(path.join('.nebula', 'assets', 'haproxy.cfg'));
  var pathToRestartScript = path.resolve(path.join('.nebula', 'assets', 'restart.sh' ));
  var pathToRebuildScript = path.resolve(path.join('.nebula', 'assets', 'rebuild.sh' ));

  var scripts = [ "build.sh", "pull.sh", "respawn.sh", "upstart.conf" ].map(function (name) {
    return { name: name,
      template: handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', name)).toString('utf8')),
    };
  });

  var haproxyConfigTemplate =
    handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', 'haproxy.cfg')).toString('utf8'));

  var restartScriptTemplate =
    handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', 'restart.sh')).toString('utf8'));

  var rebuildScriptTemplate =
    handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', 'rebuild.sh')).toString('utf8'));

  mkdirp.sync(pathToConfig);
  mkdirp.sync(pathToSource);
  mkdirp.sync(pathToAssets);
  mkdirp.sync(pathToBuilds);

  var configJson = { apps: [] };

  var configLock = {};
  var configLockPath = path.join(pathToAssets, 'nebula.lock');

  fs.readdirSync(pathToConfig).filter(function (file) {
    return path.extname(file) === '.json';
  }).forEach(function (file) {
    configJson.apps[path.basename(file, '.json')] = JSON.parse(fs.readFileSync(path.join(pathToConfig, file), 'utf8'));
  });

  //if (fs.existsSync(configJsonPath)) {
  //  configJson = JSON.parse(fs.readFileSync(configJsonPath).toString('utf8'));
  //}

  if (fs.existsSync(configLockPath)) {
    configLock = JSON.parse(fs.readFileSync(configLockPath).toString('utf8'));
  }

  var listOfIds = Object.keys(configJson.apps);

  // make sure the asset repository is initialized
  if (!fs.existsSync(path.join(pathToAssets, '.git'))) {
    exec('git init', {
      cwd: pathToAssets
    }, function (error, stdout, stderr) {
      if (!error) {
        console.log(('created git repo at ' + pathToAssets).green);
      }
    });
  }

  // TODO: make sure that app names are unique



  //throw new Error("LOL");

  Promise.all(
    listOfIds.map(function (name) {
      return new Promise(function (resolve, reject) {
        var app = configJson.apps[name];
        console.log(name.cyan + ' -> ' + app.repository.git.yellow);
        exec('git ls-remote ' + app.repository.git, { cwd: null }, either(reject).or(function (stdout) {
          var match = /^([\da-f]+)\s+HEAD$/m.exec(stdout);
          if (match) {
            configJson.apps[name].sha = match[1];
            console.log(name.cyan + ' -> ' + match[1]);
          }
          resolve();
        }));
      });
    })
  ).then(function () {
    fiber.run();
  }, function (error) {
    fiber.throwInto(error);
  }).catch(function (error) {
    console.error(error.stack.red);
  });

  Fiber.yield();

  var lastFreePort = 3000;

  listOfIds.forEach(function (id) {
    var app = configJson.apps[id];

    app.port = lastFreePort++;
    app.hash = app.id;
    app.user = process.env.USER;

    app.pathToAssets = path.join(pathToAssets, id);
    app.pathToSource = path.join(pathToSource, id);
    app.pathToBuilds = path.join(pathToBuilds, id);

    mkdirp.sync(app.pathToAssets);
    
    // environment variables
    fs.writeFileSync(path.join(app.pathToAssets, 'variables'), Object.keys(app.environment).map(function (key) {
      return key + '=' + (typeof app.environment[key] === 'object' ? JSON.stringify(app.environment[key]) : app.environment[key].toString());
    }).join('\n'));

    // scripts from templates
    scripts.forEach(function (script) {
      fs.writeFileSync(path.join(app.pathToAssets, script.name), script.template(app));
      if (/\.sh/.test(script.name)) {
        fs.chmodSync(path.join(app.pathToAssets, script.name), "744");
      }
    });

  });

  console.log('saving config files ...');

  // lock file
  // fs.writeFileSync(configLockPath, JSON.stringify(configJson, undefined, 2));

  // haproxy config
  fs.writeFileSync(pathToHaproxyConfig, haproxyConfigTemplate({
    apps: Object.keys(configJson.apps).map(function (name) { 
      return configJson.apps[name];
    })
  }));

  // rebuild script
  fs.writeFileSync(pathToRebuildScript, rebuildScriptTemplate({
    listOfIds : listOfIds
  }));

  // restart script
  fs.writeFileSync(pathToRestartScript, restartScriptTemplate({
    pathToHaproxyConfig : pathToHaproxyConfig,
    listOfIds           : listOfIds
  }));

  fs.chmodSync(pathToRestartScript, "744");
  fs.chmodSync(pathToRebuildScript, "744");

  exec("git add restart.sh rebuild.sh " + listOfIds.join(' ') + " && git commit -a -m 'updated assets'",
    { cwd: pathToAssets }, function () {
      fiber.run();
    });

  Fiber.yield();

}
