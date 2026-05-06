// Called by the Claude Code PostToolUse hook.
// Claude Code passes hook data via stdin as JSON.
// We forward it to the running ClaudeRPG server.

const http = require('http');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const event = {
    type: 'tool_use',
    tool: payload.tool_name || payload.tool || 'unknown',
    agent: payload.session_id || 'main',
    input: payload.tool_input || {},
    timestamp: Date.now(),
  };

  const body = JSON.stringify(event);
  const req = http.request({
    hostname: 'localhost',
    port: 3131,
    path: '/event',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  });

  req.on('error', () => {}); // Server not running — silently skip
  req.write(body);
  req.end();
});
