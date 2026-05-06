// ── PALETTE ────────────────────────────────────────────────────────────────
const C = {
  // Ground
  DEEP_GRN:   0x1e5c14, TROP_GRN:  0x2d7a1a, MID_GRN:  0x3a9622,
  SAND:       0xd4a854, DEEP_SAND: 0xa87e40, STONE:    0x9a8e7e,
  LT_STONE:   0xc8bba8,
  // Water
  WATER:      0x1a6e9a, WATER_LT:  0x3a9ec8, WATER_DK: 0x0e4a6e,
  // Gold / Temple
  GOLD:       0xFFD700, DARK_GOLD: 0xCC9900, PALE_GOLD:0xFFEC80,
  SAFFRON:    0xFF8C00, TEMPLE_W:  0xF5EED8, TEMPLE_C: 0xEADDC0,
  TEMPLE_G:   0xC0B090,
  // Roofs
  ROOF_ORG:   0xC84B0A, ROOF_RED:  0xAA3300, ROOF_DK:  0x882200,
  // Vegetation
  BAMBOO:     0x7a9a3a, BAMBOO_DK: 0x4a6a1e, JUNG_DK:  0x1a4a10,
  JUNG_MID:   0x2a6a1a, LOTUS:     0xFF69B4, LOTUS_DK: 0xCC3388,
  LOTUS_LF:   0x2a8a3a, RICE_GRN:  0x5ab832, RICE_PAL: 0x8ace4e,
  WATER_RICE: 0x2a7e9a,
  // Wood
  WOOD:       0x8B5E3C, DARK_WOOD: 0x5C3D1E, TEAK:     0x6b4226,
  // Monk
  MONK_ORG:   0xE07800, MONK_DK:   0xB85A00, SKIN:     0xD4A882,
  SKIN_DK:    0xB08060,
  // UI
  LANT_RED:   0xff2222, LANT_YLW:  0xffee22,
};

// ── ZONES ──────────────────────────────────────────────────────────────────
const ZONES = {
  sala:      { x: 150, y: 125 },   // Sala — Thai pavilion (Library)
  jungle:    { x: 645, y: 115 },   // Jungle — Bamboo grove (Grep/Glob)
  market:    { x: 118, y: 362 },   // Talat Nam — Floating market (Web)
  courtyard: { x: 400, y: 258 },   // Wat — Temple courtyard (idle)
  bazaar:    { x: 610, y: 335 },   // Bazaar — Night market (Edit/Bash)
  gate:      { x: 712, y: 418 },   // Pratu — Temple gate (Agent)
  paddy:     { x: 265, y: 410 },   // Rice Paddy — Farm (Task)
};

const TOOL_MAP = {
  Read:      { zone: 'sala',      label: 'reading...' },
  Glob:      { zone: 'jungle',    label: 'searching...' },
  Grep:      { zone: 'jungle',    label: 'searching...' },
  Edit:      { zone: 'bazaar',    label: 'crafting...' },
  Write:     { zone: 'bazaar',    label: 'scribing...' },
  Bash:      { zone: 'bazaar',    label: 'working...' },
  WebSearch: { zone: 'market',    label: 'trading...' },
  WebFetch:  { zone: 'market',    label: 'trading...' },
  Agent:     { zone: 'gate',      label: 'dispatching...' },
  Task:      { zone: 'paddy',     label: 'tending...' },
};

const DEFAULT_MAPPING = { zone: 'courtyard', label: 'meditating...' };

