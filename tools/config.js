
var Connection = require('ssh2');
var Fiber = require('fibers');
var crypto = require('crypto');
var handlebars = require('handlebars');
var colors = require('colors');
var mkdirp = require('mkdirp');
var yaml = require('js-yaml');
var form = require('../tools/prompt');
var path = require('path');
var chalk = require('chalk');
var fs = require('fs');
var exec = require('child_process').exec;

var unicode = {
  mark: "\u2714",
  fail: "\u00D7",
};

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

  createConfig(name);

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

function createConfig(name) {

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

function randomHexString(length) {
  return crypto.randomBytes(length / 2).toString('hex').slice(0, length);
}

function either (first) {
  return {
    or: function (second) {
      return function (arg1, arg2) {
        return arg1 ? first(arg1) : second(arg2);
      };
    }
  };
};
