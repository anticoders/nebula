
{{#each variables}}
export {{name}}={{{value}}}
{{/each}}

/usr/bin/env node {{pathToBuilds}}/latest/main.js
