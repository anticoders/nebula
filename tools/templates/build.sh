
cd {{pathToSource}}
HASH=`git rev-parse --short {{sha}}`

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

if [ ! -e {{pathToBuilds}}/${HASH} ];
then
  echo "creating meteor bundle"
  
  # TODO: alter the behavior for older releases (bundle is deprecated since 0.9.2)
  #RELEASE=`cat .meteor/release | sed 's/METEOR@//'`;
  #if [ $RELEASE \< "0.9.2" ];
  #then
  #fi

  mkdir -p {{pathToBuilds}}

  # TODO: only use meteorite if smart.json is present
  mrt install
  meteor bundle {{pathToBuilds}}/bundle.tar.gz
  (
    cd {{pathToBuilds}}
    echo "extracting tar"
    tar -zxf bundle.tar.gz
    rm bundle.tar.gz
    echo "rename bundle -> ${HASH}"
    mv bundle ${HASH}
  )
fi

# for older releases this folder does not have to exist
if [ -e ${HASH}/programs/server ];
then
  cd ${HASH}/programs/server && npm install
fi

cd {{pathToBuilds}}
rm -f latest
ln -s ${HASH} latest
