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

### Agents
- Villagers walk to new spots on every tool call, via A* pathfinding
- Speech bubbles show Claude's actual response text and tool names
- Context window meter under each villager's name (green → yellow → red)
- Hover over a building roof to fade it and see who's inside
- Villagers greet each other when they pass by
- Villagers idle-wander and occasionally fish at the lower-right pond

### Action pane
- Click any entity to select it — an action pane opens in the lower-right corner
- Click anywhere on the map to move the selected entity there (A* pathfinding)
- Right-click to deselect
- The pane shows agent history, entity stats, and context-aware actions
- Resume button restores auto-behavior after a manual move

### Chicken combat 🐔
- 7 chickens roam the village with individual health bars (hidden at full HP)
- Select a chicken, hover a rival to target it (red glow), then click to attack
- The attacker pathfinds to melee range before engaging
- Turns alternate — attacker strikes, defender retaliates
- KO'd chickens fall over and gradually heal back to full over 60 seconds
- Floating damage numbers

### Duck 🦆
- Follows your agents around the village (prefers character2)
- Click it to select — use the action pane to Honk or Grow it
- Grows in 50% increments up to 4× its normal size; next click resets
- Honk bubble and size persist across sessions via localStorage

### Music player
- 🔇 / 🔊 toggle in the HUD with a station dropdown
- Five stations: **EDM** (SomaFM The Trip) · **Jazz** (SomaFM Secret Agent) · **Hip-Hop** (SomaFM Fluid) · **Medieval** (Radio Rivendell) · **Reggae** (SomaFM Reggae)
- Volume slider; station and volume preferences saved across sessions

### World
- Night/day cycle based on your system clock
- Occasional rain showers with atmospheric blue overlay
- Chickens hold a secret dance ritual every 20–45 minutes
- Two dogs roam freely — the cattledog and the doodle
- Doodle eats eggs laid by chickens (egg count tracked per session)
- ⧉ pop-out button opens a borderless fullscreen window

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
| Phase 1.5 ✅ | Village interactions. Combat, music, action pane. |
| Phase 2 | Village → Claude. Send tasks via MCP queue. |
| Phase 3 | Multiplayer. Share a village with friends. |

## Credits

- [LPC sprites](https://lpc.opengameart.org/) — CC-BY-SA 3.0
- [Phaser.js](https://phaser.io/)
- [SomaFM](https://somafm.com/) — commercial-free internet radio
- [Radio Rivendell](https://www.radiorivendell.com/) — 24/7 fantasy music
- chokidar

MIT
