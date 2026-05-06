// ClaudeRPG — FF4-style village
// Assets: LPC Base Assets + LPC Terrains (CC-BY-SA 3.0, Stephen Challener / Lanea Zimmermann et al.)

// ── PATHFINDING ────────────────────────────────────────────────────────────
// 30×20 tile grid (50px/tile in 1536×1024 source). A* routes villagers
// through walkable tiles defined by the player.

const TILE_SIZE = 50, GRID_COLS = 30, GRID_ROWS = 20;
const SRC_W = 1536, SRC_H = 1024, GAME_W = 800, GAME_H = 500;

// Walkable column ranges per row [colStart, colEnd] inclusive
const NAV = [
  [[14,29]],                              // row  0
  [[14,29]],                              // row  1
  [[10,21],[28,29]],                      // row  2
  [[9,25],[28,29]],                       // row  3
  [[8,11],[17,29]],                       // row  4
  [[6,11],[17,21],[25,29]],              // row  5
  [[3,8],[17,21],[25,29]],               // row  6
  [[1,8],[12,15],[17,29]],               // row  7
  [[1,3],[5,12],[14,15],[19,29]],        // row  8
  [[1,1],[4,8],[11,15],[19,21],[24,29]], // row  9
  [[1,8],[12,15],[19,21],[24,29]],       // row 10
  [[1,8],[14,14],[19,29]],               // row 11
  [[5,8],[13,17],[19,29]],               // row 12
  [[5,10],[12,29]],                       // row 13
  [[5,15],[17,21],[24,29]],              // row 14
  [[5,11],[14,15],[17,21]],              // row 15
  [[6,6],[9,21]],                         // row 16
  [[6,6],[9,21]],                         // row 17
  [[6,6],[9,21]],                         // row 18
  [[10,21]],                              // row 19
];

const GRID = NAV.map(ranges => {
  const row = new Array(GRID_COLS).fill(false);
  for (const [c1, c2] of ranges) for (let c = c1; c <= c2; c++) row[c] = true;
  return row;
});

function gameToTile(gx, gy) {
  return {
    c: Math.max(0, Math.min(GRID_COLS-1, Math.floor((gx/GAME_W)*SRC_W/TILE_SIZE))),
    r: Math.max(0, Math.min(GRID_ROWS-1, Math.floor((gy/GAME_H)*SRC_H/TILE_SIZE))),
  };
}

function tileToGame(c, r) {
  return {
    x: (c*TILE_SIZE + TILE_SIZE/2) * GAME_W/SRC_W,
    y: (r*TILE_SIZE + TILE_SIZE/2) * GAME_H/SRC_H,
  };
}

function nearestWalkable(c, r) {
  for (let rad = 0; rad <= 8; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dc) !== rad && Math.abs(dr) !== rad) continue;
        const nc = c+dc, nr = r+dr;
        if (nc>=0 && nc<GRID_COLS && nr>=0 && nr<GRID_ROWS && GRID[nr][nc]) return {c:nc,r:nr};
      }
    }
  }
  return { c:14, r:10 };
}

// Flat list of every walkable tile — used for random destination picks
const WALKABLE_LIST = [];
for (let r = 0; r < GRID_ROWS; r++)
  for (let c = 0; c < GRID_COLS; c++)
    if (GRID[r][c]) WALKABLE_LIST.push({ c, r });

function randomDest() {
  const t = WALKABLE_LIST[Math.floor(Math.random() * WALKABLE_LIST.length)];
  const g = tileToGame(t.c, t.r);
  // Small sub-tile jitter so agents don't always snap to tile centres
  return {
    x: g.x + (Math.random() - 0.5) * 20,
    y: g.y + (Math.random() - 0.5) * 10,
  };
}

