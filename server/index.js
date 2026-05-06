const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { setupHooks, teardownHooks } = require('./hooks.js');

const PORT = 3131;
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Track connected browser clients
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(event) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Hook endpoint — Claude Code PostToolUse fires here
app.post('/event', (req, res) => {
  const event = req.body;
  broadcast(event);
  res.json({ ok: true });
});

app.get('/health', (req, res) => res.json({ ok: true }));

server.listen(PORT, async () => {
  console.log(`ClaudeRPG running at http://localhost:${PORT}`);
  setupHooks();
  const { default: open } = await import('open');
  open(`http://localhost:${PORT}`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  teardownHooks();
  process.exit(0);
});
