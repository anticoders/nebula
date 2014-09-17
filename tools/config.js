
var ObjectID = require('mongodb').ObjectID;
var handlebars = require('handlebars');
var colors = require('colors');
var yaml = require('js-yaml');
var path = require('path');
var fs = require('fs');

module.exports = function config (name, options) {

  var defaultFileName = 'default.yml';
  var defaultTemplate;
  var defaultContents;
  var config;
  var ruler;

  if (!fs.existsSync('.meteor')) {
    console.log("\u26A0 it looks like you're not in a valid meteor project directory".yellow);
  }

  if (!fs.existsSync('.nebula')) {
    fs.mkdirSync('.nebula');
  }

  var listOfFiles = fs.readdirSync('.nebula').filter(function (file) { return path.extname(file) === '.yml' });

  if (listOfFiles.length === 0) {
    // drop a default file

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
    config = listOfFiles.filter(function (file) {
      return name === file.name;
    })[0];
    if (!config) {
      console.log("config file ".red + name.red + " does not exist".red);
      console.log("valid choices are:");
      console.log(listOfOptionsAsString());
      return;
    }
  } else {
    config = listOfFiles[0];
  }

  try {
    config = yaml.safeLoad(fs.readFileSync(config.path, 'utf8'));
  } catch(err) {
    console.log(err.toString().red);
    return;
  }

  console.log("\u2714 using config:".green);
  console.log(JSON.stringify(config, undefined, 2).magenta);

  var pathToIdsFile = path.join('.nebula', 'nebula.json');
  if (!fs.existsSync(pathToIdsFile)) {
    fs.writeFileSync(pathToIdsFile, "{}");
  }
  
  var IDs = JSON.parse(fs.readFileSync(pathToIdsFile, 'utf8'));

  config.id = IDs[config.name] || new ObjectID();
  
  if (!IDs[config.name]) {
    IDs[config.name] = config.id;
    fs.writeFileSync(pathToIdsFile, JSON.stringify(IDs, undefined, 2));

    console.log('we have added a unique id for ' + config.name + ' app to ' + pathToIdsFile + ' file');
    console.log('you should generally commit this file to your repository');
  }

  return config;
}
