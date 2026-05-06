const express    = require('express');
const http       = require('http');
const WebSocket  = require('ws');
const path       = require('path');
const startWatcher = require('./watcher.js');

const PORT = 3131;
const app  = express();

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const clients = new Set();

// Last known tool_use per agent — survives browser reloads
const villagerState = {};

wss.on('connection', (ws) => {
  clients.add(ws);

  // Push current state to newly connected browser immediately
  for (const state of Object.values(villagerState)) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(state));
  }

  ws.on('close', () => clients.delete(ws));
});

function broadcast(event) {
  // Track last position per agent so new connections can restore state
  if (event.type === 'tool_use') villagerState[event.agent] = event;

  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

// Manual event injection (for testing)
app.post('/event', (req, res) => {
  broadcast(req.body);
  res.json({ ok: true });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Asset save endpoint — used by extraction scripts
app.post('/save-asset', (req, res) => {
  const { name, data } = req.body;
  const base64 = data.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(base64, 'base64');
  require('fs').writeFileSync(path.join(__dirname, '../client/assets', name), buf);
  res.json({ ok: true, name });
});

server.listen(PORT, async () => {
  console.log(`ClaudeRPG running at http://localhost:${PORT}`);
  startWatcher(broadcast);
  const { default: open } = await import('open');
  open(`http://localhost:${PORT}`);
});

process.on('SIGINT', () => process.exit(0));
