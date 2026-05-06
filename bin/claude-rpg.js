#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

if (command === 'hook') {
  // Called by Claude Code PostToolUse hook — reads stdin, POSTs to server
  require('../server/hook-client.js');
} else if (command === 'stop') {
  require('../server/stop.js');
} else {
  // Default: start the server and open the browser
  require('../server/index.js');
}
