set -e

for f in {{#each listOfIds}}{{this}} {{/each}}
do
  if [ -d $f ]
  then
    echo "respawning ${f}"
    $f/respawn.sh
  fi
done

sudo rm -f /etc/haproxy/haproxy.cfg
sudo cp {{pathToHaproxyConfig}} /etc/haproxy/haproxy.cfg
sudo service haproxy restart
