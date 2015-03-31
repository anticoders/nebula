set -e

for f in {{#each listOfApps}}{{appId}} {{/each}}
do
  if [ -d {{pathToAssets}}/$f ]
  then
    echo "processing ${f}"
    {{pathToAssets}}/$f/pull.sh
    {{pathToAssets}}/$f/build.sh
  fi
done
