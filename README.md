# ClaudeRPG

Your Claude Code agents, alive in a pixel art village.

Open a Claude Code window → a villager appears. Spawn a subagent → another one shows up. Tool calls make them walk around. No config, no hooks — it just watches Claude's session files.

## Install

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
- Hover over a building roof to fade it and see who's inside
- Drag villagers and chickens to reposition them
- Click a villager to see its last 8 tool calls
- Night/day cycle based on your system clock
- 7 chickens that wander and peck

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
