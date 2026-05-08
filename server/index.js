const express    = require('express');
const http       = require('http');
const WebSocket  = require('ws');
const path       = require('path');
const fs         = require('fs');
const startWatcher = require('./watcher.js');

const PORT       = 3131;
const app        = express();
const STATE_FILE = path.join(__dirname, 'state.json');

function loadState()    { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function saveState(s)   { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

let gameState = loadState();

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const clients = new Set();

// Last known tool_use per agent — survives browser reloads
const villagerState = {};
// Last known context usage per agent
const contextState  = {};

const AGENT_TTL = 60 * 60 * 1000; // 1 hour

// Purge agents whose last event is older than TTL
function pruneVillagerState() {
  const cutoff = Date.now() - AGENT_TTL;
  for (const [agent, state] of Object.entries(villagerState)) {
    if (state.timestamp < cutoff) delete villagerState[agent];
  }
}

setInterval(pruneVillagerState, 5 * 60 * 1000); // run every 5 minutes

wss.on('connection', (ws) => {
  clients.add(ws);

  // Push current (recent) state to newly connected browser
  const cutoff = Date.now() - AGENT_TTL;
  for (const state of Object.values(villagerState)) {
    if (state.timestamp < cutoff) continue;
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(state));
  }
  for (const state of Object.values(contextState)) {
    if (state.timestamp < cutoff) continue;
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(state));
  }

  ws.on('close', () => clients.delete(ws));
});

function broadcast(event) {
  // Track last position per agent so new connections can restore state
  if (event.type === 'tool_use')      villagerState[event.agent] = event;
  if (event.type === 'context_update') contextState[event.agent] = event;

  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/state',  (req, res) => res.json(gameState));
app.post('/state', (req, res) => { Object.assign(gameState, req.body); saveState(gameState); res.json({ ok: true }); });

// Asset save endpoint — used by sprite extraction scripts
const ASSETS_DIR = path.resolve(path.join(__dirname, '../client/assets'));
app.post('/save-asset', (req, res) => {
  const { name, data } = req.body;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'invalid name' });
  const safeName = path.basename(name);
  const dest = path.resolve(ASSETS_DIR, safeName);
  if (!dest.startsWith(ASSETS_DIR + path.sep) && dest !== ASSETS_DIR) {
    return res.status(400).json({ error: 'invalid filename' });
  }
  const base64 = data.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(base64, 'base64');
  fs.writeFileSync(dest, buf);
  res.json({ ok: true, name: safeName });
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`ClaudeRPG running at http://localhost:${PORT}`);
  startWatcher(broadcast);
  const url = `http://localhost:${PORT}`;
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  require('child_process').exec(cmd);
});

process.on('SIGINT', () => process.exit(0));
