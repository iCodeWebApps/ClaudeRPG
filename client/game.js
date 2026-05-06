// ClaudeRPG — FF4-style village
// Assets: LPC Base Assets + LPC Terrains (CC-BY-SA 3.0, Stephen Challener / Lanea Zimmermann et al.)

// ── PATHFINDING ────────────────────────────────────────────────────────────
// 30×20 tile grid (50px/tile in 1536×1024 source). A* routes villagers
// through walkable tiles defined by the player.

const TILE_SIZE = 50, GRID_COLS = 30, GRID_ROWS = 20;
const SRC_W = 1536, SRC_H = 1024, GAME_W = 800, GAME_H = 500;

// Walkable column ranges per row [colStart, colEnd] inclusive
const NAV = [
  [[18,19],[27,29]],                              // row  0  (-20-26)
  [[14,29]],                                      // row  1  (+21)
  [[10,20],[27,29]],                              // row  2  (-22,23)
  [[9,11],[17,20],[22,25],[27,29]],               // row  3  (+27)
  [[8,10],[17,20],[22,29]],                       // row  4  (-11)
  [[6,9],[12,12],[14,15],[17,20],[22,29]],          // row  5  (+22-24 merged)
  [[3,8],[12,12],[14,15],[17,20],[22,29]],          // row  6  (+22-24 merged)
  [[1,8],[10,10],[12,12],[14,15],[17,20],[22,29]], // row  7  (-13 +10)
  [[1,3],[5,8],[10,12],[14,15],[20,20],[28,29]],  // row  8  (-13 -19 -22-27)
  [[1,1],[4,8],[10,15],[20,20],[28,29]],          // row  9  (-23-27)
  [[1,8],[12,15],[20,20],[28,29]],                // row 10  (-24-27)
  [[1,8],[12,15],[20,20],[22,29]],                // row 11  (+12,13)
  [[1,2],[6,8],[15,15],[17,17],[19,29]],           // row 12  (-16)
  [[0,4],[6,10],[15,15],[17,29]],                  // row 13  (-16)
  [[0,4],[6,10],[15,15],[17,20],[24,29]],          // row 14  (-12-14)
  [[0,4],[6,10],[15,15],[17,20]],                 // row 15  (-11 -14)
  [[0,4],[6,6],[9,20],[22,29]],                   // row 16  (+22-29)
  [[0,4],[6,6],[9,23],[29,29]],                   // row 17  (-24-28)
  [[0,4],[6,6],[9,20]],                           // row 18
  [[0,4],[6,20]],                                 // row 19  (-5)
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

const FISHING_ZONE  = { x: 550, y: 250, w: 250, h: 250 }; // bottom-right 250×250
const FISHING_SNAP  = { x: 700, y: 385 };                 // where the character stands to fish
const FISHING_OFFSETS = [0, -36, 36, -72, 72];           // x offsets for multiple fishers
const FISHING_CHARS = new Set(['character1', 'character2']);

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
let spriteIdx = 0;

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

    // Universal LPC characters — 64×64 frames, 26 cols wide (1664px sheet)
    this.load.spritesheet('character1', 'assets/character1.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('character2', 'assets/character2.png', { frameWidth: 64, frameHeight: 64 });

    // Fishing frames are 128×128 (rod extends right, casting pose goes tall)
    // Same PNG, different frame config: 13 cols × 31 rows
    this.load.spritesheet('character1-fishing', 'assets/character1.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('character2-fishing', 'assets/character2.png', { frameWidth: 128, frameHeight: 128 });

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
    // Fishing rod animations — character1 and character2 only
    // Sheet: 832px wide = 13 frames/row; fishing at rows 50-53
    // Row 53 (right-cast): frames 689-694  Row 51 (wait/hold): 663-665  Row 50 (bite/reel): 650-655
    for (const key of ['character1', 'character2']) {
      // Fishing uses 128×64 frames (13 cols × 62 rows), frame = row*13 + col
      // Rows 54-57 = cast (4 dirs), rows 58-61 = hold (4 dirs); right-facing = rows 57 and 61
      const fk = `${key}-fishing`;
      // 128×128 frames, 13 cols × 31 rows; fishing rows 27-30
      // Row 30 (right-facing cast): 30×13=390  Row 29 (down-hold): 29×13=377  Row 27 (up-reel): 27×13=351
      this.anims.create({ key: `${key}-fish-cast`, frames: this.anims.generateFrameNumbers(fk, { start: 390, end: 396 }), frameRate: 8, repeat: 0 });
      this.anims.create({ key: `${key}-fish-wait`, frames: this.anims.generateFrameNumbers(fk, { start: 390, end: 393 }), frameRate: 4, repeat: -1 });
      this.anims.create({ key: `${key}-fish-bite`, frames: this.anims.generateFrameNumbers(fk, { start: 351, end: 357 }), frameRate: 8, repeat: 0 });
    }

    // Universal LPC characters — 64×64 frames, 26 cols/row (1664px sheet)
    // Walk at rows 8-11: frame = row*26 + col
    for (const key of ['character1', 'character2']) {
      this.anims.create({ key: `${key}-up`,        frames: this.anims.generateFrameNumbers(key, { start: 208, end: 216 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-left`,       frames: this.anims.generateFrameNumbers(key, { start: 234, end: 242 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-down`,       frames: this.anims.generateFrameNumbers(key, { start: 260, end: 268 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-right`,      frames: this.anims.generateFrameNumbers(key, { start: 286, end: 294 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}-idle`,       frames: [{ key, frame: 260 }], frameRate: 1 });
      this.anims.create({ key: `${key}-look-left`,  frames: this.anims.generateFrameNumbers(key, { start: 234, end: 236 }), frameRate: 5, repeat: 0 });
      this.anims.create({ key: `${key}-look-right`, frames: this.anims.generateFrameNumbers(key, { start: 286, end: 288 }), frameRate: 5, repeat: 0 });
      this.anims.create({ key: `${key}-look-down`,  frames: this.anims.generateFrameNumbers(key, { start: 260, end: 262 }), frameRate: 5, repeat: 0 });
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
    this.fishingSlots = new Set();

    this.buildMap();
    this.buildDayNight();
    this.spawnChickens();
    this.spawnDoodle();
    this.spawnCattleDog();

    // Hourly chicken ritual
    this.time.addEvent({
      delay: 60 * 60 * 1000,
      loop: true,
      callback: this.startRitual,
      callbackScope: this,
    });

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

    // G key toggles navmesh grid overlay
    this.input.keyboard.on('keydown-G', () => this.toggleNavGrid());
    if (new URLSearchParams(window.location.search).has('grid')) this.toggleNavGrid();
  }

  toggleNavGrid() {
    if (this._navGrid) { this._navGrid.destroy(); this._navGrid = null; return; }

    const g = this.add.graphics().setDepth(50);
    this._navGrid = g;
    const sx = GAME_W / SRC_W, sy = GAME_H / SRC_H;
    const tw = TILE_SIZE * sx, th = TILE_SIZE * sy;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = c * tw, y = r * th;
        g.fillStyle(GRID[r][c] ? 0x00ff00 : 0xff2222, GRID[r][c] ? 0.18 : 0.35);
        g.fillRect(x, y, tw, th);
        g.lineStyle(1, 0xffffff, 0.25);
        g.strokeRect(x, y, tw, th);
      }
    }

    // Tile coordinate labels
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = c * tw + tw / 2, y = r * th + th / 2;
        this.add.text(x, y, `${c},${r}`, {
          fontSize: '5px', color: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(51).setData('navlabel', true);
      }
    }
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
      .setScale(0.045).setDepth(8);
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

  startRitual() {
    const CENTER        = { x: 195, y: 385 }; // Town Green
    const RADIUS        = 44;
    const STEPS_PER_ROT = 14;
    const ROTATIONS     = 2;
    const STEP_MS       = 260;

    // Stop normal behaviour — _fleeing blocks dog-avoidance logic too
    for (const chicken of this.chickens) {
      this.tweens.killTweensOf(chicken);
      chicken._fleeing = true;
    }

    this.chickens.forEach((chicken, i) => {
      const baseAngle = (i / this.chickens.length) * Math.PI * 2;
      const sx = CENTER.x + Math.cos(baseAngle) * RADIUS;
      const sy = CENTER.y + Math.sin(baseAngle) * RADIUS;

      // Gather to starting position
      this.tweens.add({
        targets: chicken, x: sx, y: sy,
        duration: 1400, ease: 'Quad.Out',
        onComplete: () => {
          // Peck once on arrival
          this.tweens.add({
            targets: chicken, y: chicken.y + 4, duration: 110,
            yoyo: true, repeat: 1,
            onComplete: () => {
              // Orbit for ROTATIONS full laps
              const totalSteps = ROTATIONS * STEPS_PER_ROT;
              let step = 0;

              const orbit = () => {
                step++;
                if (step > totalSteps) {
                  // Ritual complete — peck and scatter
                  this.tweens.add({
                    targets: chicken, y: chicken.y + 4, duration: 110,
                    yoyo: true, repeat: 2,
                    onComplete: () => {
                      chicken._fleeing = false;
                      chicken._wander();
                    },
                  });
                  return;
                }
                const angle = baseAngle + (step / STEPS_PER_ROT) * Math.PI * 2;
                const tx = CENTER.x + Math.cos(angle) * RADIUS;
                const ty = CENTER.y + Math.sin(angle) * RADIUS;
                chicken.setFlipX(tx > chicken.x);
                this.tweens.add({
                  targets: chicken, x: tx, y: ty,
                  duration: STEP_MS, ease: 'Linear',
                  onComplete: orbit,
                });
              };

              orbit();
            },
          });
        },
      });
    });
  }

  _stopFishing(sprite) {
    sprite._fishing = false;
    if (sprite._fishTween) { sprite._fishTween.remove(); sprite._fishTween = null; }
    if (sprite._fishTimer) { sprite._fishTimer.remove(); sprite._fishTimer = null; }
    if (sprite._fishingSlot !== undefined) {
      this.fishingSlots.delete(sprite._fishingSlot);
      sprite._fishingSlot = undefined;
    }
    if (sprite._bubbleRef) {
      const restore = sprite._preFishText
        ?? (sprite.history.length > 0 ? sprite.history[sprite.history.length - 1] : 'wandering...');
      sprite._bubbleRef.setText(restore);
    }
    sprite._preFishText = null;
    sprite.y = Math.round(sprite.y);
  }

  startFishing(v) {
    if (!v || !v.sprite._fishing) return;
    const key = v.cfg.key;
    v.bubble.setText('fishing...');
    v.sprite.play(`${key}-fish-cast`);
    v.sprite.once('animationcomplete', () => {
      if (v.sprite._fishing) this._fishWait(v);
    });
  }

  _fishWait(v) {
    if (!v.sprite._fishing) return;
    const key = v.cfg.key;
    v.sprite.play(`${key}-fish-wait`);
    v.bubble.setText('...🎣...');

    if (v.sprite._fishTween) v.sprite._fishTween.remove();
    v.sprite._fishTween = this.tweens.add({
      targets: v.sprite, y: v.sprite.y + 2,
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });

    v.sprite._fishTimer = this.time.delayedCall(
      Phaser.Math.Between(2500, 6000),
      () => {
        if (!v.sprite._fishing) return;
        if (v.sprite._fishTween) { v.sprite._fishTween.remove(); v.sprite._fishTween = null; }
        v.sprite.y = Math.round(v.sprite.y);
        if (Math.random() < 0.35) this._fishBite(v);
        else this.startFishing(v);
      }
    );
  }

  _fishBite(v) {
    if (!v.sprite._fishing) return;
    const key = v.cfg.key;
    v.bubble.setText('Got one! 🐟');
    v.sprite.play(`${key}-fish-bite`);
    v.sprite.once('animationcomplete', () => {
      if (v.sprite._fishing) this.startFishing(v);
    });
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
      { key: 'inn',      tx: 425, ty: 192, tw: 450, th: 460, clipTriW: 185, clipTriH: 114 },
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
      .setScale(0.72).setTint(cfg.tint).setDepth(5);
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
    sprite.history        = [];
    sprite._wasDragged    = false;
    sprite._fishing       = false;
    sprite._fishTween     = null;
    sprite._fishTimer     = null;
    sprite._fishingSlot   = undefined;
    sprite._preFishText   = null;
    sprite._idleWander    = false;
    sprite._idleWanderMs  = 0;
    sprite._idleWanderWait = Phaser.Math.Between(6000, 12000);
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

    sprite._bubbleRef = bubble;
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
      this._stopFishing(sprite);          // cancel fishing before drag starts
      sprite.body.setEnable(false);
      this.tweens.killTweensOf(sprite);
      sprite.setDepth(25);
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

      // Start fishing if dropped near the pond — only rod-carrying characters
      const canFish = FISHING_CHARS.has(this.villagers[agentId]?.cfg.key);
      const inZone  = sprite.x >= FISHING_ZONE.x && sprite.x <= FISHING_ZONE.x + FISHING_ZONE.w
                   && sprite.y >= FISHING_ZONE.y && sprite.y <= FISHING_ZONE.y + FISHING_ZONE.h;
      if (canFish && inZone) {
        this._stopFishing(sprite);
        const offset = FISHING_OFFSETS.find(o => !this.fishingSlots.has(o)) ?? 0;
        this.fishingSlots.add(offset);
        sprite._fishingSlot = offset;
        const sx = FISHING_SNAP.x + offset, sy = FISHING_SNAP.y;
        sprite.setPosition(sx, sy);
        sprite.body.reset(sx, sy);
        label.setPosition(sx, sy - 40);
        bubble.setPosition(sx, sy + 30);
        sprite.targetX = sx;
        sprite.targetY = sy;
        sprite._fishing     = true;
        sprite._preFishText = sprite._bubbleRef?.text ?? null;
        sprite.setFlipX(false);
        this.startFishing(this.villagers[agentId]);
      } else {
        this._stopFishing(sprite);
      }
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

    // Interrupt fishing and idle wander — agent has work to do
    this._stopFishing(v.sprite);
    v.sprite._idleWander   = false;
    v.sprite._idleWanderMs = 0;

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
    const SPEED      = 75;
    const IDLE_SPEED = 30;
    const ARRIVAL    = 20;
    const LOOKS      = ['look-left', 'look-right', 'look-down'];

    for (const v of Object.values(this.villagers)) {
      const idle = `${v.cfg.key}-idle`;

      if (v.sprite.arrived) {
        v.sprite.setVelocity(0, 0);

        if (v.sprite._fishing) {
          v.label.setPosition(v.sprite.x, v.sprite.y - 40);
          v.bubble.setPosition(v.sprite.x, v.sprite.y + 30);
          continue;
        }

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

        // Idle wander — occasional slow amble to a nearby tile
        if (!v.sprite.looking && !v.sprite._fishing) {
          v.sprite._idleWanderMs += delta;
          if (v.sprite._idleWanderMs >= v.sprite._idleWanderWait) {
            v.sprite._idleWanderMs  = 0;
            v.sprite._idleWanderWait = Phaser.Math.Between(6000, 12000);
            const ct = gameToTile(v.sprite.x, v.sprite.y);
            const picks = [];
            for (let dr = -3; dr <= 3; dr++)
              for (let dc = -3; dc <= 3; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = ct.r + dr, nc = ct.c + dc;
                if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && GRID[nr][nc])
                  picks.push({ c: nc, r: nr });
              }
            if (picks.length > 0) {
              const dest = picks[Math.floor(Math.random() * picks.length)];
              const path = aStar(ct.c, ct.r, dest.c, dest.r);
              if (path && path.length > 1) {
                v.sprite.path    = path.slice(1).map(t => tileToGame(t.c, t.r));
                v.sprite.pathIdx = 0;
                v.sprite.targetX = v.sprite.path[0].x;
                v.sprite.targetY = v.sprite.path[0].y;
              } else {
                const g = tileToGame(dest.c, dest.r);
                v.sprite.path    = null;
                v.sprite.targetX = g.x;
                v.sprite.targetY = g.y;
              }
              v.sprite._idleWander = true;
              v.sprite.arrived     = false;
              v.sprite.looking     = false;
              v.sprite.idleMs      = 0;
            }
          }
        }
      } else {
        const dx   = v.sprite.targetX - v.sprite.x;
        const dy   = v.sprite.targetY - v.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > ARRIVAL) {
          const spd = v.sprite._idleWander ? IDLE_SPEED : SPEED;
          v.sprite.setVelocity((dx / dist) * spd, (dy / dist) * spd);
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
            v.sprite.arrived     = true;
            v.sprite._idleWander = false;
            v.sprite.path        = null;
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
