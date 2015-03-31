
var handlebars = require('handlebars');
var path       = require('path');
var fs         = require('fs');
var _          = require('lodash');

exports.getTemplatePath = _.memoize(function (name) {
  return path.resolve(__dirname, '..', 'templates', name);
});

exports.getTemplateSource = _.memoize(function (name) {
  return fs.readFileSync(exports.getTemplatePath(name), 'utf8');
});

exports.getTemplate = _.memoize(function (name) {
  return handlebars.compile(exports.getTemplateSource(name));
});

exports.getPathToConfig = _.memoize(function () {
  return path.resolve('.nebula', 'config');
});

exports.LIST_OF_IGNORED_DIRS = [
  "assets", "builds", "source", "deploy"
];
