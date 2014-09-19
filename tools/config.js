
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
var unicode = require('./common').unicode;
var either = require('./common').either;

module.exports = function config (name, options) {

  var fiber = Fiber.current;

  if (!fiber) {
    throw new Error('config must be runned within a fiber');
  }

  var reject = function (err) { fiber.throwInto(err); };
  var resolve = function (res) { fiber.run(res); };

  var pathToConfig = path.join('.nebula', 'config');
  mkdirp.sync(pathToConfig);

  var settings = options.settings || findSettingsByName(pathToConfig, name);
  if (!settings) {
    console.log("\u00D7 no settings provided".red);
    return;
  }

  settings.deploy = settings.deploy || name;
  if (!settings.appId) {
    console.log('settings appId must be provided'.red);
    return;
  }

  console.log(chalk.green(              "==============================="));
  console.log(chalk.green(unicode.mark + " using the following settings:"));
  console.log(chalk.green(              "==============================="));
  console.log(chalk.magenta(JSON.stringify(settings, undefined, 2)));

  var save = options.save;

  if (!save && !fs.existsSync(path.join(pathToConfig, settings.deploy + '.yml'))) {
    process.stdout.write(chalk.underline('Save?') + ' : ');
    form.input({ placeholder: 'do you want to save?' }, either(reject).or(resolve));
    save = [ 'y', 'yes', 'true', '1' ].indexOf( Fiber.yield().toLowerCase() ) >= 0;
    
    console.log();

    if (save) {
      template = handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', 'default.yml'), 'utf8'));
      fs.writeFileSync(path.join(pathToConfig, settings.deploy + '.yml'), template(settings) + '\n');
    }
  } else if (save) {
    fs.writeFileSync(path.join(pathToConfig, settings.deploy + '.yml'),
      yaml.safeDump(settings, { skipInvalid: true }) + '\n');
  }

  return settings;
}

function findSettingsByName (pathToConfig, name) {

  var fiber = Fiber.current;

  if (!fiber) {
    throw new Error('findByName must be runned within a fiber');
  }

  var reject = function (err) { fiber.throwInto(err); };
  var resolve = function (res) { fiber.run(res); };

  var deploys = {};
  var settings;
  var listOfFiles = fs.readdirSync(pathToConfig).filter(function (file) { return path.extname(file) === '.yml' });

  if (listOfFiles.length === 0) {

    fs.writeFileSync(path.join('.nebula', 'README.md'), fs.readFileSync(path.join(__dirname, 'templates', 'README.md')));
    fs.writeFileSync(path.join('.nebula', '.gitignore'), [
      "assets", "builds", "source"
    ].join('\n'));
  }

  listOfFiles.forEach(function (file) {
    var name = path.basename(file, '.yml');
    deploys[name] = path.join(pathToConfig, file);
  });

  var hasDefault = deploys.default !== undefined;

  if (!name && hasDefault) {
    name = 'default';
  }

  if (!name && listOfFiles.length === 1) {
    name = Object.keys(deploys)[0];
  }

  if (!name && listOfFiles.length > 1) {

    process.stdout.write(chalk.underline('Choose deploy') + ' : ');
    form.input({ placeholder: Object.keys(deploys).join(', ') }, either(reject).or(resolve));

    name = Fiber.yield();
    process.stdout.write('\n\r');
  }

  if (!name || !deploys[name]) {

    if (name) {
      console.log('settings file for ' + chalk.underline(name) + ' does not exist, but we can create it:');
    }

    settings = create(name);
    name = settings.deploy;

  } else {

    try {
      settings = yaml.safeLoad(fs.readFileSync(deploys[name], 'utf8'));
    } catch(err) {
      // TODO: throw error maybe?
      console.log(err.toString().red);
      return;
    }

  }

  return settings;
}
