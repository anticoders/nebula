sudo rm -f /etc/haproxy/haproxy.cfg
sudo cp {{pathToHaproxyConfig}} /etc/haproxy/haproxy.cfg
sudo service haproxy restart
