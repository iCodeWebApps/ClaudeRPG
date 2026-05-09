// ClaudeRPG — FF4-style village
// Assets: LPC Base Assets + LPC Terrains (CC-BY-SA 3.0, Stephen Challener / Lanea Zimmermann et al.)

// ── PATHFINDING ────────────────────────────────────────────────────────────
// 30×20 tile grid (50px/tile in 1536×1024 source). A* routes villagers
// through walkable tiles defined by the player.

const TILE_SIZE = 50, GRID_COLS = 30, GRID_ROWS = 20;
const SRC_W = 1536, SRC_H = 1024, GAME_W = 800, GAME_H = 500;

// Walkable column ranges per row [colStart, colEnd] inclusive
const NAV = [
  [[18,19],[28,29]],                              // row  0  (-20-26 -27)
  [[14,19],[28,29]],                               // row  1  (+21 -20-27)
  [[10,20],[27,29]],                              // row  2  (-22,23)
  [[9,11],[18,20],[22,24],[26,29]],               // row  3  (+27 -17 -25 +26)
  [[8,10],[18,20],[22,24],[26,29]],               // row  4  (-11 -17 -25)
  [[6,9],[12,12],[14,15],[18,20],[22,29]],         // row  5  (+22-24 merged -17)
  [[3,8],[12,12],[14,15],[18,20],[22,29]],         // row  6  (+22-24 merged -17)
  [[1,8],[10,10],[12,12],[14,15],[18,20],[22,29]], // row  7  (-13 +10 -17)
  [[1,3],[5,8],[10,12],[14,14],[20,20],[28,29]],  // row  8  (-13 -19 -22-27 -15)
  [[1,8],[10,14],[20,20],[28,29]],                 // row  9  (-23-27 -15 +2,3)
  [[1,8],[12,15],[20,20],[28,29]],                 // row 10  (-24-27 +3)
  [[1,2],[5,8],[12,15],[20,20],[22,29]],           // row 11  (+12,13 -3-4)
  [[1,2],[6,8],[15,15],[17,17],[20,29]],           // row 12  (-16 -19)
  [[0,2],[6,9],[15,15],[17,29]],                   // row 13
  [[0,2],[6,10],[15,15],[17,20],[24,29]],            // row 14
  [[0,2],[6,10],[15,15],[17,20],[25,27]],           // row 15  (-11 -14 -3-4 +25-27)
  [[0,4],[6,6],[9,20],[22,29]],                   // row 16  (+22-29)
  [[0,4],[6,6],[9,20],[29,29]],                   // row 17  (-24-28 -21-23)
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

const FISHING_ZONE  = { x: 651, y: 366, w: 78, h: 49 };  // tiles col 25-27, row 15-16
const FISHING_SNAP  = { x: 690, y: 390 };                 // where the character stands to fish
const FISHING_OFFSETS = [0, -36, 36, -72, 72];           // x offsets for multiple fishers
const FISHING_CHARS = new Set(['character1', 'character2']); // only these have rod animations

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
    this._greetedPairs = new Set();
  }

  _txt(x, y, text, style) {
    return this.add.text(x, y, text, { ...style, resolution: window.devicePixelRatio || 2 });
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

    // Skeleton boss — 64×64 frames, 18 cols wide (1152px sheet)
    this.load.spritesheet('skeleton', 'assets/skeleton.png', { frameWidth: 64, frameHeight: 64 });

    // Fishing frames are 128×128 (rod extends right, casting pose goes tall)
    // Same PNG, different frame config: 13 cols × 31 rows
    this.load.spritesheet('character1-fishing', 'assets/character1.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('character2-fishing', 'assets/character2.png', { frameWidth: 128, frameHeight: 128 });

    // Village backgrounds — both pixel-perfect aligned (1950×1300)
    this.load.image('village',        'assets/village.png');         // with roofs
    this.load.image('village_noroofs','assets/village_noroofs.png'); // interiors visible

    // Chicken sprite (transparent background, 800×922)
    this.load.image('chicken', 'assets/chicken.png');
    this.load.image('egg', 'assets/egg.png');

    // Doodle dog sprites
    this.load.image('doodle',       'assets/doodle.png');
    this.load.image('doodle_step',  'assets/doodle_step.png');
    this.load.image('doodle_sleep', 'assets/doodle_sleep.png');

    // Cattle dog sprites
    this.load.image('cattledog',       'assets/cattledog.png');
    this.load.image('cattledog_step',  'assets/cattledog_step.png');
    this.load.image('cattledog_sleep', 'assets/cattledog_sleep.png');

    // Duck
    this.load.image('duck',      'assets/duck.png');
    this.load.image('duck_step', 'assets/duck_step.png');

    // Rain drop — 1×6 light-blue streak, generated without a file
    const rg = this.make.graphics({ x: 0, y: 0, add: false });
    rg.fillStyle(0xaaddff, 1);
    rg.fillRect(0, 0, 1, 6);
    rg.generateTexture('raindrop', 1, 6);
    rg.destroy();
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

    // Skeleton boss — 18 cols/row; walk rows 8-11 (9 frames each), death row 20 (6 frames)
    this.anims.create({ key: 'skeleton-up',    frames: this.anims.generateFrameNumbers('skeleton', { start: 144, end: 152 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'skeleton-left',  frames: this.anims.generateFrameNumbers('skeleton', { start: 162, end: 170 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'skeleton-down',  frames: this.anims.generateFrameNumbers('skeleton', { start: 180, end: 188 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'skeleton-right', frames: this.anims.generateFrameNumbers('skeleton', { start: 198, end: 206 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'skeleton-idle',  frames: [{ key: 'skeleton', frame: 180 }], frameRate: 1 });
    this.anims.create({ key: 'skeleton-die',   frames: this.anims.generateFrameNumbers('skeleton', { start: 360, end: 365 }), frameRate: 8, repeat: 0 });
    // Skeleton slash/attack — rows 12-15 (6 frames each, same direction order as walk)
    this.anims.create({ key: 'skeleton-slash-up',    frames: this.anims.generateFrameNumbers('skeleton', { start: 216, end: 221 }), frameRate: 12, repeat: 0 });
    this.anims.create({ key: 'skeleton-slash-left',  frames: this.anims.generateFrameNumbers('skeleton', { start: 234, end: 239 }), frameRate: 12, repeat: 0 });
    this.anims.create({ key: 'skeleton-slash-down',  frames: this.anims.generateFrameNumbers('skeleton', { start: 252, end: 257 }), frameRate: 12, repeat: 0 });
    this.anims.create({ key: 'skeleton-slash-right', frames: this.anims.generateFrameNumbers('skeleton', { start: 270, end: 275 }), frameRate: 12, repeat: 0 });

    // ── Physics group — collider added once, handles all villager separation
    this.villagerGroup = this.physics.add.group();
    this.physics.add.collider(this.villagerGroup, this.villagerGroup);

    this.chickens = [];
    this.dogs = [];
    this.eggs = [];
    this.fishingSlots = new Set();

    this.buildMap();
    this.buildDayNight();
    this.buildRain();
    this.spawnChickens();
    this.spawnDoodle();
    this.spawnCattleDog();
    this.spawnDuck();

    // Villager proximity greetings — checked every 2 seconds
    this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: this._checkGreetings,
      callbackScope: this,
    });

    // ── Selection state ───────────────────────────────────────────────
    this._selEntity      = null;
    this._selEntityType  = null;
    this._selEntityExtra = {};
    this._moveMode       = false;
    this._hovTarget      = null;
    this._activeCombats  = new Map(); // attacker → combat state object
    this._skeleton          = null;
    this._skeletonFighters  = new Map(); // chicken → { phase, nextHitMs }
    this._skeletonNextHitMs = 0;
    window._rp = this;

    // Hover targeting — red glow on rival when a chicken is selected
    this.input.on('pointermove', (ptr, hits) => {
      if (!this._selEntity || this._selEntityType !== 'chicken') {
        if (this._hovTarget) { this._removeHovGlow(this._hovTarget); this._hovTarget = null; }
        return;
      }
      // While skeleton is alive, chickens ignore each other
      if (this._skeleton && !this._skeleton._ko) {
        if (this._hovTarget) { this._removeHovGlow(this._hovTarget); this._hovTarget = null; }
        return;
      }
      const target = hits.find(o => this.chickens.includes(o) && o !== this._selEntity && !o._ko) || null;
      if (target !== this._hovTarget) {
        if (this._hovTarget) this._removeHovGlow(this._hovTarget);
        this._hovTarget = target;
        if (this._hovTarget) this._applyHovGlow(this._hovTarget);
      }
    });

    // Left-click: combat if hovering a rival, otherwise move selected entity
    this.input.on('pointerdown', (ptr, hits) => {
      if (ptr.rightButtonDown()) return;
      // Chicken combat — hover target takes priority over map click
      if (this._selEntityType === 'chicken' && this._hovTarget) {
        const attacker = this._selEntity;
        const defender = this._hovTarget;
        this._clearSelection();
        this._initChickenCombat(attacker, defender);
        return;
      }
      if (hits.length > 0 || !this._selEntity || !this._moveMode) return;
      const tile = gameToTile(ptr.x, ptr.y);
      const safe = GRID[tile.r]?.[tile.c] ? tile : nearestWalkable(tile.c, tile.r);
      const dest = tileToGame(safe.c, safe.r);
      this._selEntity._walkTo(dest.x, dest.y);
      this._spawnClickPing(dest.x, dest.y);
      this._clearSelection();
    });

    // Right-click anywhere → deselect
    this.input.on('pointerdown', (ptr) => {
      if (ptr.rightButtonDown()) this._clearSelection();
    });

    this.connectWebSocket();

    this._scheduleRandomEvent();

    // G=navmesh, R=rain, D=dance ritual, S=summon skeleton boss
    this.input.keyboard.on('keydown-G', () => this.toggleNavGrid());
    this.input.keyboard.on('keydown-R', () => this._startRain());
    this.input.keyboard.on('keydown-D', () => this.startDanceRitual());
    this.input.keyboard.on('keydown-S', () => this._spawnSkeleton());
    if (new URLSearchParams(window.location.search).has('grid')) {
      this.toggleNavGrid();
      history.replaceState(null, '', '/');
    }
  }

  toggleNavGrid() {
    if (this._navGrid) { this._navGrid.destroy(true); this._navGrid = null; return; }

    const container = this.add.container(0, 0).setDepth(50);
    this._navGrid = container;

    const g = this.add.graphics();
    container.add(g);

    const sx = GAME_W / SRC_W, sy = GAME_H / SRC_H;
    const tw = TILE_SIZE * sx, th = TILE_SIZE * sy;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = c * tw, y = r * th;
        g.fillStyle(GRID[r][c] ? 0x00ff00 : 0xff2222, GRID[r][c] ? 0.18 : 0.35);
        g.fillRect(x, y, tw, th);
        g.lineStyle(1, 0xffffff, 0.25);
        g.strokeRect(x, y, tw, th);

        const label = this._txt(x + tw / 2, y + th / 2, `${c},${r}`, {
          fontSize: '8px', color: '#ffffff', fontFamily: 'Arial',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5);
        container.add(label);
      }
    }
  }

  // ── DAY / NIGHT ──────────────────────────────────────────────────────────
  buildDayNight() {
    // Overlay dims the whole scene (depth 13 — above all porch/roof layers, below labels)
    this.dayOverlay = this.add.rectangle(400, 250, 800, 500, 0x000000, 0).setDepth(13);


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

  // ── RAIN ─────────────────────────────────────────────────────────────────
  buildRain() {
    // Subtle blue-grey tint during rain (depth 14 — just above day overlay at 13)
    this._rainOverlay = this.add.rectangle(400, 250, 800, 500, 0x112244, 0).setDepth(14);

    // Particle emitter — streaks fall from above the screen at a slight angle
    this._rainEmitter = this.add.particles(0, 0, 'raindrop', {
      x: { min: -80, max: 860 },
      y: { min: -10, max: -4 },
      speedX: 38,
      speedY: { min: 300, max: 460 },
      lifespan: 1400,
      quantity: 5,
      frequency: 18,
      alpha: { start: 0.55, end: 0.08 },
      emitting: false,
    }).setDepth(15);

  }

  _startRain() {
    this._rainEmitter.start();
    this.tweens.add({ targets: this._rainOverlay, alpha: 0.12, duration: 1800, ease: 'Sine.In' });
    const duration = Phaser.Math.Between(20 * 1000, 50 * 1000);
    this.time.delayedCall(duration, () => this._stopRain());
  }

  _stopRain() {
    this._rainEmitter.stop();
    this.tweens.add({ targets: this._rainOverlay, alpha: 0, duration: 2500, ease: 'Sine.Out' });
  }


  // ── SKELETON BOSS ────────────────────────────────────────────────────────
  _spawnSkeleton() {
    if (this._skeleton && !this._skeleton._ko) return; // already alive

    // Interrupt dance ritual
    for (const chicken of this.chickens) {
      if (chicken._inRitual || chicken._fleeing) {
        this.tweens.killTweensOf(chicken);
        chicken._fleeing  = false;
        chicken._inRitual = false;
      }
    }

    // Interrupt chicken vs chicken combat
    for (const c of [...this._activeCombats.values()]) {
      this._activeCombats.delete(c.attacker);
      c.attacker._inCombat = false;
      c.defender._inCombat = false;
    }

    // Spawn sprite between tiles 18,0 and 19,0 — top north path
    const spA = tileToGame(18, 0), spB = tileToGame(19, 0);
    const spawnX = (spA.x + spB.x) / 2, spawnY = spA.y;

    const sk = this.add.sprite(spawnX, spawnY, 'skeleton')
      .setScale(0.82).setDepth(6);
    sk.play('skeleton-down');
    sk._ko        = false;
    sk._hp        = 380;
    sk._maxHp     = 380;
    sk._attacking = false;
    sk._taunted   = false;

    const HP_W = 80, HP_H = 4;
    sk._hpBg   = this.add.rectangle(spawnX, spawnY - 28, HP_W, HP_H, 0x222222, 0.88).setDepth(15);
    sk._hpFill = this.add.rectangle(spawnX - HP_W / 2, spawnY - 28, HP_W, HP_H, 0xff4444, 0.95)
      .setOrigin(0, 0.5).setDepth(16);
    sk._nameLabel = this._txt(spawnX, spawnY - 40, '☠ SKELETON', {
      fontSize: '10px', color: '#ff6666', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(15);

    this._skeleton        = sk;
    this._skeletonNextHitMs = 0;

    // Announce
    const ann = this._txt(400, 90, '☠  SKELETON APPROACHES!', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setDepth(30).setAlpha(0);
    this.tweens.add({
      targets: ann, alpha: 1, y: 75, duration: 350, ease: 'Back.Out',
      onComplete: () => this.time.delayedCall(1600, () =>
        this.tweens.add({ targets: ann, alpha: 0, duration: 500, onComplete: () => ann.destroy() })),
    });

    // Send all non-KO chickens to fight
    for (const chicken of this.chickens) {
      if (chicken._ko) continue;
      this.tweens.killTweensOf(chicken);
      chicken._inCombat  = false;
      chicken._pinned    = false;
      chicken._walkToken = {};
      this._initiateChickenVsSkeleton(chicken);
    }
  }

  _initiateChickenVsSkeleton(chicken) {
    if (chicken._ko || !this._skeleton || this._skeleton._ko) return;
    this._skeleton._taunted = false; // reset so taunt fires again if chickens die again
    this.tweens.killTweensOf(chicken);
    chicken._inCombat = true;
    chicken._pinned   = true;
    this._skeletonFighters.set(chicken, {
      phase: 'approach',
      nextHitMs: 0,
    });
  }

  _skeletonDamage(amount) {
    const sk = this._skeleton;
    if (!sk || sk._ko) return;
    sk._hp = Math.max(0, sk._hp - amount);
    this._updateSkeletonHpBar();
    this._showDamageNumber(sk.x, sk.y, amount);
    if (sk._hp <= 0) this._skeletonKO();
  }

  _updateSkeletonHpBar() {
    const sk = this._skeleton;
    if (!sk) return;
    const pct   = Math.max(0, sk._hp / sk._maxHp);
    const HP_W  = 80;
    const color = pct > 0.5 ? 0xff4444 : pct > 0.25 ? 0xff8800 : 0xffcc00;
    sk._hpFill.setSize(HP_W * pct, 4).setFillStyle(color, 0.95);
  }

  _skeletonKO() {
    const sk = this._skeleton;
    if (!sk || sk._ko) return;
    sk._ko = true;
    this.tweens.killTweensOf(sk);

    // Release all chicken fighters
    for (const [chicken] of [...this._skeletonFighters.entries()]) {
      chicken._inCombat = false;
      chicken._pinned   = false;
      chicken._resume?.();
    }
    this._skeletonFighters.clear();

    // Death animation, then tilt-fade
    sk.play('skeleton-die');
    sk.once('animationcomplete', () => {
      this.tweens.add({
        targets: sk, angle: 90, alpha: 0, duration: 700, ease: 'Quad.Out',
        onComplete: () => {
          if (sk._hpBg) { sk._hpBg.destroy(); sk._hpFill.destroy(); sk._nameLabel.destroy(); }
          sk.destroy();
          this._skeleton = null;
        },
      });
    });

    const def = this._txt(sk.x, sk.y - 28, '☠ DEFEATED!', {
      fontSize: '14px', color: '#ffcc00', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(30);
    this.tweens.add({
      targets: def, y: def.y - 50, alpha: 0,
      duration: 2200, delay: 300, ease: 'Quad.Out',
      onComplete: () => def.destroy(),
    });
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
      // Snap to nearest walkable tile so chickens never start in a blocked area
      const ht = gameToTile(home.x, home.y);
      const snapT = GRID[ht.r]?.[ht.c] ? ht : nearestWalkable(ht.c, ht.r);
      const snapG = tileToGame(snapT.c, snapT.r);
      home.x = snapG.x; home.y = snapG.y;

      const chicken = this.add.image(home.x, home.y, 'chicken')
        .setScale(0.042).setDepth(5);

      const wander = () => {
        if (chicken._pinned || chicken._fleeing || chicken._inCombat) return;
        if (this._skeleton && !this._skeleton._ko) { this._initiateChickenVsSkeleton(chicken); return; }
        // Pick a walkable tile, preferring ones away from dogs
        const ct = gameToTile(chicken.x, chicken.y);
        const allPicks = [];
        for (let dr = -2; dr <= 2; dr++)
          for (let dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = ct.r + dr, nc = ct.c + dc;
            if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && GRID[nr][nc])
              allPicks.push({ c: nc, r: nr });
          }
        if (allPicks.length === 0) { this.time.delayedCall(400, wander); return; }

        const safePicks = allPicks.filter(t => {
          const g = tileToGame(t.c, t.r);
          const nearDog = (this.dogs || []).some(d => {
            const ddx = g.x - d.x, ddy = g.y - d.y;
            return ddx*ddx + ddy*ddy < 80*80;
          });
          const nearChicken = this.chickens.some(other => {
            if (other === chicken || other._inCombat) return false;
            const ddx = g.x - other.x, ddy = g.y - other.y;
            return ddx*ddx + ddy*ddy < 22*22; // keep at least 1 tile apart
          });
          return !nearDog && !nearChicken;
        });
        const picks = safePicks.length > 0 ? safePicks : allPicks;
        const t = picks[Math.floor(Math.random() * picks.length)];
        const g = tileToGame(t.c, t.r);
        const tx = g.x + (Math.random()-0.5)*12;
        const ty = g.y + (Math.random()-0.5)*8;

        // A* path to destination
        const stW = GRID[ct.r]?.[ct.c] ? ct : nearestWalkable(ct.c, ct.r);
        const path = aStar(stW.c, stW.r, t.c, t.r);
        const waypoints = path && path.length > 1
          ? [...path.slice(1).map(w => tileToGame(w.c, w.r)), { x: tx, y: ty }]
          : [{ x: tx, y: ty }];

        let i = 0;
        const step = () => {
          if (chicken._pinned || chicken._fleeing || chicken._inCombat) return;
          if (i >= waypoints.length) { peck(); return; }
          const wp = waypoints[i++];
          const dur = Math.max(80, Math.hypot(wp.x - chicken.x, wp.y - chicken.y) / 50 * 1000);
          chicken.setFlipX(wp.x > chicken.x);
          this.tweens.add({ targets: chicken, x: wp.x, y: wp.y, duration: dur, ease: 'Linear', onComplete: step });
        };
        step();
      };

      const peck = () => {
        if (chicken._pinned || chicken._inCombat) return;
        this.tweens.add({
          targets: chicken,
          y: chicken.y + 5,
          duration: 110,
          yoyo: true,
          repeat: Phaser.Math.Between(0, 2),
          onComplete: () => {
            if (chicken._pinned || chicken._inCombat) return;
            if (Math.random() < 0.04) this.layEgg(chicken.x, chicken.y);
            this.time.delayedCall(Phaser.Math.Between(300, 1800), wander);
          },
        });
      };

      chicken._fleeing  = false;
      chicken._pinned   = false;
      chicken._inCombat = false;
      chicken._ko       = false;
      chicken._koTimer  = null;
      chicken._hp       = 100;
      chicken._maxHp    = 100;
      chicken._wander   = wander;
      this.chickens.push(chicken);

      // ── Health bar ─────────────────────────────────────────────────
      const HP_W = 24, HP_H = 3;
      chicken._hpBg   = this.add.rectangle(home.x, home.y - 14, HP_W, HP_H, 0x222222, 0.85).setDepth(8).setVisible(false);
      chicken._hpFill = this.add.rectangle(home.x - HP_W / 2, home.y - 14, HP_W, HP_H, 0x44dd66, 0.95)
        .setOrigin(0, 0.5).setDepth(9).setVisible(false);

      chicken._resume = () => { chicken._pinned = false; wander(); };
      chicken._walkToken = null; // cancellation token — changes on each new walk
      chicken._walkTo = (tx, ty) => {
        this.tweens.killTweensOf(chicken);
        // Keep _pinned = true throughout the walk to block wander.
        // The step uses a token (not _pinned) for its own cancellation.
        chicken._pinned = true;
        const myToken = {}; chicken._walkToken = myToken;
        const ct  = gameToTile(chicken.x, chicken.y);
        const et  = gameToTile(tx, ty);
        const stW = GRID[ct.r]?.[ct.c] ? ct : nearestWalkable(ct.c, ct.r);
        const etW = GRID[et.r]?.[et.c] ? et : nearestWalkable(et.c, et.r);
        const path = aStar(stW.c, stW.r, etW.c, etW.r);
        const wps  = path && path.length > 1
          ? path.slice(1).map(w => tileToGame(w.c, w.r))
          : [tileToGame(etW.c, etW.r)];
        let i = 0;
        const step = () => {
          // Stop if this walk was superseded by a newer one, or combat started
          if (chicken._walkToken !== myToken || chicken._inCombat) return;
          if (i >= wps.length) { this._renderPane(); return; }
          const wp  = wps[i++];
          const dur = Math.max(80, Math.hypot(wp.x - chicken.x, wp.y - chicken.y) / 50 * 1000);
          chicken.setFlipX(wp.x > chicken.x);
          this.tweens.add({ targets: chicken, x: wp.x, y: wp.y, duration: dur, ease: 'Linear', onComplete: step });
        };
        step();
      };

      chicken.setInteractive();
      chicken.on('pointerdown', () => {
        // If this chicken is the combat hover target, don't re-select it —
        // the global pointerdown handler will initiate combat using the
        // current _selEntity as the attacker. Re-selecting here would
        // overwrite _selEntity to this chicken, making attacker === defender.
        if (this._hovTarget === chicken) return;
        this._selectEntity('chicken', chicken);
      });

      // Stagger start so they don't all sync up
      this.time.delayedCall(Phaser.Math.Between(0, 2500), wander);
    }
  }

  spawnDoodle() {
    const home = { x: 200, y: 400 }; // Town Green, near the picnic table

    const doodle = this.add.image(home.x, home.y, 'doodle')
      .setScale(0.075).setDepth(5);
    this.dogs.push(doodle);

    const walkToPath = (tx, ty, onDone) => {
      if (doodle._walkTimer) doodle._walkTimer.remove();
      let stepFrame = false;
      doodle._walkTimer = this.time.addEvent({
        delay: 180, loop: true,
        callback: () => { stepFrame = !stepFrame; doodle.setTexture(stepFrame ? 'doodle_step' : 'doodle'); },
      });
      const st = gameToTile(doodle.x, doodle.y);
      const et = gameToTile(tx, ty);
      const stW = GRID[st.r]?.[st.c] ? st : nearestWalkable(st.c, st.r);
      const etW = GRID[et.r]?.[et.c] ? et : nearestWalkable(et.c, et.r);
      const path = aStar(stW.c, stW.r, etW.c, etW.r);
      const waypoints = path && path.length > 1
        ? [...path.slice(1).map(t => tileToGame(t.c, t.r)), { x: tx, y: ty }]
        : [{ x: tx, y: ty }];
      let i = 0;
      const step = () => {
        if (i >= waypoints.length) { onDone(); return; }
        const wp = waypoints[i++];
        const dur = Math.max(80, Math.hypot(wp.x - doodle.x, wp.y - doodle.y) / 60 * 1000);
        doodle.setFlipX(wp.x > doodle.x);
        this.tweens.add({ targets: doodle, x: wp.x, y: wp.y, duration: dur, ease: 'Linear', onComplete: step });
      };
      step();
    };

    const wander = () => {
      if (doodle._pinned) return;
      // Head toward a nearby egg if one is close enough
      const nearEgg = this.eggs?.find(e => {
        const dx = doodle.x - e.x, dy = doodle.y - e.y;
        return dx * dx + dy * dy < 320 * 320;
      });

      if (nearEgg) {
        walkToPath(nearEgg.x, nearEgg.y, () => eatEgg(nearEgg));
        return;
      }

      const dest = this.pickWalkableTile(doodle.x, doodle.y, 8);
      if (!dest) { this.time.delayedCall(400, wander); return; }
      walkToPath(dest.x, dest.y, sniff);
    };

    const sleep = () => {
      doodle.setTexture('doodle_sleep');
      doodle._sleepTween = this.tweens.add({
        targets: doodle,
        scaleX: 0.075 * 1.08, scaleY: 0.075 * 1.08,
        duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
      doodle._sleepTimer = this.time.delayedCall(Phaser.Math.Between(8000, 20000), () => {
        doodle._sleepTimer = null;
        if (doodle._sleepTween) { doodle._sleepTween.remove(); doodle._sleepTween = null; }
        doodle.setScale(0.075);
        doodle.setTexture('doodle');
        this.time.delayedCall(600, wander);
      });
    };

    const wakeUp = () => {
      if (doodle._sleepTimer) { doodle._sleepTimer.remove(); doodle._sleepTimer = null; }
      if (doodle._sleepTween) { doodle._sleepTween.remove(); doodle._sleepTween = null; }
      doodle.setScale(0.075);
      doodle.setTexture('doodle');
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
          if (Math.random() < 0.25) {
            sleep();
          } else {
            this.time.delayedCall(Phaser.Math.Between(400, 2200), wander);
          }
        },
      });
    };

    const eatEgg = (egg) => {
      if (doodle._walkTimer) { doodle._walkTimer.remove(); doodle._walkTimer = null; }
      doodle.setTexture('doodle');
      const idx = this.eggs.indexOf(egg);
      if (idx === -1) { wander(); return; }
      this.tweens.add({
        targets: doodle, y: doodle.y + 4, duration: 100, yoyo: true, repeat: 3,
        onComplete: () => {
          egg.sprite.destroy();
          this.eggs.splice(idx, 1);
          doodle._eggsEaten = (doodle._eggsEaten || 0) + 1;
          localStorage.setItem('clauderpg_eggsEaten', doodle._eggsEaten);
          fetch('/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eggsEaten: doodle._eggsEaten }) }).catch(() => {});
          this.time.delayedCall(300, wander);
        },
      });
    };

    doodle._eggsEaten = parseInt(localStorage.getItem('clauderpg_eggsEaten') || '0', 10);
    doodle._pinned = false;
    doodle._resume = () => {
      wakeUp();
      doodle._pinned = false;
      wander();
    };
    doodle._walkTo = (tx, ty) => {
      if (doodle._walkTimer)  { doodle._walkTimer.remove();  doodle._walkTimer  = null; }
      if (doodle._sleepTimer) { doodle._sleepTimer.remove(); doodle._sleepTimer = null; }
      if (doodle._sleepTween) { doodle._sleepTween.remove(); doodle._sleepTween = null; }
      this.tweens.killTweensOf(doodle);
      doodle.setTexture('doodle').setScale(0.075);
      doodle._pinned = false;
      walkToPath(tx, ty, () => { doodle._pinned = true; this._renderPane(); });
    };
    doodle.setInteractive();
    doodle.on('pointerdown', () => this._selectEntity('doodle', doodle));

    this.time.delayedCall(Phaser.Math.Between(0, 1500), wander);
  }

  spawnCattleDog() {
    const home = { x: 90, y: 355 }; // Workshop south yard

    const dog = this.add.image(home.x, home.y, 'cattledog')
      .setScale(0.045).setDepth(5);
    this.dogs.push(dog);

    const walkToPath = (tx, ty, onDone) => {
      if (dog._walkTimer) dog._walkTimer.remove();
      let stepFrame = false;
      dog._walkTimer = this.time.addEvent({
        delay: 180, loop: true,
        callback: () => { stepFrame = !stepFrame; dog.setTexture(stepFrame ? 'cattledog_step' : 'cattledog'); },
      });
      const st = gameToTile(dog.x, dog.y);
      const et = gameToTile(tx, ty);
      const stW = GRID[st.r]?.[st.c] ? st : nearestWalkable(st.c, st.r);
      const etW = GRID[et.r]?.[et.c] ? et : nearestWalkable(et.c, et.r);
      const path = aStar(stW.c, stW.r, etW.c, etW.r);
      const waypoints = path && path.length > 1
        ? [...path.slice(1).map(t => tileToGame(t.c, t.r)), { x: tx, y: ty }]
        : [{ x: tx, y: ty }];
      let i = 0;
      const step = () => {
        if (i >= waypoints.length) { onDone(); return; }
        const wp = waypoints[i++];
        const dur = Math.max(80, Math.hypot(wp.x - dog.x, wp.y - dog.y) / 60 * 1000);
        if (wp.x !== dog.x) dog.setFlipX(wp.x > dog.x);
        this.tweens.add({ targets: dog, x: wp.x, y: wp.y, duration: dur, ease: 'Linear', onComplete: step });
      };
      step();
    };

    const wander = () => {
      if (dog._pinned) return;
      const dest = this.pickWalkableTile(dog.x, dog.y, 8);
      if (!dest) { this.time.delayedCall(400, wander); return; }
      walkToPath(dest.x, dest.y, sniff);
    };

    const sleep = () => {
      dog.setTexture('cattledog_sleep');
      dog._sleepTween = this.tweens.add({
        targets: dog,
        scaleX: 0.045 * 1.08, scaleY: 0.045 * 1.08,
        duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
      dog._sleepTimer = this.time.delayedCall(Phaser.Math.Between(8000, 20000), () => {
        dog._sleepTimer = null;
        if (dog._sleepTween) { dog._sleepTween.remove(); dog._sleepTween = null; }
        dog.setScale(0.045);
        dog.setTexture('cattledog');
        this.time.delayedCall(600, wander);
      });
    };

    const wakeUp = () => {
      if (dog._sleepTimer) { dog._sleepTimer.remove(); dog._sleepTimer = null; }
      if (dog._sleepTween) { dog._sleepTween.remove(); dog._sleepTween = null; }
      dog.setScale(0.045);
      dog.setTexture('cattledog');
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
          if (Math.random() < 0.25) {
            sleep();
          } else {
            this.time.delayedCall(Phaser.Math.Between(400, 2200), wander);
          }
        },
      });
    };

    dog._pinned = false;
    dog._resume = () => {
      wakeUp();
      dog._pinned = false;
      wander();
    };
    dog._walkTo = (tx, ty) => {
      if (dog._walkTimer)  { dog._walkTimer.remove();  dog._walkTimer  = null; }
      if (dog._sleepTimer) { dog._sleepTimer.remove(); dog._sleepTimer = null; }
      if (dog._sleepTween) { dog._sleepTween.remove(); dog._sleepTween = null; }
      this.tweens.killTweensOf(dog);
      dog.setTexture('cattledog').setScale(0.045);
      dog._pinned = false;
      walkToPath(tx, ty, () => { dog._pinned = true; this._renderPane(); });
    };
    dog.setInteractive();
    dog.on('pointerdown', () => this._selectEntity('cattledog', dog));

    this.time.delayedCall(Phaser.Math.Between(0, 1500), wander);
  }

  // ── DUCK ─────────────────────────────────────────────────────────────────
  spawnDuck() {
    const SCALE    = 0.033;
    const SPEED    = 48;   // px/s — slower than dogs, waddly
    const FOLLOW_R = 70;   // px — chase threshold

    const duck = this.add.image(320, 340, 'duck').setScale(SCALE).setDepth(5);
    duck._sizeStep = parseInt(localStorage.getItem('clauderpg_duck_size') || '0', 10);
    if (duck._sizeStep) duck.setScale(SCALE * (1 + 0.5 * duck._sizeStep));
    if (this.renderer.gl) {
      this.renderer.pipelines.addPostPipeline('OutlinePostFX', OutlinePostFX);
      duck.setPostPipeline('OutlinePostFX');
    }

    const walkToPath = (tx, ty, onDone) => {
      if (duck._walkTimer) { duck._walkTimer.remove(); duck._walkTimer = null; }
      this.tweens.killTweensOf(duck);
      let stepFrame = false;
      duck._walkTimer = this.time.addEvent({
        delay: 110, loop: true,
        callback: () => { stepFrame = !stepFrame; duck.setTexture(stepFrame ? 'duck_step' : 'duck'); },
      });
      const st  = gameToTile(duck.x, duck.y);
      const et  = gameToTile(tx, ty);
      const stW = GRID[st.r]?.[st.c] ? st : nearestWalkable(st.c, st.r);
      const etW = GRID[et.r]?.[et.c] ? et : nearestWalkable(et.c, et.r);
      const path = aStar(stW.c, stW.r, etW.c, etW.r);
      const waypoints = path && path.length > 1
        ? [...path.slice(1).map(t => tileToGame(t.c, t.r)), { x: tx, y: ty }]
        : [{ x: tx, y: ty }];
      let i = 0;
      const step = () => {
        if (i >= waypoints.length) {
          if (duck._walkTimer) { duck._walkTimer.remove(); duck._walkTimer = null; }
          duck.setTexture('duck');
          onDone();
          return;
        }
        const wp  = waypoints[i++];
        const dur = Math.max(80, Math.hypot(wp.x - duck.x, wp.y - duck.y) / SPEED * 1000);
        duck.setFlipX(wp.x < duck.x);
        this.tweens.add({ targets: duck, x: wp.x, y: wp.y, duration: dur, ease: 'Linear', onComplete: step });
      };
      step();
    };

    const idle = () => {
      if (duck._pinned) return;
      this.tweens.add({
        targets: duck, y: duck.y + 3, duration: 480,
        yoyo: true, repeat: 1,
        onComplete: () => this.time.delayedCall(Phaser.Math.Between(600, 2000), follow),
      });
    };

    const follow = () => {
      if (duck._pinned) return;

      // Drop target if it disconnected
      if (duck._targetId && !this.villagers[duck._targetId]) duck._targetId = null;

      // Upgrade to character2 if one is available
      if (!duck._targetId || this.villagers[duck._targetId]?.cfg.key !== 'character2') {
        const c2 = Object.entries(this.villagers).find(([, v]) => v.cfg.key === 'character2');
        if (c2) duck._targetId = c2[0];
      }

      // Fall back to any agent
      if (!duck._targetId) {
        const entries = Object.entries(this.villagers);
        if (entries.length) duck._targetId = entries[Math.floor(Math.random() * entries.length)][0];
      }

      const target = duck._targetId ? this.villagers[duck._targetId] : null;

      if (!target) {
        const dest = this.pickWalkableTile(duck.x, duck.y, 8);
        if (!dest) { this.time.delayedCall(1500, follow); return; }
        walkToPath(dest.x, dest.y, () => this.time.delayedCall(Phaser.Math.Between(2000, 4000), follow));
        return;
      }

      const dx = target.sprite.x - duck.x;
      const dy = target.sprite.y - duck.y;
      const dist = Math.hypot(dx, dy);

      if (dist > FOLLOW_R) {
        // Stop ~45px away rather than walking into the agent
        const norm = 1 / dist;
        const tx = Phaser.Math.Clamp(target.sprite.x - dx * norm * 45, 12, 788);
        const ty = Phaser.Math.Clamp(target.sprite.y - dy * norm * 20, 12, 488);
        walkToPath(tx, ty, idle);
      } else {
        idle();
      }
    };

    duck._targetId = null;
    duck._pinned   = false;
    duck._resume   = () => { duck._pinned = false; follow(); };
    duck._walkTo   = (tx, ty) => {
      duck._pinned = false;
      walkToPath(tx, ty, () => { duck._pinned = true; this._renderPane(); });
    };

    duck.setInteractive();
    duck.on('pointerdown', () => this._selectEntity('duck', duck));

    this.time.delayedCall(800, follow);
  }

  _duckHonk(duck) {
    if (duck._honkText) { duck._honkText.destroy(); duck._honkText = null; }
    const honkScale = 1 + 0.5 * (duck._sizeStep || 0);
    duck._honkText = this._txt(duck.x, duck.y - 18 * honkScale, 'Honk!', {
      fontSize: `${Math.round(11 * honkScale)}px`, color: '#ffffff', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: Math.round(3 * honkScale),
      backgroundColor: '#00000055', padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 1).setDepth(20);
    this.tweens.add({
      targets: duck._honkText, alpha: 0, duration: 1200, delay: 900,
      onComplete: () => { if (duck._honkText) { duck._honkText.destroy(); duck._honkText = null; } },
    });
  }

  // ── DANCE RITUAL ─────────────────────────────────────────────────────────
  startDanceRitual() {
    if (this.chickens.some(c => c._inRitual)) return;

    const CENTER        = tileToGame(17, 17);
    const RADIUS        = 38;
    const STEPS_PER_ROT = 10;
    const ROTATIONS     = 3;
    const RISE_MS       = 95;
    const LAND_MS       = 155;

    for (const chicken of this.chickens) {
      if (chicken._inCombat) continue;
      this.tweens.killTweensOf(chicken);
      chicken._fleeing  = true;
      chicken._inRitual = true;
    }

    let done = 0;

    this.chickens.forEach((chicken, i) => {
      const baseAngle = (i / this.chickens.length) * Math.PI * 2;
      const sx = CENTER.x + Math.cos(baseAngle) * RADIUS;
      const sy = CENTER.y + Math.sin(baseAngle) * RADIUS;

      // Gather to circle
      this.tweens.add({
        targets: chicken, x: sx, y: sy,
        duration: 1100, ease: 'Quad.Out',
        onComplete: () => {
              const totalSteps = ROTATIONS * STEPS_PER_ROT;
              let step = 0;

              const dance = () => {
                step++;
                if (step > totalSteps) {
                  // Triple peck then scatter
                  this.tweens.add({
                    targets: chicken, y: chicken.y + 5, duration: 90,
                    yoyo: true, repeat: 3,
                    onComplete: () => {
                      chicken._fleeing  = false;
                      chicken._inRitual = false;
                      chicken._wander();
                      done++;
                    },
                  });
                  return;
                }
                const angle = baseAngle + (step / STEPS_PER_ROT) * Math.PI * 2;
                const tx = CENTER.x + Math.cos(angle) * RADIUS;
                const ty = CENTER.y + Math.sin(angle) * RADIUS;
                chicken.setFlipX(tx > chicken.x);
                // Hop: rise to midpoint then bounce-land at orbit position
                this.tweens.add({
                  targets: chicken, x: tx, y: ty - 9,
                  duration: RISE_MS, ease: 'Quad.Out',
                  onComplete: () => {
                    this.tweens.add({
                      targets: chicken, y: ty,
                      duration: LAND_MS, ease: 'Bounce.Out',
                      onComplete: dance,
                    });
                  },
                });
              };

              dance();
        },
      });
    });
  }

  _interruptRitual() {
    for (const chicken of this.chickens) {
      if (!chicken._inRitual) continue;
      this.tweens.killTweensOf(chicken);
      chicken._fleeing  = false;
      chicken._inRitual = false;
      chicken._wander();
    }
  }

  // ── RANDOM EVENT SYSTEM ──────────────────────────────────────────────────
  // Add new entries here to extend the event pool. Each fires on its own
  // internal guard (skeleton won't double-spawn, rain won't stack, etc.).
  _fireRandomEvent() {
    const events = [
      () => this.startDanceRitual(),
      () => this._startRain(),
      () => this._spawnSkeleton(),
    ];
    events[Phaser.Math.Between(0, events.length - 1)]();
    this._scheduleRandomEvent();
  }

  _scheduleRandomEvent() {
    this.time.delayedCall(30 * 60 * 1000, () => this._fireRandomEvent());
  }

  pickWalkableTile(x, y, radius) {
    const ct = gameToTile(x, y);
    const picks = [];
    for (let dr = -radius; dr <= radius; dr++)
      for (let dc = -radius; dc <= radius; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = ct.r + dr, nc = ct.c + dc;
        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && GRID[nr][nc])
          picks.push({ c: nc, r: nr });
      }
    if (picks.length === 0) return null;
    const t = picks[Math.floor(Math.random() * picks.length)];
    const g = tileToGame(t.c, t.r);
    return { x: g.x + (Math.random() - 0.5) * 12, y: g.y + (Math.random() - 0.5) * 8 };
  }

  layEgg(x, y) {
    const ey = y + 4;
    const sprite = this.add.image(x, ey, 'egg').setScale(0.022).setDepth(5);
    const egg = { x, y: ey, sprite };
    this.eggs.push(egg);
    this.time.delayedCall(60000, () => {
      const idx = this.eggs.indexOf(egg);
      if (idx !== -1) { sprite.destroy(); this.eggs.splice(idx, 1); }
    });
  }

  _stopFishing(sprite) {
    sprite._fishing = false;
    if (sprite._fishTween)   { sprite._fishTween.remove();   sprite._fishTween   = null; }
    if (sprite._fishTimer)   { sprite._fishTimer.remove();   sprite._fishTimer   = null; }
    if (sprite._fishTimeout) { sprite._fishTimeout.remove(); sprite._fishTimeout = null; }
    if (sprite._fishingSlot !== undefined) {
      this.fishingSlots.delete(sprite._fishingSlot);
      sprite._fishingSlot = undefined;
    }
    if (sprite._bubbleRef) {
      const restore = sprite._preFishText
        ?? (sprite.history.length > 0 ? sprite.history[sprite.history.length - 1] : 'wandering...');
      const v = Object.values(this.villagers).find(vi => vi.sprite === sprite);
      if (v) this._setBubble(v, restore);
      else sprite._bubbleRef.setText(restore);
    }
    sprite._preFishText = null;
    sprite.y = Math.round(sprite.y);
  }

  startFishing(v) {
    if (!v || !v.sprite._fishing) return;
    const key = v.cfg.key;
    this._setBubble(v, 'fishing...', { persist: true });
    if (FISHING_CHARS.has(key)) {
      v.sprite.play(`${key}-fish-cast`);
      v.sprite.once('animationcomplete', () => {
        if (v.sprite._fishing) this._fishWait(v);
      });
    } else {
      v.sprite.play(`${key}-idle`);
      this._fishWait(v);
    }
  }

  _fishWait(v) {
    if (!v.sprite._fishing) return;
    const key = v.cfg.key;
    if (FISHING_CHARS.has(key)) v.sprite.play(`${key}-fish-wait`);
    this._setBubble(v, '...🎣...', { persist: true });

    if (v.sprite._fishTween) v.sprite._fishTween.remove();
    const snapY = v.sprite._fishSnapY ?? v.sprite.y;
    v.sprite.y = snapY;
    v.sprite._fishTween = this.tweens.add({
      targets: v.sprite, y: snapY + 2,
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });

    // Idle timeout — stop fishing after 4 minutes and walk away
    if (!v.sprite._fishTimeout) {
      v.sprite._fishTimeout = this.time.delayedCall(4 * 60 * 1000, () => {
        if (!v.sprite._fishing) return;
        this._stopFishing(v.sprite);
        // Walk away from the pond so update()'s auto-fish block doesn't immediately re-trigger
        const ct   = gameToTile(v.sprite.x, v.sprite.y);
        const away = tileToGame(Math.max(0, ct.c - 5), ct.r);
        v.sprite.path        = null;
        v.sprite.targetX     = away.x;
        v.sprite.targetY     = away.y;
        v.sprite.arrived     = false;
        v.sprite._idleWander = true;
      });
    }

    v.sprite._fishTimer = this.time.delayedCall(
      Phaser.Math.Between(2500, 6000),
      () => {
        if (!v.sprite._fishing) return;
        if (v.sprite._fishTween) { v.sprite._fishTween.remove(); v.sprite._fishTween = null; }
        v.sprite.y = snapY;
        if (Math.random() < 0.35) this._fishBite(v);
        else this.startFishing(v);
      }
    );
  }

  _fishBite(v) {
    if (!v.sprite._fishing) return;
    const key = v.cfg.key;
    this._setBubble(v, 'Got one! 🐟', { delay: 2500 });
    if (FISHING_CHARS.has(key)) {
      v.sprite.play(`${key}-fish-bite`);
      v.sprite.once('animationcomplete', () => {
        if (v.sprite._fishing) this.startFishing(v);
      });
    } else {
      this.time.delayedCall(600, () => { if (v.sprite._fishing) this.startFishing(v); });
    }
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
      { key: 'inn',      tx: 425, ty: 192, tw: 450, th: 505, clipTriW: 185, clipTriH: 114, clipBotTriW: 180, clipBotTriH: 130 },
      { key: 'lodge',    tx: 1070, ty: 30, tw: 305, th: 380 },
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

      // Geometry mask — clips top-left and/or bottom-left triangles
      const hasTopClip = def.clipTriW    && def.clipTriH;
      const hasBotClip = def.clipBotTriW && def.clipBotTriH;
      if (hasTopClip || hasBotClip) {
        const mask = this.make.graphics({ add: false });
        mask.fillStyle(0xffffff);
        mask.beginPath();
        if (hasTopClip) {
          mask.moveTo(gx,                       gy + def.clipTriH    * sy);
          mask.lineTo(gx + def.clipTriW * sx,   gy);
        } else {
          mask.moveTo(gx, gy);
        }
        mask.lineTo(gx + gw, gy);
        mask.lineTo(gx + gw, gy + gh);
        if (hasBotClip) {
          mask.lineTo(gx + def.clipBotTriW * sx, gy + gh);
          mask.lineTo(gx,                        gy + gh - def.clipBotTriH * sy);
        } else {
          mask.lineTo(gx, gy + gh);
        }
        mask.closePath();
        mask.fillPath();
        img.setMask(mask.createGeometryMask());
      }

      this.roofSprites[def.key] = { img, gx, gy, gw, gh };
    }

    // Lodge porch — base (12), interior cap (12.5), roof cap (12.8)
    // All below the day overlay at depth 13 so night tints them correctly
    this.add.image(0, 0, 'village')
      .setOrigin(0).setScale(sx, sy)
      .setCrop(28 * TILE_SIZE - 40, 2 * TILE_SIZE, 2 * TILE_SIZE + 30, 6 * TILE_SIZE)
      .setDepth(12);
    this.add.image(0, 0, 'village_noroofs')
      .setOrigin(0).setScale(sx, sy)
      .setCrop(28 * TILE_SIZE - 40, 2 * TILE_SIZE, 2 * TILE_SIZE + 30, 6 * TILE_SIZE)
      .setDepth(12.5);
    const porchRoof = this.add.image(0, 0, 'village')
      .setOrigin(0).setScale(sx, sy)
      .setCrop(28 * TILE_SIZE - 40, 2 * TILE_SIZE, 2 * TILE_SIZE + 30, 6 * TILE_SIZE)
      .setDepth(12.8);
    const lodge = this.roofSprites['lodge'];
    this.roofSprites['porch_roof'] = { img: porchRoof, gx: lodge.gx, gy: lodge.gy, gw: lodge.gw, gh: lodge.gh };

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
    const label  = this._txt(pos.x, pos.y - 40, name, {
      fontSize: '10px', color: '#ffe082', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000055', padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 1).setDepth(15);
    const bubble = this._txt(pos.x, pos.y + 30, 'wandering...', {
      fontSize: '10px', color: '#aaffaa', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000055', padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 0).setDepth(15);

    sprite._bubbleRef = bubble;

    // Context window meter — hidden until first context_update arrives
    const CTX_W   = 44;
    const meterBg = this.add.rectangle(pos.x, pos.y - 35, CTX_W, 3, 0x222222, 0.75)
      .setDepth(15).setVisible(false);
    const meterFill = this.add.rectangle(pos.x - CTX_W / 2, pos.y - 35, 0, 3, 0x44dd66, 0.9)
      .setOrigin(0, 0.5).setDepth(15).setVisible(false);

    this.villagers[agentId] = { sprite, label, bubble, meterBg, meterFill, cfg };

    sprite._pinned   = false;
    sprite._onArrive = null;
    sprite._resume   = () => { sprite._pinned = false; };
    sprite._walkTo   = (tx, ty) => {
      this._stopFishing(sprite);
      sprite._idleWander = false;
      const st  = gameToTile(sprite.x, sprite.y);
      const et  = gameToTile(tx, ty);
      const stW = GRID[st.r]?.[st.c] ? st : nearestWalkable(st.c, st.r);
      const etW = GRID[et.r]?.[et.c] ? et : nearestWalkable(et.c, et.r);
      const path = aStar(stW.c, stW.r, etW.c, etW.r);
      if (path && path.length > 1) {
        sprite.path    = path.slice(1).map(t => tileToGame(t.c, t.r));
        sprite.path.push({ x: tx, y: ty });
        sprite.pathIdx = 0;
        sprite.targetX = sprite.path[0].x;
        sprite.targetY = sprite.path[0].y;
      } else {
        sprite.path    = null;
        sprite.targetX = tx;
        sprite.targetY = ty;
      }
      sprite.arrived   = false;
      sprite.looking   = false;
      sprite._greeting = false;
      sprite.idleMs    = 0;
      sprite._pinned   = true;
      sprite._onArrive = () => this._renderPane();
    };

    sprite.setInteractive();
    sprite.on('pointerdown', () => this._selectEntity('villager', agentId, sprite));

    return this.villagers[agentId];
  }

  // ── GREETINGS ─────────────────────────────────────────────────────────────
  _checkGreetings() {
    const idle = Object.entries(this.villagers).filter(
      ([, v]) => v.sprite.arrived && !v.sprite._fishing && !v.sprite._greeting && !v.sprite.looking
    );
    for (let i = 0; i < idle.length; i++) {
      for (let j = i + 1; j < idle.length; j++) {
        const [idA, vA] = idle[i];
        const [idB, vB] = idle[j];
        const dx = vA.sprite.x - vB.sprite.x;
        const dy = vA.sprite.y - vB.sprite.y;
        if (dx * dx + dy * dy > 65 * 65) continue;
        const pairKey = [idA, idB].sort().join('|');
        if (this._greetedPairs.has(pairKey)) continue;
        this._greetedPairs.add(pairKey);
        this.time.delayedCall(60000, () => this._greetedPairs.delete(pairKey));
        this._greet(vA, vB);
      }
    }
  }

  _greet(vA, vB) {
    const LINES = ['Hey!', 'Hi!', 'Sup?', 'Hello!', 'Howdy!', 'Hey there!', 'Nice day!', 'Greetings!', 'Oh hi!', 'Heya!'];
    const pick  = () => LINES[Phaser.Math.Between(0, LINES.length - 1)];
    [[vA, vB], [vB, vA]].forEach(([v, other]) => {
      const prevText = v.bubble.text;
      const idle     = `${v.cfg.key}-idle`;
      v.sprite._greeting = true;
      v.sprite.looking   = true;
      const lookAnim = other.sprite.x >= v.sprite.x
        ? `${v.cfg.key}-look-right`
        : `${v.cfg.key}-look-left`;
      v.sprite.play(lookAnim);
      v.sprite.once('animationcomplete', () => {
        v.sprite.looking = false;
        if (v.sprite.arrived) v.sprite.play(idle);
      });
      this._setBubble(v, pick(), { delay: 3000 });
      this.time.delayedCall(3000, () => {
        v.sprite._greeting = false;
        if (!v.sprite._fishing) this._setBubble(v, prevText);
      });
    });
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

    v.sprite.arrived   = false;
    v.sprite.looking   = false;
    v.sprite._greeting = false;
    v.sprite.idleMs    = 0;

    this._setBubble(v, event.tool || map.label);

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
          v.meterBg.setPosition(v.sprite.x, v.sprite.y - 35);
          v.meterFill.setPosition(v.sprite.x - 22, v.sprite.y - 35);
          continue;
        }

        // Auto-fish if arrived in the fishing zone
        {
          const inZone = v.sprite.x >= FISHING_ZONE.x && v.sprite.x <= FISHING_ZONE.x + FISHING_ZONE.w
                      && v.sprite.y >= FISHING_ZONE.y && v.sprite.y <= FISHING_ZONE.y + FISHING_ZONE.h;
          if (inZone) {
            const offset = FISHING_OFFSETS.find(o => !this.fishingSlots.has(o)) ?? 0;
            this.fishingSlots.add(offset);
            v.sprite._fishingSlot = offset;
            const sx = FISHING_SNAP.x + offset, sy = FISHING_SNAP.y;
            v.sprite.setPosition(sx, sy);
            v.sprite.body.reset(sx, sy);
            v.label.setPosition(sx, sy - 40);
            v.bubble.setPosition(sx, sy + 30);
            v.meterBg.setPosition(sx, sy - 35);
            v.meterFill.setPosition(sx - 22, sy - 35);
            v.sprite.targetX    = sx;
            v.sprite.targetY    = sy;
            v.sprite._fishing   = true;
            v.sprite._fishSnapY = sy;
            v.sprite._preFishText = v.sprite._bubbleRef?.text ?? null;
            v.sprite.setFlipX(false);
            this.startFishing(v);
            continue;
          }
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
        if (!v.sprite._pinned && !v.sprite.looking && !v.sprite._fishing) {
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
            if (v.sprite._onArrive) { v.sprite._onArrive(); v.sprite._onArrive = null; }
          }
        }
      }

      // Labels always track the actual sprite position (physics may have shifted it)
      v.label.setPosition(v.sprite.x, v.sprite.y - 40);
      v.bubble.setPosition(v.sprite.x, v.sprite.y + 30);
      v.meterBg.setPosition(v.sprite.x, v.sprite.y - 35);
      v.meterFill.setPosition(v.sprite.x - 22, v.sprite.y - 35);
    }

    // ── Active chicken combat (state machine, no closures/timers) ────────────
    const now   = this.time.now;
    const COMBAT_SPEED = 65; // px/s approach speed
    for (const c of [...this._activeCombats.values()]) {
      const { attacker: a, defender: d } = c;
      if (a._ko || d._ko) { this._endActiveCombat(c); continue; }

      if (c.phase === 'approach') {
        this.tweens.killTweensOf(a);
        const dist = Math.hypot(a.x - d.x, a.y - d.y);
        if (dist <= 20) {
          c.phase = 'fight';
          c.nextHitMs = now + 400;
          // Do NOT reset defenderTurn here — preserve whose turn it is.
          // It is initialised false in _initChickenCombat and alternates
          // naturally through the fight; resetting it on every re-engage
          // would permanently skip the defender's turn.
        } else {
          // Target: stop ~20 px short of defender so they don't fully overlap
          const _dd = Math.hypot(d.x - a.x, d.y - a.y);
          const _stop = Math.max(0, _dd - 20) / (_dd || 1);
          let tx = a.x + (d.x - a.x) * _stop + (d.x - a.x) * (20 / (_dd || 1));
          let ty = a.y + (d.y - a.y) * _stop + (d.y - a.y) * (20 / (_dd || 1));
          if (c.wpIdx < c.wps.length) {
            const wp = c.wps[c.wpIdx];
            if (Math.hypot(wp.x - a.x, wp.y - a.y) < 5) c.wpIdx++;
            else { tx = wp.x; ty = wp.y; }
          }
          const dx   = tx - a.x, dy = ty - a.y;
          const step = COMBAT_SPEED * (delta / 1000);
          const d2   = Math.hypot(dx, dy);
          if (d2 > 0) {
            a.x += (dx / d2) * step;
            a.y += (dy / d2) * step;
            a.setFlipX(dx > 0);
          }
        }
      } else if (c.phase === 'fight' && now >= c.nextHitMs) {
        if (!c.defenderTurn) {
          a.setFlipX(d.x > a.x);
          this.tweens.add({ targets: a, y: a.y + 7, duration: 110, yoyo: true });
          this._chickenDamage(d, Phaser.Math.Between(15, 25));
          if (d._ko) { this._endActiveCombat(c); continue; }
          c.defenderTurn = true;
          c.nextHitMs    = now + 550;
        } else {
          d.setFlipX(a.x > d.x);
          this.tweens.add({ targets: d, y: d.y + 7, duration: 110, yoyo: true });
          this._chickenDamage(a, Phaser.Math.Between(10, 20));
          if (a._ko) { this._endActiveCombat(c); continue; }
          c.defenderTurn = false;
          c.nextHitMs    = now + 900;
        }
      }
    }

    // Chicken HP bar positions
    for (const c of this.chickens) {
      if (c._hpBg) {
        c._hpBg.setPosition(c.x, c.y - 14);
        c._hpFill.setPosition(c.x - 12, c.y - 14);
      }
    }

    // ── Skeleton boss combat ───────────────────────────────────────────────────
    if (this._skeleton) {
      const sk = this._skeleton;

      // Track HP bar and label with sprite
      if (sk._hpBg) {
        sk._hpBg.setPosition(sk.x, sk.y - 28);
        sk._hpFill.setPosition(sk.x - 40, sk.y - 28);
        sk._nameLabel.setPosition(sk.x, sk.y - 40);
      }

      if (!sk._ko) {
        // Walk toward nearest non-KO chicken
        const alive = this.chickens.filter(c => !c._ko);
        if (alive.length > 0) {
          alive.sort((a, b) => Math.hypot(sk.x - a.x, sk.y - a.y) - Math.hypot(sk.x - b.x, sk.y - b.y));
          const nearest = alive[0];
          const sdx = nearest.x - sk.x, sdy = nearest.y - sk.y;
          const sdist = Math.hypot(sdx, sdy);
          if (sdist > 40) {
            const sstep = 32 * (delta / 1000);
            sk.x += (sdx / sdist) * sstep;
            sk.y += (sdy / sdist) * sstep;
            const sdir = Math.abs(sdx) > Math.abs(sdy) ? (sdx > 0 ? 'right' : 'left') : (sdy > 0 ? 'down' : 'up');
            if (!sk._attacking && sk.anims?.currentAnim?.key !== `skeleton-${sdir}`) sk.play(`skeleton-${sdir}`);
          } else {
            if (!sk._attacking && sk.anims?.currentAnim?.key !== 'skeleton-idle') sk.play('skeleton-idle');
          }
        } else {
          // No alive chickens — idle and taunt once
          if (!sk._attacking && sk.anims?.currentAnim?.key !== 'skeleton-idle') sk.play('skeleton-idle');
          if (!sk._taunted) {
            sk._taunted = true;
            const taunt = this._txt(sk.x, sk.y - 44, '☠ VICTORIOUS!', {
              fontSize: '11px', color: '#ffcc00', fontFamily: 'Arial', fontStyle: 'bold',
              stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5, 1).setDepth(30);
            this.tweens.add({
              targets: taunt, y: taunt.y - 28, alpha: 0,
              duration: 2000, delay: 600, ease: 'Quad.Out',
              onComplete: () => taunt.destroy(),
            });
          }
        }

        // Skeleton attacks one nearby chicken on its own timer
        if (now >= this._skeletonNextHitMs) {
          let target = null, closestDist = Infinity;
          for (const chicken of this.chickens) {
            if (chicken._ko) continue;
            const cd = Math.hypot(sk.x - chicken.x, sk.y - chicken.y);
            if (cd < 50 && cd < closestDist) { target = chicken; closestDist = cd; }
          }
          if (target) {
            const adx = target.x - sk.x, ady = target.y - sk.y;
            const adir = Math.abs(adx) > Math.abs(ady) ? (adx > 0 ? 'right' : 'left') : (ady > 0 ? 'down' : 'up');
            sk._attacking = true;
            sk.play(`skeleton-slash-${adir}`);
            sk.once('animationcomplete', () => { sk._attacking = false; });
            this._chickenDamage(target, Phaser.Math.Between(48, 62));
            this._skeletonNextHitMs = now + 950;
          }
        }
      }

      // Each chicken fighter approaches and attacks the skeleton
      for (const [chicken, c] of [...this._skeletonFighters.entries()]) {
        if (chicken._ko) {
          this._skeletonFighters.delete(chicken);
          chicken._inCombat = false;
          continue;
        }
        if (sk._ko) {
          this._skeletonFighters.delete(chicken);
          chicken._inCombat = false;
          chicken._pinned   = false;
          chicken._resume?.();
          continue;
        }

        const fdist = Math.hypot(chicken.x - sk.x, chicken.y - sk.y);

        if (c.phase === 'approach') {
          this.tweens.killTweensOf(chicken); // tweens run after update() and would override position writes
          if (fdist <= 28) {
            c.phase = 'fight';
            c.nextHitMs = now + Phaser.Math.Between(200, 800);
          } else {
            const fdx = sk.x - chicken.x, fdy = sk.y - chicken.y;
            const fstep = 65 * (delta / 1000);
            const fd2 = Math.hypot(fdx, fdy);
            if (fd2 > 0) {
              chicken.x += (fdx / fd2) * fstep;
              chicken.y += (fdy / fd2) * fstep;
              chicken.setFlipX(fdx > 0);
            }
          }
        } else if (c.phase === 'fight') {
          if (fdist > 38) {
            c.phase = 'approach'; // skeleton drifted away — re-close
          } else if (now >= c.nextHitMs) {
            chicken.setFlipX(sk.x > chicken.x);
            this.tweens.add({ targets: chicken, y: chicken.y + 7, duration: 110, yoyo: true });
            this._skeletonDamage(Phaser.Math.Between(22, 30));
            if (!sk._ko) c.nextHitMs = now + Phaser.Math.Between(1000, 1500);
          }
        }
      }
    }

    // ── Creature separation nudge ─────────────────────────────────────────
    // Push overlapping chickens and dogs apart each frame. KO'd chickens are
    // excluded so they can pile up naturally at a fight scene.
    const creatures = [...this.chickens, ...this.dogs];
    const SEP = 20;
    for (let i = 0; i < creatures.length; i++) {
      for (let j = i + 1; j < creatures.length; j++) {
        const a = creatures[i], b = creatures[j];
        if (a._ko || b._ko) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > 0 && dist2 < SEP * SEP) {
          const dist = Math.sqrt(dist2);
          const push = (SEP - dist) * 0.5;
          const nx = dx / dist, ny = dy / dist;
          a.x -= nx * push;  a.y -= ny * push;
          b.x += nx * push;  b.y += ny * push;
        }
      }
    }

  }

  // Set bubble text with a fade-out after `delay` ms (persist=true = no fade).
  _setBubble(v, text, { persist = false, delay = 5000 } = {}) {
    if (v.bubble._fadeTimer) { v.bubble._fadeTimer.remove(); v.bubble._fadeTimer = null; }
    this.tweens.killTweensOf(v.bubble);
    v.bubble.setAlpha(1).setText(text);
    if (!persist) {
      v.bubble._fadeTimer = this.time.delayedCall(delay, () => {
        this.tweens.add({ targets: v.bubble, alpha: 0.25, duration: 1500, ease: 'Quad.In' });
      });
    }
  }

  // Update the per-villager context window fill bar.
  _updateContextMeter(v, pct) {
    const CTX_W = 44;
    const color = pct < 0.5 ? 0x44dd66 : pct < 0.8 ? 0xffcc00 : 0xff4444;
    v.meterBg.setVisible(true);
    v.meterFill.setVisible(pct > 0);
    v.meterFill.setSize(CTX_W * pct, 3).setFillStyle(color, 0.9);
  }

  // Real agent text replaces the bubble — always wins over the tool placeholder.
  handleText(ev) {
    const agentId = ev.agent || 'main';
    const v = this.villagers[agentId];
    if (!v) return;
    const clean   = ev.text.replace(/\s+/g, ' ').trim();
    const snippet = clean.length > 72 ? '...' + clean.slice(-69) : clean;
    this._setBubble(v, snippet, { delay: 8000 });

    // Log to history
    const histLine = clean.length > 45 ? '"...' + clean.slice(-42) + '"' : `"${clean}"`;
    v.sprite.history.push(histLine);
    if (v.sprite.history.length > 20) v.sprite.history.shift();
  }

  // ── ACTION PANE ──────────────────────────────────────────────────────────
  _selectEntity(type, idOrObj, gameObj) {
    let obj, extra = {};
    if (type === 'villager') {
      extra = { agentId: idOrObj };
      obj   = gameObj || this.villagers[idOrObj]?.sprite;
    } else {
      obj = idOrObj;
    }
    if (!obj) return;
    if (this._selEntity && this._selEntity !== obj) this._removeSelGlow(this._selEntity);
    this._selEntity      = obj;
    this._selEntityType  = type;
    this._selEntityExtra = extra;
    this._moveMode       = true;
    this._applySelGlow(obj);
    this._renderPane();
  }

  _clearSelection() {
    if (this._selEntity) this._removeSelGlow(this._selEntity);
    if (this._hovTarget) { this._removeHovGlow(this._hovTarget); this._hovTarget = null; }
    this._selEntity      = null;
    this._selEntityType  = null;
    this._selEntityExtra = {};
    this._moveMode       = false;
    document.getElementById('action-pane').classList.remove('open');
  }

  _spawnClickPing(x, y) {
    const g = this.add.graphics().setDepth(20);
    const proxy = { r: 4, a: 1 };
    this.tweens.add({
      targets: proxy,
      r: 20,
      a: 0,
      duration: 450,
      ease: 'Quad.Out',
      onUpdate: () => {
        g.clear();
        g.lineStyle(2, 0xffcc44, proxy.a);
        g.strokeCircle(x, y, proxy.r);
        g.fillStyle(0xffcc44, proxy.a * 0.35);
        g.fillCircle(x, y, proxy.r * 0.35);
      },
      onComplete: () => g.destroy(),
    });
  }

  // ── COMBAT ───────────────────────────────────────────────────────────────
  _applyHovGlow(obj) {
    if (!this.renderer.gl || !obj.postFX) return;
    if (obj._hovGlow) return;
    obj._hovGlow = obj.postFX.addGlow(0xff3333, 5, 0, false);
  }

  _removeHovGlow(obj) {
    if (!obj?._hovGlow) return;
    obj.postFX?.remove(obj._hovGlow);
    obj._hovGlow = null;
  }

  _initChickenCombat(attacker, defender) {
    if (this._skeleton && !this._skeleton._ko) return; // skeleton takes combat priority
    if (attacker === defender) return; // same chicken — click landed on hover target, re-selecting it
    if (attacker._ko || defender._ko || attacker._inCombat || defender._inCombat) return;
    attacker._inCombat = defender._inCombat = true;
    attacker._pinned   = defender._pinned   = true;
    attacker._walkToken = null; // cancel any in-progress player-directed walk
    this.tweens.killTweensOf(attacker);
    this.tweens.killTweensOf(defender);

    // Compute A* path to defender's tile once — update() steps through it each frame
    const ct  = gameToTile(attacker.x, attacker.y);
    const stW = GRID[ct.r]?.[ct.c] ? ct : nearestWalkable(ct.c, ct.r);
    const etT = gameToTile(defender.x, defender.y);
    const etW = GRID[etT.r]?.[etT.c] ? etT : nearestWalkable(etT.c, etT.r);
    const path = aStar(stW.c, stW.r, etW.c, etW.r);
    const wps  = path && path.length > 1
      ? path.slice(1).map(t => tileToGame(t.c, t.r))
      : [];

    this._activeCombats.set(attacker, {
      attacker, defender,
      wps, wpIdx: 0,
      phase: 'approach',
      defenderTurn: false,
      nextHitMs: 0,
    });
  }

  _endActiveCombat(combat) {
    this._activeCombats.delete(combat.attacker);
    combat.attacker._inCombat = combat.defender._inCombat = false;
    if (!combat.attacker._ko) { combat.attacker._pinned = false; combat.attacker._resume?.(); this._startChickenRegen(combat.attacker); }
    if (!combat.defender._ko) { combat.defender._pinned = false; combat.defender._resume?.(); this._startChickenRegen(combat.defender); }
  }

  // A*-pathfinding walk to a specific tile.
  _chickenDamage(chicken, amount) {
    if (chicken._ko) return;
    chicken._hp = Math.max(0, chicken._hp - amount);
    this._updateChickenHpBar(chicken);
    this._showDamageNumber(chicken.x, chicken.y, amount);
    if (chicken._hp <= 0) this._chickenKO(chicken);
  }

  _updateChickenHpBar(chicken) {
    const pct  = Math.max(0, chicken._hp / chicken._maxHp);
    const full = pct >= 1 && !chicken._ko;
    chicken._hpBg.setVisible(!full);
    chicken._hpFill.setVisible(!full);
    if (!full) {
      const color = chicken._ko ? 0x666666 : pct > 0.5 ? 0x44dd66 : pct > 0.25 ? 0xffcc00 : 0xff4444;
      chicken._hpFill.setSize(24 * pct, 3).setFillStyle(color, 0.95);
    }
  }

  _chickenKO(chicken) {
    chicken._ko     = true;
    chicken._pinned = true;
    this.tweens.killTweensOf(chicken);
    chicken.setAngle(90).setTint(0x999999);
    this._updateChickenHpBar(chicken);

    const ko = this._txt(chicken.x, chicken.y - 18, 'KO!', {
      fontSize: '11px', color: '#ff4444', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(25);
    this.tweens.add({
      targets: ko, alpha: 0, y: ko.y - 18, duration: 1200, delay: 1200,
      onComplete: () => ko.destroy(),
    });

    this._startChickenRegen(chicken);
  }

  // Heal a chicken back to full over ~60 s. Works for both KO'd chickens
  // (starting from 0) and walking-wounded survivors (starting from partial HP).
  // Clears KO state and resumes wandering once full HP is reached.
  _startChickenRegen(chicken) {
    if (chicken._hp >= chicken._maxHp) return;
    if (chicken._koTimer) { chicken._koTimer.remove(); chicken._koTimer = null; }
    const TICK_MS   = 2000;
    const hpPerTick = chicken._maxHp / 30;
    const tick = () => {
      chicken._hp = Math.min(chicken._maxHp, Math.round(chicken._hp + hpPerTick));
      this._updateChickenHpBar(chicken);
      if (chicken._hp >= chicken._maxHp) {
        chicken._koTimer = null;
        if (chicken._ko) {
          chicken._ko     = false;
          chicken._pinned = false;
          chicken.setAngle(0).clearTint();
          this._updateChickenHpBar(chicken);
          chicken._resume?.();
        }
      } else {
        chicken._koTimer = this.time.delayedCall(TICK_MS, tick);
      }
    };
    chicken._koTimer = this.time.delayedCall(TICK_MS, tick);
  }

  _showDamageNumber(x, y, amount) {
    const txt = this._txt(x, y - 8, `-${amount}`, {
      fontSize: '12px', color: '#ff4444', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(25);
    this.tweens.add({
      targets: txt, y: y - 36, alpha: 0,
      duration: 850, ease: 'Quad.Out',
      onComplete: () => txt.destroy(),
    });
  }

  _applySelGlow(obj) {
    if (!this.renderer.gl || !obj.postFX) return;
    if (obj._selGlow) return;
    obj._selGlow = obj.postFX.addGlow(0xffcc44, 6, 0, false);
  }

  _removeSelGlow(obj) {
    if (!obj?._selGlow) return;
    obj.postFX?.remove(obj._selGlow);
    obj._selGlow = null;
  }

  _resumeSelected() {
    if (!this._selEntity) return;
    this._selEntity._resume?.();
    this._renderPane();
  }

  _growDuck() {
    const duck = this._selEntity;
    if (!duck) return;
    const SCALE = 0.033;
    duck._sizeStep = duck._sizeStep >= 6 ? 0 : duck._sizeStep + 1;
    localStorage.setItem('clauderpg_duck_size', duck._sizeStep);
    const s = SCALE * (1 + 0.5 * duck._sizeStep);
    this.tweens.add({ targets: duck, scaleX: s, scaleY: s, duration: 180, ease: 'Back.Out' });
    this._renderPane();
  }

  _honkDuck() {
    if (this._selEntity) this._duckHonk(this._selEntity);
  }

  _escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  _renderPane() {
    const pane     = document.getElementById('action-pane');
    const titleEl  = document.getElementById('ap-title');
    const bodyEl   = document.getElementById('ap-body');
    const actionsEl = document.getElementById('ap-actions');
    if (!this._selEntity) { pane.classList.remove('open'); return; }
    pane.classList.add('open');

    const type  = this._selEntityType;
    const obj   = this._selEntity;
    const extra = this._selEntityExtra || {};

    const ICONS = { villager: '◆', duck: '🦆', doodle: '🐾', cattledog: '🐕', chicken: '🐔' };
    const label = type === 'villager' ? (extra.agentId || 'agent') : type;
    titleEl.textContent = `${ICONS[type] || '●'} ${label}`;

    let bodyHTML = '';
    if (type === 'villager') {
      const v     = this.villagers[extra.agentId];
      const items = v?.sprite.history.slice(-8).reverse() || [];
      bodyHTML = items.length === 0
        ? '<span style="color:#445566">(no events yet)</span>'
        : items.map(item => {
            const col = item.startsWith('→') ? '#88ccff' : '#999';
            return `<div style="color:${col};word-break:break-word">${this._escHtml(item)}</div>`;
          }).join('');
    } else if (type === 'doodle') {
      bodyHTML = `<span style="color:#ffdd88">Eggs eaten: ${obj._eggsEaten || 0} 🥚</span>`;
    } else if (type === 'duck') {
      const step = obj._sizeStep || 0;
      const size = step === 0 ? '1x' : `${(1 + 0.5 * step).toFixed(1)}x`;
      bodyHTML = `<span style="color:#aaffaa">Size: ${size}${step > 0 ? ` (step ${step}/6)` : ''}</span>`;
    } else if (type === 'chicken') {
      const pct  = Math.round((obj._hp / obj._maxHp) * 100);
      const col  = obj._ko ? '#888' : pct > 50 ? '#44dd66' : pct > 25 ? '#ffcc00' : '#ff4444';
      bodyHTML   = `<div style="color:${col}">HP: ${obj._hp} / ${obj._maxHp}</div>`;
      if (obj._ko) bodyHTML += '<div style="color:#ff4444;font-style:italic;margin-top:2px">KO\'d — recovering…</div>';
      else         bodyHTML += '<div style="color:#ff8844;margin-top:3px;font-size:10px">⚔ Hover a rival to target</div>';
    } else {
      bodyHTML = '<span style="color:#445566">—</span>';
    }
    bodyEl.innerHTML = bodyHTML;

    const btns = [];
    if (obj._pinned) {
      btns.push(`<button class="ap-btn primary" onclick="window._rp._resumeSelected()">▶ Resume</button>`);
    }
    if (type === 'duck') {
      const step = obj._sizeStep || 0;
      const label = step >= 6 ? '↩ Reset size' : '⬆ Grow';
      btns.push(`<button class="ap-btn" onclick="window._rp._growDuck()">${label}</button>`);
      btns.push(`<button class="ap-btn" onclick="window._rp._honkDuck()">📢 Honk</button>`);
    }
    actionsEl.innerHTML = btns.join('');
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
        if (ev.type === 'context_update') {
          const v = this.villagers[ev.agent];
          if (v) this._updateContextMeter(v, ev.pct);
        }
      } catch {}
    };

    ws.onclose = () => {
      statusEl.textContent = '● disconnected';
      statusEl.className = '';
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }
}

// ── OUTLINE POST-FX ────────────────────────────────────────────────────────
class OutlinePostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game) {
    super({
      game,
      name: 'OutlinePostFX',
      fragShader: `
        precision mediump float;
        uniform sampler2D uMainSampler;
        uniform vec2 uTexelSize;
        varying vec2 outTexCoord;
        void main () {
          vec4 c = texture2D(uMainSampler, outTexCoord);
          if (c.a > 0.5) { gl_FragColor = c; return; }
          float a = texture2D(uMainSampler, outTexCoord + vec2( uTexelSize.x, 0.0)).a
                  + texture2D(uMainSampler, outTexCoord + vec2(-uTexelSize.x, 0.0)).a
                  + texture2D(uMainSampler, outTexCoord + vec2(0.0,  uTexelSize.y)).a
                  + texture2D(uMainSampler, outTexCoord + vec2(0.0, -uTexelSize.y)).a;
          gl_FragColor = (a > 0.5) ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(0.0);
        }
      `,
    });
  }

  onDraw(renderTarget) {
    this.set2f('uTexelSize', 0.55 / renderTarget.width, 0.55 / renderTarget.height);
    this.bindAndDraw(renderTarget);
  }
}

// ── BOOT ───────────────────────────────────────────────────────────────────
new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 500,
  backgroundColor: '#3a6a28',
  antialias: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: VillageScene,
  parent: document.body,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, zoom: 2 },
  input: { mouse: { preventDefaultDown: false } },
});