// ── SCENE ──────────────────────────────────────────────────────────────────
class VillageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VillageScene' });
    this.villagers = {};
  }

  preload() {
    // Kenney Tiny Town individual tiles (16×16, CC0)
    this.load.image('palm',   'assets/tiny-town/Tiles/tile_0008.png');
    this.load.image('tree',   'assets/tiny-town/Tiles/tile_0007.png');
    this.load.image('pine',   'assets/tiny-town/Tiles/tile_0006.png');
    this.load.image('bamboo', 'assets/tiny-town/Tiles/tile_0010.png');
    this.load.image('bush',   'assets/tiny-town/Tiles/tile_0009.png');
    this.load.image('plant',  'assets/tiny-town/Tiles/tile_0018.png');
  }

  create() {
    const ground = this.add.graphics();
    const bldg   = this.add.graphics();
    const decor  = this.add.graphics();

    this.drawGround(ground);
    this.drawPaths(ground);
    this.drawWater(ground);
    this.drawRicePaddy(bldg);
    this.drawFloatingMarket(bldg);
    this.drawBambooGrove(bldg);
    this.drawSala(bldg);
    this.drawBazaar(bldg);
    this.drawGate(bldg);
    this.drawWat(bldg);
    this.drawLanternPosts(decor);
    this.drawLotus(decor);
    this.placeTrees();

    this.connectWebSocket();
  }

  // ── MAP LAYERS ────────────────────────────────────────────────────────────

  drawGround(g) {
    g.fillStyle(C.TROP_GRN); g.fillRect(0, 0, 800, 500);
    // Grass variation patches
    g.fillStyle(C.MID_GRN);
    for (const [px, py] of [
      [50,45],[185,75],[315,45],[475,80],[570,60],[695,45],
      [60,175],[290,220],[510,185],[720,200],
      [40,320],[200,290],[330,350],[490,310],[680,390],
      [80,450],[340,460],[510,445],[670,455],
    ]) g.fillRect(px, py, 22, 14);
  }

  drawPaths(g) {
    // Main cross-paths (sandy stone)
    g.fillStyle(C.SAND);
    g.fillRect(0, 244, 800, 38);    // E-W
    g.fillRect(376, 0, 38, 500);    // N-S

    // Path edges
    g.fillStyle(C.DEEP_SAND);
    g.fillRect(0, 244, 800, 3); g.fillRect(0, 279, 800, 3);
    g.fillRect(376, 0, 3, 500); g.fillRect(411, 0, 3, 500);

    // Stone slab dots on paths
    g.fillStyle(C.STONE);
    for (let x = 25; x < 800; x += 48) g.fillRect(x, 256, 8, 5);
    for (let y = 20; y < 500; y += 48) g.fillRect(388, y, 5, 8);
  }

  drawWater(g) {
    // SW water area (floating market)
    g.fillStyle(C.WATER_DK);
    g.fillRect(28, 318, 202, 102);
    // Shimmer strips
    g.fillStyle(C.WATER);
    for (const wy of [318, 336, 352, 370, 390, 408])
      g.fillRect(28, wy, 202, 5);
    g.lineStyle(2, C.WATER_LT, 1);
    g.strokeRect(28, 318, 202, 102);
    // Water meets path
    g.fillStyle(C.WATER);
    g.fillRect(220, 247, 30, 32);
  }

  drawRicePaddy(g) {
    const ox = 186, oy = 336;
    const terraces = [
      { x:0, y:0,  w:122, h:22, col:C.RICE_GRN },
      { x:8, y:24, w:106, h:20, col:C.RICE_PAL },
      { x:0, y:46, w:122, h:22, col:C.RICE_GRN },
      { x:8, y:70, w:106, h:18, col:C.RICE_PAL },
    ];
    for (const t of terraces) {
      g.fillStyle(t.col); g.fillRect(ox+t.x, oy+t.y, t.w, t.h);
      g.fillStyle(C.WATER_RICE);
      g.fillRect(ox+t.x, oy+t.y+t.h-3, t.w, 3);
      g.lineStyle(1, C.BAMBOO_DK, 0.7);
      g.strokeRect(ox+t.x, oy+t.y, t.w, t.h);
    }
  }

  drawFloatingMarket(g) {
    // Wooden dock
    g.fillStyle(C.DARK_WOOD);
    g.fillRect(55, 314, 165, 8);
    for (const px of [55, 115, 175])
      g.fillRect(px, 314, 8, 26);

    // Boats
    g.fillStyle(C.WOOD);   g.fillEllipse(82, 346, 46, 18);
    g.fillStyle(C.MONK_ORG); g.fillRect(72, 337, 38, 5);
    g.fillStyle(C.DARK_WOOD); g.fillEllipse(162, 368, 46, 18);
    g.fillStyle(C.SAFFRON);  g.fillRect(152, 359, 38, 5);

    // Market umbrellas
    const umbrellas = [
      { x:68, y:358, col:C.LOTUS },
      { x:130, y:342, col:C.SAFFRON },
      { x:176, y:364, col:C.LOTUS },
    ];
    for (const u of umbrellas) {
      g.fillStyle(u.col);   g.fillEllipse(u.x, u.y, 30, 14);
      g.fillStyle(C.DARK_WOOD); g.fillRect(u.x-1, u.y, 3, 18);
    }

    // Lotus on water
    for (const [lx, ly] of [[92,398],[148,412]]) {
      g.fillStyle(C.LOTUS_LF);  g.fillEllipse(lx, ly, 18, 11);
      g.fillStyle(C.LOTUS);     g.fillCircle(lx, ly-2, 5);
      g.fillStyle(0xFFFFAA);    g.fillCircle(lx, ly-2, 2);
    }
  }

  drawBambooGrove(g) {
    const ox=535, oy=48, w=194, h=144;
    g.fillStyle(C.JUNG_DK); g.fillRect(ox, oy, w, h);
    g.fillStyle(C.JUNG_MID); g.fillRect(ox+8, oy+8, w-16, h-16);

    // Bamboo stalks
    const cols = [C.BAMBOO, C.BAMBOO_DK, 0x9ab84a];
    for (let i = 0; i < 19; i++) {
      const bx = ox + 6 + i * 10;
      const bh = h - 8 + Phaser.Math.Between(-12, 12);
      g.fillStyle(cols[i % 3]);
      g.fillRect(bx, oy+4, 4, bh);
      g.fillStyle(C.BAMBOO_DK);
      for (let ny = oy+16; ny < oy+bh-8; ny+=16)
        g.fillRect(bx-1, ny, 6, 2);
      // Leaf clusters
      g.fillStyle(C.JUNG_MID);
      g.fillEllipse(bx+2, oy+9, 22, 10);
    }

    // Jungle edge
    g.fillStyle(C.JUNG_MID); g.fillRect(ox, oy+h-14, w, 14);
    g.fillStyle(C.TROP_GRN);
    for (let lx = ox; lx < ox+w; lx += 18)
      g.fillEllipse(lx+9, oy+h-4, 24, 14);
  }

  drawSala(g) {
    // Thai open pavilion (library) — NW
    const ox=54, oy=58;

    // Elevated stone platform
    g.fillStyle(C.TEMPLE_C); g.fillRect(ox, oy+52, 164, 62);
    g.fillStyle(C.TEMPLE_G);
    g.fillRect(ox, oy+110, 164, 5);
    g.fillRect(ox, oy+52, 5, 62);
    g.fillRect(ox+159, oy+52, 5, 62);

    // 4 pillars
    for (const px of [ox+14, ox+52, ox+98, ox+136]) {
      g.fillStyle(C.TEMPLE_W); g.fillRect(px, oy+30, 10, 80);
      g.fillStyle(C.GOLD);
      g.fillRect(px-2, oy+33, 14, 6);
      g.fillRect(px-2, oy+96, 14, 6);
    }

    // Roof tier 3 (bottom)
    g.fillStyle(C.ROOF_DK);
    g.fillTriangle(ox-22, oy+34, ox+81, oy-2, ox+184, oy+34);
    g.fillStyle(C.ROOF_ORG);
    g.fillTriangle(ox-16, oy+34, ox+81, oy+4, ox+178, oy+34);
    g.fillStyle(C.TEMPLE_C);
    g.fillTriangle(ox-8, oy+34, ox+81, oy+12, ox+170, oy+34);

    // Roof tier 2
    g.fillStyle(C.ROOF_DK);
    g.fillTriangle(ox+10, oy+14, ox+81, oy-20, ox+152, oy+14);
    g.fillStyle(C.ROOF_ORG);
    g.fillTriangle(ox+16, oy+14, ox+81, oy-14, ox+146, oy+14);
    g.fillStyle(C.TEMPLE_C);
    g.fillTriangle(ox+22, oy+14, ox+81, oy-6,  ox+140, oy+14);

    // Roof tier 1 (top)
    g.fillStyle(C.ROOF_DK);
    g.fillTriangle(ox+40, oy-6, ox+81, oy-36, ox+122, oy-6);
    g.fillStyle(C.ROOF_ORG);
    g.fillTriangle(ox+44, oy-6, ox+81, oy-30, ox+118, oy-6);

    // Gold roof trim lines
    g.lineStyle(2, C.GOLD, 0.9);
    g.lineBetween(ox-22, oy+34, ox+81, oy-2);
    g.lineBetween(ox+81, oy-2, ox+184, oy+34);

    // Chofa tips (upturned ends — Thai signature)
    g.fillStyle(C.GOLD);
    g.fillTriangle(ox-22, oy+34, ox-16, oy+22, ox-8,  oy+32);
    g.fillTriangle(ox+184, oy+34, ox+190, oy+22, ox+198, oy+32);

    // Gold finial spire
    g.fillStyle(C.GOLD);
    g.fillTriangle(ox+77, oy-50, ox+81, oy-36, ox+85, oy-50);
    g.fillCircle(ox+81, oy-52, 5);
    g.fillStyle(C.PALE_GOLD);
    g.fillTriangle(ox+79, oy-56, ox+81, oy-62, ox+83, oy-56);

    // Steps
    g.fillStyle(C.STONE);
    g.fillRect(ox+57, oy+112, 50, 8);
    g.fillRect(ox+62, oy+120, 40, 7);
  }

  drawBazaar(g) {
    // Night bazaar (forge/edit) — SE area
    const ox=515, oy=278;
    // Ground
    g.fillStyle(C.DEEP_SAND); g.fillRect(ox, oy, 178, 114);

    // Stall 1 (left)
    g.fillStyle(C.DARK_WOOD); g.fillRect(ox+4, oy+32, 72, 62);
    g.fillStyle(C.TEAK);      g.fillRect(ox+7, oy+35, 66, 56);
    // Stall 1 roof
    g.fillStyle(C.ROOF_RED);
    g.fillTriangle(ox-2, oy+34, ox+41, oy+10, ox+84, oy+34);
    g.lineStyle(2, C.DARK_GOLD, 0.9);
    g.lineBetween(ox-2, oy+34, ox+41, oy+10);
    g.lineBetween(ox+41, oy+10, ox+84, oy+34);
    // Anvil inside
    g.fillStyle(0x555555); g.fillRect(ox+22, oy+72, 30, 14);
    g.fillStyle(0x888888); g.fillRect(ox+26, oy+65, 22, 9);

    // Stall 2 (right)
    g.fillStyle(C.DARK_WOOD); g.fillRect(ox+94, oy+32, 72, 62);
    g.fillStyle(C.WOOD);      g.fillRect(ox+97, oy+35, 66, 56);
    // Stall 2 roof
    g.fillStyle(C.SAFFRON);
    g.fillTriangle(ox+90, oy+34, ox+131, oy+10, ox+172, oy+34);
    g.lineStyle(2, C.DARK_GOLD, 0.9);
    g.lineBetween(ox+90, oy+34, ox+131, oy+10);
    g.lineBetween(ox+131, oy+10, ox+172, oy+34);
    // Scroll/writing inside
    g.fillStyle(C.TEMPLE_W); g.fillRect(ox+108, oy+55, 30, 22);
    g.fillStyle(C.STONE);
    for (const ly of [oy+60, oy+65, oy+70]) g.fillRect(ox+112, ly, 22, 2);

    // Hanging lanterns
    const lanterns = [
      { x:ox+80, y:oy+18, col:C.LANT_RED },
      { x:ox+60, y:oy+25, col:C.LANT_YLW },
      { x:ox+100, y:oy+25, col:C.LANT_RED },
    ];
    for (const l of lanterns) {
      g.lineStyle(1, C.DARK_WOOD, 1); g.lineBetween(l.x, oy+5, l.x, l.y+8);
      g.fillStyle(l.col); g.fillEllipse(l.x, l.y, 12, 18);
      g.fillStyle(C.LANT_YLW); g.fillEllipse(l.x, l.y, 6, 9);
    }

    // Front counter
    g.fillStyle(C.DARK_WOOD); g.fillRect(ox+4, oy+94, 170, 14);
  }

  drawGate(g) {
    // Thai temple gate (Pratu Wat) — SE corner
    const ox=660, oy=372;

    // Gate pillars
    g.fillStyle(C.TEMPLE_W);
    g.fillRect(ox, oy, 20, 82);
    g.fillRect(ox+80, oy, 20, 82);
    // Gold bands
    g.fillStyle(C.GOLD);
    for (const by of [oy+10, oy+30, oy+50, oy+68]) {
      g.fillRect(ox-2, by, 24, 5);
      g.fillRect(ox+78, by, 24, 5);
    }

    // Arch top beam
    g.fillStyle(C.ROOF_ORG); g.fillRect(ox+20, oy, 60, 16);

    // Pointed Yod finial
    g.fillStyle(C.GOLD);
    g.fillTriangle(ox+40, oy-22, ox+50, oy, ox+60, oy-22);
    g.fillCircle(ox+50, oy-24, 5);
    g.fillStyle(C.PALE_GOLD);
    g.fillTriangle(ox+48, oy-28, ox+50, oy-36, ox+52, oy-28);

    // Teak doors
    g.fillStyle(C.TEAK);
    g.fillRect(ox+22, oy+16, 26, 52);
    g.fillRect(ox+52, oy+16, 26, 52);
    // Door panels
    g.fillStyle(C.DARK_WOOD);
    g.fillRect(ox+25, oy+20, 20, 18); g.fillRect(ox+25, oy+42, 20, 18);
    g.fillRect(ox+55, oy+20, 20, 18); g.fillRect(ox+55, oy+42, 20, 18);
    // Gold handles
    g.fillStyle(C.GOLD);
    g.fillCircle(ox+47, oy+41, 3); g.fillCircle(ox+53, oy+41, 3);

    // Yaksha guardians (simplified)
    g.fillStyle(C.DEEP_SAND);
    g.fillRect(ox-14, oy+30, 11, 42); g.fillCircle(ox-8, oy+26, 9);
    g.fillRect(ox+103, oy+30, 11, 42); g.fillCircle(ox+109, oy+26, 9);
    // Yaksha eyes (gold, menacing)
    g.fillStyle(C.GOLD);
    g.fillRect(ox-11, oy+21, 4, 3); g.fillRect(ox+105, oy+21, 4, 3);
  }

  drawWat(g) {
    // Central Wat — golden stupa
    const ox=400, oy=242;

    // Stone courtyard circle
    g.fillStyle(C.TEMPLE_C); g.fillEllipse(ox, oy+20, 108, 62);
    g.lineStyle(2, C.GOLD, 0.5); g.strokeEllipse(ox, oy+20, 108, 62);

    // Lotus base platform
    g.fillStyle(C.GOLD); g.fillEllipse(ox, oy+18, 46, 17);
    g.fillStyle(C.DARK_GOLD); g.fillEllipse(ox, oy+20, 40, 11);

    // Stupa square base
    g.fillStyle(C.TEMPLE_W); g.fillRect(ox-20, oy, 40, 22);
    g.fillStyle(C.GOLD);
    g.fillRect(ox-22, oy, 44, 5);
    g.fillRect(ox-22, oy+17, 44, 5);

    // Stupa bell body
    g.fillStyle(C.TEMPLE_C); g.fillEllipse(ox, oy-8, 30, 26);
    g.lineStyle(1, C.GOLD, 0.6); g.strokeEllipse(ox, oy-8, 30, 26);

    // Neck rings (gold)
    g.fillStyle(C.GOLD);
    for (let i = 0; i < 5; i++)
      g.fillEllipse(ox, oy-22-i*4, 16-i*2, 5);

    // Spire
    g.fillStyle(C.GOLD);
    g.fillTriangle(ox-6, oy-38, ox, oy-60, ox+6, oy-38);
    g.fillCircle(ox, oy-61, 4);
    g.fillStyle(C.PALE_GOLD);
    g.fillTriangle(ox-3, oy-64, ox, oy-72, ox+3, oy-64);

    // Prayer streamers
    g.lineStyle(1, C.SAFFRON, 0.7);
    g.lineBetween(ox, oy-60, ox-38, oy-32);
    g.lineBetween(ox, oy-60, ox+38, oy-32);
    g.fillStyle(C.SAFFRON);
    for (let t = 0.1; t < 1; t += 0.22) {
      for (const [tx, ty] of [
        [Phaser.Math.Linear(ox, ox-38, t), Phaser.Math.Linear(oy-60, oy-32, t)],
        [Phaser.Math.Linear(ox, ox+38, t), Phaser.Math.Linear(oy-60, oy-32, t)],
      ]) g.fillRect(tx-3, ty, 7, 6);
    }

    // Bodhi tree (left of stupa)
    g.fillStyle(C.TROP_GRN); g.fillCircle(ox-58, oy+8, 22);
    g.fillCircle(ox-50, oy-4, 18); g.fillCircle(ox-66, oy-2, 16);
    g.fillStyle(C.DEEP_GRN); g.fillCircle(ox-56, oy+4, 14);
    g.fillStyle(C.DARK_WOOD); g.fillRect(ox-60, oy+22, 5, 18);
  }

  drawLanternPosts(g) {
    // 4 lantern posts at path intersection
    const posts = [
      { x:368, y:242 }, { x:420, y:242 },
      { x:368, y:282 }, { x:420, y:282 },
    ];
    for (const p of posts) {
      g.fillStyle(C.DARK_WOOD); g.fillRect(p.x-1, p.y-24, 3, 26);
      g.fillStyle(C.LANT_RED);  g.fillEllipse(p.x, p.y-24, 12, 17);
      g.fillStyle(C.LANT_YLW); g.fillEllipse(p.x, p.y-24, 6, 9);
      g.lineStyle(1, C.DARK_GOLD, 0.7);
      g.strokeEllipse(p.x, p.y-24, 12, 17);
    }
  }

  drawLotus(g) {
    // Scattered lotus and offerings
    for (const [lx, ly] of [[348,62],[498,184],[285,198],[622,445],[730,300]]) {
      g.fillStyle(C.LOTUS_LF);  g.fillEllipse(lx, ly, 16, 10);
      g.fillStyle(C.LOTUS);     g.fillCircle(lx, ly-2, 5);
      g.fillStyle(0xFFFFAA);    g.fillCircle(lx, ly-2, 2);
    }
    // Gold offering bowls by Sala entrance
    for (const [bx, by] of [[60,188],[242,188]]) {
      g.fillStyle(C.GOLD);  g.fillEllipse(bx, by, 14, 9);
      g.fillStyle(C.DARK_GOLD); g.fillRect(bx-7, by-3, 14, 4);
    }
  }

  placeTrees() {
    // Scatter Kenney tiles (palm, tree, bamboo) at 2× scale
    const spots = [
      { key:'palm',   x:330, y:80  }, { key:'palm',   x:460, y:88  },
      { key:'palm',   x:310, y:180 }, { key:'palm',   x:510, y:460 },
      { key:'palm',   x:460, y:450 }, { key:'palm',   x:755, y:180 },
      { key:'palm',   x:755, y:320 },
      { key:'tree',   x:355, y:148 }, { key:'tree',   x:485, y:155 },
      { key:'tree',   x:340, y:458 }, { key:'tree',   x:680, y:448 },
      { key:'pine',   x:365, y:70  }, { key:'pine',   x:490, y:68  },
      { key:'bamboo', x:555, y:200 }, { key:'bamboo', x:720, y:190 },
      { key:'bush',   x:290, y:238 }, { key:'bush',   x:510, y:238 },
      { key:'plant',  x:250, y:330 }, { key:'plant',  x:440, y:330 },
    ];
    for (const s of spots)
      this.add.image(s.x, s.y, s.key).setScale(2).setDepth(3);
  }

  // ── VILLAGER ──────────────────────────────────────────────────────────────

  drawMonk(g) {
    // Robe
    g.fillStyle(C.MONK_ORG);
    g.fillRoundedRect(-9, 2, 18, 22, { tl:3, tr:3, bl:2, br:2 });
    // Folds
    g.fillStyle(C.MONK_DK);
    g.fillRect(-2, 5, 3, 16); g.fillRect(3, 5, 3, 16);
    // Left-shoulder sash
    g.fillStyle(C.SAFFRON);
    g.fillRect(-9, 2, 4, 20);
    // Head (bald)
    g.fillStyle(C.SKIN); g.fillCircle(0, -6, 10);
    g.fillStyle(C.SKIN_DK); g.fillEllipse(-2, -9, 8, 5); // Bald sheen
    // Eyes
    g.fillStyle(0x2a1a10);
    g.fillRect(-4, -8, 3, 3); g.fillRect(2, -8, 3, 3);
    // Smile
    g.fillStyle(0x2a1a10); g.fillEllipse(0, -2, 7, 4);
    g.fillStyle(C.SKIN);   g.fillEllipse(0, -1, 5, 3);
    // Gold offering bowl
    g.fillStyle(C.DARK_GOLD); g.fillEllipse(0, 20, 14, 7);
    g.fillStyle(C.GOLD);      g.fillEllipse(0, 18, 12, 6);
  }

  spawnVillager(agentId) {
    const g = this.add.graphics();
    this.drawMonk(g);

    const name = agentId === 'main' ? 'Claude' : agentId.slice(0, 8);
    const label = this.add.text(0, -24, name, {
      fontSize: '8px', color: '#ffe082', fontFamily: 'monospace',
      backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1);

    const bubble = this.add.text(0, 20, 'meditating...', {
      fontSize: '8px', color: '#aaffaa', fontFamily: 'monospace',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 0);

    const pos = ZONES.courtyard;
    const container = this.add.container(pos.x, pos.y, [g, label, bubble]);
    container.setDepth(10);

    // Idle gentle bob
    const idleTween = this.tweens.add({
      targets: g, y: '-=3',
      duration: 700, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    this.villagers[agentId] = { container, g, bubble, idleTween, walkTween: null };
    return this.villagers[agentId];
  }

  handleEvent(event) {
    const agentId = event.agent || 'main';
    let v = this.villagers[agentId];
    if (!v) v = this.spawnVillager(agentId);

    const map = TOOL_MAP[event.tool] || DEFAULT_MAPPING;
    const zone = ZONES[map.zone];
    const jx = Phaser.Math.Between(-14, 14);
    const jy = Phaser.Math.Between(-10, 10);

    // Switch to walking bob
    if (v.idleTween) { v.idleTween.stop(); v.g.y = 0; }
    if (v.walkTween)  v.walkTween.stop();
    v.walkTween = this.tweens.add({
      targets: v.g, y: '-=4',
      duration: 90, ease: 'Linear', yoyo: true, repeat: -1,
    });

    this.tweens.add({
      targets: v.container,
      x: zone.x + jx, y: zone.y + jy,
      duration: 800, ease: 'Power2',
      onComplete: () => {
        if (v.walkTween) { v.walkTween.stop(); v.walkTween = null; }
        v.g.y = 0;
        // Resume idle
        v.idleTween = this.tweens.add({
          targets: v.g, y: '-=3',
          duration: 700, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        });
      },
    });

    v.bubble.setText(map.label);
  }

  // ── WEBSOCKET ─────────────────────────────────────────────────────────────

  connectWebSocket() {
    const statusEl = document.getElementById('status');
    const ws = new WebSocket(`ws://localhost:3131`);

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
  width: 800, height: 500,
  backgroundColor: '#1e5c14',
  scene: VillageScene,
  parent: document.body,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
