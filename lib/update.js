var handlebars = require('handlebars');
var commander = require('commander');
var mkdirp = require('mkdirp');
var utils = require('./utils');
var colors = require('colors');
var async = require('async');
var Fiber = require('fibers');
var chalk = require('chalk');
var exec = require('child_process').exec;
var path = require('path');
var fs = require('fs');
var either = utils.either;
var requireFiber = utils.requireFiber;
var promise = utils.promise;

module.exports = function update (appId, options) {

  // TODO: appId is currently ignored, but it would be nice to restrict
  //       the update routine to a given app only

  var fiber = requireFiber();

  var pathToDeploy = path.resolve('.nebula', 'deploy');
  var pathToSource = path.resolve('.nebula', 'source');
  var pathToBuilds = path.resolve('.nebula', 'builds');
  var pathToAssets = path.resolve('.nebula', 'assets'); // these files should have versions

  var scripts = [ "build.sh", "pull.sh", "respawn.sh", "upstart.conf" ].map(function (name) {
    return { name: name,
      template: handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', name)).toString('utf8')),
    };
  });

  var globalScripts = [ "haproxy.cfg", "restart.sh", "rebuild.sh" ].map(function (name) {
    return { name: name,
      template: handlebars.compile(fs.readFileSync(path.resolve(__dirname, '..', 'templates', name)).toString('utf8')),
    };
  });
  
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
  // TODO: verify if app configs have all necessary data

  async.series(
    listOfIds.map(function (appId) {
      return promise(function (resolve, reject) {
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
    }),
  function (err) {
    if (err) return fiber.throwInto(err);
    //console.error(error.stack.red);
    fiber.run();
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
    
    if (app.environment && !app.environment.MONGO_URL) {
      app.environment.MONGO_URL = "mongodb://127.0.0.1/" + appId; // development mode
    }

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
      pathToAssets : pathToAssets,
      listOfApps   : listOfApps,
      listOfIds    : listOfIds,
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
