# ClaudeRPG

Watch your Claude Code agents come to life as villagers in a pixel art RPG village.

## How it works

Claude Code fires a `PostToolUse` hook on every tool call. ClaudeRPG intercepts these events and animates a villager in a Phaser.js village based on what tool ran:

| Tool | Villager does |
|---|---|
| `Read` | Goes to the library |
| `Edit` / `Write` | Works at the forge |
| `Grep` / `Glob` | Runs into the forest |
| `Bash` | Blacksmith at the forge |
| `WebSearch` / `WebFetch` | Casts a line at the docks |
| `Agent` spawn | New villager rides in |
| Idle | Chases chickens, sits by the fire |

## Usage

```bash
npx claude-rpg        # start server + open village in browser
npx claude-rpg stop   # remove hooks and stop
```

On first run, ClaudeRPG registers itself in `~/.claude/settings.json` as a `PostToolUse` hook. It removes itself cleanly on stop.

## Requirements

- Node.js 18+
- Claude Code installed

## Development

```bash
git clone https://github.com/iCodeWebApps/ClaudeRPG
cd ClaudeRPG
npm install
npm start
```
