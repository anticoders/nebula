# use diff to check if it's necessary
sudo service {{name}} stop
sudo rm -f /etc/init/{{name}}.conf
sudo cp {{pathToAssets}}/upstart.conf /etc/init/{{name}}.conf
sudo service {{name}} start
