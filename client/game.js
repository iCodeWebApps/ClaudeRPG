// ClaudeRPG — FF4-style village
// Assets: LPC Base Assets + LPC Terrains (CC-BY-SA 3.0, Stephen Challener / Lanea Zimmermann et al.)

// ── ZONES  (positions tuned to real features in village.png 1950×1300→800×500)
const ZONES = {
  library: { x: 172, y: 170, label: "Sage's Tower" },  // left dark-roofed building
  smithy:  { x: 400, y: 215, label: 'Blacksmith'    },  // central large stone building
  harbor:  { x: 658, y: 148, label: 'The Tavern'    },  // right half-timber building
  square:  { x: 272, y: 390, label: 'Town Square'   },  // outdoor table/bench
  forest:  { x: 710, y: 310, label: 'Dark Forest'   },  // right-side tree cluster
  gate:    { x: 530, y: 58,  label: 'North Gate'    },  // top fence/barrel path
  fields:  { x: 128, y: 460, label: 'Fields'        },  // bottom-left fenced grass
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

    // Characters (576×256, 9 frames × 4 rows, 64×64 each)
    this.load.spritesheet('soldier',  B + 'sprites/people/soldier.png',         { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('altcolor', B + 'sprites/people/soldier_altcolor.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('princess', B + 'sprites/people/princess.png',         { frameWidth: 64, frameHeight: 64 });

    // Village backgrounds — both pixel-perfect aligned (1950×1300)
    this.load.image('village',        'assets/village.png');         // with roofs
    this.load.image('village_noroofs','assets/village_noroofs.png'); // interiors visible
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
    // ── Layer 0: interiors always visible ─────────────────────────────
    this.add.image(0, 0, 'village_noroofs')
      .setOrigin(0).setDisplaySize(800, 500).setDepth(0);

    // ── Layer 6: roofs — pixel-perfect on top, hides characters inside
    this.roofLayer = this.add.image(0, 0, 'village')
      .setOrigin(0).setDisplaySize(800, 500).setDepth(6);

    // R key toggles roofs (classic RPG behaviour)
    this.roofVisible = true;
    this.input.keyboard.on('keydown-R', () => {
      this.roofVisible = !this.roofVisible;
      this.roofLayer.setVisible(this.roofVisible);
      this.roofHint.setText(this.roofVisible ? '[R] hide roofs' : '[R] show roofs');
    });

    // ── Zone labels (depth 15 — always above roofs) ───────────────────
    const ls = { fontSize: '9px', color: '#ffe082', fontFamily: 'monospace',
                 backgroundColor: '#00000099', padding: { x: 4, y: 2 } };
    for (const z of Object.values(ZONES))
      this.add.text(z.x, z.y + 36, z.label, ls).setOrigin(0.5, 0).setDepth(15);

    // ── UI hint ───────────────────────────────────────────────────────
    this.roofHint = this.add.text(8, 8, '[R] hide roofs', {
      fontSize: '9px', color: '#cccccc', fontFamily: 'monospace',
      backgroundColor: '#00000099', padding: { x: 4, y: 2 },
    }).setDepth(20);
  }

  // ── VILLAGER ────────────────────────────────────────────────────────────
  spawnVillager(agentId) {
    const cfg = SPRITES[spriteIdx++ % SPRITES.length];
    const pos = ZONES.square;

    const sprite = this.add.sprite(pos.x, pos.y, cfg.key)
      .setScale(0.72).setTint(cfg.tint).setDepth(5); // depth 5: under roofs (depth 6)
    sprite.play(`${cfg.key}-idle`);

    // Short ID — name label floats above roofs (depth 15) so always readable
    const name = agentId.startsWith('agent-') ? agentId.slice(0, 10) : agentId.slice(0, 8);
    const labelStyle = { fontSize: '8px', color: '#ffe082', fontFamily: 'monospace',
                         backgroundColor: '#00000099', padding: { x: 3, y: 1 } };
    const bubbleStyle = { fontSize: '8px', color: '#aaffaa', fontFamily: 'monospace',
                          backgroundColor: '#00000088', padding: { x: 3, y: 1 } };

    const label  = this.add.text(pos.x, pos.y - 40, name, labelStyle).setOrigin(0.5, 1).setDepth(15);
    const bubble = this.add.text(pos.x, pos.y + 30, 'wandering...', bubbleStyle).setOrigin(0.5, 0).setDepth(15);

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

  // Show the last ~72 chars of Claude's actual text in the speech bubble.
  handleText(ev) {
    const agentId = ev.agent || 'main';
    const v = this.villagers[agentId];
    if (!v) return;
    const snippet = ev.text.length > 72 ? '...' + ev.text.slice(-72) : ev.text;
    v.bubble.setText(snippet);
  }

  // ── WEBSOCKET ────────────────────────────────────────────────────────────
  connectWebSocket() {
    const statusEl = document.getElementById('status');
    const ws = new WebSocket('ws://localhost:3131');

    ws.onopen = () => {
      statusEl.textContent = '● connected';
      statusEl.className = 'connected';
      // Villagers spawn on demand as events arrive — no pre-spawn needed
    };

    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data);
        if (ev.type === 'tool_use')       this.handleEvent(ev);
        if (ev.type === 'assistant_text') this.handleText(ev);
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
