
BUILD_ONLY=""

APP_NAME="{{appName}}"

ASSETS_DIR="{{pathToAssets}}"
SOURCE_DIR="{{pathToSource}}"
BUILDS_DIR="{{pathToBuilds}}"

REPOSITORY_SHA="{{sha}}"
REPOSITORY_URL="{{repository.url}}"

# Create a build for the given commit. If the build already exists,
# do nothing but update the "latest" symbolic link.

build ()
{
  cd ${SOURCE_DIR}
  HASH=`git rev-parse --short ${REPOSITORY_SHA}`

  if [ ! -e .meteor ];
  then
    if [ -e example/.meteor ];
    then
      echo "using example directory"
      cd example
    else
      echo "it does not seem to be a meteor project"
      exit 1
    fi
  fi

  if [ ! -e ${BUILDS_DIR}/${HASH} ];
  then
    mkdir -p ${BUILDS_DIR}

    echo "building meteor app ..."
    meteor build --directory ${BUILDS_DIR}
    (
      cd ${BUILDS_DIR}
      echo "rename bundle -> ${HASH}"
      mv bundle ${HASH}
    )
  fi

  # for older releases this file does not exists
  if [ -e ${BUILDS_DIR}/${HASH}/programs/server/package.json ];
  then
    cd ${BUILDS_DIR}/${HASH}/programs/server && npm install
  fi

  cd ${BUILDS_DIR}
  rm -f latest
  ln -s ${HASH} latest
}

restart ()
{
  # Refresh the upstart "conf" and restart the app service.
  sudo service ${APP_NAME} stop
  sudo rm -f /etc/init/${APP_NAME}.conf
  sudo cp ${ASSETS_DIR}/upstart.conf /etc/init/${APP_NAME}.conf
  sudo service ${APP_NAME} start

  # Refresh the haproxy.cfg and restart haproxy service.
  sudo rm -f /etc/haproxy/haproxy.cfg
  sudo cp ${ASSETS_DIR}/../haproxy.cfg /etc/haproxy/haproxy.cfg
  sudo service haproxy restart
}

# Start by parsing the script options ...
while getopts b opt
do case "$opt" in
  b)  BUILD_ONLY=1;;
  [?])  echo "Usage: $0 [-b]"
    exit 1;;
  esac
done

# Clone repository if there is still no local copy.
if [ ! -e ${SOURCE_DIR} ];
then
  git clone ${REPOSITORY_URL} ${SOURCE_DIR}
fi

# Fetch the origin and checkout the given commit sha.
(
  cd ${SOURCE_DIR}
  git fetch origin
  git checkout ${REPOSITORY_SHA}
)

# Build everything ...
build

if [ -z "${BUILD_ONLY}" ];
then
  restart
fi
