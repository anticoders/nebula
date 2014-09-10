nebula
======

A tool for deploying meteor apps.

installation
------------

Start by installing on your development machine:
```
sudo npm install -g meteor-nebula
```
Then install it on your server:
```
sudo curl https://gist.githubusercontent.com/apendua/46bcbfb403a8bb5b2ce5/raw/install-nebula.sh | sh
```

configuration
-------------

An example config file may look like this:
```javascript
{
  "host": "192.168.33.10",
  "port": 22,
  "user": "nebula",
  "pass": "secret",
  "apps": {
    "app1": {
      "git" : "https://github.com/anticoders/impact-demo-generic.git",
      "env" : {
        "METEOR_SETTINGS" : {
          "public": {}
        },
        "MONGO_URL" : "mongodb://localhost:27017/app1",
        "ROOT_URL"  : "http://localhost:8080"
      },
      "domain": "localhost"
    },
    "app2": {
      "git" : "https://github.com/anticoders/impact-demo-generic.git",
      "env" : {
        "FAKE"      : 1,
        "MONGO_URL" : "mongodb://localhost:27017/app2",
        "ROOT_URL"  : "http://127.0.0.1:8080"
      },
      "domain": "127.0.0.1"
    }
  }
}

```
save it to `nebula.json` and run `nebula deploy` in the same directory.

random stuff
------------

If you don't want to enter the sudo password all the time:
```
sudo visudo
```
and add the following line to the end of file (replacing with the correct user name of course):
```
user ALL=(ALL) NOPASSWD: ALL
```
