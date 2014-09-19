if [ ! -e {{pathToSource}} ];
then
  git clone {{repository.url}} {{pathToSource}}
fi

(
  cd {{pathToSource}}
  git fetch origin
  git checkout {{sha}}
)
