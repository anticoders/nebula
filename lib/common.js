
var path = require('path');
var fs   = require('fs');

exports.getTemplatePath = function (name) {
  return path.resolve(__dirname, '..', 'templates', name);
}

exports.getPathToConfig = function () {
  return path.resolve('.nebula', 'config');
}
