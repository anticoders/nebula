set -e

for f in {{#each listOfApps}}{{appId}} {{/each}}
do
  if [ -d $f ]
  then
    echo "processing ${f}"
    $f/pull.sh
    $f/build.sh
  fi
done
