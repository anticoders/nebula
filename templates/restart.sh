set -e

for f in {{#each listOfApps}}{{appId}} {{/each}}
do
  if [ -d {{pathToAssets}}/$f ]
  then
    echo "respawning ${f}"
    {{pathToAssets}}/$f/respawn.sh
  fi
done

sudo rm -f /etc/haproxy/haproxy.cfg
sudo cp {{pathToAssets}}/haproxy.cfg /etc/haproxy/haproxy.cfg
sudo service haproxy restart
