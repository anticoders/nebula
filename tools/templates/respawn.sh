# use diff to check if it's necessary
sudo service {{id}} stop
sudo rm -f /etc/init/{{id}}.conf
sudo cp {{pathToAssets}}/upstart.conf /etc/init/{{id}}.conf
sudo service {{id}} start
