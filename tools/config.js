
var Fiber = require('fibers');
var handlebars = require('handlebars');
var mkdirp = require('mkdirp');
var yaml = require('js-yaml');
var form = require('./prompt');
var path = require('path');
var chalk = require('chalk');
var fs = require('fs');
var create = require('./create');
var unicode = require('./common').unicode;
var either = require('./common').either;
var requireFiber = require('./common').requireFiber;

module.exports = function config (name, options) {

  var pathToConfig = path.join('.nebula', 'config');
  mkdirp.sync(pathToConfig);

  var settings = findSettingsByName(pathToConfig, name);

  name = settings._name;
  delete settings._name;

  console.log(chalk.green(              "==============================="));
  console.log(chalk.green(unicode.mark + " using the following settings:"));
  console.log(chalk.green(              "==============================="));
  console.log(chalk.magenta(JSON.stringify(settings, undefined, 2)));

  var configFilePath = path.join(pathToConfig, name + '.yml');

  if (!fs.existsSync(configFilePath)) {
    console.log("saving to file", configFilePath);

    template = handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', 'default.yml'), 'utf8'));
    fs.writeFileSync(configFilePath, template(settings) + '\n');
  }

  return settings;
}

function findSettingsByName (pathToConfig, name) {

  var fiber = requireFiber();
  var pathsByName = {};
  var listOfFiles = fs.readdirSync(pathToConfig).filter(function (file) { return path.extname(file) === '.yml' });

  if (listOfFiles.length === 0) {

    fs.writeFileSync(path.join('.nebula', 'README.md'), fs.readFileSync(path.join(__dirname, 'templates', 'README.md')));
    fs.writeFileSync(path.join('.nebula', '.gitignore'), [
      "assets", "builds", "source", "deploy"
    ].join('\n'));
  }

  listOfFiles.forEach(function (file) {
    var name = path.basename(file, '.yml');
    pathsByName[name] = path.join(pathToConfig, file);
  });

  if (!name && pathsByName['default'] !== undefined) {
    name = 'default';
  }

  if (!name && listOfFiles.length === 1) {
    name = Object.keys(pathsByName)[0];
  }

  if (!name && listOfFiles.length > 1) {

    process.stdout.write(chalk.underline('Choose config') + ' : ');
    form.input({ placeholder: Object.keys(pathsByName).join(', ') }, either(fiber.reject).or(fiber.resolve));

    name = Fiber.yield();
    process.stdout.write('\n\r');
  }

  if (!name || !pathsByName[name]) {
    name && console.log('settings file for ' + chalk.underline(name) + ' does not exist, but we can create it:');
    return create(name);
  }

  var settings = yaml.safeLoad(fs.readFileSync(pathsByName[name], 'utf8'));
  settings._name = name;

  return settings;
}
