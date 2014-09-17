var Connection = require('ssh2');
var fs = require('fs');

module.exports = function deploy (settings) {

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
      stream.write("cat <<EOF | nebula config --save --file -");
      stream.write(JSON.stringify(settings, undefined, 2));
      stream.write('\nEOF\n');
      //stream.write('nebula update\n');
      //stream.write('nebula reload\n');
      stream.end('exit\n');
    });

  }).connect({
    username : settings.username,
    password : settings.password,
    host     : settings.host,
    port     : settings.port || 22,
  });

}

