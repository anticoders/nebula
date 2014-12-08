script () {

if [ ! -e $HOME/.nebula ]; then
  sudo apt-get update
  sudo apt-get install -y python-software-properties
  sudo add-apt-repository -y ppa:chris-lea/node.js
  sudo apt-key adv --keyserver keyserver.ubuntu.com --recv 7F0CEB10
  sudo echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/10gen.list
  sudo apt-get update
  sudo apt-get remove -y apache
  sudo apt-get install -y build-essential git haproxy nodejs mongodb curl
  # we can probably get rid of this one later on
  sudo npm install -g meteorite
  sudo npm install -g meteor-nebula

  mkdir $HOME/.nebula
fi

if [ ! -e $HOME/.meteor ]; then
  sudo curl https://install.meteor.com/ | sh
fi

cat <<EOF | nebula deploy --local --config-from - || true && echo "{{uniqueTag}}"
{{settings}}
EOF

}

script
