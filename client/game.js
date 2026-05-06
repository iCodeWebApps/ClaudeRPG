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
    for (const key of ['soldier', 'altcolor', 'princess']) {
      this.anims.create({ key: `${key}-up`,    frames: this.anims.generateFrameNumbers(key, { start: 0,  end: 8  }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-left`,  frames: this.anims.generateFrameNumbers(key, { start: 9,  end: 17 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-down`,  frames: this.anims.generateFrameNumbers(key, { start: 18, end: 26 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-right`, frames: this.anims.generateFrameNumbers(key, { start: 27, end: 35 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-idle`,  frames: [{ key, frame: 18 }], frameRate: 1 });
      // Short "look" clips — 3 frames, play-once, then caller returns to idle
      this.anims.create({ key: `${key}-look-left`,  frames: this.anims.generateFrameNumbers(key, { start: 9,  end: 11 }), frameRate: 5, repeat: 0 });
      this.anims.create({ key: `${key}-look-right`, frames: this.anims.generateFrameNumbers(key, { start: 27, end: 29 }), frameRate: 5, repeat: 0 });
      this.anims.create({ key: `${key}-look-down`,  frames: this.anims.generateFrameNumbers(key, { start: 18, end: 20 }), frameRate: 5, repeat: 0 });
    }

    // ── Physics group — collider added once, handles all villager separation
    this.villagerGroup = this.physics.add.group();
    this.physics.add.collider(this.villagerGroup, this.villagerGroup);

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

        if (dx !== 0) chicken.setFlipX(dx > 0);

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

    // ── Individual roof layers — one masked sprite per building ─────────
    // Source image is 1536×1024 displayed at 800×500; scale factors:
    const sx = 800 / 1536, sy = 500 / 1024;

    // Bounding boxes in source texture coordinates
    const ROOFS = [
      { key: 'workshop', tx:  10, ty: 105, tw: 210, th: 170 },
      { key: 'inn',      tx: 345, ty: 145, tw: 500, th: 370 },
      { key: 'lodge',    tx: 940, ty:  80, tw: 340, th: 360 },
    ];

    this.roofSprites = {};

    for (const def of ROOFS) {
      // Convert to game-space bounding box
      const gx = def.tx * sx, gy = def.ty * sy;
      const gw = def.tw * sx, gh = def.th * sy;

      // Geometry mask clips the full-image copy to just this roof region
      const mg = this.add.graphics();
      mg.fillStyle(0xffffff).fillRect(gx, gy, gw, gh);

      const img = this.add.image(0, 0, 'village')
        .setOrigin(0).setDisplaySize(800, 500).setDepth(6)
        .setMask(mg.createGeometryMask());

      this.roofSprites[def.key] = { img, gx, gy, gw, gh };
    }

    // R — toggle all roofs globally
    this.roofVisible = true;
    this.input.keyboard.on('keydown-R', () => {
      this.roofVisible = !this.roofVisible;
      for (const r of Object.values(this.roofSprites)) {
        this.tweens.killTweensOf(r.img);
        this.tweens.add({ targets: r.img, alpha: this.roofVisible ? 1 : 0, duration: 250 });
      }
      this.roofHint.setText(this.roofVisible ? '[R] hide roofs' : '[R] show roofs');
    });

    // Hover — fade individual roof when cursor enters its bounding box
    this.input.on('pointermove', (ptr) => {
      for (const r of Object.values(this.roofSprites)) {
        const inside = ptr.x >= r.gx && ptr.x <= r.gx + r.gw
                    && ptr.y >= r.gy && ptr.y <= r.gy + r.gh;
        // Only act if globally visible and alpha needs to change
        const target = (!this.roofVisible || inside) ? 0 : 1;
        if (Math.abs(r.img.alpha - target) > 0.01) {
          this.tweens.killTweensOf(r.img);
          this.tweens.add({ targets: r.img, alpha: target, duration: 180, ease: 'Quad.Out' });
        }
      }
    });

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

    // Physics sprite — circular body for natural separation
    const sprite = this.physics.add.sprite(pos.x, pos.y, cfg.key)
      .setScale(0.72).setTint(cfg.tint).setDepth(7);
    // Circular body: radius 18px in texture space (64×64), centered
    sprite.setCircle(18, 14, 14);
    sprite.body.setCollideWorldBounds(true);
    sprite.body.setMaxVelocity(120, 120);
    sprite.play(`${cfg.key}-idle`);

    this.villagerGroup.add(sprite);

    // Target + arrived flag — once settled, don't fight physics separation
    sprite.targetX  = pos.x;
    sprite.targetY  = pos.y;
    sprite.arrived  = true;
    // Idle look animation — independent random timer per villager
    sprite.idleMs   = 0;
    sprite.idleWait = Phaser.Math.Between(2000, 6000);
    sprite.looking  = false;

    const name = agentId.startsWith('agent-') ? agentId.slice(0, 10) : agentId.slice(0, 8);
    const label  = this.add.text(pos.x, pos.y - 40, name, {
      fontSize: '8px', color: '#ffe082', fontFamily: 'monospace',
      backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setDepth(15);
    const bubble = this.add.text(pos.x, pos.y + 30, 'wandering...', {
      fontSize: '8px', color: '#aaffaa', fontFamily: 'monospace',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 0).setDepth(15);

    this.villagers[agentId] = { sprite, label, bubble, cfg };
    return this.villagers[agentId];
  }

  handleEvent(event) {
    const agentId = event.agent || 'main';
    let v = this.villagers[agentId];
    if (!v) v = this.spawnVillager(agentId);

    const map  = TOOL_MAP[event.tool] || DEFAULT_MAP;
    const zone = ZONES[map.zone];
    v.sprite.targetX  = zone.x + Phaser.Math.Between(-18, 18);
    v.sprite.targetY  = zone.y + Phaser.Math.Between(-12, 12);
    v.sprite.arrived  = false;
    v.sprite.looking  = false;
    v.sprite.idleMs   = 0;

    v.bubble.setText(event.tool || map.label);
  }

  // update() drives villager movement — physics handles separation
  update(time, delta) {
    const SPEED   = 75;
    const ARRIVAL = 20;
    const LOOKS   = ['look-left', 'look-right', 'look-down'];

    for (const v of Object.values(this.villagers)) {
      const idle = `${v.cfg.key}-idle`;

      if (v.sprite.arrived) {
        v.sprite.setVelocity(0, 0);

        // Idle look animation — tick the per-villager timer
        if (!v.sprite.looking) {
          v.sprite.idleMs += delta;
          if (v.sprite.idleMs >= v.sprite.idleWait) {
            v.sprite.idleMs   = 0;
            v.sprite.idleWait = Phaser.Math.Between(3000, 8000);
            v.sprite.looking  = true;
            const look = `${v.cfg.key}-${LOOKS[Phaser.Math.Between(0, 2)]}`;
            v.sprite.play(look);
            v.sprite.once('animationcomplete', () => {
              v.sprite.looking = false;
              if (v.sprite.arrived) v.sprite.play(idle);
            });
          } else if (v.sprite.anims.currentAnim?.key !== idle) {
            v.sprite.play(idle);
          }
        }
      } else {
        const dx   = v.sprite.targetX - v.sprite.x;
        const dy   = v.sprite.targetY - v.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > ARRIVAL) {
          v.sprite.setVelocity((dx / dist) * SPEED, (dy / dist) * SPEED);
          const dir  = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');
          const anim = `${v.cfg.key}-${dir}`;
          if (v.sprite.anims.currentAnim?.key !== anim) v.sprite.play(anim);
        } else {
          // Arrived — lock in and never fight physics again until next event
          v.sprite.arrived = true;
          v.sprite.setVelocity(0, 0);
          if (v.sprite.anims.currentAnim?.key !== idle) v.sprite.play(idle);
        }
      }

      // Labels always track the actual sprite position (physics may have shifted it)
      v.label.setPosition(v.sprite.x, v.sprite.y - 40);
      v.bubble.setPosition(v.sprite.x, v.sprite.y + 30);
    }
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
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: VillageScene,
  parent: document.body,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
});
