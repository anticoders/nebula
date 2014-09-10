var Connection = require('ssh2');
var fs = require('fs');

module.exports = function deploy (configJsonPath) {

  var configJson = {};

  if (fs.existsSync(configJsonPath)) {
    configJson = JSON.parse(fs.readFileSync(configJsonPath).toString('utf8'));
  }

  var conn = new Connection();

  conn.on('ready', function () {

    conn.shell('uptime', function (err, stream) {
      if (err) throw err;
      stream.on('close', function () {
        conn.end();
      }).on('data', function (data) {
        process.stdout.write(data);
      }).stderr.on('data', function(data) {
        process.stderr.write(data);
      });
      stream.write('cat <<EOF > nebula.json\n');
      stream.write(JSON.stringify(configJson, undefined, 2));
      stream.write('\nEOF\n');
      stream.write('nebula update\n');
      stream.write('nebula restart\n');
      stream.end('exit\n');
    });

  }).connect({
    username : configJson.user,
    password : configJson.pass,
    host     : configJson.host,
    port     : configJson.port,
  });

}

