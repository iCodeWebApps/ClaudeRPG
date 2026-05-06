// ClaudeRPG — FF4-style village
// Assets: LPC Base Assets + LPC Terrains (CC-BY-SA 3.0, Stephen Challener / Lanea Zimmermann et al.)

// ── ZONES  (image is 1536×1024 → 800×500; scale x×0.521, y×0.488)
// zone.x/y = where the villager stands; label renders at zone.y+36
const ZONES = {
  workshop: { x: 80,  y: 162, label: 'The Workshop' }, // NW shed (barrels/logs/jugs)
  inn:      { x: 312, y: 290, label: 'The Inn'       }, // central stone+wood building
  lodge:    { x: 547, y: 195, label: 'The Lodge'     }, // right half-timber building
  green:    { x: 195, y: 374, label: 'Town Green'    }, // outdoor picnic table
  orchard:  { x: 573, y: 352, label: 'The Orchard'   }, // right autumn trees + fence
  gate:     { x: 430, y: 50,  label: 'North Gate'    }, // top sandy path + fence
  commons:  { x: 70,  y: 413, label: 'The Commons'   }, // bottom-left rocks + grass
};

const TOOL_MAP = {
  Read:      { zone: 'inn',      label: 'studying...'    },
  Glob:      { zone: 'orchard',  label: 'searching...'   },
  Grep:      { zone: 'orchard',  label: 'searching...'   },
  Edit:      { zone: 'workshop', label: 'crafting...'    },
  Write:     { zone: 'workshop', label: 'scribing...'    },
  Bash:      { zone: 'workshop', label: 'forging...'     },
  WebSearch: { zone: 'lodge',    label: 'scouting...'    },
  WebFetch:  { zone: 'lodge',    label: 'fetching...'    },
  Agent:     { zone: 'gate',     label: 'dispatching...' },
  Task:      { zone: 'commons',  label: 'tending...'     },
};
const DEFAULT_MAP = { zone: 'green', label: 'wandering...' };

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

    // Chicken sprite (transparent background, 800×922)
    this.load.image('chicken', 'assets/chicken.png');
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
    this.spawnChickens();
    this.connectWebSocket();
  }

  spawnChickens() {
    // Home positions — grassy outdoor areas only
    const homes = [
      { x: 142, y: 300 },  // Workshop yard
      { x:  90, y: 355 },  // Workshop south
      { x: 218, y: 235 },  // Between Workshop and Inn
      { x: 170, y: 422 },  // Town Green table area
      { x: 370, y: 420 },  // South of Inn entrance
      { x: 618, y: 398 },  // Orchard fence
      { x: 470, y: 115 },  // North Gate path
    ];

    for (const home of homes) {
      const chicken = this.add.image(home.x, home.y, 'chicken')
        .setScale(0.042).setDepth(8); // depth 8: above roofs (6) and agents (7)

      const wander = () => {
        const dx = Phaser.Math.Between(-60, 60);
        const dy = Phaser.Math.Between(-28, 28);
        const tx = Phaser.Math.Clamp(home.x + dx, 12, 788);
        const ty = Phaser.Math.Clamp(home.y + dy, 12, 488);

        if (dx !== 0) chicken.setFlipX(dx < 0);

        this.tweens.add({
          targets: chicken, x: tx, y: ty,
          duration: Phaser.Math.Between(1000, 2600),
          ease: 'Linear',
          onComplete: peck,
        });
      };

      const peck = () => {
        this.tweens.add({
          targets: chicken,
          y: chicken.y + 5,
          duration: 110,
          yoyo: true,
          repeat: Phaser.Math.Between(0, 2),
          onComplete: () => {
            this.time.delayedCall(Phaser.Math.Between(300, 1800), wander);
          },
        });
      };

      // Stagger start so they don't all sync up
      this.time.delayedCall(Phaser.Math.Between(0, 2500), wander);
    }
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

    // Zone labels intentionally removed — village art speaks for itself

    // ── UI hint ───────────────────────────────────────────────────────
    this.roofHint = this.add.text(8, 8, '[R] hide roofs', {
      fontSize: '9px', color: '#cccccc', fontFamily: 'monospace',
      backgroundColor: '#00000099', padding: { x: 4, y: 2 },
    }).setDepth(20);
  }

  // ── VILLAGER ────────────────────────────────────────────────────────────
  spawnVillager(agentId) {
    const cfg = SPRITES[spriteIdx++ % SPRITES.length];
    const pos = ZONES.green;

    const sprite = this.add.sprite(pos.x, pos.y, cfg.key)
      .setScale(0.72).setTint(cfg.tint).setDepth(7); // depth 7: above roofs — always visible
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

    // Show tool name as placeholder until real text arrives
    v.bubble.setText(event.tool || map.label);
  }

  // Real agent text replaces the bubble — always wins over the tool placeholder.
  handleText(ev) {
    const agentId = ev.agent || 'main';
    const v = this.villagers[agentId];
    if (!v) return;
    // Take the last sentence-like chunk (split on . ! ? \n) that fits in ~72 chars
    const clean = ev.text.replace(/\s+/g, ' ').trim();
    const snippet = clean.length > 72 ? '...' + clean.slice(-69) : clean;
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
