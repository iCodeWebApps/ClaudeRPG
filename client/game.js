// ClaudeRPG — FF4-style village
// Assets: LPC Base Assets + LPC Terrains (CC-BY-SA 3.0, Stephen Challener / Lanea Zimmermann et al.)

// ── ZONES ──────────────────────────────────────────────────────────────────
const ZONES = {
  library: { x: 168, y: 148, label: "Sage's Tower" },
  forest:  { x: 644, y: 108, label: 'Dark Forest'  },
  harbor:  { x: 128, y: 368, label: 'Harbor'        },
  square:  { x: 400, y: 252, label: 'Town Square'   },
  smithy:  { x: 614, y: 338, label: 'Blacksmith'    },
  gate:    { x: 714, y: 424, label: 'Castle Gate'   },
  fields:  { x: 262, y: 418, label: 'Fields'        },
};

const TOOL_MAP = {
  Read:      { zone: 'library', label: 'studying...'    },
  Glob:      { zone: 'forest',  label: 'searching...'   },
  Grep:      { zone: 'forest',  label: 'searching...'   },
  Edit:      { zone: 'smithy',  label: 'crafting...'    },
  Write:     { zone: 'smithy',  label: 'scribing...'    },
  Bash:      { zone: 'smithy',  label: 'forging...'     },
  WebSearch: { zone: 'harbor',  label: 'scouting...'    },
  WebFetch:  { zone: 'harbor',  label: 'fetching...'    },
  Agent:     { zone: 'gate',    label: 'dispatching...' },
  Task:      { zone: 'fields',  label: 'tending...'     },
};
const DEFAULT_MAP = { zone: 'square', label: 'wandering...' };

// Agent → sprite assignments (cycles for subagents)
const SPRITES = [
  { key: 'soldier',  tint: 0xffffff },
  { key: 'altcolor', tint: 0xffffff },
  { key: 'princess', tint: 0xffffff },
  { key: 'soldier',  tint: 0x88ffcc },
  { key: 'altcolor', tint: 0xffccff },
];
let spriteIdx = 1; // 0 reserved for main

