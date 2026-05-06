const express    = require('express');
const http       = require('http');
const WebSocket  = require('ws');
const path       = require('path');
const startWatcher = require('./watcher.js');

const PORT = 3131;
const app  = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(event) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

// Manual event injection (for testing / future Phase 2 use)
app.post('/event', (req, res) => {
  broadcast(req.body);
  res.json({ ok: true });
});

app.get('/health', (req, res) => res.json({ ok: true }));

server.listen(PORT, async () => {
  console.log(`ClaudeRPG running at http://localhost:${PORT}`);
  startWatcher(broadcast);
  const { default: open } = await import('open');
  open(`http://localhost:${PORT}`);
});

process.on('SIGINT', () => process.exit(0));
