#!/usr/bin/env node

var handlebars = require('handlebars');
var commander = require('commander');
var Promise = require('es6-promise').Promise;
var mkdirp = require('mkdirp');
var colors = require('colors');
var Fiber = require('fibers');
var exec = require('child_process').exec;
var path = require('path');
var fs = require('fs');

var program = commander
  .option('-c, --config <relpath>', 'config file', 'nebula.json')
  .parse(process.argv);

var pathToSource = path.join(process.env.HOME, '.nebula', 'source');
var pathToBuilds = path.join(process.env.HOME, '.nebula', 'builds');
var pathToAssets = path.join(process.env.HOME, '.nebula', 'assets'); // these files should have versions

var scripts = [ "build.sh", "pull.sh", "respawn.sh", "upstart.conf" ].map(function (name) {
  return { name: name,
    template: handlebars.compile(fs.readFileSync(path.join('templates', name)).toString('utf8')),
  };
});

mkdirp.sync(pathToSource);
mkdirp.sync(pathToAssets);
mkdirp.sync(pathToBuilds);

var configJson = {};
var configJsonPath = path.resolve(program.config);

var configLock = {};
var configLockPath = path.join(pathToAssets, 'nebula.lock');

if (fs.existsSync(configJsonPath)) {
  configJson = JSON.parse(fs.readFileSync(configJsonPath).toString('utf8'));
}

if (fs.existsSync(configLockPath)) {
  configLock = JSON.parse(fs.readFileSync(configLockPath).toString('utf8'));
}

var listOfNames = Object.keys(configJson.apps);

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

Fiber(function () {
  var fiber = Fiber.current;

  //throw new Error("LOL");

  Promise.all(
    listOfNames.map(function (name) {
      return new Promise(function (resolve, reject) {
        var app = configJson.apps[name];
        console.log(name.cyan + ' -> ' + app.git.yellow);
        exec('git ls-remote ' + app.git, { cwd: null }, either(reject).or(function (stdout) {
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

  listOfNames.forEach(function (name) {
    var app = configJson.apps[name];

    app.port = lastFreePort++;
    app.name = name;

    app.pathToAssets = path.join(pathToAssets, name);
    app.pathToSource = path.join(pathToSource, name);
    app.pathToBuilds = path.join(pathToBuilds, name);

    mkdirp.sync(app.pathToAssets);
    
    // environment variables
    fs.writeFileSync(path.join(app.pathToAssets, 'variables'), Object.keys(app.env).map(function (key) {
      return key + '=' + JSON.stringify(app.env[key]);
    }).join('\n'));

    scripts.forEach(function (script) {
      fs.writeFileSync(path.join(app.pathToAssets, script.name), script.template(app));
      if (/\.sh/.test(script.name)) {
        fs.chmodSync(path.join(app.pathToAssets, script.name), "744");
      }
    });

  });

  console.log('writing to file ...');
  fs.writeFileSync(configLockPath, JSON.stringify(configJson, undefined, 2));

  exec("git add nebula.lock " + listOfNames.join(' ') + " && git commit -a -m 'updated assets'", { cwd: pathToAssets }, function () {
    fiber.run();
  });

  Fiber.yield();

}).run();

function either (first) {
  return {
    or: function (second) {
      return function (arg1, arg2) {
        return arg1 ? first(arg1) : second(arg2);
      };
    }
  };
};
