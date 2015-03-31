# use diff to check if it's necessary
sudo service {{appId}} stop
sudo rm -f /etc/init/{{appId}}.conf
sudo cp {{pathToAssets}}/upstart.conf /etc/init/{{appId}}.conf
sudo service {{appId}} start
