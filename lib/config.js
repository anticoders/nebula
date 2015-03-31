
var mkdirp = require('mkdirp');
var yaml = require('js-yaml');
var form = require('./prompt');
var path = require('path');
var chalk = require('chalk');
var fs = require('fs');
var createNewConfig = require('./createNewConfig');
var utils = require('./utils');
var common = require('./common');
var logs = require('./logs');

module.exports = function config (name, cb) {

  var pathToConfig = common.getPathToConfig();

  mkdirp.sync(pathToConfig);

  logs.system('user requested config "' + name + '"');

  var settings = findSettingsByNameOrCreate(pathToConfig, name, function (err, settings) {

    if (err) {
      if (cb) {
        return cb(err);
      }
      throw err;
    }

    logs.system('received settings "' + settings._name + '"');

    name = settings._name;
    delete settings._name;

    console.log(chalk.green(                     "==============================="));
    console.log(chalk.green(utils.unicode.mark + " using the following settings:"));
    console.log(chalk.green(                     "==============================="));
    console.log(chalk.magenta(JSON.stringify(settings, undefined, 2)));

    var configFilePath = path.join(pathToConfig, name + '.yml');

    if (!fs.existsSync(configFilePath)) {
      process.stdout.write("saving to file " + configFilePath + "\n");

      template = common.getTemplate("default.yml");
      fs.writeFileSync(configFilePath, template(settings) + '\n');
    }

    // if callback provided, call it!
    cb && cb(null, settings);
  });
}

function findSettingsByNameOrCreate (pathToConfig, name, cb) {

  var listOfFiles = fs.readdirSync(pathToConfig).filter(function (file) { return path.extname(file) === '.yml' });
  var pathsByName = {};

  if (listOfFiles.length === 0) {
    // "initialize" the assets repository
    fs.writeFileSync(path.join('.nebula', 'README.md'), common.getTemplateSource('README.md'));
    fs.writeFileSync(path.join('.nebula', '.gitignore'), common.LIST_OF_IGNORED_DIRS.join('\n'));
  }

  listOfFiles.forEach(function (file) {
    var name = path.basename(file, '.yml');
    pathsByName[name] = path.join(pathToConfig, file);
  });

  logs.system('available configs are: ' + JSON.stringify(Object.keys(pathsByName)));

  // name not provided but default.yml exists!
  if (!name && pathsByName['default'] !== undefined) {
    name = 'default';
  }

  // name not provided but there is only one file
  if (!name && listOfFiles.length === 1) {
    name = Object.keys(pathsByName)[0];
  }

  // no luck, to many files and the name is not provided
  if (!name && listOfFiles.length > 1) {

    process.stdout.write(chalk.underline('Choose config') + ' : ');

    form.input({
      placeholder: Object.keys(pathsByName).join(', ')

    }, function (err, userChoice) {

      process.stdout.write('\n\r');

      loadOrCreate(userChoice, cb);
    });
  } else {

    loadOrCreate(name, cb);
  }

  /**
   * Load settings from file if it exists, otherwise create a new one.
   *
   * @param {string} name
   * @param {function} done
   */
  function loadOrCreate (name, cb) {

    if (!name || !pathsByName[name]) {
      if (name) {
        process.stdout.write('settings file for ' + chalk.underline(name) + ' does not exist, but we can create it:\n');
      }
      createNewConfig(name, cb);
      return;
    }

    var settings = yaml.safeLoad(fs.readFileSync(pathsByName[name], 'utf8'));
    settings._name = name;

    cb(null, settings);
  }

} // findSettingsByNameOrCreate

