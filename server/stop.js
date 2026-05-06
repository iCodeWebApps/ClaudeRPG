// Standalone stop — removes hooks even if server isn't running.
const { teardownHooks } = require('./hooks.js');
teardownHooks();
console.log('ClaudeRPG stopped.');
