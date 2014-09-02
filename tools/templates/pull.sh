if [[ ! -e {{pathToSource}} ]]
then
  git clone {{git}} {{pathToSource}}
fi

(
  cd {{pathToSource}}
  git fetch origin
  git checkout {{sha}}
)
