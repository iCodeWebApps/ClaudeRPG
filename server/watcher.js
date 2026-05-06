// Watches ~/.claude/projects/**/*.jsonl for live Claude Code session events.
// No hooks, no configuration — works automatically with any running session.

const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const chokidar = require('chokidar');

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// Extract a unique agent ID from the JSONL file path.
// Subagent files:   .../subagents/agent-<hex>.jsonl  → first 12 chars of agent-<hex>
// Session files:    .../<uuid>.jsonl                  → first 8 chars of uuid
function agentIdFromPath(filePath) {
  const sub = filePath.match(/subagents[/\\](agent-[^/\\]+)\.jsonl$/i);
  if (sub) return sub[1].slice(0, 12);
  const ses = filePath.match(/([a-f0-9-]{36})\.jsonl$/i);
  return ses ? ses[1].slice(0, 8) : 'unknown';
}

// Parse one JSONL event and call broadcast() if it's actionable.
function processLine(raw, agentId, broadcast) {
  let event;
  try { event = JSON.parse(raw); } catch { return; }

  // Only assistant events carry tool calls and text output.
  if (event.type !== 'assistant') return;

  const content = event.message?.content;
  if (!Array.isArray(content)) return;

  for (const block of content) {
    if (block.type === 'tool_use') {
      broadcast({
        type:      'tool_use',
        tool:      block.name,
        agent:     agentId,
        sessionId: event.sessionId,
        timestamp: Date.now(),
      });
    }

    // Emit the last ~100 chars of Claude's text so speech bubbles show real output.
    if (block.type === 'text' && block.text?.trim()) {
      broadcast({
        type:      'assistant_text',
        text:      block.text.trim(),
        agent:     agentId,
        sessionId: event.sessionId,
        timestamp: Date.now(),
      });
    }
  }
}

// Read only the bytes added since last read, parse new lines.
const offsets = {};

function drain(filePath, broadcast) {
  const agentId = agentIdFromPath(filePath);

  let stat;
  try { stat = fs.statSync(filePath); } catch { return; }

  const prev = offsets[filePath] ?? stat.size;  // first time: skip history
  if (prev >= stat.size) return;                 // no new data

  const chunk = Buffer.alloc(stat.size - prev);
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, chunk, 0, chunk.length, prev);
  } catch { return; } finally {
    try { if (fd !== undefined) fs.closeSync(fd); } catch {}
  }

  offsets[filePath] = stat.size;

  for (const line of chunk.toString('utf8').split('\n')) {
    if (line.trim()) processLine(line, agentId, broadcast);
  }
}

module.exports = function startWatcher(broadcast) {
  // Scan existing files first so we know their sizes (and don't replay history).
  function initFile(filePath) {
    if (offsets[filePath] !== undefined) return;
    try { offsets[filePath] = fs.statSync(filePath).size; } catch {}
  }

  function scanDir(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scanDir(full);
        else if (entry.name.endsWith('.jsonl')) initFile(full);
      }
    } catch {}
  }

  scanDir(PROJECTS_DIR);

  // Watch for new files and changes.
  const watcher = chokidar.watch(`${PROJECTS_DIR}/**/*.jsonl`, {
    persistent:     true,
    ignoreInitial:  true,   // existing files already seeded above
    awaitWriteFinish: false,
    usePolling:     false,
  });

  watcher.on('add', (filePath) => {
    // Brand-new session file — start from the beginning.
    if (offsets[filePath] === undefined) offsets[filePath] = 0;
    drain(filePath, broadcast);
    console.log(`ClaudeRPG watcher: new session ${path.basename(filePath)}`);
  });

  watcher.on('change', (filePath) => {
    drain(filePath, broadcast);
  });

  watcher.on('error', (err) => {
    console.error('ClaudeRPG watcher error:', err.message);
  });

  console.log(`ClaudeRPG: watching ${PROJECTS_DIR}`);
};
