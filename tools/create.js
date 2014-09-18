
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

module.exports = function create (name) {

  var fiber = Fiber.current;
  if (!fiber) { throw new Error('createConfig must be runned within a fiber'); }

  var reject = function (err) { fiber.throwInto(err); };
  var resolve = function (res) { fiber.run(res); };

  var options = {
    data      : { deploy: name || 'default' },
    transform : function (str) { return chalk.green(str); },
  };

  // GENERAL INFO
  console.log(chalk.underline.magenta("General info:"));

  form([
    { name: 'deploy', label: 'Deploy', placeholder: 'name of this deployment', type: 'text' },
    { name: 'domain', label: 'Domain', placeholder: 'domain of your app',      type: 'text' },
  ], options, either(reject).or(resolve));

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
  ], options, either(reject).or(resolve));

  Fiber.yield();

  var conn = new Connection();

  // TODO: reserve id on this server

  conn.on('ready', function () {
    conn.end(); resolve();
  }).on('error', reject).connect(options.data);

  try {
    Fiber.yield();
  } catch (err) {
    console.log(chalk.red(unicode.fail + ' cannot connect to the server (' + err.toString() + ')'));
    return;
  }

  options.data.id = randomHexString(8);

  console.log(chalk.green(unicode.mark + ' credentials seems to be fine'));

  // REPOSITORY SETTINGS
  console.log(chalk.underline.magenta("Repository:"));

  exec('git remote -v', function (err, stdout) {
    if (err) return resolve();
    var match = /origin\s+(http[^\s]*)/m.exec(stdout);
    resolve(match && match[1]);
  });

  options.data.repoUrl = Fiber.yield();
  options.data['private'] = 'no';

  form([
    { name: 'repoUrl', label: 'Url',      placeholder: 'url to your git repo', type: 'text' },
    { name: 'private', label: 'Private?', placeholder: 'yes or no',            type: 'text' },
  ], options, either(reject).or(resolve));

  Fiber.yield();

  if (options.data['private'] === 'yes') {
    form([
      { name: 'repoUser', label: 'Repo User'     , placeholder: 'username', type: 'text' },
      { name: 'repoPass', label: 'Repo Password' , placeholder: '',         type: 'password' },
    ], options, either(reject).or(resolve));

    Fiber.yield();
  }

  // ENVIRONMENT VARIABLES
  console.log(chalk.underline.magenta("Environment:"));

  options.data.ROOT_PATH = 'http://' + options.data.domain;

  form([
    { name: 'ROOT_PATH', label: 'ROOT_PATH', placeholder: 'root path for your app', type: 'text' },
    { name: 'MONGO_URL', label: 'MONGO_URL', placeholder: 'you may leave it blank', type: 'text' },
  ], options, either(reject).or(resolve));

  Fiber.yield();

  return options.data;
}