# ClaudeRPG

[![npm version](https://img.shields.io/npm/v/claude-rpg.svg)](https://www.npmjs.com/package/claude-rpg)
[![npm downloads](https://img.shields.io/npm/dm/claude-rpg.svg)](https://www.npmjs.com/package/claude-rpg)

Your Claude Code agents, alive in a pixel art village.

Open a Claude Code window → a villager appears. Spawn a subagent → another one shows up. Tool calls make them walk around. No config, no hooks — it just watches Claude's session files.

<img width="1515" height="945" alt="image" src="https://github.com/user-attachments/assets/748bd79a-8ac6-47bf-b5a7-5b2be2332086" />

## Install

**Option 1 — npx (no install needed):**

```bash
npx claude-rpg
```

**Option 2 — global install:**

```bash
npm install -g claude-rpg
claude-rpg
```

**Option 3 — from source:**

```bash
git clone https://github.com/iCodeWebApps/ClaudeRPG
cd ClaudeRPG
npm install
node bin/claude-rpg.js
```

Opens at **http://localhost:3131**. Start any Claude Code session and your villager appears within seconds.

**Requires:** Node.js 18+, Claude Code

## What's in the village

- Villagers walk to new spots on every tool call, via A* pathfinding
- Speech bubbles show Claude's actual response text
- Click a villager to see its last 8 tool calls
- Hover over a building roof to fade it and see who's inside
- Drag villagers, dogs, and the duck to reposition them
- Night/day cycle based on your system clock
- Occasional rain showers with atmospheric blue overlay
- Villagers greet each other when they're nearby
- 7 chickens that wander, peck, and occasionally lay eggs
- Chickens hold a secret dance ritual every so often
- Two dogs roam the village — the cattledog herds chickens to the lower-left corner
- A duck that follows your agents around (prefers character2). Click it to honk.
- Drag a villager to the lower-right pond to fish

## Debug keys

| Key | |
|---|---|
| `G` | Toggle navmesh overlay |
| `R` | Trigger rain |
| `D` | Trigger chicken dance ritual |

## Roadmap

| | |
|---|---|
| Phase 1 ✅ | Claude → Village. Sessions become villagers. |
| Phase 2 | Village → Claude. Send tasks via MCP queue. |
| Phase 3 | Multiplayer. Share a village with friends. |

## Credits

- [LPC sprites](https://lpc.opengameart.org/) — CC-BY-SA 3.0
- [Phaser.js](https://phaser.io/)
- chokidar

MIT
