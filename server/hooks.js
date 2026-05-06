// Writes and removes the Claude Code PostToolUse hook from the global settings.
// Hook entry: runs `node <path>/bin/claude-rpg.js hook` on every tool call.

const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const HOOK_COMMAND = `node "${path.join(__dirname, '../bin/claude-rpg.js')}" hook`;

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function setupHooks() {
  const settings = readSettings();
  settings.hooks = settings.hooks || {};
  settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];

  const already = settings.hooks.PostToolUse.some(
    (h) => h.command === HOOK_COMMAND
  );
  if (!already) {
    settings.hooks.PostToolUse.push({ command: HOOK_COMMAND });
    writeSettings(settings);
    console.log('ClaudeRPG: hook registered in ~/.claude/settings.json');
  }
}

function teardownHooks() {
  const settings = readSettings();
  if (!settings.hooks?.PostToolUse) return;
  settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
    (h) => h.command !== HOOK_COMMAND
  );
  writeSettings(settings);
  console.log('ClaudeRPG: hook removed from ~/.claude/settings.json');
}

module.exports = { setupHooks, teardownHooks };
