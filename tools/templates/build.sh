
cd {{pathToSource}}
HASH=`git rev-parse --short {{sha}}`

if [ ! -e {{pathToBuilds}}/${HASH} ];
then
  echo -e "creating meteor bundle"
  mkdir -p {{pathToBuilds}}
  mrt install && meteor bundle {{pathToBuilds}}/bundle.tar.gz
  (
    cd {{pathToBuilds}}
    echo -e "extracting tar"
    tar -zxf bundle.tar.gz
    rm bundle.tar.gz
    echo -e "rename bundle -> ${HASH}"
    mv bundle ${HASH}
  )
fi

cd {{pathToBuilds}}
rm -f latest
ln -s ${HASH} latest

