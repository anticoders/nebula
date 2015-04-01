
var Future = require('fibers/future');
var crypto = require('crypto');
var prompt = require('./prompt');
var chalk = require('chalk');
var exec = require('child_process').exec;
var utils = require('./utils');
var unicode = utils.unicode;

module.exports = utils.runInsideFiber(function create (name) {

  // TODO: try to implement this without a Fiber

  var form = Future.wrap(prompt.form);

  var options = {
    data : {
      configName : name || 'default',
      appName    : name,
      remote     : 'no',
    },
    transform : chalk.green,
  };

  // GENERAL INFO
  section("General info:");

  form([
    { name: 'configName' , label: 'Config name', placeholder: 'name of this config' , type: 'text'    },
    { name: 'appName'    , label: 'App. name',   placeholder: 'name of your app'    , type: 'text'    },
    { name: 'domain'     , label: 'Domain',      placeholder: 'domain of your app'  , type: 'text'    },
    { name: 'remote'     , label: 'Remote?',     placeholder: 'yes or no'           , type: 'boolean' },
  ], options).wait();

  if (options.data.remote === 'yes') {

    // SSH CREDENTIALS
    section("SSH credentials:");

    // default values
    options.data.host = options.data.domain;
    options.data.port = "22";

    form([

      { name: 'host',       label: 'Host',        placeholder: 'domain or ip address',   type: 'text',     },
      { name: 'port',       label: 'SSH Port',    placeholder: 'default is 22',          type: 'text',     },
      { name: 'username',   label: 'Username',    placeholder: 'username',               type: 'text',     },
      { name: 'password',   label: 'Password',    placeholder: '',                       type: 'password', },

      //{ name: 'privateKey', label: 'Private Key', placeholder: 'path to private key',    type: 'file'     },
    ], options).wait();

    Future.wrap(utils.checkSshCredentials)(options.data).wait();

  // console.log(chalk.green(              '=============================='));
  // console.log(chalk.green(unicode.mark + ' credentials seems to be fine'));
  // console.log(chalk.green(              '=============================='));

    options.data.save = 'no';

    form([
      { name: 'save', label: 'Save password?', placeholder: 'yes or no', type: 'boolean' }
    ], options).wait();

    if (options.data.save !== 'yes') {
      delete options.data.password;
    }
  }

  // REPOSITORY SETTINGS
  section("Repository:");

  try {
    options.data.repoUrl = Future.wrap(utils.getGitRemoteUrl)().wait();
  } catch (err) {
    options.data.ropoUrl = "";
  }

  options.data['private'] = 'no';

  form([
    { name: 'repoUrl', label: 'Url',      placeholder: 'url to your git repo', type: 'text' },
    { name: 'private', label: 'Private?', placeholder: 'yes or no',            type: 'text' },
  ], options).wait();

  if (options.data['private'] === 'yes') {
    form([
      { name: 'repoUser', label: 'Repo User'     , placeholder: 'username', type: 'text' },
      { name: 'repoPass', label: 'Repo Password' , placeholder: '',         type: 'password' },
    ], options).wait();
  }

  // ENVIRONMENT VARIABLES
  section("Environment:");

  options.data.ROOT_URL = 'http://' + options.data.domain;

  form([
    { name: 'ROOT_URL',  label: 'ROOT_URL', placeholder: 'root path for your app', type: 'text' },
    { name: 'MONGO_URL', label: 'MONGO_URL', placeholder: 'you may leave it blank', type: 'text' },
  ], options).wait();

  return clean(options.data);

}); // runInsideFiber


function section (title) {
  process.stdout.write(chalk.underline.magenta(title) + "\n"); 
}

function clean(formData) {

  var settings = { _name: formData.configName };

  [ 'appName', 'domain', 'host', 'port', 'username', 'password' ].forEach(function (name) {
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
