
var Connection = require('ssh2');
var Fiber = require('fibers');
var crypto = require('crypto');
var form = require('../tools/prompt');
var chalk = require('chalk');
var exec = require('child_process').exec;
var common = require('./common');
var either = common.either;
var unicode = common.unicode;
var randomHexString = common.randomHexString;
var requireFiber = common.requireFiber;

module.exports = function create (name) {

  var fiber = requireFiber();

  var options = {
    data      : { deployment: name || 'default' },
    transform : chalk.green,
  };

  // GENERAL INFO
  console.log(chalk.underline.magenta("General info:"));

  form([
    { name: 'deployment' , label: 'Deployment', placeholder: 'name of this deployment', type: 'text' },
    { name: 'domain'     , label: 'Domain',     placeholder: 'domain of your app',      type: 'text' },
  ], options, either(fiber.reject).or(fiber.resolve));

  Fiber.yield();

  // SSH CREDENTIALS
  console.log(chalk.underline.magenta("SSH credentials:"));

  // default values
  options.data.host = options.data.domain;
  options.data.port = "22";

  form([

    { name: 'host',       label: 'Host',        placeholder: 'domain or ip address',   type: 'text',     },
    { name: 'port',       label: 'SSH Port',    placeholder: 'default is 22',          type: 'text',     },
    { name: 'username',   label: 'User',        placeholder: 'username',               type: 'text',     },
    { name: 'password',   label: 'Password',    placeholder: '',                       type: 'password', },

    //{ name: 'privateKey', label: 'Private Key', placeholder: 'path to private key',    type: 'file'     },
  ], options, either(fiber.reject).or(fiber.resolve));

  Fiber.yield();

  var conn = new Connection();

  // TODO: reserve id on this server

  conn.on('ready', function () {
    conn.end(); fiber.resolve();
  }).on('error', fiber.reject).connect(options.data);

  Fiber.yield();

  options.data.appId = randomHexString(8);

  console.log(chalk.green(              '=============================='));
  console.log(chalk.green(unicode.mark + ' credentials seems to be fine'));
  console.log(chalk.green(              '=============================='));

  options.data.save = 'no';

  form([
    { name: 'save', label: 'Save password?', placeholder: 'yes or no', type: 'boolean' }
  ], options, either(fiber.reject).or(fiber.resolve));

  Fiber.yield();

  if (options.data.save !== 'yes') {
    delete options.data.password;
  }

  // REPOSITORY SETTINGS
  console.log(chalk.underline.magenta("Repository:"));

  exec('git remote -v', function (err, stdout) {
    if (err) return fiber.resolve();
    var match = /origin\s+(http[^\s]*)/m.exec(stdout);
    fiber.resolve(match && match[1]);
  });

  options.data.repoUrl = Fiber.yield();
  options.data['private'] = 'no';

  form([
    { name: 'repoUrl', label: 'Url',      placeholder: 'url to your git repo', type: 'text' },
    { name: 'private', label: 'Private?', placeholder: 'yes or no',            type: 'text' },
  ], options, either(fiber.reject).or(fiber.resolve));

  Fiber.yield();

  if (options.data['private'] === 'yes') {
    form([
      { name: 'repoUser', label: 'Repo User'     , placeholder: 'username', type: 'text' },
      { name: 'repoPass', label: 'Repo Password' , placeholder: '',         type: 'password' },
    ], options, either(fiber.reject).or(fiber.resolve));

    Fiber.yield();
  }

  // ENVIRONMENT VARIABLES
  console.log(chalk.underline.magenta("Environment:"));

  options.data.ROOT_URL = 'http://' + options.data.domain;

  form([
    { name: 'ROOT_URL',  label: 'ROOT_URL', placeholder: 'root path for your app', type: 'text' },
    { name: 'MONGO_URL', label: 'MONGO_URL', placeholder: 'you may leave it blank', type: 'text' },
  ], options, either(fiber.reject).or(fiber.resolve));

  Fiber.yield();

  return clean(options.data);
}


function clean(formData) {

  var settings = { _name: formData.deployment };

  [ 'appId', 'domain', 'host', 'port', 'username', 'password' ].forEach(function (name) {
    settings[name] = formData[name];
  });

  settings.repository = {
    url      : formData.repoUrl,
    username : formData.repoUser,
    password : formData.repoPass,
  }

  settings.environment = {};

  [ 'MONGO_URL', 'ROOT_URL' ].forEach(function (name) {
    settings.environment[name] = formData[name];
  });

  return settings;
}
