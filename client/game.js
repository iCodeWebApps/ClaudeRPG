// Tool name → village zone + animation label
const TOOL_MAP = {
  Read:       { zone: 'library',  label: 'reading...' },
  Glob:       { zone: 'forest',   label: 'searching...' },
  Grep:       { zone: 'forest',   label: 'searching...' },
  Edit:       { zone: 'forge',    label: 'editing...' },
  Write:      { zone: 'forge',    label: 'writing...' },
  Bash:       { zone: 'forge',    label: 'running...' },
  WebSearch:  { zone: 'docks',    label: 'fetching...' },
  WebFetch:   { zone: 'docks',    label: 'fetching...' },
  Agent:      { zone: 'gate',     label: 'sending agent...' },
  Task:       { zone: 'square',   label: 'tasking...' },
};

const DEFAULT_ZONE = { zone: 'square', label: 'thinking...' };

// Zone positions on the map (will be tuned once tilemap is in)
const ZONES = {
  library: { x: 200, y: 150 },
  forest:  { x: 650, y: 100 },
  forge:   { x: 550, y: 300 },
  docks:   { x: 150, y: 400 },
  gate:    { x: 750, y: 400 },
  square:  { x: 400, y: 280 },
  farm:    { x: 300, y: 420 },
};

// --- Phaser Scene ---

class VillageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VillageScene' });
    this.villagers = {}; // keyed by agent session_id
  }

  preload() {
    // Placeholder graphics until real LPC sprites are added
    // Sprites will be loaded from client/assets/ once available
  }

  create() {
    this.cameras.main.setBackgroundColor('#2d5a27');

    this.drawPlaceholderMap();
    this.connectWebSocket();
  }

  drawPlaceholderMap() {
    const g = this.add.graphics();

    // Ground
    g.fillStyle(0x3a7d44);
    g.fillRect(0, 0, 800, 500);

    // Paths
    g.fillStyle(0xc2a46e);
    g.fillRect(380, 0, 40, 500);
    g.fillRect(0, 260, 800, 40);

    // Buildings (placeholder colored rects)
    const buildings = [
      { label: 'Library',  x: 160, y: 110, w: 90, h: 70,  color: 0x6b4f2c },
      { label: 'Forge',    x: 510, y: 260, w: 90, h: 70,  color: 0x8b3a3a },
      { label: 'Docks',    x: 100, y: 380, w: 100, h: 50, color: 0x2c5f6b },
      { label: 'Forest',   x: 620, y: 60,  w: 120, h: 90, color: 0x2d6b2d },
      { label: 'Gate',     x: 730, y: 380, w: 60,  h: 60, color: 0x7a7a3a },
      { label: 'Farm',     x: 260, y: 400, w: 80,  h: 60, color: 0xa0784e },
    ];

    for (const b of buildings) {
      g.fillStyle(b.color);
      g.fillRect(b.x, b.y, b.w, b.h);
      this.add.text(b.x + b.w / 2, b.y - 10, b.label, {
        fontSize: '10px', color: '#ffffffaa', fontFamily: 'monospace',
      }).setOrigin(0.5, 1);
    }

    // Town square marker
    g.fillStyle(0xc2a46e, 0.4);
    g.fillCircle(400, 280, 40);
  }

  spawnVillager(agentId) {
    const g = this.add.graphics();
    g.fillStyle(0xf4c542);
    g.fillCircle(0, 0, 10); // Head placeholder

    const label = this.add.text(0, -18, agentId === 'main' ? 'Claude' : agentId, {
      fontSize: '9px', color: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#00000066', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1);

    const bubble = this.add.text(0, 14, '...', {
      fontSize: '9px', color: '#aaffaa', fontFamily: 'monospace',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 0);

    const container = this.add.container(ZONES.square.x, ZONES.square.y, [g, label, bubble]);

    this.villagers[agentId] = { container, bubble };
    return this.villagers[agentId];
  }

  handleEvent(event) {
    const agentId = event.agent || 'main';
    let villager = this.villagers[agentId];
    if (!villager) villager = this.spawnVillager(agentId);

    const mapping = TOOL_MAP[event.tool] || DEFAULT_ZONE;
    const target = ZONES[mapping.zone];

    // Move villager to the relevant zone
    this.tweens.add({
      targets: villager.container,
      x: target.x + Phaser.Math.Between(-15, 15),
      y: target.y + Phaser.Math.Between(-15, 15),
      duration: 600,
      ease: 'Power2',
    });

    villager.bubble.setText(mapping.label);
  }

  connectWebSocket() {
    const statusEl = document.getElementById('status');
    const ws = new WebSocket(`ws://localhost:3131`);

    ws.onopen = () => {
      statusEl.textContent = '● connected';
      statusEl.className = 'connected';
      // Spawn the main villager immediately on connect
      this.spawnVillager('main');
    };

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        if (event.type === 'tool_use') this.handleEvent(event);
      } catch {}
    };

    ws.onclose = () => {
      statusEl.textContent = '● disconnected';
      statusEl.className = '';
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }
}

// --- Boot Phaser ---

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 500,
  backgroundColor: '#1a1a2e',
  scene: VillageScene,
  parent: document.body,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