// ── SCENE ──────────────────────────────────────────────────────────────────
class VillageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VillageScene' });
    this.villagers = {};
  }

  preload() {
    const B = 'assets/lpc_base/LPC Base Assets/';
    const T = 'assets/lpc_terrains/lpc-terrains/';

    // Characters (576×256, 9 frames × 4 rows, 64×64 each)
    this.load.spritesheet('soldier',  B + 'sprites/people/soldier.png',         { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('altcolor', B + 'sprites/people/soldier_altcolor.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('princess', B + 'sprites/people/princess.png',         { frameWidth: 64, frameHeight: 64 });

    // Terrain ground (512-wide atlas, 32×32 tiles)
    this.load.spritesheet('terrain', T + 'terrain-map-v7.png', { frameWidth: 32, frameHeight: 32 });

    // Building + decoration images
    this.load.image('castle_outside', B + 'tiles/castle_outside.png');
    this.load.image('water',    B + 'tiles/water.png');
    this.load.image('treetop',  B + 'tiles/treetop.png');
    this.load.image('trunk',    B + 'tiles/trunk.png');
    this.load.image('mountains',B + 'tiles/mountains.png');
  }

  create() {
    // ── Animations ─────────────────────────────────────────────────────
    // LPC walk layout: row 0 = up, 1 = left, 2 = down, 3 = right (9 frames each)
    for (const key of ['soldier', 'altcolor', 'princess']) {
      this.anims.create({ key: `${key}-up`,    frames: this.anims.generateFrameNumbers(key, { start: 0,  end: 8  }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-left`,  frames: this.anims.generateFrameNumbers(key, { start: 9,  end: 17 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-down`,  frames: this.anims.generateFrameNumbers(key, { start: 18, end: 26 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-right`, frames: this.anims.generateFrameNumbers(key, { start: 27, end: 35 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-idle`,  frames: [{ key, frame: 18 }], frameRate: 1 });
    }

    this.buildMap();
    this.connectWebSocket();
  }

  buildMap() {
    // ── Ground ─────────────────────────────────────────────────────────
    // Grass base (terrain frame 2 = grass swatch, tiled at 2×)
    this.add.tileSprite(0, 0, 800, 500, 'terrain', 2).setOrigin(0).setScale(2).setDepth(0);

    // Dirt cross-paths (frame 0 = brown dirt)
    this.add.tileSprite(0, 234, 800, 36, 'terrain', 0).setOrigin(0).setScale(2).setDepth(1);
    this.add.tileSprite(372, 0, 36, 500, 'terrain', 0).setOrigin(0).setScale(2).setDepth(1);

    // ── Water — Harbor SW ─────────────────────────────────────────────
    // Water fill
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x2060a0); g.fillRect(18, 308, 228, 122);
    g.fillStyle(0x3888cc);
    for (const wy of [308, 326, 342, 358, 374, 392, 408]) g.fillRect(18, wy, 228, 6);
    g.lineStyle(2, 0x60aadd); g.strokeRect(18, 308, 228, 122);
    // Dock planks
    g.fillStyle(0x6b4226);
    g.fillRect(18, 304, 228, 8);
    for (const px of [28, 90, 152, 214]) g.fillRect(px, 304, 10, 30);

    // ── Sage's Tower — NW ─────────────────────────────────────────────
    // Tower base: place castle_outside section (conical tower on left + arched walls)
    this.add.image(14, 10, 'castle_outside')
      .setOrigin(0).setCrop(0, 0, 272, 224).setDepth(2);

    // ── Dark Forest — NE ──────────────────────────────────────────────
    // Dense forest block
    const fg = this.add.graphics().setDepth(2);
    fg.fillStyle(0x0a2e0a); fg.fillRect(530, 32, 210, 150);
    fg.fillStyle(0x1a4a1a); fg.fillRect(536, 38, 198, 138);
    // Tree grid inside forest
    const treeOffsets = [
      [0,0],[70,0],[140,0],[35,64],[105,64],[175,0],
      [0,68],[70,68],[140,68],
    ];
    for (const [dx, dy] of treeOffsets) {
      this.add.image(548 + dx, 44 + dy, 'treetop')
        .setOrigin(0).setScale(0.85).setDepth(3);
    }
    // Forest edge fade
    fg.fillStyle(0x1e5c1e);
    for (let lx = 530; lx < 740; lx += 22)
      fg.fillEllipse(lx + 11, 182, 28, 18);

    // ── Blacksmith — SE ───────────────────────────────────────────────
    this.add.image(488, 264, 'castle_outside')
      .setOrigin(0).setCrop(288, 128, 256, 192).setDepth(2);

    // ── Castle Gate — far SE ──────────────────────────────────────────
    this.add.image(632, 352, 'castle_outside')
      .setOrigin(0).setCrop(128, 60, 190, 200).setDepth(2);

    // ── Fields — S ───────────────────────────────────────────────────
    const ffg = this.add.graphics().setDepth(1);
    const fieldColors = [0x5ab832, 0x6ace40, 0x5ab832, 0x48a028];
    for (let i = 0; i < 4; i++) {
      ffg.fillStyle(fieldColors[i]);
      ffg.fillRect(160 + i * 2, 348 + i * 18, 178 - i * 4, 16);
      ffg.lineStyle(1, 0x3a8020, 0.6);
      ffg.strokeRect(160 + i * 2, 348 + i * 18, 178 - i * 4, 16);
    }

    // ── Scattered trees ───────────────────────────────────────────────
    const treeSpots = [
      [308, 38, 1.1], [462, 55, 1.0], [288, 165, 0.9],
      [510, 178, 1.0], [322, 440, 1.1], [492, 444, 0.9],
      [748, 195, 1.0], [758, 318, 1.1],
    ];
    for (const [tx, ty, sc] of treeSpots)
      this.add.image(tx, ty, 'treetop').setScale(sc).setDepth(3);

    // ── Town Square stone circle ──────────────────────────────────────
    const sq = this.add.graphics().setDepth(1);
    sq.fillStyle(0xb0a080, 0.55); sq.fillCircle(400, 252, 48);
    sq.lineStyle(3, 0x8a7060, 0.9); sq.strokeCircle(400, 252, 48);
    // Fountain
    sq.fillStyle(0x4080c0, 0.8); sq.fillCircle(400, 252, 14);
    sq.fillStyle(0x80c0ff, 0.6); sq.fillCircle(400, 252, 7);

    // ── Zone labels ───────────────────────────────────────────────────
    const ls = { fontSize: '9px', color: '#ffe082', fontFamily: 'monospace',
                 backgroundColor: '#00000099', padding: { x: 4, y: 2 } };
    for (const z of Object.values(ZONES))
      this.add.text(z.x, z.y + 38, z.label, ls).setOrigin(0.5, 0).setDepth(8);
  }

  // ── VILLAGER ────────────────────────────────────────────────────────────
  spawnVillager(agentId) {
    const isMain = agentId === 'main';
    const cfg = isMain ? SPRITES[0] : SPRITES[(spriteIdx++ % (SPRITES.length - 1)) + 1];
    const pos = ZONES.square;

    const sprite = this.add.sprite(pos.x, pos.y, cfg.key)
      .setScale(0.72).setTint(cfg.tint).setDepth(10);
    sprite.play(`${cfg.key}-idle`);

    const name = isMain ? 'Claude' : agentId.slice(0, 8);
    const labelStyle = { fontSize: '8px', color: '#ffe082', fontFamily: 'monospace',
                         backgroundColor: '#00000099', padding: { x: 3, y: 1 } };
    const bubbleStyle = { fontSize: '8px', color: '#aaffaa', fontFamily: 'monospace',
                          backgroundColor: '#00000088', padding: { x: 3, y: 1 } };

    const label  = this.add.text(pos.x, pos.y - 40, name, labelStyle).setOrigin(0.5, 1).setDepth(11);
    const bubble = this.add.text(pos.x, pos.y + 30, 'wandering...', bubbleStyle).setOrigin(0.5, 0).setDepth(11);

    this.villagers[agentId] = { sprite, label, bubble, cfg };
    return this.villagers[agentId];
  }

  handleEvent(event) {
    const agentId = event.agent || 'main';
    let v = this.villagers[agentId];
    if (!v) v = this.spawnVillager(agentId);

    const map   = TOOL_MAP[event.tool] || DEFAULT_MAP;
    const zone  = ZONES[map.zone];
    const tx    = zone.x + Phaser.Math.Between(-18, 18);
    const ty    = zone.y + Phaser.Math.Between(-12, 12);

    // Pick directional walk animation
    const dx = tx - v.sprite.x;
    const dy = ty - v.sprite.y;
    const dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down'  : 'up');
    v.sprite.play(`${v.cfg.key}-${dir}`);

    const DURATION = 900;
    this.tweens.add({ targets: v.sprite, x: tx, y: ty,    duration: DURATION, ease: 'Power1',
      onComplete: () => v.sprite.play(`${v.cfg.key}-idle`) });
    this.tweens.add({ targets: v.label,  x: tx, y: ty-40, duration: DURATION, ease: 'Power1' });
    this.tweens.add({ targets: v.bubble, x: tx, y: ty+30, duration: DURATION, ease: 'Power1' });

    v.bubble.setText(map.label);
  }

  // ── WEBSOCKET ────────────────────────────────────────────────────────────
  connectWebSocket() {
    const statusEl = document.getElementById('status');
    const ws = new WebSocket('ws://localhost:3131');

    ws.onopen = () => {
      statusEl.textContent = '● connected';
      statusEl.className = 'connected';
      this.spawnVillager('main');
    };

    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data);
        if (ev.type === 'tool_use') this.handleEvent(ev);
      } catch {}
    };

    ws.onclose = () => {
      statusEl.textContent = '● disconnected';
      statusEl.className = '';
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }
}

// ── BOOT ───────────────────────────────────────────────────────────────────
new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 500,
  backgroundColor: '#3a6a28',
  pixelArt: true,               // nearest-neighbour — no anti-aliasing
  scene: VillageScene,
  parent: document.body,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
});