function aStar(sc, sr, ec, er) {
  const key = (c,r) => c*100+r;
  const h   = (c,r) => Math.abs(c-ec)+Math.abs(r-er);
  const open = new Map(), closed = new Set();
  const s = { c:sc, r:sr, g:0, h:h(sc,sr), parent:null };
  s.f = s.h; open.set(key(sc,sr), s);

  while (open.size) {
    let best = null;
    for (const n of open.values()) if (!best || n.f < best.f) best = n;
    if (best.c===ec && best.r===er) {
      const path=[]; for (let n=best; n; n=n.parent) path.unshift(n); return path;
    }
    open.delete(key(best.c,best.r)); closed.add(key(best.c,best.r));
    for (const [dc,dr] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nc=best.c+dc, nr=best.r+dr;
      if (nc<0||nc>=GRID_COLS||nr<0||nr>=GRID_ROWS||!GRID[nr][nc]||closed.has(key(nc,nr))) continue;
      const g=best.g+1, ex=open.get(key(nc,nr));
      if (!ex||g<ex.g) { const n={c:nc,r:nr,g,h:h(nc,nr),parent:best}; n.f=n.g+n.h; open.set(key(nc,nr),n); }
    }
  }
  return null;
}

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
  { key: 'character1', tint: 0xffffff },
  { key: 'character2', tint: 0xffffff },
  { key: 'princess',   tint: 0xffffff },
  { key: 'soldier',    tint: 0x88ffcc },
  { key: 'altcolor',   tint: 0xffccff },
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

    // Universal LPC characters (832×3456, 13 frames × 54 rows, 64×64 each)
    this.load.spritesheet('character1', 'assets/character1.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('character2', 'assets/character2.png', { frameWidth: 64, frameHeight: 64 });

    // Village backgrounds — both pixel-perfect aligned (1950×1300)
    this.load.image('village',        'assets/village.png');         // with roofs
    this.load.image('village_noroofs','assets/village_noroofs.png'); // interiors visible

    // Chicken sprite (transparent background, 800×922)
    this.load.image('chicken', 'assets/chicken.png');

    // Doodle dog sprites
    this.load.image('doodle',      'assets/doodle.png');
    this.load.image('doodle_step', 'assets/doodle_step.png');

    // Cattle dog sprites
    this.load.image('cattledog',      'assets/cattledog.png');
    this.load.image('cattledog_step', 'assets/cattledog_step.png');
  }

  create() {
    // ── Animations ─────────────────────────────────────────────────────
    // Universal LPC characters — walk cycle at rows 8-11 (13 frames/row → frame = row*13+col)
    for (const key of ['character1', 'character2']) {
      this.anims.create({ key: `${key}-up`,         frames: this.anims.generateFrameNumbers(key, { start: 104, end: 112 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-left`,        frames: this.anims.generateFrameNumbers(key, { start: 117, end: 125 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-down`,        frames: this.anims.generateFrameNumbers(key, { start: 130, end: 138 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-right`,       frames: this.anims.generateFrameNumbers(key, { start: 143, end: 151 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-idle`,        frames: [{ key, frame: 130 }], frameRate: 1 });
      this.anims.create({ key: `${key}-look-left`,   frames: this.anims.generateFrameNumbers(key, { start: 117, end: 119 }), frameRate: 5, repeat: 0 });
      this.anims.create({ key: `${key}-look-right`,  frames: this.anims.generateFrameNumbers(key, { start: 143, end: 145 }), frameRate: 5, repeat: 0 });
      this.anims.create({ key: `${key}-look-down`,   frames: this.anims.generateFrameNumbers(key, { start: 130, end: 132 }), frameRate: 5, repeat: 0 });
    }

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

    this.chickens = [];
    this.dogs = [];

    this.buildMap();
    this.buildDayNight();
    this.spawnChickens();
    this.spawnDoodle();
    this.spawnCattleDog();

    // ── History panel (shared, shown on villager click) ───────────────
    this.histPanel = this.add.container(0, 0).setDepth(30).setVisible(false);
    this.histPanel._bg    = this.add.rectangle(0, 0, 240, 40, 0x0d0d1a, 0.93).setOrigin(0).setStrokeStyle(1, 0x334466);
    this.histPanel._lines = [];
    this.histPanel.add(this.histPanel._bg);

    // Click anywhere outside a villager closes the panel
    this.input.on('pointerdown', (ptr, hits) => {
      if (this.histPanel.visible && hits.length === 0) this.histPanel.setVisible(false);
    });

    this.connectWebSocket();
  }

  // ── DAY / NIGHT ──────────────────────────────────────────────────────────
  buildDayNight() {
    // Overlay dims the whole scene (depth 13 — above roofs, below labels)
    this.dayOverlay = this.add.rectangle(400, 250, 800, 500, 0x000000, 0)
      .setDepth(13);


    this.updateDayNight();
    this.time.addEvent({ delay: 60000, loop: true, callback: this.updateDayNight, callbackScope: this });
  }

  updateDayNight() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    let color = 0x000000, alpha = 0;

    if      (h >= 23 || h < 5)  { color = 0x111133; alpha = 0.55; }
    else if (h >= 5  && h < 7)  { color = 0xff5522; alpha = 0.20; }
    else if (h >= 7  && h < 9)  { color = 0xffaa44; alpha = 0.07; }
    else if (h >= 9  && h < 17) { color = 0x000000; alpha = 0.00; }
    else if (h >= 17 && h < 19) { color = 0xff8833; alpha = 0.12; }
    else if (h >= 19 && h < 21) { color = 0xcc3322; alpha = 0.28; }
    else                         { color = 0x221144; alpha = 0.42; }

    this.dayOverlay.setFillStyle(color, alpha);
  }

  // ── HISTORY PANEL ────────────────────────────────────────────────────────
  showHistory(agentId, sx, sy) {
    const v = this.villagers[agentId];
    if (!v) return;

    // Clear previous lines
    for (const t of this.histPanel._lines) t.destroy();
    this.histPanel._lines = [];

    const W = 240, PAD = 7, LH = 13;
    let cy = PAD;

    const title = this.add.text(PAD, cy, `◆ ${agentId.slice(0,14)}`, {
      fontSize: '8px', color: '#88aaff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0);
    this.histPanel.add(title); this.histPanel._lines.push(title);
    cy += LH + 3;

    const items = v.sprite.history.slice(-8).reverse();
    if (items.length === 0) {
      const t = this.add.text(PAD, cy, '(no events yet)', {
        fontSize: '7px', color: '#445566', fontFamily: 'monospace',
      }).setOrigin(0);
      this.histPanel.add(t); this.histPanel._lines.push(t);
      cy += LH;
    } else {
      for (const item of items) {
        const isTool = item.startsWith('→');
        const t = this.add.text(PAD, cy, item, {
          fontSize: '7px', color: isTool ? '#88ccff' : '#aaaaaa', fontFamily: 'monospace',
          wordWrap: { width: W - PAD * 2 },
        }).setOrigin(0);
        this.histPanel.add(t); this.histPanel._lines.push(t);
        cy += Math.max(LH, Math.ceil(item.length / 30) * LH) + 1;
      }
    }

    this.histPanel._bg.setSize(W, cy + PAD);

    const px = Phaser.Math.Clamp(sx - W / 2, 4, 800 - W - 4);
    const py = Phaser.Math.Clamp(sy - cy - PAD - 50, 4, 500 - cy - PAD * 2);
    this.histPanel.setPosition(px, py).setVisible(true);
    this.histPanel._activeAgent = agentId;
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
        let dx = Phaser.Math.Between(-60, 60);
        let dy = Phaser.Math.Between(-28, 28);
        let tx = Phaser.Math.Clamp(home.x + dx, 12, 788);
        let ty = Phaser.Math.Clamp(home.y + dy, 12, 488);

        // Steer away from dogs — if destination is too close, flee direction instead
        for (const dog of (this.dogs || [])) {
          const ddx = tx - dog.x;
          const ddy = ty - dog.y;
          if (ddx * ddx + ddy * ddy < 80 * 80) {
            const angle = Math.atan2(chicken.y - dog.y, chicken.x - dog.x);
            const dist  = Phaser.Math.Between(50, 90);
            tx = Phaser.Math.Clamp(chicken.x + Math.cos(angle) * dist, 12, 788);
            ty = Phaser.Math.Clamp(chicken.y + Math.sin(angle) * dist, 12, 488);
            dx = tx - chicken.x;
            break;
          }
        }

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

      chicken._fleeing = false;
      chicken._wander  = wander;
      this.chickens.push(chicken);

      // ── Drag to relocate ───────────────────────────────────────────
      chicken.setInteractive();
      this.input.setDraggable(chicken);

      chicken.on('dragstart', () => {
        this.tweens.killTweensOf(chicken); // stop current wander
        chicken.setDepth(25);
      });

      chicken.on('drag', (pointer, dragX, dragY) => {
        chicken.setPosition(dragX, dragY);
      });

      chicken.on('dragend', () => {
        chicken.setDepth(8);
        home.x = chicken.x;   // update home so wander stays in new area
        home.y = chicken.y;
        this.time.delayedCall(Phaser.Math.Between(200, 800), wander);
      });

      // Stagger start so they don't all sync up
      this.time.delayedCall(Phaser.Math.Between(0, 2500), wander);
    }
  }

  spawnDoodle() {
    const home = { x: 200, y: 400 }; // Town Green, near the picnic table

    const doodle = this.add.image(home.x, home.y, 'doodle')
      .setScale(0.075).setDepth(8);
    this.dogs.push(doodle);

    const wander = () => {
      const dx = Phaser.Math.Between(-55, 55);
      const dy = Phaser.Math.Between(-25, 25);
      const tx = Phaser.Math.Clamp(home.x + dx, 12, 788);
      const ty = Phaser.Math.Clamp(home.y + dy, 12, 488);

      if (dx !== 0) doodle.setFlipX(dx > 0);

      if (doodle._walkTimer) doodle._walkTimer.remove();
      let stepFrame = false;
      doodle._walkTimer = this.time.addEvent({
        delay: 180, loop: true,
        callback: () => { stepFrame = !stepFrame; doodle.setTexture(stepFrame ? 'doodle_step' : 'doodle'); },
      });

      this.tweens.add({
        targets: doodle, x: tx, y: ty,
        duration: Phaser.Math.Between(1200, 3000),
        ease: 'Linear',
        onComplete: sniff,
      });
    };

    const sniff = () => {
      if (doodle._walkTimer) { doodle._walkTimer.remove(); doodle._walkTimer = null; }
      doodle.setTexture('doodle');

      this.tweens.add({
        targets: doodle,
        y: doodle.y + 4,
        duration: 130,
        yoyo: true,
        repeat: Phaser.Math.Between(0, 3),
        onComplete: () => {
          this.time.delayedCall(Phaser.Math.Between(400, 2200), wander);
        },
      });
    };

    doodle.setInteractive();
    this.input.setDraggable(doodle);

    doodle.on('dragstart', () => {
      this.tweens.killTweensOf(doodle);
      doodle.setDepth(25);
    });

    doodle.on('drag', (pointer, dragX, dragY) => {
      doodle.setPosition(dragX, dragY);
    });

    doodle.on('dragend', () => {
      doodle.setDepth(8);
      home.x = doodle.x;
      home.y = doodle.y;
      this.time.delayedCall(Phaser.Math.Between(200, 800), wander);
    });

    this.time.delayedCall(Phaser.Math.Between(0, 1500), wander);
  }

  spawnCattleDog() {
    const home = { x: 90, y: 355 }; // Workshop south yard

    const dog = this.add.image(home.x, home.y, 'cattledog')
      .setScale(0.06).setDepth(8);
    this.dogs.push(dog);

    const wander = () => {
      const dx = Phaser.Math.Between(-55, 55);
      const dy = Phaser.Math.Between(-25, 25);
      const tx = Phaser.Math.Clamp(home.x + dx, 12, 788);
      const ty = Phaser.Math.Clamp(home.y + dy, 12, 488);

      if (dx !== 0) dog.setFlipX(dx > 0);

      if (dog._walkTimer) dog._walkTimer.remove();
      let stepFrame = false;
      dog._walkTimer = this.time.addEvent({
        delay: 180, loop: true,
        callback: () => { stepFrame = !stepFrame; dog.setTexture(stepFrame ? 'cattledog_step' : 'cattledog'); },
      });

      this.tweens.add({
        targets: dog, x: tx, y: ty,
        duration: Phaser.Math.Between(1200, 3000),
        ease: 'Linear',
        onComplete: sniff,
      });
    };

    const sniff = () => {
      if (dog._walkTimer) { dog._walkTimer.remove(); dog._walkTimer = null; }
      dog.setTexture('cattledog');

      this.tweens.add({
        targets: dog,
        y: dog.y + 4,
        duration: 130,
        yoyo: true,
        repeat: Phaser.Math.Between(0, 3),
        onComplete: () => {
          this.time.delayedCall(Phaser.Math.Between(400, 2200), wander);
        },
      });
    };

    dog.setInteractive();
    this.input.setDraggable(dog);

    dog.on('dragstart', () => {
      this.tweens.killTweensOf(dog);
      dog.setDepth(25);
    });

    dog.on('drag', (pointer, dragX, dragY) => {
      dog.setPosition(dragX, dragY);
    });

    dog.on('dragend', () => {
      dog.setDepth(8);
      home.x = dog.x;
      home.y = dog.y;
      this.time.delayedCall(Phaser.Math.Between(200, 800), wander);
    });

    this.time.delayedCall(Phaser.Math.Between(0, 1500), wander);
  }

  buildMap() {
    // ── Ground ─────────────────────────────────────────────────────────
    // Grass base (terrain frame 2 = grass swatch, tiled at 2×)
    // ── Layer 0: interiors always visible ─────────────────────────────
    this.add.image(0, 0, 'village_noroofs')
      .setOrigin(0).setDisplaySize(800, 500).setDepth(0);

    // ── Individual roof layers — one cropped sprite per building ────────
    // Source image is 1536×1024; displayed at 800×500 via setScale.
    // setCrop uses texture coords; Phaser offsets the frame to its natural
    // screen position, so no geometry masks needed.
    const sx = 800 / 1536, sy = 500 / 1024;

    const ROOFS = [
      { key: 'workshop', tx:  10, ty: 105, tw: 265, th: 170 },
      { key: 'inn',      tx: 425, ty: 192, tw: 450, th: 360, clipTriW: 185, clipTriH: 114 },
      { key: 'lodge',    tx: 1070, ty: 0, tw: 330, th: 450 },
    ];

    this.roofSprites = {};

    for (const def of ROOFS) {
      const img = this.add.image(0, 0, 'village')
        .setOrigin(0)
        .setScale(sx, sy)          // scale using original texture dims
        .setCrop(def.tx, def.ty, def.tw, def.th)  // Phaser offsets automatically
        .setDepth(6);

      // Game-space bounding box for hover detection
      const gx = def.tx * sx, gy = def.ty * sy;
      const gw = def.tw * sx, gh = def.th * sy;

      // Optional top-left triangle cutout (clips a triangle so lower layer shows through)
      if (def.clipTriW && def.clipTriH) {
        const triW = def.clipTriW * sx;
        const triH = def.clipTriH * sy;
        const mask = this.make.graphics({ add: false });
        mask.fillStyle(0xffffff);
        mask.beginPath();
        mask.moveTo(gx,        gy + triH);
        mask.lineTo(gx + triW, gy);
        mask.lineTo(gx + gw,   gy);
        mask.lineTo(gx + gw,   gy + gh);
        mask.lineTo(gx,        gy + gh);
        mask.closePath();
        mask.fillPath();
        img.setMask(mask.createGeometryMask());
      }

      this.roofSprites[def.key] = { img, gx, gy, gw, gh };
    }

    // Hover — fade individual roof when cursor enters its bounding box
    this.input.on('pointermove', (ptr) => {
      for (const r of Object.values(this.roofSprites)) {
        const inside = ptr.x >= r.gx && ptr.x <= r.gx + r.gw
                    && ptr.y >= r.gy && ptr.y <= r.gy + r.gh;
        const target = inside ? 0 : 1;
        if (Math.abs(r.img.alpha - target) > 0.01) {
          this.tweens.killTweensOf(r.img);
          this.tweens.add({ targets: r.img, alpha: target, duration: 180, ease: 'Quad.Out' });
        }
      }
    });
  }

  // ── VILLAGER ────────────────────────────────────────────────────────────
  spawnVillager(agentId) {
    const cfg = SPRITES[spriteIdx++ % SPRITES.length];
    const pos = ZONES.green;

    // Physics sprite — circular body for natural separation
    const sprite = this.physics.add.sprite(pos.x, pos.y, cfg.key)
      .setScale(0.72).setTint(cfg.tint).setDepth(5); // under roofs (6); hover to reveal
    // Circular body: radius 18px in texture space (64×64), centered
    sprite.setCircle(18, 14, 14);
    sprite.body.setCollideWorldBounds(true);
    sprite.body.setMaxVelocity(120, 120);
    sprite.play(`${cfg.key}-idle`);

    this.villagerGroup.add(sprite);

    // Target + arrived flag — once settled, don't fight physics separation
    sprite.targetX  = pos.x;
    sprite.targetY  = pos.y;
    sprite.arrived    = true;
    sprite.path       = null;
    sprite.pathIdx    = 0;
    sprite.history    = [];      // event log for click-to-inspect
    sprite._wasDragged = false;
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

    // ── Click to show history ─────────────────────────────────────────
    sprite.setInteractive();
    sprite.on('pointerdown', () => { sprite._wasDragged = false; });
    sprite.on('drag',        () => { sprite._wasDragged = true;  });
    sprite.on('pointerup',   () => {
      if (sprite._wasDragged) return;
      if (this.histPanel.visible && this.histPanel._activeAgent === agentId) {
        this.histPanel.setVisible(false);
      } else {
        this.showHistory(agentId, sprite.x, sprite.y);
      }
    });

    // ── Drag to reposition ────────────────────────────────────────────
    this.input.setDraggable(sprite);

    sprite.on('dragstart', () => {
      sprite.body.setEnable(false);       // physics off while held
      this.tweens.killTweensOf(sprite);
      sprite.setDepth(25);               // float above everything
    });

    sprite.on('drag', (pointer, dragX, dragY) => {
      sprite.setPosition(dragX, dragY);
      label.setPosition(dragX, dragY - 40);
      bubble.setPosition(dragX, dragY + 30);
    });

    sprite.on('dragend', () => {
      // Snap to nearest walkable tile if dropped in a blocked area
      const tile = gameToTile(sprite.x, sprite.y);
      if (!GRID[tile.r]?.[tile.c]) {
        const safe = nearestWalkable(tile.c, tile.r);
        const pos  = tileToGame(safe.c, safe.r);
        sprite.setPosition(pos.x, pos.y);
      }

      sprite.body.setEnable(true);
      sprite.body.reset(sprite.x, sprite.y);
      sprite.setDepth(5);
      sprite.targetX = sprite.x;
      sprite.targetY = sprite.y;
      sprite.arrived = true;
      sprite.path    = null;
      sprite.looking = false;
      sprite.idleMs  = 0;
    });

    return this.villagers[agentId];
  }

  handleEvent(event) {
    const agentId = event.agent || 'main';
    let v = this.villagers[agentId];
    if (!v) v = this.spawnVillager(agentId);

    const dest  = randomDest();
    const destX = dest.x;
    const destY = dest.y;

    // A* from current tile to nearest walkable tile at destination
    const st = gameToTile(v.sprite.x, v.sprite.y);
    const et = gameToTile(destX, destY);
    const stW = GRID[st.r]?.[st.c] ? st : nearestWalkable(st.c, st.r);
    const etW = GRID[et.r]?.[et.c] ? et : nearestWalkable(et.c, et.r);
    const path = aStar(stW.c, stW.r, etW.c, etW.r);

    if (path && path.length > 1) {
      // Convert tile waypoints to game coords, append exact destination
      v.sprite.path   = path.slice(1).map(t => tileToGame(t.c, t.r));
      v.sprite.path.push({ x: destX, y: destY });
      v.sprite.pathIdx = 0;
      v.sprite.targetX = v.sprite.path[0].x;
      v.sprite.targetY = v.sprite.path[0].y;
    } else {
      v.sprite.path    = null;
      v.sprite.targetX = destX;
      v.sprite.targetY = destY;
    }

    v.sprite.arrived  = false;
    v.sprite.looking  = false;
    v.sprite.idleMs   = 0;

    v.bubble.setText(event.tool || map.label);

    // Log to history
    v.sprite.history.push(`→ ${event.tool}`);
    if (v.sprite.history.length > 20) v.sprite.history.shift();
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
          // Reached current waypoint — advance path or declare arrival
          const path = v.sprite.path;
          if (path && v.sprite.pathIdx < path.length - 1) {
            v.sprite.pathIdx++;
            const wp = path[v.sprite.pathIdx];
            v.sprite.targetX = wp.x;
            v.sprite.targetY = wp.y;
          } else {
            v.sprite.arrived = true;
            v.sprite.path    = null;
            v.sprite.setVelocity(0, 0);
            if (v.sprite.anims.currentAnim?.key !== idle) v.sprite.play(idle);
          }
        }
      }

      // Labels always track the actual sprite position (physics may have shifted it)
      v.label.setPosition(v.sprite.x, v.sprite.y - 40);
      v.bubble.setPosition(v.sprite.x, v.sprite.y + 30);
    }

    // Chicken avoidance — flee from any dog within range
    const FLEE_R = 45;
    for (const chicken of this.chickens) {
      if (chicken._fleeing) continue;
      for (const dog of this.dogs) {
        const dx = chicken.x - dog.x;
        const dy = chicken.y - dog.y;
        if (dx * dx + dy * dy < FLEE_R * FLEE_R) {
          chicken._fleeing = true;
          this.tweens.killTweensOf(chicken);
          const angle = Math.atan2(dy, dx);
          const tx = Phaser.Math.Clamp(chicken.x + Math.cos(angle) * 90, 12, 788);
          const ty = Phaser.Math.Clamp(chicken.y + Math.sin(angle) * 90, 12, 488);
          chicken.setFlipX(tx > chicken.x);
          this.tweens.add({
            targets: chicken, x: tx, y: ty,
            duration: 450,
            ease: 'Quad.Out',
            onComplete: () => {
              this.time.delayedCall(400, () => {
                chicken._fleeing = false;
                chicken._wander();
              });
            },
          });
          break;
        }
      }
    }
  }

  // Real agent text replaces the bubble — always wins over the tool placeholder.
  handleText(ev) {
    const agentId = ev.agent || 'main';
    const v = this.villagers[agentId];
    if (!v) return;
    const clean   = ev.text.replace(/\s+/g, ' ').trim();
    const snippet = clean.length > 72 ? '...' + clean.slice(-69) : clean;
    v.bubble.setText(snippet);

    // Log to history
    const histLine = clean.length > 45 ? '"...' + clean.slice(-42) + '"' : `"${clean}"`;
    v.sprite.history.push(histLine);
    if (v.sprite.history.length > 20) v.sprite.history.shift();
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
