# ClaudeRPG

> Your Claude Code agents, alive in a pixel art village.

Every Claude Code window you have open becomes a villager wandering the map. Spawn a subagent and a new character appears at the gate. No config. No hooks. It just watches.

---

## Screenshot

*(coming soon — village with 3 active agents and 7 chickens)*

---

## What It Is

ClaudeRPG is a real-time visualization layer for Claude Code. It reads Claude's session files as they update and renders each active session as an animated LPC-style villager in a detailed pixel art village.

- **One Claude window = one villager**
- **One subagent = one more villager**
- **Tool calls = movement** — villagers walk to a new destination on every tool use
- **Claude's response text = speech bubble** floating above their head

It's a live map of what your agents are doing, without touching your workflow at all.

---

## How It Works

```
~/.claude/projects/**/*.jsonl
         │
         │  chokidar (file watcher)
         ▼
    Node.js + Express
         │
         │  WebSocket (real-time push)
         ▼
    Phaser.js (browser)
         │
    LPC villagers on a 1536×1024 pixel art village
```

1. **File watcher** — chokidar watches every JSONL session file Claude Code writes
2. **Session → villager** — each file gets a villager named by the first 8 characters of its session UUID
3. **Events → motion** — when a tool call lands in the JSONL, the villager walks to a new random location via A* pathfinding through a walkable navmesh
4. **Response text → speech bubble** — Claude's actual reply text appears above the character's head
5. **Persistent state** — the server keeps all villager positions in memory; browser reloads and server restarts restore positions instantly

---

## Features

### Village

- **1536×1024 pixel art scene** — hand-crafted village with buildings, paths, water, and forest
- **Matching interior view** — every building has a no-roof interior that matches the exterior layout
- **Per-building roof hover** — move your cursor over any building to fade its roof and see inside
- **Agents under roofs** — villagers can be found inside buildings; hover to reveal them

### Villagers

- **LPC animated sprites** — Liberated Pixel Cup characters with full 4-direction walk cycles
- **Arcade physics** — no character stacking; agents navigate around each other
- **Idle look animations** — while waiting, villagers glance left and right
- **A* pathfinding** — movement routed through a walkable navmesh, not a straight line

### Chickens

- **7 wandering chickens** — fully independent with their own peck animations and roaming behavior

---

## Installation

```bash
git clone https://github.com/iCodeWebApps/ClaudeRPG
cd ClaudeRPG
npm install
node bin/claude-rpg.js
```

Opens at **http://localhost:3131** automatically.

Start any Claude Code session and your villager appears within seconds.

### Requirements

- Node.js 18+
- Claude Code installed (any version)

---

## Architecture

```
ClaudeRPG/
├── bin/
│   └── claude-rpg.js       # entry point — starts server, opens browser
├── server/
│   ├── watcher.js           # chokidar session file watcher
│   ├── state.js             # villager position + session state store
│   └── index.js             # Express + WebSocket server
└── client/
    ├── index.html           # Phaser.js game shell
    ├── game.js              # scene, physics, villager rendering
    ├── navmesh.js           # walkable grid + A* pathfinding
    └── assets/
        ├── village.png      # 1536×1024 exterior map
        ├── interior.png     # matching interior view
        ├── roofs/           # per-building roof sprites
        └── sprites/         # LPC character spritesheets
```

**Key design choices:**

- **No hooks required** — reads session files directly; zero setup beyond `npm install`
- **WebSocket for live push** — no polling; the server pushes events as files change
- **Arcade Physics** — lightweight, zero gravity, perfect for top-down navigation
- **State in-process** — simple object store; no database needed for this use case

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| **Phase 1** | Done | Claude → Village. Sessions visualized as villagers in real time. |
| **Phase 2** | Planned | Village → Claude. Click a villager to send it a task via an MCP queue. |
| **Phase 3** | Planned | Multiplayer. Friends connect their sessions to a shared village. |

---

## Credits

- **LPC sprites** — [Liberated Pixel Cup](https://lpc.opengameart.org/) (CC-BY-SA 3.0)
- **Phaser.js** — [phaser.io](https://phaser.io/)
- **chokidar** — file watcher that makes the whole thing tick

---

## License

MIT
