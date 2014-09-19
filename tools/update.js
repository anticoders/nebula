var handlebars = require('handlebars');
var commander = require('commander');
var Promise = require('es6-promise').Promise;
var mkdirp = require('mkdirp');
var common = require('./common');
var colors = require('colors');
var Fiber = require('fibers');
var chalk = require('chalk');
var exec = require('child_process').exec;
var path = require('path');
var fs = require('fs');
var either = common.either;
var requireFiber = common.requireFiber;

module.exports = function update (appId, options) {

  // TODO: appId is currently ignored, but it would be nice to restrict
  //       the update routine to a given app only

  var fiber = requireFiber();

  var pathToDeploy = path.resolve(path.join('.nebula', 'deploy'));
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

  var globalScripts = [ "haproxy.cfg", "restart.sh", "rebuild.sh" ].map(function (name) {
    return { name: name,
      template: handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', name)).toString('utf8')),
    };
  });

  var haproxyConfigTemplate = handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', 'haproxy.cfg')).toString('utf8'));
  var restartScriptTemplate = handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', 'restart.sh' )).toString('utf8'));
  var rebuildScriptTemplate = handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', 'rebuild.sh' )).toString('utf8'));

  mkdirp.sync(pathToDeploy);
  mkdirp.sync(pathToSource);
  mkdirp.sync(pathToAssets);
  mkdirp.sync(pathToBuilds);

  var configJson = { apps: [] };
  var appsById = {};

  var configLock = {};
  var configLockPath = path.join(pathToAssets, 'nebula.lock');

  fs.readdirSync(pathToDeploy).filter(function (file) {
    return path.extname(file) === '.json';
  }).forEach(function (file) {
    var appId = path.basename(file, '.json');
    appsById[appId] = JSON.parse(fs.readFileSync(path.join(pathToDeploy, file), 'utf8'));
  });

  if (fs.existsSync(configLockPath)) {
    configLock = JSON.parse(fs.readFileSync(configLockPath).toString('utf8'));
  }

  var listOfIds  = Object.keys(appsById);
  var listOfApps = listOfIds.map(function (appId) { return appsById[appId]; });

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

  Promise.all(
    listOfIds.map(function (appId) {
      return new Promise(function (resolve, reject) {
        var app = appsById[appId];
        console.log(chalk.cyan(appId) + ' -> ' + chalk.yellow(app.repository.url));
        exec('git ls-remote ' + app.repository.url, { cwd: null }, either(reject).or(function (stdout) {
          var match = /^([\da-f]+)\s+HEAD$/m.exec(stdout);
          if (match) {
            appsById[appId].sha = match[1];
            console.log(chalk.cyan(appId) + ' -> ' + match[1]);
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

  listOfIds.forEach(function (appId) {
    var app = appsById[appId];

    app.port = lastFreePort++;
    app.user = process.env.USER;

    app.pathToAssets = path.join(pathToAssets, appId);
    app.pathToSource = path.join(pathToSource, appId);
    app.pathToBuilds = path.join(pathToBuilds, appId);

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

  globalScripts.forEach(function (script) {
    fs.writeFileSync(path.join(pathToAssets, script.name), script.template({
      pathToHaproxyConfig : pathToHaproxyConfig,
      listOfApps          : listOfApps,
      listOfIds           : listOfIds,
    }));
    if (/\.sh/.test(script.name)) {
      fs.chmodSync(path.join(pathToAssets, script.name), "744");
    }
  });

  // commit to repository

  exec("git add restart.sh rebuild.sh " + listOfIds.join(' ') + " && git commit -a -m 'updated assets'",
    { cwd: pathToAssets }, function () {
      fiber.run();
    });

  Fiber.yield();

}
