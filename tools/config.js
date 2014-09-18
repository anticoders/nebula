
var Connection = require('ssh2');
var Fiber = require('fibers');
var crypto = require('crypto');
var handlebars = require('handlebars');
var colors = require('colors');
var mkdirp = require('mkdirp');
var yaml = require('js-yaml');
var form = require('./prompt');
var path = require('path');
var chalk = require('chalk');
var fs = require('fs');
var exec = require('child_process').exec;
var create = require('./create');

module.exports = function config (name, options) {

  //if (!fs.existsSync('.meteor')) {
  //  console.log("\u26A0 it looks like you're not in a valid meteor project directory".yellow);
  //}

  if (!fs.existsSync('.nebula')) {
    fs.mkdirSync('.nebula');
  }

  var pathToConfig = path.join('.nebula', 'config');
  var settings = options.settings || findSettingsByName(name);

  if (options.settings && name) {
    console.log('settings are provided explicitly, igoring name'.yellow);
  }

  if (!settings) {
    console.log("\u00D7 no settings provided".red);
    return;
  }
  
  if (!settings.id) {
    console.log('settings id must be provided'.red);
    return;
  }

  console.log("\u2714 using settings:".green);
  console.log(JSON.stringify(settings, undefined, 2).magenta);

  if (options.save) {
    mkdirp.sync(pathToConfig);
    fs.writeFileSync(path.join(pathToConfig, settings.id + '.json'), JSON.stringify(settings, undefined, 2) + '\n');
  }

  return settings;
}


function findSettingsByName (name) {

  var listOfFiles = fs.readdirSync('.nebula').filter(function (file) { return path.extname(file) === '.yml' });
  var defaultFileName = 'default.yml';
  var defaultTemplate;
  var defaultContents;
  var settings;
  var ruler;
  var fiber = Fiber.current;
  var reject = function (err) { fiber.throwInto(err); };
  var resolve = function (res) { fiber.run(res); };

  if (!fiber) {
    throw new Error('findByName must be runned within a fiber');
  }

  create(name);

  if (listOfFiles.length === 0) {
    // drop a default file

    console.log([

      "It looks like you're deploying for the first time.",

    ].join('\n'));

    defaultTemplate = handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', 'default.yml'), 'utf8'));
    defaultContents = defaultTemplate({
      host     : "127.0.0.1",
      username : "nebula",
      password : "secret",

      git: "https://github.com/anticoders/nebula.git",

      ROOT_URL  : "http://localhost:3000",
      MONGO_URL : "mongodb://localhost:27017/nebula",
    });

    fs.writeFileSync(path.join('.nebula', defaultFileName), defaultContents);
    fs.writeFileSync(path.join('.nebula', 'README.md'), fs.readFileSync(path.join(__dirname, 'templates', 'README.md')));
    fs.writeFileSync(path.join('.nebula', '.gitignore'), [
      "assets", "builds", "config", "source"
    ].join('\n'));

    ruler = "============ " + path.join(".nebula/", defaultFileName) + " ============";

    console.log("since you're running nebula for the first time, we've created an example config file for you:\n")
    console.log(ruler);
    console.log(defaultContents.green);
    console.log( new Array(ruler.length).join('=') );

    listOfFiles.push(defaultFileName);
  }

  listOfFiles = listOfFiles.map(function (file) {
    return {
      path: path.join(".nebula", file),
      name: path.basename(file, '.yml'),
    }
  });

  function listOfOptionsAsString () {
    return listOfFiles.map(function (file) {
      return "\u2022 " + file.name;
    }).join('\n');
  }

  if (listOfFiles.length > 1 && !name) {
    console.log("you need to choose from one of:");
    console.log(listOfOptionsAsString().green);
    return;
  }

  if (name) {
    settings = listOfFiles.filter(function (file) {
      return name === file.name;
    })[0];
    if (!settings) {
      console.log("config file ".red + name.red + " does not exist".red);
      console.log("valid choices are:");
      console.log(listOfOptionsAsString());
      return;
    }
  } else {
    settings = listOfFiles[0];
  }

  try {
    settings = yaml.safeLoad(fs.readFileSync(settings.path, 'utf8'));
  } catch(err) {
    console.log(err.toString().red);
    return;
  }

  var pathToIdsFile = path.join('.nebula', 'nebula.json');
  if (!fs.existsSync(pathToIdsFile)) {
    fs.writeFileSync(pathToIdsFile, "{}");
  }
  
  var IDs = JSON.parse(fs.readFileSync(pathToIdsFile, 'utf8'));

  settings.id = settings.id || IDs[settings.name] || randomHexString(8); //|| new ObjectID();
  
  if (!IDs[settings.name]) {
    IDs[settings.name] = settings.id;
    fs.writeFileSync(pathToIdsFile, JSON.stringify(IDs, undefined, 2));

    console.log('we have added a unique id for ' + settings.name + ' app to ' + pathToIdsFile + ' file');
    console.log('you should generally commit this file to your repository');
  }

  return settings;

}
