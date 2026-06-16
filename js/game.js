/* ===========================================================================
 * Deep Sea Diver — Engine & Game Logic
 * Plain script (no modules) so it runs by double-clicking index.html.
 * ======================================================================== */
(function () {
  "use strict";

  var D = window.GAMEDATA;
  var PXPM = D.PXPM;

  // ---------------------------------------------------------------------
  //  Save / persistent state
  // ---------------------------------------------------------------------
  var SAVE_PREFIX = "deepsea_save_slot_";
  var activeSlot = null;
  var state = null; // persistent profile

  function defaultState() {
    return {
      version: 2,
      created: Date.now(),
      username: "Diver",
      money: 0,
      upgrades: { oxygen: 0, fins: 0, net: 0, reel: 0, inventory: 0, suit: 0, light: 0, scoop: 0, trap: 0, hammer: 0, shovel: 0, sling: 0, knife: 0 },
      charms: { rarity: 0, shiny: 0 },
      areas: { coral: true, river: false, kelp: false, arctic: false, desert: false, ancient: false, opensea: false, trench: false,
               prism: false, forest: false, swamp: false, boneyard: false, storm: false, ashen: false, mountain: false, olympus: false, pirate: false, backrooms: false, japan: false, secretcave: false,
               oilrig: false, cave: false, cloud: false, sanctuary: false, flooded: false, grotto: false },
      keyPieces: 0,          // pirate key-of-the-captain's-chest pieces (0..4)
      davyjonesCaught: false,
      openseaClams: 0,       // clams dug in the Open Sea (15 summons the Leatherback)
      leatherbackCaught: false,
      cargoSearched: 0,      // cargo ships fully stripped (5 opens the Flooded Freighter)
      jewels: {},            // red/blue/green/yellow gems collected (4 open the Ancient Grotto)
      areaBossCaught: {}, // areaBoss id -> true
      hints: {},          // fishId -> true (purchased hint)
      discovered: {},     // fishId -> true (caught at least once)
      shinyFound: {},     // fishId -> true
      counts: {},         // fishId -> total caught
      treasures: {},      // treasureId -> count
      blobfishCaught: false,
      blobfishShiny: false,
      krakenCaught: false,
      krakenShiny: false,
      stats: { maxDepth: 0, totalCaught: 0, earned: 0, dives: 0 },
      lastArea: "coral",
      settings: { muted: false, musicMuted: false, sfxMuted: false },
      diver: { skin: 2, suit: "#1f7d9c", suitAccent: "#ffd24a", suitTrim: "#bfe9ff", hair: 0, look: "short" },
      buddy: null,       // a mini fish companion {id, shiny} that follows you everywhere
      diverUnlocks: {}, // premium suit colour id -> true
      items: {},        // one-time items, e.g. shinyPocket
      itemsOff: {},     // itemId -> true means owned but toggled OFF (boss gear)
      seeds: {},        // birdId -> seed count
      harpoons: 0,      // ammo for boss fights
      nextNight: false, // is the NEXT dive at night? (alternates each dive)
      nightVision: true, // goggles night-vision toggle (only matters if goggles owned)
      locHints: {},       // areaId -> true: bought the hint for that hidden site
      achievements: {}, // achievementId -> timestamp earned
      home: { wallpaper: "plain", music: "menu", musicOwned: { menu: 1 }, decor: {}, displayFish: null },
      visited: { coral: true }, // areas you've actually dived (unlocks location suits)
    };
  }

  function listSaves() {
    var out = [];
    for (var i = 1; i <= 6; i++) {
      var raw = null;
      try { raw = localStorage.getItem(SAVE_PREFIX + i); } catch (e) {}
      if (raw) {
        try { out.push({ slot: i, data: JSON.parse(raw) }); }
        catch (e) { out.push({ slot: i, data: null }); }
      } else {
        out.push({ slot: i, data: null });
      }
    }
    return out;
  }

  function saveGame() {
    if (activeSlot == null || !state) return;
    checkAchievements();
    try {
      localStorage.setItem(SAVE_PREFIX + activeSlot, JSON.stringify(state));
    } catch (e) {
      toast("Could not save (storage blocked).", "bad");
    }
  }

  function deleteSave(slot) {
    try { localStorage.removeItem(SAVE_PREFIX + slot); } catch (e) {}
  }

  // ---------------------------------------------------------------------
  //  Derived values from upgrades / charms
  // ---------------------------------------------------------------------
  function up(track) { return D.UPGRADES[track].levels[state.upgrades[track]].value; }
  function maxOxygen() { return up("oxygen"); }
  function speed() { return up("fins"); }
  function catchRadius() { return up("net"); }
  // a boss-reward item only applies if owned AND not toggled off
  function itemOn(id) { return state.items[id] && !(state.itemsOff && state.itemsOff[id]); }
  // Night-Vision Goggles active: night reads as day
  function nightVisionOn() { return !!(run && run.night && state.items.goggles && state.nightVision); }
  // the boss-reward gear that can be toggled on/off
  var BOSS_ITEMS = ["necklace", "jellystinger", "megtooth", "sonar", "rocfeather", "crabcrown", "nullzone"];
  function anyBossItemOn() { for (var i = 0; i < BOSS_ITEMS.length; i++) if (itemOn(BOSS_ITEMS[i])) return true; return false; }
  function creatureValueMult() { return itemOn("crabcrown") ? 2 : 1; } // Spider Crab Crown = creatures worth ×2
  function reelMul() { return up("reel"); }
  function inventoryCap() { return up("inventory"); }
  function oxygenMul() { return up("suit"); }
  function lightRadius() { return up("light"); }
  function netSize() { return up("scoop"); }
  function trapSize() { return up("trap"); } // Deploy Net coverage radius (0 = none)
  function hammerLevel() { return up("hammer"); } // 0 = no sledgehammer
  function shovelLevel() { return up("shovel"); } // 0 = no shovel
  function slingShotsMax() { return up("sling"); } // shots per dive (0 = no slingshot)

  function rarityCharmTilt() { return state.charms.rarity * D.CHARMS.rarity.perStack; }
  function shinyChance(area) {
    var c = D.BASE_SHINY_CHANCE + state.charms.shiny * D.CHARMS.shiny.perStack;
    if (area && D.LOCATIONS[area].shinyBonus) c += D.LOCATIONS[area].shinyBonus;
    return Math.min(0.95, c);
  }

  // ---------------------------------------------------------------------
  //  Runtime (per-dive) state
  // ---------------------------------------------------------------------
  var run = null;
  var scene = "boot"; // boot | start | boat | dive | ending

  function newRun(areaId) {
    var loc = D.LOCATIONS[areaId];
    // carry over any unsold haul from a previous dive
    var carryBag = (run && run.bag) ? run.bag : [];
    var carryTreasure = (run && run.bagTreasure) ? run.bagTreasure : [];
    var carryUsed = (run && run.bagUsed) ? run.bagUsed : 0;
    run = {
      area: areaId,
      loc: loc,
      diver: { x: loc.worldWidth / 2, y: 14, vx: 0, vy: 0, face: 1 },
      oxygen: maxOxygen(),
      maxO: maxOxygen(),
      bag: carryBag,      // [{fishId, shiny, size, value}]
      bagTreasure: carryTreasure,
      bagUsed: carryUsed,
      fish: [],
      creatures: [],
      birds: [],
      harpoonFx: [],
      birdTimer: 0,
      netFx: [],
      treasures: [],
      wrecks: [],
      bubbles: [],
      floaters: [],       // floating "+$" text etc
      target: null,       // current reel target id
      reel: 0,
      spawnTimer: 0,
      creatureTimer: 2,
      treasureTimer: 4,
      time: 0,
      surfaced: false,
      diveDepthReached: 0,
      night: !!state.nextNight,   // this dive's time of day
      sonarTimer: 0,
      secretShown: {},            // secretId -> already popped in this dive
      trap: { active: false, x: 0, y: 0, r: 0 }, // deployed net
      slingShots: slingShotsMax(), // slingshot ammo this dive
      pebbles: [],                 // slingshot projectiles
      bellUsed: false,
      grab: null, bossBeam: null,  // boss combat state
      playerBeam: null, breathCd: 0, // Kaiju Breath
      smoke: [], smokeTimer: 0, wyrmTimer: 6, // ashen smoke + magma wyrm
      legendTimer: 35 + Math.random() * 35,   // defeated bosses return as legendary catches
      aimX: 1, aimY: 0,                        // last steering direction (torch/breath aim)
      torpedoes: [],                           // homing torpedo-fish fired by the Rig Titan
      fireballs: [],                           // fireballs spat by the Sea Dragon
      stormCd: 0, peakX: loc.peaks ? loc.worldWidth * 0.5 : null, // storm summoner + mountain peak
    };
    placeWrecks(loc);
    placeCages(loc);
    placeLanterns(loc);
    placeJewel(loc);
    generateDecor(loc);
    // initial population
    for (var i = 0; i < 17; i++) spawnFish(true);
    if (!loc.birdPool && !loc.creaturePool) for (var ci = 0; ci < 4; ci++) spawnCreature(true);
    state.stats.dives++;
  }

  // Locked cages (smashed open with the Sledgehammer). In the Open Sea, a
  // special cage sits at the bottom-right holding the Cage Key.
  function placeCages(loc) {
    run.cages = [];
    run.oilrig = null;
    if (loc.birdPool || loc.creaturePool || loc.airArea) return;
    var floor = loc.maxDepth * PXPM;
    var n = 3 + (Math.random() * 3 | 0);
    for (var i = 0; i < n; i++) {
      // cages now drift at all depths — snagged on ledges, mid-water, not just the floor
      var cy = 120 + Math.random() * (floor - 160);
      run.cages.push({ x: 160 + Math.random() * (loc.worldWidth - 320), y: cy, opened: false, hasKey: false, bob: Math.random() * 6 });
    }
    if (loc.id === "opensea") {
      // the key cage, bottom-right corner
      if (!state.items.cagekey) run.cages.push({ x: loc.worldWidth - 120, y: floor - 22, opened: false, hasKey: true });
      // the derelict oil rig rises from the sea floor
      run.oilrig = { x: loc.worldWidth * 0.5, y: floor - 30 };
    }
  }

  // Four eerie lanterns hang in the Gloom Cavern. Swim into each to snuff it
  // out; douse all four and the Bony-eared Assfish rises from the dark.
  function placeLanterns(loc) {
    run.lanterns = [];
    if (loc.id !== "cave" || state.assfishCaught) return;
    var floor = loc.maxDepth * PXPM;
    for (var i = 0; i < 4; i++) {
      run.lanterns.push({ x: loc.worldWidth * (0.16 + i * 0.22) + (Math.random() - 0.5) * 120,
        y: 120 + Math.random() * (floor - 260), lit: true, bob: Math.random() * 6 });
    }
  }

  // Four ancient jewels — one hidden on the seabed of four areas. Collect all
  // four and a pyramid rises in the Buried Dunes that opens the Ancient Grotto.
  var JEWELS = {
    prism:   { color: "red",    col: "#e23b5a" },
    opensea: { color: "blue",   col: "#2a6ad0" },
    river:   { color: "green",  col: "#1faf6a" },
    desert:  { color: "yellow", col: "#ffcf3a" },
  };
  function placeJewel(loc) {
    run.jewel = null; run.pyramid = null;
    var j = JEWELS[loc.id];
    if (j && !state.jewels[j.color]) {
      var floor = loc.maxDepth * PXPM;
      run.jewel = { x: loc.worldWidth * (0.3 + Math.random() * 0.4), y: floor - 14, col: j.col, color: j.color, phase: Math.random() * 6 };
    }
    // once all four are found, a pyramid stands in the Buried Dunes
    if (loc.id === "desert" && jewelCount() >= 4 && !state.areas.grotto) {
      run.pyramid = { x: loc.worldWidth * 0.5, y: loc.maxDepth * PXPM - 30 };
    }
  }
  function jewelCount() { var n = 0; for (var k in state.jewels) if (state.jewels[k]) n++; return n; }
  // Captain Carp surfaces once you've caught each piece of furniture 10x
  function furnitureComplete() {
    return (state.counts.chairsnail || 0) >= 10 && (state.counts.tableturtle || 0) >= 10 && (state.counts.lampsquid || 0) >= 10;
  }

  function spawnCreature(initial) {
    var loc = D.LOCATIONS[run.area];
    if (run.creatures.length > 7) return;
    var allContent = loc.allContent;
    // Sanctuary shows ONLY its starlight creatures (not every creature in the sea)
    var pool = D.CREATURES.map(function (id) { return D.FISH_BY_ID[id]; })
      .filter(function (c) { return c.area === run.area && (!c.night || run.night) && (!c.day || !run.night); });
    if (!pool.length) return;
    // rarity-weighted pick (commoner creatures appear more)
    var total = 0, weights = pool.map(function (c) { var w = D.RARITY[c.rarity].weight; total += w; return w; });
    var pick = Math.random() * total, def = pool[0];
    for (var i = 0; i < pool.length; i++) { pick -= weights[i]; if (pick <= 0) { def = pool[i]; break; } }
    var x = initial ? Math.random() * loc.worldWidth : (Math.random() < 0.5 ? -30 : loc.worldWidth + 30);
    run.creatures.push({
      uid: "c" + (Math.random() * 1e9 | 0) + run.time,
      def: def, x: x, y: run.floorY - 8,
      vx: (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 10),
      phase: Math.random() * 6, shiny: Math.random() < shinyChance(run.area), size: def.size,
      hasPearl: !!def.dropsPearl && Math.random() < 0.5, // predetermined: a visible pearl when open
    });
  }

  // per-area decoration recipe: seabed flora/rock + a couple of background ridges
  var DECOR = {
    coral:     { plants: ["coral", "coral", "anemone"], plantColors: ["#ff6f91", "#ff9f43", "#5ad1c8", "#c77dff"], rock: "#3a5a6b", floor: "#2a6e7a" },
    river:     { plants: ["kelp", "kelp", "rock"], plantColors: ["#3f8f4d", "#6cae4a", "#2f7f5f"], rock: "#5a6a4a", floor: "#6a7a52" },
    kelp:      { plants: ["kelp", "kelp", "coral"], plantColors: ["#3fa34d", "#5cc46a", "#2f8f6f"], rock: "#244a3a", floor: "#1c3f33" },
    trench:    { plants: ["vent", "rock", "rock"], plantColors: ["#6b4a8f", "#8a5a32", "#3a4a55"], rock: "#1a232c", floor: "#0a1119" },
    sanctuary: { plants: ["crystal", "crystal", "coral"], plantColors: ["#a07bff", "#7affd0", "#ff8be0", "#9fd8ff"], rock: "#2a1e55", floor: "#1a0f3a" },
    arctic:    { plants: ["crystal", "rock", "rock"], plantColors: ["#bfe6ff", "#8fb0c4", "#dff2ff"], rock: "#3a4a58", floor: "#3a5060" },
    ancient:   { plants: ["coral", "rock", "vent"], plantColors: ["#8a7a4a", "#b09a5a", "#6a8a5a"], rock: "#3a2e1a", floor: "#2a2010" },
    opensea:   { plants: ["rock", "coral", "rock"], plantColors: ["#2a6a9a", "#3a8aaa", "#4a6a8a"], rock: "#1a3a5a", floor: "#123048" },
    cave:      { plants: ["crystal", "vent", "rock"], plantColors: ["#8affc0", "#7a5a9a", "#4a3a5a"], rock: "#1a151f", floor: "#0a0710" },
    cloud:     { plants: ["coral", "coral", "rock"], plantColors: ["#bfe0c0", "#a0d8e8", "#cfeaff"], rock: "#9fc0d8", floor: "#7fae8a" },
    forest:    { plants: ["coral", "rock", "coral"], plantColors: ["#3f8f3d", "#5a7a32", "#2f7f3f", "#7a6a3a"], rock: "#3a4a2a", floor: "#2a3a18" },
    swamp:     { plants: ["kelp", "anemone", "rock"], plantColors: ["#5a6a2a", "#7a8a3a", "#3a4a1a"], rock: "#3a3a22", floor: "#2a2a12" },
    boneyard:  { plants: ["rock", "crystal", "rock"], plantColors: ["#d8d2c0", "#bcb6a4", "#8a8474"], rock: "#2a2e34", floor: "#14181e" },
    backrooms: { plants: ["rock", "rock", "rock"], plantColors: ["#c8b84a", "#b8a838", "#9a8a28"], rock: "#a89838", floor: "#8a7a28" },
    japan:     { plants: ["coral", "kelp", "coral"], plantColors: ["#e0556a", "#ff9a4a", "#5cc46a", "#ffd6e0"], rock: "#3a4a6a", floor: "#23304a" },
    secretcave:{ plants: ["crystal", "vent", "rock"], plantColors: ["#9fffd0", "#8a7ad0", "#5a4a6a"], rock: "#141019", floor: "#08060c" },
    oilrig:    { plants: ["vent", "rock", "rock"], plantColors: ["#caa14a", "#6a6258", "#3a3320"], rock: "#2a2418", floor: "#100c06" },
    prism:     { plants: ["coral", "coral", "anemone"], plantColors: ["#ff5b9f", "#ffcf3a", "#3ad0e0", "#9a3ad0", "#36d6a0", "#ff7a3a"], rock: "#3a4a8a", floor: "#2a4a8a" },
    storm:     { plants: ["kelp", "rock", "rock"], plantColors: ["#3a5a4a", "#46506a", "#2a3a4a"], rock: "#2a3340", floor: "#161e28" },
    ashen:     { plants: ["vent", "vent", "rock"], plantColors: ["#ff5b1a", "#c0402a", "#5a2a1a"], rock: "#2a1810", floor: "#140804" },
    mountain:  { plants: ["crystal", "rock", "rock"], plantColors: ["#cfe0ee", "#8a9aae", "#4a5a6a"], rock: "#3a4654", floor: "#28323e" },
    olympus:   { plants: ["crystal", "coral", "crystal"], plantColors: ["#ffe07a", "#fff3b0", "#cfe0ff", "#ffd24a"], rock: "#c9b06a", floor: "#a8904a" },
    pirate:    { plants: ["rock", "coral", "rock"], plantColors: ["#caa14a", "#6a5a3a", "#3a4a4a"], rock: "#2a2620", floor: "#15110a" },
    flooded:   { plants: ["rock", "kelp", "rock"], plantColors: ["#3a5a4a", "#4a4a40", "#2a3a32"], rock: "#1f2a26", floor: "#0a120e" },
    desert:    { plants: ["rock", "coral", "rock"], plantColors: ["#d8c078", "#c8a85a", "#a8884a", "#8a6a3a"], rock: "#a8884a", floor: "#c8a860" },
    grotto:    { plants: ["coral", "crystal", "coral"], plantColors: ["#3ad0e0", "#ffcf3a", "#e23b5a", "#9a5ad0"], rock: "#2a7a8a", floor: "#caa14a" },
  };

  function generateDecor(loc) {
    run.decor = [];
    run.hills = [];
    var d = DECOR[loc.id] || DECOR.coral;
    var floorY = loc.maxDepth * PXPM;
    // background ridges (3 layers, far ones hazed for atmospheric distance)
    var hazeTargets = [mix(d.rock, "#000000", 0.45), mix(d.rock, loc.deepColor, 0.5), mix(d.rock, loc.topColor, 0.5)];
    var parallaxes = [0.6, 0.38, 0.2];
    for (var h = 2; h >= 0; h--) { // far to near so near draws on top
      var pts = [];
      var layerY = floorY - 30 - h * 80;
      var amp = 60 + h * 55;
      for (var px = -200; px < loc.worldWidth + 200; px += 70) {
        pts.push({ x: px, y: layerY - Math.abs(Math.sin(px * 0.011 + h * 2.3)) * amp });
      }
      run.hills.push({ pts: pts, parallax: parallaxes[h], color: hazeTargets[h], baseY: floorY });
    }
    // BIG background flora — towering kelp / coral mounds / spires, hazed,
    // parallaxed, rising from the floor. Makes areas feel lush & deep.
    run.bgFlora = [];
    var bigType = { coral: "bigcoral", river: "reed", kelp: "bigkelp", trench: "spire", sanctuary: "starcoral", arctic: "bigcrystal", ancient: "fossil", opensea: "boulder", cave: "stalagmite", cloud: "skyisle", forest: "tree", swamp: "mangrove", boneyard: "bones", backrooms: "pillar", japan: "blossom", secretcave: "mushroom", oilrig: "pipe", prism: "fan", storm: "piling", pirate: "mast", ashen: "lavavent", mountain: "crag", olympus: "column", flooded: "container", desert: "dune", grotto: "obelisk" }[loc.id] || "bigkelp";
    var bcount = loc.airArea ? Math.round(loc.worldWidth / 420) : Math.round(loc.worldWidth / 190);
    for (var bi = 0; bi < bcount; bi++) {
      run.bgFlora.push({
        type: bigType,
        x: Math.random() * loc.worldWidth,
        h: 160 + Math.random() * 320,
        w: 0.8 + Math.random() * 1.1,
        sway: Math.random() * 6.28,
        parallax: 0.62 + Math.random() * 0.12,
        color: mix(d.plantColors[(Math.random() * d.plantColors.length) | 0], loc.deepColor, 0.45),
      });
    }
    // seabed plants/rocks along the floor (denser now)
    var n = Math.round(loc.worldWidth / 42);
    for (var i = 0; i < n; i++) {
      var type = d.plants[(Math.random() * d.plants.length) | 0];
      run.decor.push({
        type: type,
        x: Math.random() * loc.worldWidth,
        y: floorY - 2,
        size: 0.6 + Math.random() * 1.0,
        sway: Math.random() * 6.28,
        color: d.plantColors[(Math.random() * d.plantColors.length) | 0],
      });
    }
    run.floorY = floorY;
    run.floorColor = d.floor;
    run.rockColor = d.rock;
  }

  function drawBgFlora(loc) {
    loc = loc || D.LOCATIONS[run.area];
    var floorScreenY = run.floorY - cam.y;
    for (var i = 0; i < run.bgFlora.length; i++) {
      var fl = run.bgFlora[i];
      var x = fl.x - cam.x * fl.parallax;
      if (x < -160 || x > W + 160) continue;
      if (floorScreenY - fl.h > H || floorScreenY < -40) continue;
      ctx.save();
      ctx.fillStyle = fl.color;
      if (fl.type === "bigkelp") {
        var segs = Math.round(fl.h / 18);
        for (var s = 0; s < segs; s++) {
          var t = s / segs;
          var sway = Math.sin(run.time * 0.7 + fl.sway + t * 2) * 16 * t;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(Math.round(x + sway - 6 * fl.w), Math.round(floorScreenY - s * 18 - 18), Math.round(12 * fl.w), 18);
          if (s % 2 === 0) ctx.fillRect(Math.round(x + sway + 6 * fl.w), Math.round(floorScreenY - s * 18 - 14), 7, 10);
        }
      } else if (fl.type === "bigcoral") {
        ctx.globalAlpha = 0.5;
        var bw = 60 * fl.w;
        ctx.beginPath();
        ctx.moveTo(x - bw / 2, floorScreenY);
        ctx.quadraticCurveTo(x - bw / 2, floorScreenY - fl.h, x, floorScreenY - fl.h);
        ctx.quadraticCurveTo(x + bw / 2, floorScreenY - fl.h, x + bw / 2, floorScreenY);
        ctx.closePath(); ctx.fill();
        // knobby branches
        for (var c = 0; c < 4; c++) {
          var bx = x + (c - 1.5) * bw * 0.28;
          ctx.fillRect(Math.round(bx - 5 * fl.w), Math.round(floorScreenY - fl.h - 14), Math.round(10 * fl.w), 22);
        }
      } else if (fl.type === "bigcrystal") {
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(x, floorScreenY - fl.h);
        ctx.lineTo(x + 22 * fl.w, floorScreenY);
        ctx.lineTo(x - 22 * fl.w, floorScreenY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = mix(fl.color, "#ffffff", 0.4);
        ctx.fillRect(Math.round(x - 3), Math.round(floorScreenY - fl.h + 10), 4, Math.round(fl.h - 14));
      } else if (fl.type === "tree") {
        // submerged old-growth tree: brown trunk + leafy green canopy that sways
        ctx.globalAlpha = 0.6;
        var topY = floorScreenY - fl.h, sway = Math.sin(run.time * 0.5 + fl.sway) * 8;
        ctx.fillStyle = mix(fl.color, "#2a1c10", 0.7); // trunk
        var tw = 10 * fl.w;
        ctx.fillRect(Math.round(x - tw / 2), Math.round(topY + fl.h * 0.32), Math.round(tw), Math.round(fl.h * 0.68));
        // a couple of boughs
        ctx.fillRect(Math.round(x - 22 * fl.w), Math.round(topY + fl.h * 0.4), Math.round(22 * fl.w), 5);
        ctx.fillRect(Math.round(x + sway), Math.round(topY + fl.h * 0.5), Math.round(20 * fl.w), 5);
        // leafy canopy — overlapping green blobs
        ctx.fillStyle = fl.color;
        for (var cb = 0; cb < 6; cb++) {
          var bx = x + sway + Math.sin(cb * 1.7 + fl.sway) * 30 * fl.w;
          var by = topY + (cb % 3) * 16 + Math.cos(cb * 1.3) * 8;
          ctx.beginPath(); ctx.arc(bx, by, 24 * fl.w, 0, 7); ctx.fill();
        }
      } else if (fl.type === "bones") {
        // a giant ribcage rising from the seabed
        ctx.globalAlpha = 0.5; ctx.strokeStyle = fl.color; ctx.lineWidth = Math.max(3, 5 * fl.w);
        var spineX = x, baseY = floorScreenY, topY = floorScreenY - fl.h;
        ctx.beginPath(); ctx.moveTo(spineX, baseY); ctx.lineTo(spineX, topY); ctx.stroke();
        for (var rb = 0; rb < 5; rb++) {
          var ry = topY + (rb / 5) * fl.h, rw = (28 - rb * 3) * fl.w;
          ctx.beginPath(); ctx.moveTo(spineX, ry); ctx.quadraticCurveTo(spineX - rw, ry + 10, spineX - rw * 0.7, ry + 26); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(spineX, ry); ctx.quadraticCurveTo(spineX + rw, ry + 10, spineX + rw * 0.7, ry + 26); ctx.stroke();
        }
      } else if (fl.type === "pipe") {
        // rusted industrial standpipe with flanges + a valve wheel
        ctx.globalAlpha = 0.55; ctx.fillStyle = fl.color;
        var pw = 12 * fl.w;
        ctx.fillRect(Math.round(x - pw / 2), Math.round(floorScreenY - fl.h), Math.round(pw), Math.round(fl.h));
        ctx.fillStyle = mix(fl.color, "#000", 0.3);
        for (var fg = 0; fg < fl.h; fg += 40) ctx.fillRect(Math.round(x - pw / 2 - 3), Math.round(floorScreenY - fg - 6), Math.round(pw + 6), 5);
        ctx.strokeStyle = mix(fl.color, "#ff7a3a", 0.4); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, floorScreenY - fl.h, 9 * fl.w, 0, 7); ctx.stroke(); // valve
      } else if (fl.type === "mast") {
        // a broken galleon mast with a crossbeam and tattered sail
        ctx.globalAlpha = 0.5; ctx.fillStyle = fl.color;
        var mw = 8 * fl.w;
        ctx.fillRect(Math.round(x - mw / 2), Math.round(floorScreenY - fl.h), Math.round(mw), Math.round(fl.h));
        ctx.fillRect(Math.round(x - 30 * fl.w), Math.round(floorScreenY - fl.h * 0.78), Math.round(60 * fl.w), 5); // yard
        ctx.fillStyle = "rgba(220,210,180,0.25)"; // ragged sail
        ctx.beginPath(); ctx.moveTo(x - 26 * fl.w, floorScreenY - fl.h * 0.76);
        ctx.lineTo(x + 26 * fl.w, floorScreenY - fl.h * 0.76);
        ctx.lineTo(x + 18 * fl.w, floorScreenY - fl.h * 0.44);
        ctx.lineTo(x - 12 * fl.w, floorScreenY - fl.h * 0.5); ctx.closePath(); ctx.fill();
      } else if (fl.type === "lavavent") {
        // a black chimney with a molten glowing crown + smoke
        ctx.globalAlpha = 0.6; ctx.fillStyle = mix(fl.color, "#000", 0.4);
        ctx.beginPath(); ctx.moveTo(x - 22 * fl.w, floorScreenY); ctx.lineTo(x - 8 * fl.w, floorScreenY - fl.h);
        ctx.lineTo(x + 8 * fl.w, floorScreenY - fl.h); ctx.lineTo(x + 22 * fl.w, floorScreenY); ctx.closePath(); ctx.fill();
        var ventY = floorScreenY - fl.h;
        drawGlow(x, ventY, 16 * fl.w, "#ff5b1a", 0.5 + 0.2 * Math.sin(run.time * 3 + fl.sway));
        ctx.fillStyle = "rgba(255,120,40,0.6)"; ctx.fillRect(Math.round(x - 8 * fl.w), Math.round(ventY - 2), Math.round(16 * fl.w), 4);
      } else if (fl.type === "crag") {
        // jagged layered mountain crag
        ctx.globalAlpha = 0.6; ctx.fillStyle = fl.color;
        ctx.beginPath(); ctx.moveTo(x - 30 * fl.w, floorScreenY);
        ctx.lineTo(x - 10 * fl.w, floorScreenY - fl.h * 0.7);
        ctx.lineTo(x, floorScreenY - fl.h);
        ctx.lineTo(x + 12 * fl.w, floorScreenY - fl.h * 0.6);
        ctx.lineTo(x + 30 * fl.w, floorScreenY); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.16)"; // snow/light cap
        ctx.beginPath(); ctx.moveTo(x - 6 * fl.w, floorScreenY - fl.h * 0.82); ctx.lineTo(x, floorScreenY - fl.h); ctx.lineTo(x + 7 * fl.w, floorScreenY - fl.h * 0.78); ctx.closePath(); ctx.fill();
      } else if (fl.type === "container") {
        // a leaning stack of shipping containers
        ctx.globalAlpha = 0.55;
        var ccols = ["#b14a3a", "#3a72a0", "#caa14a", "#4a8a5a"];
        var rows = Math.max(2, Math.round(fl.h / 26));
        for (var cr = 0; cr < rows; cr++) {
          ctx.fillStyle = ccols[(cr + (x | 0)) % ccols.length];
          var off = Math.sin(cr * 0.8 + fl.sway) * 6 * fl.w;
          ctx.fillRect(Math.round(x - 24 * fl.w + off), Math.round(floorScreenY - (cr + 1) * 26), Math.round(48 * fl.w), 24);
          ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(Math.round(x - 24 * fl.w + off), Math.round(floorScreenY - (cr + 1) * 26), Math.round(48 * fl.w), 3);
        }
      } else if (fl.type === "fossil") {
        // a giant coiled ammonite fossil half-buried in the floor
        ctx.globalAlpha = 0.5; ctx.strokeStyle = fl.color; ctx.lineWidth = Math.max(3, 4 * fl.w);
        var fcx = x, fcy = floorScreenY - fl.h * 0.5, R0 = fl.h * 0.45;
        ctx.beginPath();
        for (var a2 = 0; a2 < 18; a2++) { var ang = a2 * 0.5, rr = R0 * (1 - a2 / 22); var pxc = fcx + Math.cos(ang) * rr, pyc = fcy + Math.sin(ang) * rr; if (a2 === 0) ctx.moveTo(pxc, pyc); else ctx.lineTo(pxc, pyc); }
        ctx.stroke();
        ctx.lineWidth = 1.5; for (var rib = 0; rib < 10; rib++) { var ang2 = rib * 0.6, rr2 = R0 * (1 - rib / 14); ctx.beginPath(); ctx.moveTo(fcx + Math.cos(ang2) * rr2 * 0.6, fcy + Math.sin(ang2) * rr2 * 0.6); ctx.lineTo(fcx + Math.cos(ang2) * rr2, fcy + Math.sin(ang2) * rr2); ctx.stroke(); }
      } else if (fl.type === "obelisk") {
        // a tall Egyptian obelisk with a gilded pyramidion cap
        ctx.globalAlpha = 0.6; var ow = 9 * fl.w, oty = floorScreenY - fl.h;
        ctx.fillStyle = fl.color;
        ctx.fillRect(Math.round(x - ow / 2), Math.round(oty + 12), Math.round(ow), Math.round(fl.h - 12));
        ctx.fillStyle = mix("#ffd24a", loc.deepColor, 0.2);
        ctx.beginPath(); ctx.moveTo(x, oty); ctx.lineTo(x - ow / 2, oty + 14); ctx.lineTo(x + ow / 2, oty + 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(Math.round(x + ow / 6), Math.round(oty + 14), Math.round(ow / 3), Math.round(fl.h - 14));
      } else if (fl.type === "dune") {
        // a rolling sand dune ridge with a wind-blown crest
        ctx.globalAlpha = 0.6; ctx.fillStyle = fl.color;
        var dw = 60 * fl.w;
        ctx.beginPath();
        ctx.moveTo(x - dw, floorScreenY);
        ctx.quadraticCurveTo(x - dw * 0.3, floorScreenY - fl.h, x + dw * 0.2, floorScreenY - fl.h);
        ctx.quadraticCurveTo(x + dw * 0.7, floorScreenY - fl.h * 0.9, x + dw, floorScreenY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = mix(fl.color, "#fff", 0.18); // sunlit crest
        ctx.beginPath();
        ctx.moveTo(x - dw * 0.3, floorScreenY - fl.h);
        ctx.quadraticCurveTo(x + dw * 0.2, floorScreenY - fl.h - 3, x + dw * 0.5, floorScreenY - fl.h * 0.86);
        ctx.lineTo(x + dw * 0.2, floorScreenY - fl.h); ctx.closePath(); ctx.fill();
      } else if (fl.type === "blossom") {
        // cherry-blossom tree — dark trunk, drifting pink canopy
        ctx.globalAlpha = 0.55; var bty = floorScreenY - fl.h, bsw = Math.sin(run.time * 0.5 + fl.sway) * 6;
        ctx.fillStyle = "rgba(70,46,34,0.7)"; var btw = 8 * fl.w;
        ctx.fillRect(Math.round(x - btw / 2), Math.round(bty + fl.h * 0.4), Math.round(btw), Math.round(fl.h * 0.6));
        ctx.fillStyle = mix("#ff9ec4", loc.deepColor, 0.35);
        for (var bcb = 0; bcb < 6; bcb++) { var bbx = x + bsw + Math.sin(bcb * 1.7 + fl.sway) * 26 * fl.w; var bby = bty + (bcb % 3) * 15; ctx.beginPath(); ctx.arc(bbx, bby, 22 * fl.w, 0, 7); ctx.fill(); }
      } else if (fl.type === "fan") {
        // branching sea-fan / gorgonian
        ctx.globalAlpha = 0.5; ctx.strokeStyle = fl.color; ctx.lineWidth = Math.max(2, 3 * fl.w);
        var fsw = Math.sin(run.time * 0.6 + fl.sway) * 8;
        for (var fb = -3; fb <= 3; fb++) {
          ctx.beginPath(); ctx.moveTo(x, floorScreenY);
          ctx.quadraticCurveTo(x + fb * 6 * fl.w, floorScreenY - fl.h * 0.5, x + fb * 16 * fl.w + fsw, floorScreenY - fl.h); ctx.stroke();
        }
      } else if (fl.type === "reed") {
        // tall freshwater reeds with cattail tips
        ctx.globalAlpha = 0.5; ctx.strokeStyle = fl.color; ctx.lineWidth = Math.max(2, 3 * fl.w);
        for (var rd = -2; rd <= 2; rd++) {
          var rsw = Math.sin(run.time * 0.8 + fl.sway + rd) * 12, rx = x + rd * 9 * fl.w;
          ctx.beginPath(); ctx.moveTo(rx, floorScreenY); ctx.quadraticCurveTo(rx + rsw * 0.5, floorScreenY - fl.h * 0.6, rx + rsw, floorScreenY - fl.h); ctx.stroke();
          ctx.fillStyle = mix(fl.color, "#3a2a10", 0.4); ctx.fillRect(Math.round(rx + rsw - 2), Math.round(floorScreenY - fl.h), 4, 12);
        }
      } else if (fl.type === "boulder") {
        // lone rounded boulders on the open seabed
        ctx.globalAlpha = 0.55; ctx.fillStyle = fl.color;
        ctx.beginPath(); ctx.ellipse(x, floorScreenY - fl.h * 0.28, 34 * fl.w, fl.h * 0.32, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = mix(fl.color, "#fff", 0.12); ctx.beginPath(); ctx.ellipse(x - 8 * fl.w, floorScreenY - fl.h * 0.34, 12 * fl.w, fl.h * 0.12, 0, Math.PI, 0); ctx.fill();
      } else if (fl.type === "mangrove") {
        // arching mangrove prop-roots
        ctx.globalAlpha = 0.5; ctx.strokeStyle = fl.color; ctx.lineWidth = Math.max(3, 4 * fl.w);
        var mty = floorScreenY - fl.h;
        ctx.beginPath(); ctx.moveTo(x, floorScreenY); ctx.lineTo(x, mty); ctx.stroke();
        for (var mr = -2; mr <= 2; mr++) { if (!mr) continue; ctx.beginPath(); ctx.moveTo(x, mty + fl.h * 0.3); ctx.quadraticCurveTo(x + mr * 24 * fl.w, mty + fl.h * 0.5, x + mr * 20 * fl.w, floorScreenY); ctx.stroke(); }
        ctx.fillStyle = mix(fl.color, "#6cae4a", 0.5); ctx.beginPath(); ctx.arc(x, mty, 20 * fl.w, 0, 7); ctx.fill();
      } else if (fl.type === "stalagmite") {
        // a cluster of cave stalagmites (and a hanging stalactite)
        ctx.globalAlpha = 0.6; ctx.fillStyle = fl.color;
        for (var sg = -1; sg <= 1; sg++) {
          var sgx = x + sg * 16 * fl.w, sgh = fl.h * (sg === 0 ? 1 : 0.6);
          ctx.beginPath(); ctx.moveTo(sgx - 12 * fl.w, floorScreenY); ctx.lineTo(sgx, floorScreenY - sgh); ctx.lineTo(sgx + 12 * fl.w, floorScreenY); ctx.closePath(); ctx.fill();
        }
        var sty = floorScreenY - fl.h - 40; // a stalactite tip above
        if (sty > -20) { ctx.beginPath(); ctx.moveTo(x - 8 * fl.w, sty - 30); ctx.lineTo(x, sty); ctx.lineTo(x + 8 * fl.w, sty - 30); ctx.closePath(); ctx.fill(); }
      } else if (fl.type === "pillar") {
        // a derelict concrete support pillar
        ctx.globalAlpha = 0.5; ctx.fillStyle = mix("#9a8f6a", loc.deepColor, 0.4);
        var plw = 18 * fl.w;
        ctx.fillRect(Math.round(x - plw / 2), Math.round(floorScreenY - fl.h), Math.round(plw), Math.round(fl.h));
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(Math.round(x + plw / 4), Math.round(floorScreenY - fl.h), Math.round(plw / 4), Math.round(fl.h));
        ctx.fillStyle = mix("#9a8f6a", "#000", 0.3); ctx.fillRect(Math.round(x - plw / 2 - 3), Math.round(floorScreenY - fl.h), Math.round(plw + 6), 6);
      } else if (fl.type === "piling") {
        // rotted wooden dock pilings
        ctx.globalAlpha = 0.55; ctx.fillStyle = mix("#5a4632", loc.deepColor, 0.4);
        for (var pl = -1; pl <= 1; pl++) {
          var plx = x + pl * 16 * fl.w, plh = fl.h * (1 - Math.abs(pl) * 0.22);
          ctx.fillRect(Math.round(plx - 5 * fl.w), Math.round(floorScreenY - plh), Math.round(10 * fl.w), Math.round(plh));
          ctx.fillStyle = mix("#3a5a4a", loc.deepColor, 0.4); ctx.fillRect(Math.round(plx - 6 * fl.w), Math.round(floorScreenY - plh), Math.round(12 * fl.w), 5); ctx.fillStyle = mix("#5a4632", loc.deepColor, 0.4);
        }
      } else if (fl.type === "starcoral") {
        // glowing star-burst coral
        var stcy = floorScreenY - fl.h * 0.5;
        drawGlow(x, stcy, 26 * fl.w, fl.color, 0.22 + 0.1 * Math.sin(run.time * 2 + fl.sway));
        ctx.globalAlpha = 0.6; ctx.strokeStyle = mix(fl.color, "#fff", 0.4); ctx.lineWidth = Math.max(2, 3 * fl.w);
        for (var stp = 0; stp < 7; stp++) { var sa = stp / 7 * 6.283 + fl.sway; ctx.beginPath(); ctx.moveTo(x, stcy); ctx.lineTo(x + Math.cos(sa) * fl.h * 0.4, stcy + Math.sin(sa) * fl.h * 0.4); ctx.stroke(); }
      } else if (fl.type === "skyisle") {
        // a floating sky island (Cloud Reaches)
        ctx.globalAlpha = 0.5; ctx.fillStyle = mix(fl.color, "#6a5a3a", 0.4);
        var siy = floorScreenY - fl.h * 0.4;
        ctx.beginPath(); ctx.moveTo(x - 34 * fl.w, siy); ctx.lineTo(x + 34 * fl.w, siy); ctx.lineTo(x, siy + 30 * fl.w); ctx.closePath(); ctx.fill();
        ctx.fillStyle = mix("#6cae4a", loc.deepColor, 0.25); ctx.beginPath(); ctx.ellipse(x, siy, 34 * fl.w, 8 * fl.w, 0, Math.PI, 0); ctx.fill();
      } else if (fl.type === "mushroom") {
        // glowing cave mushrooms
        ctx.globalAlpha = 0.55;
        for (var mu = -1; mu <= 1; mu++) {
          var mux = x + mu * 18 * fl.w, muh = fl.h * (mu === 0 ? 0.7 : 0.45);
          ctx.fillStyle = mix(fl.color, "#fff", 0.2); ctx.fillRect(Math.round(mux - 3 * fl.w), Math.round(floorScreenY - muh), Math.round(6 * fl.w), Math.round(muh));
          var capY = floorScreenY - muh; drawGlow(mux, capY, 12 * fl.w, fl.color, 0.3);
          ctx.fillStyle = fl.color; ctx.beginPath(); ctx.ellipse(mux, capY, 14 * fl.w, 8 * fl.w, 0, Math.PI, 0); ctx.fill();
        }
      } else if (fl.type === "column") {
        // a broken marble column (Olympus)
        ctx.globalAlpha = 0.55; var clw = 16 * fl.w, ch = fl.h;
        ctx.fillStyle = mix("#efe7cf", loc.deepColor, 0.3);
        ctx.fillRect(Math.round(x - clw / 2), Math.round(floorScreenY - ch), Math.round(clw), Math.round(ch));
        ctx.strokeStyle = mix("#cfc6a8", loc.deepColor, 0.4); ctx.lineWidth = 1.5;
        for (var fl2 = -2; fl2 <= 2; fl2++) { ctx.beginPath(); ctx.moveTo(x + fl2 * 3 * fl.w, floorScreenY - ch); ctx.lineTo(x + fl2 * 3 * fl.w, floorScreenY); ctx.stroke(); }
        ctx.fillStyle = mix("#efe7cf", loc.deepColor, 0.3); ctx.fillRect(Math.round(x - clw / 2 - 4), Math.round(floorScreenY - ch), Math.round(clw + 8), 8); // capital
        ctx.fillRect(Math.round(x - clw / 2 - 4), Math.round(floorScreenY - 8), Math.round(clw + 8), 8); // base
      } else { // spire
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - 26 * fl.w, floorScreenY);
        ctx.lineTo(x, floorScreenY - fl.h);
        ctx.lineTo(x + 26 * fl.w, floorScreenY);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function placeWrecks(loc) {
    run.wrecks = [];
    if (loc.birdPool || loc.creaturePool) return; // no sunken wrecks in the sky / cave
    var n = loc.maxDepth > 700 ? 3 : 2;
    var planeChance = loc.id === "trench" ? 0.45 : (loc.id === "river" ? 0.1 : 0.28);
    for (var i = 0; i < n; i++) {
      var type, roll = Math.random();
      if (roll < 0.06) type = "yacht";                 // a rare luxury yacht (high spoils)
      else if (roll < 0.34) type = "cargo";            // a big cargo freighter (10 treasures)
      else if (Math.random() < planeChance) type = "plane";
      else type = "ship";
      run.wrecks.push({
        type: type,
        x: 200 + Math.random() * (loc.worldWidth - 400),
        y: loc.maxDepth * (0.45 + 0.5 * (i / n)) + Math.random() * 40,
        w: type === "cargo" ? 300 + Math.random() * 120 : type === "yacht" ? 200 + Math.random() * 80 : 180 + Math.random() * 120,
        looted: 0,
      });
    }
  }

  // ---------------------------------------------------------------------
  //  Rarity / fish selection
  // ---------------------------------------------------------------------
  function depthFactor(y, loc) {
    // 0 at surface -> 1 at maxDepth
    return clamp(y / (loc.maxDepth * PXPM), 0, 1);
  }

  function rollRarity(df) {
    // Build weights, tilt toward rarer as depth + charms increase.
    var tilt = df * 1.6 + rarityCharmTilt(); // 0..(big)
    var entries = [];
    var total = 0;
    for (var key in D.RARITY) {
      var r = D.RARITY[key];
      // each rarity order step gets boosted by tilt
      var w = r.weight * Math.pow(1 + tilt, r.order);
      entries.push([key, w]);
      total += w;
    }
    var pick = Math.random() * total;
    for (var i = 0; i < entries.length; i++) {
      pick -= entries[i][1];
      if (pick <= 0) return entries[i][0];
    }
    return "common";
  }

  function eligibleFish(areaId, rarity, depthM) {
    var out = [];
    var loc = D.LOCATIONS[areaId];
    var allContent = loc && loc.allContent;       // Sanctuary: everything
    var birdPool = loc && loc.birdPool;            // Cloud Reaches: birds swim like fish
    var creaturePool = loc && loc.creaturePool;    // Gloom Cavern: creatures swim like fish
    var isNight = !!(run && run.night);
    for (var i = 0; i < D.FISH.length; i++) {
      var f = D.FISH[i];
      if (f.night && !isNight) continue;           // nocturnal species only at night
      if (f.day && isNight) continue;              // diurnal species only in daylight
      if (f.area === "sanctuary" && areaId !== "sanctuary") continue; // starlight species stay in the Sanctuary
      if (D.LOCATIONS[f.area] && D.LOCATIONS[f.area].secret && f.area !== areaId) continue; // secret-area species don't leak into Cloud/Gloom
      if (birdPool) {
        if (!f.bird || f.rarity !== rarity) continue;
        out.push(f); continue;                     // no depth/secret gating for the sky
      }
      if (creaturePool) {
        if (f.creature && f.rarity === rarity) { out.push(f); continue; } // every creature drifts in the cave
        // ...plus the cavern's own resident fish
        if (f.area === areaId && !f.bird && !f.areaBoss && !f.secretBoss && f.rarity === rarity && depthM >= f.minDepth) out.push(f);
        continue;
      }
      if (!allContent && f.area !== areaId) continue;
      if (f.rarity !== rarity) continue;
      if (f.isKraken || f.isBlob || f.areaBoss || f.secretBoss || f.creature || f.bird) continue;
      if (depthM < f.minDepth) continue;
      if (f.secret) {
        // secrets need a purchased hint + meeting their depth condition
        if (!state.hints[f.id]) continue;
        if (!secretConditionMet(f, depthM)) continue;
      }
      out.push(f);
    }
    return out;
  }

  function secretConditionMet(f, depthM) {
    var c = f.condition || {};
    if (c.minDepth != null && depthM < c.minDepth) return false;
    if (c.maxDepth != null && depthM > c.maxDepth) return false;
    // special catch methods (read live dive state)
    if (c.circle && Math.abs(run.spin || 0) < 2.0) return false;
    if (c.lowOxygen && run.oxygen / run.maxO > 0.32) return false; // a bit easier to reach
    if (c.fast && Math.hypot(run.diver.vx, run.diver.vy) < speed() * 0.8) return false;
    if (c.still && (run.stillTimer || 0) < 2) return false;
    if (c.corner) { // lurk at a far corner of the rooms
      var cl = D.LOCATIONS[run.area];
      var nx = run.diver.x < 140 || run.diver.x > cl.worldWidth - 140;
      var ny = run.diver.y < 90 || run.diver.y > cl.maxDepth * PXPM - 90;
      if (!(nx && ny)) return false;
    }
    if (c.corners4 && cornersVisited() < 4) return false; // must visit ALL four corners this run
    return true;
  }
  // track which of the four map corners you've reached this dive (for the CCTV Fish)
  function trackCorners() {
    var cl = D.LOCATIONS[run.area], d = run.diver;
    var left = d.x < 160, right = d.x > cl.worldWidth - 160;
    var top = d.y < 120, bot = d.y > cl.maxDepth * PXPM - 120;
    if (!run.corners) run.corners = {};
    if (left && top) run.corners.tl = true;
    if (right && top) run.corners.tr = true;
    if (left && bot) run.corners.bl = true;
    if (right && bot) run.corners.br = true;
  }
  function cornersVisited() { var c = run.corners || {}; return (c.tl ? 1 : 0) + (c.tr ? 1 : 0) + (c.bl ? 1 : 0) + (c.br ? 1 : 0); }

  function spawnFish(initial) {
    var loc = D.LOCATIONS[run.area];
    if (run.fish.length > 30) return;

    // Where (depth) does this fish spawn? bias around the diver's depth band.
    var diverDepthM = run.diver.y / PXPM;
    var spawnYpx;
    if (initial) {
      spawnYpx = Math.random() * loc.maxDepth * PXPM;
    } else {
      // near the diver vertically, anywhere horizontally
      spawnYpx = clamp(run.diver.y + (Math.random() - 0.5) * 700, 30, loc.maxDepth * PXPM);
    }
    var depthM = spawnYpx / PXPM;
    var df = depthFactor(spawnYpx, loc);

    // secret spawn is gated and rare
    var rarity = rollRarity(df);
    var pool = eligibleFish(run.area, rarity, depthM);

    // If nothing eligible at this rarity/depth, fall back down the tiers.
    if (pool.length === 0) {
      var fallback = ["mythic", "legendary", "epic", "rare", "uncommon", "common"];
      for (var fi = 0; fi < fallback.length && pool.length === 0; fi++) {
        pool = eligibleFish(run.area, fallback[fi], depthM);
      }
    }
    if (pool.length === 0) return;

    var def = pool[(Math.random() * pool.length) | 0];

    var shiny = Math.random() < shinyChance(run.area);

    var x = initial
      ? Math.random() * loc.worldWidth
      : (Math.random() < 0.5 ? -40 : loc.worldWidth + 40);

    run.fish.push({
      uid: "f" + (Math.random() * 1e9 | 0) + run.time,
      def: def,
      x: x,
      y: spawnYpx,
      baseY: spawnYpx,
      vx: (def.shape === "shark" || def.shape === "whale" || def.shape === "kraken" ? 28 : 46) * (Math.random() < 0.5 ? -1 : 1),
      phase: Math.random() * Math.PI * 2,
      shiny: shiny,
      size: def.size,
      fleeing: 0,
    });
  }

  // spawn a SPECIFIC fish near the diver (used so secret fish pop in the
  // instant you meet their condition, then mingle with the regular pool)
  function spawnSpecificFish(def) {
    var loc = D.LOCATIONS[run.area];
    var sy = clamp(run.diver.y + (Math.random() - 0.5) * 180, 30, loc.maxDepth * PXPM);
    var sx = run.diver.x + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 80);
    run.fish.push({
      uid: "s" + (Math.random() * 1e9 | 0) + run.time, def: def,
      x: clamp(sx, 20, loc.worldWidth - 20), y: sy, baseY: sy,
      vx: 40 * (Math.random() < 0.5 ? -1 : 1), phase: Math.random() * 6,
      shiny: Math.random() < shinyChance(run.area), size: def.size, fleeing: 0,
    });
  }

  function spawnBoss(defId, isBlob) {
    var loc = D.LOCATIONS[run.area];
    var def = D.FISH_BY_ID[defId];
    var shiny = Math.random() < shinyChance(run.area);
    run.fish.push({
      uid: defId,
      def: def,
      x: loc.worldWidth / 2,
      y: loc.maxDepth * PXPM - 60,
      baseY: loc.maxDepth * PXPM - 60,
      vx: 20, phase: 0, shiny: shiny, size: def.size, fleeing: 0,
      isKraken: !isBlob, isBlob: isBlob, isBoss: true, hp: bossHP(3, def), hitFlash: 0,
    });
    run.bossPresent = true;
    if (window.AUDIO) { AUDIO.rumble(); if (isBlob) AUDIO.playBlob(); else AUDIO.playBoss(); }
    toast("The water TREMBLES... something colossal rises from the abyss! Hit it with HARPOONS! 🔱", "epic", 5000);
  }

  // The fish the game *claims* summon the Kraken (the lie).
  function requiredMet() {
    for (var i = 0; i < D.REQUIRED_FISH.length; i++) {
      if (!state.discovered[D.REQUIRED_FISH[i]]) return false;
    }
    return true;
  }
  function requiredProgress() {
    var n = 0;
    for (var i = 0; i < D.REQUIRED_FISH.length; i++) if (state.discovered[D.REQUIRED_FISH[i]]) n++;
    return n;
  }
  // TRUE 100% — EVERYTHING: every fish/creature/bird and every secret across
  // every dive site, INCLUDING the hidden secret locations and all new content.
  // (The Sanctuary itself is excluded only because it is unlocked AFTER the
  // Kraken; you can't be asked to finish it first.)
  function trueComplete() {
    for (var i = 0; i < D.COMPLETION_FISH.length; i++) {
      var cf = D.FISH_BY_ID[D.COMPLETION_FISH[i]];
      if (cf.area === "sanctuary") continue;
      if (!state.discovered[cf.id]) return false;
    }
    for (var j = 0; j < D.FISH.length; j++) {
      var f = D.FISH[j];
      if (f.secret && f.area !== "sanctuary" && !state.discovered[f.id]) return false;
    }
    return true;
  }
  // every ordinary (non-secret/boss/creature/bird) fish in an area discovered?
  function areaFishComplete(area) {
    for (var i = 0; i < D.FISH.length; i++) {
      var f = D.FISH[i];
      if (f.area !== area || f.areaBoss || f.secret || f.creature || f.bird) continue;
      if (!state.discovered[f.id]) return false;
    }
    return true;
  }
  function unlockSecretArea(id, msg) {
    if (state.areas[id]) return;
    state.areas[id] = true; saveGame();
    toast(msg, "epic", 5000);
    if (window.AUDIO) AUDIO.rumble();
  }
  // Hidden passages out of ordinary areas. Swim into the spot and the FIRST
  // time it simply happens (you're swept straight in); every visit AFTER, an
  // "Enter Secret Location" button lets you dive in from that spot.
  var SECRET_PASSAGES = [
    { from: "river", to: "japan", msg: "⛩️ A tunnel in the riverbed opens onto a HIDDEN COAST — the Ornate Ocean!",
      at: function (d, loc) { return d.x > loc.worldWidth - 70 && d.y > loc.maxDepth * PXPM - 70; },
      guide: "Sink into the far-RIGHT corner of the riverbed and swim down through the tunnel in the floor." },
    { from: "kelp", to: "backrooms", msg: "🚪 You squeeze through a crack in the sea floor... and fall into THE BACKROOMS!",
      at: function (d, loc) { return d.x < 30 && d.y > loc.maxDepth * PXPM - 50; },
      guide: "Sink to the far-LEFT seabed of the Kelp Forest and slip through the crack." },
    { from: "storm", to: "pirate", msg: "☠️ You're dragged through a galleon's hull into a DROWNED COVE of pirates!",
      at: function (d, loc) { return d.x < 26 && d.y > loc.maxDepth * PXPM - 46; },
      guide: "Dive to the wreck-strewn far-LEFT floor of the Stormy Seas." },
  ];
  // How to reach every hidden dive site (revealed by the $35k guide)
  // Each hidden dive site has its OWN hint to buy. Early ones share a base
  // price; later-game sites cost more. `teaser` is shown before purchase (no
  // spoilers — it never names the hidden site); `how` is revealed after.
  // `requires` = you only hear the rumour once you've unlocked that source area
  // (so late-game sites aren't spoiled early).
  var SECRET_SITE_GUIDE = [
    { area: "japan",      requires: "river",   price: 6000,  teaser: "A fisherman swears a hidden coast lies somewhere past <b>River Run</b>.",
      how: "Sink into the far-RIGHT corner of the <b>River Run</b> riverbed and swim down through the tunnel in the floor." },
    { area: "backrooms",  requires: "kelp",    price: 6000,  teaser: "Something is wrong beneath the <b>Kelp Forest</b> floor...",
      how: "Sink to the far-LEFT seabed of the <b>Kelp Forest</b> and slip through the crack in the floor." },
    { area: "pirate",     requires: "storm",   price: 16000, teaser: "A cursed place sleeps somewhere under the <b>Stormy Seas</b>.",
      how: "Dive the wreck-strewn far-LEFT floor of the <b>Stormy Seas</b>." },
    { area: "oilrig",     requires: "opensea", price: 16000, teaser: "A derelict structure rusts somewhere out in the <b>Open Sea</b>.",
      how: "Smash sea-floor cages with the <b>Sledgehammer</b> to pry out a Cage Key, then carry it to the sunken rig in the Open Sea." },
    { area: "flooded",    requires: "opensea", price: 24000, teaser: "Sailors whisper of a freighter lost in the deep, full of loot.",
      how: "Fully strip the loot from <b>3 cargo-ship wrecks</b>, then swim into another cargo wreck's hold." },
    { area: "olympus",    requires: "mountain", price: 35000, teaser: "They say something divine waits above the highest peak of all.",
      how: "Own the <b>Storm Summoner</b>, climb to the tallest peak of the <b>Sunlit Peaks</b>, line up with its tip and summon a storm." },
    { area: "grotto",     requires: "desert", price: 30000, teaser: "Legends tell of four ancient jewels and a tomb sealed beneath the dunes.",
      how: "Collect the four jewels — RED in Prism Reef, BLUE in the Open Sea, GREEN in River Run, YELLOW in the Buried Dunes — then enter the pyramid that rises in the <b>Buried Dunes</b>." },
  ];
  var pendingSecretEnter = null; // area id to dive into after this frame
  // hidden-area discovery checks, run every dive frame
  function checkSecretUnlocks(loc, depthM) {
    var d = run.diver;
    run.secretEdge = null;
    for (var i = 0; i < SECRET_PASSAGES.length; i++) {
      var p = SECRET_PASSAGES[i];
      if (p.from !== run.area) continue;
      if (!p.at(d, loc)) continue;
      if (!state.areas[p.to]) {
        // first discovery — it just happens: reveal AND sweep you straight in
        unlockSecretArea(p.to, p.msg);
        pendingSecretEnter = p.to;
      } else {
        // already known — offer a one-tap entrance from this very spot
        run.secretEdge = p.to;
      }
      break;
    }
  }
  // gating helpers for the Cloud Reaches (all birds) & Gloom Cavern (all
  // creatures — excluding the cave's own, to avoid a chicken-and-egg lock).
  // (the post-game Sanctuary's birds/creatures are excluded so these areas
  //  stay reachable BEFORE the Kraken, not after it)
  function allBirdsFound() {
    for (var i = 0; i < D.FISH.length; i++) { var f = D.FISH[i]; if (f.bird && f.area !== "sanctuary" && !state.discovered[f.id]) return false; }
    return true;
  }
  function allCreaturesFound() {
    for (var i = 0; i < D.FISH.length; i++) { var f = D.FISH[i]; if (f.creature && f.area !== "cave" && f.area !== "sanctuary" && !state.discovered[f.id]) return false; }
    return true;
  }
  // What (if anything) should rise in the Trench right now? Blobfish first —
  // so you still meet it even if you hit 100% before triggering the fake-out.
  function bossToSummon() {
    if (!state.blobfishCaught && requiredMet()) return "blobfish";
    if (!state.krakenCaught && trueComplete()) return "kraken";
    return null;
  }

  // Bosses get tougher the more you've beaten (so late bosses aren't trivial).
  // Meg Tooth still shaves one hit off every boss.
  // ----- defeated bosses return as rare LEGENDARY catches in their home area --
  var LEGEND_DEFS = {};
  function legendDefFor(boss) {
    if (!LEGEND_DEFS[boss.id]) {
      var d = {}; for (var k in boss) d[k] = boss[k];
      d.size = Math.min(6, boss.size);    // shrunk so you can actually bag it
      d.legendary = true;
      d.areaBoss = false; d.secretBoss = false; d.hp = undefined; // a catch, not a fight
      LEGEND_DEFS[boss.id] = d;
    }
    return LEGEND_DEFS[boss.id];
  }
  function defeatedBossDefsForArea(area) {
    var out = [];
    for (var i = 0; i < D.FISH.length; i++) {
      var f = D.FISH[i]; if (f.area !== area) continue;
      if (f.areaBoss && state.areaBossCaught[f.id]) out.push(f);
      else if (f.secretBoss && state[f.id + "Caught"]) out.push(f);
    }
    return out;
  }
  // total bosses you've ever beaten (area + secret + trench), drives difficulty
  function totalBossesBeaten() {
    var n = 0;
    for (var k in state.areaBossCaught) if (state.areaBossCaught[k]) n++;
    if (state.blobfishCaught) n++;
    if (state.krakenCaught) n++;
    var secret = ["magmawyrm", "cavernwyrm", "assfish", "leatherback", "davyjones", "mechakaiju"];
    for (var i = 0; i < secret.length; i++) if (state[secret[i] + "Caught"]) n++;
    return n;
  }
  // a "tier" for an area from its unlock cost — later/pricier sites = tougher bosses
  function areaTier(area) {
    var loc = D.LOCATIONS[area]; if (!loc) return 0;
    var c = loc.cost || 0;
    if (loc.secret) c += 120000;           // hidden sites are end-game tough
    return Math.min(5, Math.floor(c / 45000));
  }
  // catches sell for MORE the further on the area is, so each new (pricier)
  // site funds the upgrades and unlocks ahead of it.
  function areaValueMult(area) { return 1 + areaTier(area) * 0.22; } // tier 0..5 → ×1.0..×2.1
  function bossHP(base, def) {
    var beaten = totalBossesBeaten();
    var tier = (def && def.area) ? areaTier(def.area) : 0;
    var depthTier = def ? Math.floor((def.minDepth || 0) / 350) : 0;
    var scaled = base + 1 + Math.floor(beaten * 1.0) + Math.floor(tier * 0.7) + depthTier;
    return Math.max(1, scaled - (itemOn("megtooth") ? 1 : 0));
  }

  // area bosses: appear once every regular fish in their area is caught
  var AREA_BOSS_BY_AREA = {};
  D.FISH.forEach(function (f) { if (f.areaBoss) AREA_BOSS_BY_AREA[f.area] = f.id; });

  // ----- Achievements -----
  function discCount() { return Object.keys(state.discovered).length; }
  function shinyCount() { return Object.keys(state.shinyFound).length; }
  function bossesBeaten() { var n = 0; for (var k in state.areaBossCaught) if (state.areaBossCaught[k]) n++; return n; }
  var ACHIEVEMENTS = [
    { id: "earn10k",  name: "Pocket Money",     desc: "Earn $10,000 in total",   check: function () { return state.stats.earned >= 10000; } },
    { id: "earn100k", name: "Big Hauls",        desc: "Earn $100,000 in total",  check: function () { return state.stats.earned >= 100000; } },
    { id: "earn1m",   name: "Millionaire",      desc: "Earn $1,000,000 in total",check: function () { return state.stats.earned >= 1000000; } },
    { id: "fish10",   name: "Getting Started",  desc: "Discover 10 species",     check: function () { return discCount() >= 10; } },
    { id: "fish50",   name: "Naturalist",       desc: "Discover 50 species",     check: function () { return discCount() >= 50; } },
    { id: "fish100",  name: "Marine Biologist", desc: "Discover 100 species",    check: function () { return discCount() >= 100; } },
    { id: "shiny1",   name: "Ooh, Shiny!",      desc: "Find your first shiny",   check: function () { return shinyCount() >= 1; } },
    { id: "shiny10",  name: "Shiny Hunter",     desc: "Find 10 shiny species",   check: function () { return shinyCount() >= 10; } },
    { id: "boss1",    name: "Giant Slayer",     desc: "Defeat any area boss",    check: function () { return bossesBeaten() >= 1; } },
    { id: "bossAll",  name: "Apex Predator",    desc: "Defeat every area boss",  check: function () { return bossesBeaten() >= Object.keys(AREA_BOSS_BY_AREA).length; } },
    { id: "secret1",  name: "Hidden Depths",    desc: "Catch a secret fish",     check: function () { for (var i = 0; i < D.FISH.length; i++) { var f = D.FISH[i]; if (f.secret && state.discovered[f.id]) return true; } return false; } },
    { id: "deep1000", name: "Into the Abyss",   desc: "Dive to 1000m deep",      check: function () { return state.stats.maxDepth >= 1000; } },
    { id: "earn5m",   name: "Sea Tycoon",       desc: "Earn $5,000,000 in total",check: function () { return state.stats.earned >= 5000000; } },
    { id: "kraken",   name: "The Legend",       desc: "Catch the Kraken",        check: function () { return state.krakenCaught; } },
  ];
  function checkAchievements() {
    if (!state.achievements) state.achievements = {};
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var a = ACHIEVEMENTS[i];
      if (!state.achievements[a.id] && a.check()) {
        state.achievements[a.id] = Date.now();
        toast("🏆 Achievement: " + a.name, "epic", 3200);
      }
    }
  }
  function areaBossForArea(area) {
    var id = AREA_BOSS_BY_AREA[area];
    if (!id || state.areaBossCaught[id]) return null;
    var trig = (D.FISH_BY_ID[id] && D.FISH_BY_ID[id].trigger) || "fish";
    // special whole-collection triggers (Gloom Cavern rises once every creature is caught)
    if (trig === "allcreatures") return allCreaturesFound() ? id : null;
    if (trig === "allbirds") return allBirdsFound() ? id : null;
    for (var i = 0; i < D.FISH.length; i++) {
      var f = D.FISH[i];
      if (f.area !== area || f.areaBoss || f.isKraken || f.isBlob || f.secret) continue;
      var match = trig === "creatures" ? !!f.creature : (!f.creature && !f.bird);
      if (match && !state.discovered[f.id]) return null;
    }
    return id;
  }
  function spawnAreaBoss(id) {
    var def = D.FISH_BY_ID[id], loc = D.LOCATIONS[run.area];
    run.fish.push({
      uid: id, def: def, x: loc.worldWidth / 2, y: loc.maxDepth * PXPM - 60, baseY: loc.maxDepth * PXPM - 60,
      vx: 18, phase: 0, shiny: false, size: def.size, fleeing: 0, isBoss: true, areaBoss: true, hp: bossHP(def.hp || 3, def), hitFlash: 0,
    });
    run.bossPresent = true;
    if (window.AUDIO) { AUDIO.rumble(); AUDIO.playBoss(); }
    toast("A monstrous " + def.name + " rises! Harpoon it! 🔱", "epic", 5000);
  }

  // a one-off secret boss (e.g. Davy Jones' Serpent from the captain's chest)
  function spawnSecretBoss(id) {
    var def = D.FISH_BY_ID[id], loc = D.LOCATIONS[run.area];
    // wyrm-style ambushers burst out next to you; others rise from the deep
    var atx = def.fromSmoke ? run.diver.x + (Math.random() < 0.5 ? -1 : 1) * 60 : loc.worldWidth / 2;
    var aty = def.fromSmoke ? run.diver.y : loc.maxDepth * PXPM - 60;
    run.fish.push({
      uid: id, def: def, x: atx, y: aty, baseY: aty,
      vx: 20, phase: 0, shiny: false, size: def.size, fleeing: 0, isBoss: true, secretBoss: true,
      hp: def.hp === 1 ? 1 : bossHP(def.hp || 5, def), hitFlash: 0,
    });
    run.bossPresent = true;
    if (window.AUDIO) { AUDIO.rumble(); AUDIO.playBoss(); }
    toast(def.fromSmoke ? "🔥 " + def.name + " ERUPTS from the smoke and seizes you — HARPOON IT! 🔱"
                        : id === "cavernwyrm" ? "🐉 " + def.name + " UNCOILS from the abyss — HARPOON IT! 🔱"
                        : id === "assfish" ? "🐡 In the pitch dark, the " + def.name + " drifts up — HARPOON IT! 🔱"
                        : id === "captaincarp" ? "🐟 " + def.name + " SURFACES in a fury — HARPOON IT! 🔱"
                        : "☠️ The chest bursts open — " + def.name + " RISES! Harpoon it! 🔱", "epic", 5000);
  }

  // ---------------------------------------------------------------------
  //  Input
  // ---------------------------------------------------------------------
  var keys = {};
  window.addEventListener("keydown", function (e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === "Escape") closeTopOverlay();
    if ((e.key === " " || e.key.toLowerCase() === "e") && scene === "dive" && run && run.diver.y <= 30) {
      surface();
    }
    if (["arrowup","arrowdown","arrowleft","arrowright"," "].indexOf(e.key.toLowerCase()) >= 0) e.preventDefault();
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });

  // ----- Touch joystick (floating: drag anywhere on the dive screen) -----
  var joy = { active: false, id: null, sx: 0, sy: 0, cx: 0, cy: 0, dx: 0, dy: 0, mag: 0 };
  var JOY_MAX = 60; // px to full tilt

  function setupTouch() {
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });
  }
  function onTouchStart(e) {
    if (scene !== "dive" && !(scene === "aquarium" && aqua && aqua.diverActive)) return;
    if (joy.active) return;
    var t = e.changedTouches[0];
    joy.active = true; joy.id = t.identifier;
    joy.sx = t.clientX; joy.sy = t.clientY;
    joy.cx = t.clientX; joy.cy = t.clientY;
    joy.dx = 0; joy.dy = 0; joy.mag = 0;
    e.preventDefault();
  }
  function onTouchMove(e) {
    if (!joy.active) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier !== joy.id) continue;
      var dx = t.clientX - joy.sx, dy = t.clientY - joy.sy;
      var d = Math.hypot(dx, dy);
      joy.mag = Math.min(1, d / JOY_MAX);
      var l = d || 1;
      joy.dx = dx / l; joy.dy = dy / l;
      joy.cx = joy.sx + joy.dx * Math.min(d, JOY_MAX);
      joy.cy = joy.sy + joy.dy * Math.min(d, JOY_MAX);
    }
    e.preventDefault();
  }
  function onTouchEnd(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joy.id) {
        joy.active = false; joy.id = null; joy.mag = 0; joy.dx = 0; joy.dy = 0;
      }
    }
  }

  // ---------------------------------------------------------------------
  //  Canvas / rendering
  // ---------------------------------------------------------------------
  var canvas, ctx, W = 960, H = 600;
  var cam = { x: 0, y: 0 };

  function resize() {
    var wrap = document.getElementById("stage");
    W = wrap.clientWidth;
    H = wrap.clientHeight;
    canvas.width = W * (window.devicePixelRatio || 1);
    canvas.height = H * (window.devicePixelRatio || 1);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.imageSmoothingEnabled = false; // crisp pixel-art upscaling
  }

  // ---------------------------------------------------------------------
  //  Main loop
  // ---------------------------------------------------------------------
  var lastT = 0;
  function loop(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0);
    lastT = t;
    // never let a per-frame exception kill the rAF chain (which would freeze
    // the whole game, e.g. leaving you unable to dive after the aquarium)
    try {
      if (scene === "dive" && run) {
        update(dt);
        if (pendingSecretEnter) { var pe = pendingSecretEnter; pendingSecretEnter = null; enterSecretArea(pe); }
        else render();
      } else if (scene === "aquarium" && aqua) {
        updateAquarium(dt);
        renderAquarium();
      }
    } catch (err) {
      if (window.console) console.error("loop error", err);
    }
    requestAnimationFrame(loop);
  }

  function update(dt) {
    run.time += dt;
    var loc = D.LOCATIONS[run.area];
    var diver = run.diver;

    // --- movement (keyboard OR touch joystick) ---
    var sp = speed();
    var ax = 0, ay = 0, mag = 1;
    if (keys["a"] || keys["arrowleft"]) ax -= 1;
    if (keys["d"] || keys["arrowright"]) ax += 1;
    if (keys["w"] || keys["arrowup"]) ay -= 1;
    if (keys["s"] || keys["arrowdown"]) ay += 1;
    if (joy.active && (joy.mag > 0.08)) { ax = joy.dx; ay = joy.dy; mag = joy.mag; }
    var len = Math.hypot(ax, ay);
    var tvx = 0, tvy = 0;
    if (len > 0.001) {
      tvx = (ax / len) * sp * mag;
      tvy = (ay / len) * sp * mag;
      if (Math.abs(ax) > 0.05) diver.face = ax > 0 ? 1 : -1;
      // remember the aim direction so the torch / breath / sling point where
      // you're steering, not just left/right
      run.aimX = ax / len; run.aimY = ay / len;
    }
    // ease velocity toward the target so movement glides naturally instead of
    // snapping (fixes the "stiff + slippery" feel): quick to start, quick to stop
    var resp = 1 - Math.exp(-(len > 0.001 ? 11 : 14) * dt);
    diver.vx += (tvx - diver.vx) * resp;
    diver.vy += (tvy - diver.vy) * resp;
    if (Math.abs(diver.vx) < 1.5 && Math.abs(diver.vy) < 1.5 && len <= 0.001) { diver.vx = diver.vy = 0; }
    diver.x = diver.x + diver.vx * dt;
    // Null Zone: swim off one side of the world and reappear on the other
    if (itemOn("nullzone")) {
      if (diver.x < -10) diver.x = loc.worldWidth - 12;
      else if (diver.x > loc.worldWidth + 10) diver.x = 12;
    } else diver.x = clamp(diver.x, 12, loc.worldWidth - 12);
    // Roc Feather lets you breach up into the sky to grab birds (not in the cloud area, which is already sky)
    var minY = (itemOn("rocfeather") && !loc.airArea) ? -340 : 0;
    diver.y = clamp(diver.y + diver.vy * dt, minY, loc.maxDepth * PXPM);

    // track special secret-catch movement: circling & stillness.
    // Prefer the joystick angle — that way just swirling your thumb in a
    // circle counts, even if the diver bumps a wall and barely moves.
    var ang = null;
    if (joy.active && joy.mag > 0.15) ang = Math.atan2(joy.dy, joy.dx);
    else if (Math.hypot(diver.vx, diver.vy) > 8) ang = Math.atan2(diver.vy, diver.vx);
    if (ang != null) {
      if (run.lastAng != null) {
        var dA = ang - run.lastAng;
        while (dA > Math.PI) dA -= 2 * Math.PI;
        while (dA < -Math.PI) dA += 2 * Math.PI;
        run.spin = (run.spin || 0) + dA;
      }
      run.lastAng = ang; run.stillTimer = 0;
    } else {
      run.lastAng = null; run.stillTimer = (run.stillTimer || 0) + dt;
    }
    run.spin = (run.spin || 0) * 0.995; // slow decay (gives time to complete the loop)

    var depthM = diver.y / PXPM;
    checkSecretUnlocks(loc, depthM);
    run.diveDepthReached = Math.max(run.diveDepthReached, depthM);
    if (depthM > state.stats.maxDepth) state.stats.maxDepth = Math.floor(depthM);

    // --- oxygen ---
    if (diver.y > 26) {
      var drain = (1 + depthFactor(diver.y, loc) * 0.6) * oxygenMul();
      if (loc.cold && !state.items.coldsuit) drain *= 2;   // freezing without a Cold Suit
      if (loc.hot && !state.items.heatsuit) drain *= 1.9;  // searing without a Heat Suit
      run.oxygen -= drain * dt;
      // manual venting: dump air fast (for low-oxygen secrets) but never below
      // a safe floor just under the "low oxygen" threshold so you can't drown
      if (run.venting) {
        run.oxygen = Math.max(run.oxygen - 26 * dt, run.maxO * 0.12);
        if (Math.random() < 0.9) run.bubbles.push({ x: diver.x + (Math.random() - 0.5) * 14, y: diver.y - 4, r: 2 + Math.random() * 4, vy: 60 + Math.random() * 40, life: 1.6 });
      }
      if (run.oxygen <= 0) {
        // Diving Bell: a one-per-dive emergency air reserve
        if (state.items.divingbell && !run.bellUsed) {
          run.bellUsed = true; run.oxygen = run.maxO;
          toast("🛎️ Your Diving Bell kicks in — oxygen restored! (once per dive)", "good", 2600);
        } else { driftHome(); return; }
      }
    } else {
      run.oxygen = run.maxO; // refill at surface
    }

    // --- bubbles from diver (no bubbles up in the open sky) ---
    if (!loc.airArea && Math.random() < 0.4 && diver.y > 20) {
      run.bubbles.push({ x: diver.x + (Math.random() - 0.5) * 8, y: diver.y - 6, r: 1 + Math.random() * 3, vy: 40 + Math.random() * 30, life: 2 });
    }

    // --- spawn fish over time ---
    run.spawnTimer -= dt;
    if (run.spawnTimer <= 0) {
      run.spawnTimer = 0.5 + Math.random() * 0.8;
      spawnFish(false);
    }

    // --- legendary returns: a boss you've beaten prowls its home area as a
    //     rare, catchable LEGENDARY (no fight, big payout) ---
    if (!run.bossPresent) {
      run.legendTimer -= dt;
      if (run.legendTimer <= 0) {
        run.legendTimer = 30 + Math.random() * 45;
        var beaten = defeatedBossDefsForArea(run.area);
        // native legendary fish (e.g. the Golden Gharial) also appear this way
        for (var lgi = 0; lgi < D.FISH.length; lgi++) {
          var lgf = D.FISH[lgi];
          if (lgf.area === run.area && lgf.legendary && !lgf.areaBoss && !lgf.secretBoss && !lgf.bird && !state.discovered[lgf.id]) beaten.push(lgf);
          else if (lgf.area === run.area && lgf.legendary && !lgf.areaBoss && !lgf.secretBoss && !lgf.bird && Math.random() < 0.5) beaten.push(lgf);
        }
        if (beaten.length && run.fish.length < 30 && Math.random() < 0.5) {
          var src = beaten[(Math.random() * beaten.length) | 0];
          var ldef = (src.legendary && !src.areaBoss && !src.secretBoss) ? src : legendDefFor(src);
          var lx = clamp(diver.x + (Math.random() < 0.5 ? -1 : 1) * (260 + Math.random() * 200), 30, loc.worldWidth - 30);
          var ly = clamp(diver.y + (Math.random() - 0.5) * 280, 40, loc.maxDepth * PXPM - 20);
          run.fish.push({ uid: ldef.id + "_L", def: ldef, x: lx, y: ly, baseY: ly,
            vx: (lx < diver.x ? 1 : -1) * (26 + Math.random() * 16), phase: Math.random() * 6,
            shiny: Math.random() < shinyChance(run.area), size: ldef.size, fleeing: 0, legendary: true });
          toast("✨ A LEGENDARY " + ldef.name + " prowls these waters — bag it! ✨", "epic", 2800);
        }
      }
    }

    // --- secret fish: pop in the INSTANT you satisfy their condition ---
    for (var sx2 = 0; sx2 < D.FISH.length; sx2++) {
      var sf = D.FISH[sx2];
      if (!sf.secret || sf.bird || run.secretShown[sf.id]) continue; // secret birds spawn via the bird system
      if (sf.area !== run.area && !loc.allContent) continue;
      if (!state.hints[sf.id]) continue;            // still need the hint bought
      if (sf.night && !run.night) continue;
      // ONCE you've discovered it, it joins the pool but only rarely (a per-dive
      // roll) instead of appearing every single time you meet its condition
      if (state.discovered[sf.id]) {
        if (!run.secretRoll) run.secretRoll = {};
        if (run.secretRoll[sf.id] === undefined) run.secretRoll[sf.id] = Math.random() < 0.2;
        if (!run.secretRoll[sf.id]) { run.secretShown[sf.id] = true; continue; }
      }
      if (secretConditionMet(sf, depthM)) {
        spawnSpecificFish(sf);
        run.secretShown[sf.id] = true;
        toast(state.discovered[sf.id] ? "✦" : "Something rare stirs nearby... ✦", "epic", 1400);
      }
    }

    // --- Ashen smoke clouds (obscure the water) + the Magma Wyrm ambush ---
    if (loc.smoke) {
      run.smokeTimer -= dt;
      if (run.smokeTimer <= 0 && run.smoke.length < 6) {
        run.smokeTimer = 1.5 + Math.random() * 2;
        run.smoke.push({ x: Math.random() * loc.worldWidth, y: 60 + Math.random() * (loc.maxDepth * PXPM - 80), r: 60 + Math.random() * 60, vx: (Math.random() - 0.5) * 20, vy: -6 - Math.random() * 8, life: 8 + Math.random() * 6, phase: Math.random() * 6 });
      }
      var inSmoke = false;
      for (var smi = run.smoke.length - 1; smi >= 0; smi--) {
        var sm = run.smoke[smi];
        sm.x += sm.vx * dt; sm.y += sm.vy * dt; sm.life -= dt; sm.phase += dt;
        if (sm.life <= 0) { run.smoke.splice(smi, 1); continue; }
        if (Math.hypot(sm.x - diver.x, sm.y - diver.y) < sm.r) inSmoke = true;
      }
      // Magma Wyrm: once you've caught 10 Magma Eels, it ambushes you from the smoke
      var mw = D.FISH_BY_ID.magmawyrm;
      if (run.area === "ashen" && mw && (state.counts.magmaeel || 0) >= 10 && !state.magmawyrmCaught && !run.bossPresent && inSmoke) {
        run.wyrmTimer -= dt;
        if (run.wyrmTimer <= 0) { spawnSecretBoss("magmawyrm"); run.grab = { boss: run.fish[run.fish.length - 1], wig: 0 }; run.fish[run.fish.length - 1].mode = "grab"; run.fish[run.fish.length - 1].modeT = 6; }
      } else { run.wyrmTimer = 2.5; }
    }

    // boss summon: Trench has the blobfish/Kraken; other areas have area bosses
    if (!run.bossPresent && depthM > 200) {
      if (run.area === "pirate" && state.keyPieces >= 4 && !state.davyjonesCaught) {
        spawnSecretBoss("davyjones");           // the captain's chest rises
      } else if (run.area === "trench") {
        var boss = bossToSummon();
        if (boss === "kraken") spawnBoss("kraken", false);
        else if (boss === "blobfish") spawnBoss("blobfish", true);
      } else if (run.area === "cave" && state.hints.cavernwyrm && !state.cavernwyrmCaught
                 && depthM > loc.maxDepth * 0.82) {
        spawnSecretBoss("cavernwyrm");          // the giant wyrm wakes at the very bottom
      } else if (run.area === "japan" && state.hints.mechakaiju && state.areaBossCaught.rigtitan
                 && state.areaBossCaught.kaiju && !state.mechakaijuCaught) {
        spawnSecretBoss("mechakaiju");          // wakes only after the Kaiju AND Rig Titan fall
      } else if (run.area === "backrooms" && !state.captaincarpCaught && furnitureComplete()) {
        spawnSecretBoss("captaincarp");         // the furious carp surfaces for revenge
      } else {
        var ab = areaBossForArea(run.area);
        if (ab) spawnAreaBoss(ab);
        else if (run.area === "opensea" && (state.openseaClams || 0) >= 15 && !state.leatherbackCaught) {
          spawnSecretBoss("leatherback");
        }
      }
    }

    // --- update fish (MAGNET catching: fish are drawn toward you) ---
    var mRange = catchRadius();      // "Catch Gadget" upgrade = magnet range
    var mStr = reelMul();            // "Reel Motor" upgrade = magnet strength
    var full = run.bagUsed >= inventoryCap();
    for (var i = run.fish.length - 1; i >= 0; i--) {
      var f = run.fish[i];
      f.phase += dt * 2;
      var dx = diver.x - f.x, dy = diver.y - f.y;
      var dist = Math.hypot(dx, dy) || 0.001;
      // only pull fish that actually fit (or shinies with a Shiny Pocket) —
      // this also stops the "hold full" toast from spamming on big fish
      var fits = run.bagUsed + f.size <= inventoryCap();
      var canGrab = fits || (f.shiny && state.items.shinyPocket);
      if (f.isBoss) { canGrab = false; if (f.hitFlash > 0) f.hitFlash -= dt; } // bosses need harpoons
      // Jelly Stinger: zap nearby fish so they stop fleeing (easy to magnet)
      if (itemOn("jellystinger") && !f.isBoss && dist < mRange + 50) { f.fleeing = 0; f.stunned = 0.3; }
      // cargo-full notice: a catchable fish came into range but won't fit
      if (full && !canGrab && !f.isBoss && dist < mRange) {
        if (run.time - (run.fullHint || -99) > 5) { run.fullHint = run.time; toast("Inventory full! Surface to sell.", "bad", 1500); }
      }
      // skittish secrets (e.g. the White Squid) bolt away when you near them —
      // you have to CHASE and corner them for the magnet to grab
      if (f.def.skittish && dist < 360) {
        f.fleeing = 0.6;
        f.vx = (-dx / dist) * 110;          // dart away horizontally
        f.baseY += (-dy / dist) * 90 * dt;  // and vertically
        f.baseY = clamp(f.baseY, 20, loc.maxDepth * PXPM - 10);
      }
      // shy fish (Flooded Freighter) shy away from any diver, darting for cover —
      // milder than skittish, so you can still corner them
      if (f.def.shy && !f.isBoss && dist < 200) {
        f.fleeing = 0.5;
        f.vx = (dx < 0 ? 1 : -1) * Math.max(Math.abs(f.vx) || 0, 75);
        f.baseY += (-dy / dist) * 55 * dt;
        f.baseY = clamp(f.baseY, 20, loc.maxDepth * PXPM - 10);
      }
      var grabbing = false;
      if (canGrab && dist < mRange) {
        // pull toward the diver (stronger when closer; big fish resist)
        var t = 1 - dist / mRange;
        var pull = (55 + mStr * 75) * t / (0.55 + f.size * 0.42);
        f.x += (dx / dist) * pull * dt;
        f.baseY += (dy / dist) * pull * dt;
        f.vx *= 0.9;
        f.pulled = 0.15;
        grabbing = true;
        // catch hitbox scales with the fish's body so big fish (whales!) don't slip away
        if (dist < 16 + f.size * 4) { catchFish(f); continue; }
      }
      if (!grabbing) {
        var speedScale = f.fleeing > 0 ? 2.4 : 1;
        f.x += f.vx * dt * speedScale;
      }
      f.y = f.baseY + Math.sin(f.phase) * 10;
      if (f.fleeing > 0) f.fleeing -= dt;
      if (f.pulled > 0) f.pulled -= dt;

      // wrap / despawn off-world (bosses bounce, never despawn)
      if (f.x < -120 || f.x > loc.worldWidth + 120) {
        if (!f.isBoss) { run.fish.splice(i, 1); continue; }
        else { f.vx *= -1; }
      }
    }
    var cr = mRange;

    // --- boss AI: charge, grab (drain O2 — wiggle free!) & the Kaiju's breath ---
    if (run.bossPresent) {
      var theBoss = null;
      for (var bx2 = 0; bx2 < run.fish.length; bx2++) if (run.fish[bx2].isBoss && run.fish[bx2].hp > 0) { theBoss = run.fish[bx2]; break; }
      if (theBoss) updateBossAI(theBoss, dt, diver);
    } else { run.grab = null; run.bossBeam = null; }
    if (run.torpedoes.length) updateTorpedoes(dt, diver, loc);
    if (run.fireballs.length) updateFireballs(dt, diver, loc);

    // --- Deploy Net: any fish inside the dropped net is bagged (ignores hold) ---
    if (run.trap && run.trap.active && run.trap.r > 0) {
      for (var tpi = run.fish.length - 1; tpi >= 0; tpi--) {
        var tpf = run.fish[tpi];
        if (tpf.isBoss) continue;
        if (Math.hypot(tpf.x - run.trap.x, tpf.y - run.trap.y) < run.trap.r) catchFish(tpf, true);
      }
    }

    // --- sea-floor creatures (caught with a Net; magnet ignores them) ---
    // (skipped in the Cloud Reaches / Gloom Cavern, where creatures & birds
    //  instead swim freely and are magnet-caught like fish via spawnFish)
    var special = loc.birdPool || loc.creaturePool;
    run.creatureTimer -= dt;
    if (run.creatureTimer <= 0) { run.creatureTimer = 1.5 + Math.random() * 2.5; if (!special) spawnCreature(false); }
    var netR = netSize();              // Fishing Net upgrade size (0 = none)
    var hasNet = netR > 0;
    for (var ci = run.creatures.length - 1; ci >= 0; ci--) {
      var c = run.creatures[ci];
      c.phase += dt * (c.def.shape === "clam" ? 1.4 : 5);
      if (!c.def.tool) c.x += c.vx * dt;   // clams stay put
      c.y = run.floorY - 8 + Math.sin(c.phase) * 1.2;
      if (c.x < -60 || c.x > loc.worldWidth + 60) { run.creatures.splice(ci, 1); continue; }
      var cdx = diver.x - c.x, cdy = diver.y - c.y, cdist = Math.hypot(cdx, cdy);
      if (c.def.tool === "shovel") {            // clams: prised open with the Shovel — only while OPEN
        var clamOpen = Math.sin(c.phase) > 0.1;
        if (shovelLevel() > 0) {
          if (clamOpen && cdist < 55 && catchCreature(c)) {
            startNetFx(c, 55); if (c.hasPearl) dropPearl(c);
            if (run.area === "opensea" && !state.leatherbackCaught) {   // dig clams here to summon the Leatherback
              state.openseaClams = (state.openseaClams || 0) + 1; saveGame();
              if (state.openseaClams === 15) toast("🐢 15 clams dug! Something colossal stirs in the Open Sea deep...", "epic", 4000);
              else toast("Open Sea clams: " + state.openseaClams + "/15", "good", 1400);
            }
            run.creatures.splice(ci, 1);
          }
          else if (!clamOpen && cdist < 50 && run.time - (run.netHint || -99) > 6) { run.netHint = run.time; toast("Wait for the clam to open...", "bad", 1400); }
        } else if (cdist < 60 && run.time - (run.netHint || -99) > 12) {
          run.netHint = run.time; toast("Buy a ⛏️ Shovel (Shop → Tools) to pry open clams!", "bad", 2400);
        }
      } else if (hasNet) {
        if (cdist < netR && catchCreature(c)) { startNetFx(c, netR); run.creatures.splice(ci, 1); }
      } else if (cdist < 60 && run.time - (run.netHint || -99) > 12) {
        run.netHint = run.time;
        toast("Buy a Fishing Net (Shop → Gear) to scoop up sea creatures!", "bad", 2400);
      }
    }
    // advance net-swipe effects
    for (var ni = run.netFx.length - 1; ni >= 0; ni--) { run.netFx[ni].life -= dt; if (run.netFx[ni].life <= 0) run.netFx.splice(ni, 1); }

    // --- birds: ambient flocks always drift across the sky (so you can see
    //     what lives here); seed-summoned ones descend to you at the surface ---
    run.birdTimer -= dt;
    if (run.birdTimer <= 0) { run.birdTimer = 2 + Math.random() * 3; if (!special) spawnAmbientBird(); }
    var atSurface = diver.y <= 70;
    for (var bi = run.birds.length - 1; bi >= 0; bi--) {
      var b = run.birds[bi];
      b.phase += dt * 9; // wing flap
      if (b.mode === "ambient") {
        b.x += b.vx * dt;
        b.y = b.baseY + Math.sin(b.phase * 0.2) * 6;
        // Roc Feather: breach up into the sky and magnet ambient birds directly
        if (itemOn("rocfeather")) {
          var abd = Math.hypot(diver.x - b.x, diver.y - b.y);
          if (abd < catchRadius()) { catchBird(b); run.birds.splice(bi, 1); continue; }
        }
        if (b.x < -130 || b.x > loc.worldWidth + 130) run.birds.splice(bi, 1);
        continue;
      }
      if (!atSurface) b.mode = "flee";
      if (b.mode === "flee") {
        b.y -= 110 * dt; b.x += b.vx * dt;
        if (b.y < cam.y - 360) { run.birds.splice(bi, 1); }
      } else {
        var tx = diver.x, ty = diver.y - 34;
        var bdx = tx - b.x, bdy = ty - b.y, bd = Math.hypot(bdx, bdy) || 1;
        b.x += (bdx / bd) * 72 * dt + Math.sin(b.phase * 0.25) * 10 * dt;
        b.y += (bdy / bd) * 72 * dt;
        if (bd < 26) { catchBird(b); run.birds.splice(bi, 1); }
      }
    }

    if (run.stormCd > 0) run.stormCd -= dt;
    // --- Kaiju Breath beam (vacuum up fish it touches) ---
    if (run.breathCd > 0) run.breathCd -= dt;
    if (run.playerBeam) {
      var pbm = run.playerBeam; pbm.life -= dt; pbm.x = diver.x; pbm.y = diver.y;
      for (var pbf = run.fish.length - 1; pbf >= 0; pbf--) {
        var pf2 = run.fish[pbf]; if (pf2.isBoss) continue;
        var rx2 = pf2.x - pbm.x, ry2 = pf2.y - pbm.y;
        var along2 = rx2 * pbm.dx + ry2 * pbm.dy, perp2 = Math.abs(rx2 * -pbm.dy + ry2 * pbm.dx);
        if (along2 > 0 && along2 < pbm.len && perp2 < 40) catchFish(pf2, true);
      }
      if (pbm.life <= 0) run.playerBeam = null;
    }

    // --- slingshot pebbles (knock birds down) ---
    if (run.pebbles) {
      for (var pe = run.pebbles.length - 1; pe >= 0; pe--) {
        var pb = run.pebbles[pe];
        pb.x += pb.vx * dt; pb.vy += 220 * dt; pb.y += pb.vy * dt; pb.life -= dt; // gravity arc
        var pHit = false;
        for (var pbi = run.birds.length - 1; pbi >= 0; pbi--) {
          var bd2 = run.birds[pbi];
          if (Math.hypot(bd2.x - pb.x, bd2.y - pb.y) < 22 + bd2.def.size * 3) {
            catchBird(bd2); run.birds.splice(pbi, 1); pHit = true;
            run.floaters.push({ x: pb.x, y: pb.y, text: "🪃", color: "#ffe9b0", life: 1.0 });
            break;
          }
        }
        if (pHit || pb.life <= 0 || pb.y > diver.y + 400) run.pebbles.splice(pe, 1);
      }
    }

    // --- harpoon projectiles (boss combat) ---
    for (var hi = run.harpoonFx.length - 1; hi >= 0; hi--) {
      var hp = run.harpoonFx[hi];
      hp.x += hp.vx * dt; hp.y += hp.vy * dt; hp.life -= dt;
      var hit = false;
      for (var fi = 0; fi < run.fish.length; fi++) {
        var bo = run.fish[fi];
        if (!bo.isBoss || bo.hp <= 0) continue;
        if (Math.hypot(bo.x - hp.x, bo.y - hp.y) < 30 + bo.size * 3) { harpoonHit(bo); hit = true; break; }
      }
      if (hit || hp.life <= 0 || hp.x < -50 || hp.x > loc.worldWidth + 50) run.harpoonFx.splice(hi, 1);
    }

    // --- treasures near wrecks ---
    run.treasureTimer -= dt;
    if (run.treasureTimer <= 0 && run.treasures.length < 4) {
      run.treasureTimer = 3 + Math.random() * 4;
      maybeSpawnTreasure();
    }
    for (var ti = run.treasures.length - 1; ti >= 0; ti--) {
      var tr = run.treasures[ti];
      tr.phase += dt * 3;
      var tdx = tr.x - diver.x, tdy = tr.y - diver.y;
      if (Math.hypot(tdx, tdy) < cr * 0.8) { collectTreasure(tr); run.treasures.splice(ti, 1); }
    }

    // --- Cages (smashed with the Sledgehammer) ---
    if (run.cages) {
      for (var cgi = 0; cgi < run.cages.length; cgi++) {
        var cg = run.cages[cgi];
        if (cg.opened) continue;
        if (Math.hypot(cg.x - diver.x, cg.y - diver.y) < 46) {
          if (hammerLevel() > 0) {
            cg.opened = true;
            if (window.AUDIO) AUDIO.rumble();
            // a small burst of treasure (more per cage with a stronger hammer)
            for (var bt = 0; bt < (1 + (Math.random() * 2 | 0)) + (hammerLevel() - 1); bt++) {
              var pdef = D.TREASURES[(Math.random() * 7) | 0]; // common-ish loot
              run.treasures.push({ def: pdef, x: cg.x + (Math.random() - 0.5) * 40, y: cg.y - 14 - Math.random() * 24, phase: Math.random() * 6 });
            }
            if (cg.hasKey && !state.items.cagekey) {
              state.items.cagekey = true; saveGame();
              run.floaters.push({ x: cg.x, y: cg.y - 24, text: "🔑 Cage Key!", color: "#ffe14d", life: 2.4 });
              toast("🔑 You pried a strange KEY from the cage. What does it open?", "epic", 4000);
            } else if (run.area === "pirate" && state.keyPieces < 4 && Math.random() < 0.6) {
              state.keyPieces++; saveGame();
              run.floaters.push({ x: cg.x, y: cg.y - 24, text: "☠️ Key Piece " + state.keyPieces + "/4", color: "#ffe14d", life: 2.6 });
              toast(state.keyPieces >= 4 ? "☠️ The Captain's Key is complete! Dive deep — the chest stirs..." : "☠️ A piece of the Captain's Key! (" + state.keyPieces + "/4)", "epic", 3200);
            } else {
              toast("🔨 Cage smashed — treasure spills out!", "good", 1600);
            }
          } else if (run.time - (run.cageHint || -99) > 8) {
            run.cageHint = run.time;
            toast("A locked cage! Buy a 🔨 Sledgehammer (Shop → Tools) to crack it open.", "bad", 2600);
          }
        }
      }
    }
    // --- Gloom Cavern lanterns: snuff all four to wake the Bony-eared Assfish ---
    if (run.lanterns && run.lanterns.length && !state.assfishCaught) {
      var lit = 0;
      for (var li = 0; li < run.lanterns.length; li++) {
        var ln = run.lanterns[li];
        if (ln.lit) {
          if (Math.hypot(ln.x - diver.x, ln.y - diver.y) < 34) {
            ln.lit = false;
            if (window.AUDIO) AUDIO.ui("back");
            var left = run.lanterns.filter(function (q) { return q.lit; }).length;
            toast(left > 0 ? "🕯️ A lantern gutters out... " + left + " still burning." : "🕯️ The last lantern dies — the dark stirs...", left > 0 ? "good" : "epic", 2200);
          } else lit++;
        }
      }
      if (lit === 0 && !run.bossPresent && !run.assfishSpawned) {
        run.assfishSpawned = true;
        spawnSecretBoss("assfish");
      }
    }

    if (run.area === "backrooms") trackCorners(); // CCTV Fish wants all four corners

    // --- Ancient jewels: swim into one to collect it ---
    if (run.jewel) {
      if (Math.hypot(run.jewel.x - diver.x, run.jewel.y - diver.y) < 34) {
        state.jewels[run.jewel.color] = true; saveGame();
        var jc = jewelCount();
        run.floaters.push({ x: run.jewel.x, y: run.jewel.y - 16, text: "💎 " + run.jewel.color + " jewel!", color: run.jewel.col, life: 2.4 });
        toast(jc >= 4 ? "💎 The FOURTH jewel! A pyramid is rising in the Buried Dunes..." : "💎 An ancient " + run.jewel.color + " jewel! (" + jc + "/4)", "epic", 3000);
        if (window.AUDIO) AUDIO.rumble();
        run.jewel = null;
      }
    }
    // --- The pyramid in the Buried Dunes opens the Ancient Grotto ---
    if (run.pyramid && !state.areas.grotto) {
      if (Math.hypot(run.pyramid.x - diver.x, run.pyramid.y - diver.y) < 60) {
        unlockSecretArea("grotto", "🔺 The pyramid's seal answers your four jewels — it grinds open onto the ANCIENT GROTTO!");
        pendingSecretEnter = "grotto";
      }
    }

    // --- The Oil Rig (Open Sea): approach with the Cage Key to open the way ---
    if (run.oilrig && !state.areas.oilrig) {
      if (Math.hypot(run.oilrig.x - diver.x, run.oilrig.y - diver.y) < 90) {
        if (state.items.cagekey) {
          unlockSecretArea("oilrig", "🔑 The key fits a hatch in the rig — it grinds open onto a black sea of oil. A NEW DIVE SITE awaits. (Now in Change Area.)");
        } else if (run.time - (run.rigHint || -99) > 8) {
          run.rigHint = run.time;
          toast("A sealed hatch on the rig... it needs some kind of key.", "bad", 2600);
        }
      }
    }

    // --- Flooded Freighter: once 3 cargo ships are stripped, swim into a cargo
    //     wreck's hold and you drop straight into the hidden freighter ---
    if ((state.cargoSearched || 0) >= 3 && !state.areas.flooded && run.area !== "flooded") {
      for (var cwi = 0; cwi < run.wrecks.length; cwi++) {
        var cw = run.wrecks[cwi];
        if (cw.type !== "cargo") continue;
        if (Math.hypot(cw.x - diver.x, cw.y - diver.y) < 46) {
          unlockSecretArea("flooded", "📦 You slip through a torn container into a vast FLOODED FREIGHTER — its hold teeming with skittish life!");
          pendingSecretEnter = "flooded";
          break;
        }
      }
    }

    // --- Sonar Radar (orca drop): ping hot/cold toward the nearest wreck ---
    if (itemOn("sonar") && run.wrecks.length) {
      var nearest = Infinity;
      for (var swi = 0; swi < run.wrecks.length; swi++) {
        var wk = run.wrecks[swi];
        var sd = Math.hypot(wk.x - diver.x, wk.y - diver.y);
        if (sd < nearest) nearest = sd;
      }
      var sRange = 1000;
      if (nearest < sRange) {
        run.sonarTimer -= dt;
        if (run.sonarTimer <= 0) {
          var close = 1 - nearest / sRange;            // 0 (cold) .. 1 (hot)
          run.sonarTimer = 0.13 + (1 - close) * 1.25;  // pings faster when warmer
          if (window.AUDIO && AUDIO.sonar) AUDIO.sonar(close);
        }
      } else { run.sonarTimer = 0; }
    }

    // --- Eye of the Serpent: cursed coin chests wash up in any dive ---
    if (state.items.serpenteye) {
      run.coinTimer = (run.coinTimer == null ? 8 + Math.random() * 8 : run.coinTimer) - dt;
      if (run.coinTimer <= 0 && run.treasures.length < 6) {
        run.coinTimer = 12 + Math.random() * 12;
        if (!COIN_CHEST) { for (var i = 0; i < D.TREASURES.length; i++) if (D.TREASURES[i].id === "coinchest") COIN_CHEST = D.TREASURES[i]; }
        if (COIN_CHEST) run.treasures.push({ def: COIN_CHEST, x: clamp(diver.x + (Math.random() - 0.5) * 500, 30, loc.worldWidth - 30), y: clamp(diver.y + (Math.random() - 0.5) * 300, 40, loc.maxDepth * PXPM - 20), phase: Math.random() * 6 });
      }
    }

    // --- particles ---
    for (var bi = run.bubbles.length - 1; bi >= 0; bi--) {
      var b = run.bubbles[bi];
      b.y -= b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.y < 0) run.bubbles.splice(bi, 1);
    }
    for (var fl = run.floaters.length - 1; fl >= 0; fl--) {
      var ff = run.floaters[fl];
      ff.y -= 30 * dt; ff.life -= dt;
      if (ff.life <= 0) run.floaters.splice(fl, 1);
    }

    // camera (snapped to the pixel grid so sprites stay crisp).
    // near the surface the camera pans up to reveal lots of sky (for the birds).
    var skyReveal = (itemOn("rocfeather") && diver.y < 120) ? -470 : (diver.y < 80 ? -290 : -150);
    cam.x = Math.round(clamp(diver.x - W / 2, 0, Math.max(0, loc.worldWidth - W)));
    cam.y = Math.round(clamp(diver.y - H / 2, skyReveal, Math.max(0, loc.maxDepth * PXPM + 120 - H)));

    updateHud();
  }

  // per-dive loot budget by wreck type (cargo ships are huge — 10 treasures)
  function wreckCap(w) { return w.type === "cargo" ? 10 : w.type === "yacht" ? 6 : 4; }
  function maybeSpawnTreasure() {
    if (run.wrecks.length === 0) return;
    // only wrecks that still have loot left this dive
    var live = run.wrecks.filter(function (w) { return (w.looted || 0) < wreckCap(w); });
    if (live.length === 0) return;
    var wreck = live[(Math.random() * live.length) | 0];
    var df = depthFactor(wreck.y, D.LOCATIONS[run.area]);
    var isPlane = wreck.type === "plane", isYacht = wreck.type === "yacht", isCargo = wreck.type === "cargo";
    // ship: regular loot. plane/yacht: regular + a chance at their exclusive
    // (richer) treasures. rare+ loot is now genuinely rare.
    var pool = D.TREASURES.filter(function (tt) {
      if (tt.plane) return isPlane && Math.random() < 0.5;   // plane-only loot
      if (tt.yacht) return isYacht && Math.random() < 0.55;  // yacht-only luxury loot
      if (tt.cargo) return isCargo && Math.random() < 0.6;   // cargo containers from cargo ships
      var ro = D.RARITY[tt.rarity].order;
      if (ro >= 3) return Math.random() < (0.04 + df * 0.18) * (isYacht ? 2.2 : isCargo ? 1.4 : 1); // rare+ much rarer
      if (ro === 2) return Math.random() < (0.18 + df * 0.4);
      return Math.random() < 0.9; // common/uncommon are the bread and butter
    });
    if (pool.length === 0) pool = D.TREASURES.filter(function (tt) { return !tt.plane && !tt.yacht && !tt.cargo; });
    var def = pool[(Math.random() * pool.length) | 0];
    wreck.looted = (wreck.looted || 0) + 1; // count it toward this wreck's loot budget
    if (isCargo && wreck.looted >= wreckCap(wreck) && !wreck.credited) { wreck.credited = true; markCargoSearched(); }
    run.treasures.push({
      def: def, x: wreck.x + (Math.random() - 0.5) * wreck.w, y: wreck.y - 10 - Math.random() * 30, phase: Math.random() * 6,
    });
  }
  // fully stripping a cargo ship builds toward the hidden Flooded Freighter
  function markCargoSearched() {
    state.cargoSearched = (state.cargoSearched || 0) + 1;
    saveGame();
    if (state.cargoSearched === 3 && !state.areas.flooded) {
      toast("📦 You've stripped 3 cargo ships bare... a flooded freighter is said to lie deep below. Sink to a cargo wreck's hold to find it.", "epic", 4800);
    }
  }

  // ---------------------------------------------------------------------
  //  Catch / collect
  // ---------------------------------------------------------------------
  function catchFish(f, ignoreCap) {
    var def = f.def;
    // Shiny Pocket lets shinies through even when the hold is full
    var pocketed = f.shiny && state.items.shinyPocket;
    if (!ignoreCap && run.bagUsed + def.size > inventoryCap() && !pocketed) {
      if (run.time - (run.fullHint || -99) > 6) { run.fullHint = run.time; toast("Inventory full! Surface to sell.", "bad", 1400); }
      f.fleeing = 1.0; // push it away so the magnet doesn't keep grabbing
      return;
    }
    // remove from world
    var idx = run.fish.indexOf(f);
    if (idx >= 0) run.fish.splice(idx, 1);

    var val = def.value * (f.shiny ? D.SHINY_VALUE_MULT : 1) * (def.creature ? creatureValueMult() : 1) * areaValueMult(def.area);
    run.bag.push({ fishId: def.id, shiny: f.shiny, size: def.size, value: val, name: def.name, color: def.color });
    run.bagUsed += def.size;

    var firstEver = !state.discovered[def.id];
    var firstShiny = f.shiny && !state.shinyFound[def.id];
    state.discovered[def.id] = true;
    if (f.shiny) state.shinyFound[def.id] = true;
    state.counts[def.id] = (state.counts[def.id] || 0) + 1;
    state.stats.totalCaught++;

    run.floaters.push({ x: f.x, y: f.y, text: (f.shiny ? "✦ " : "") + def.name, color: f.shiny ? "#ffe66d" : "#dff", life: 1.4 });

    // catching a low-oxygen secret tops your air back up so you don't drown right after
    if (def.secret && def.condition && def.condition.lowOxygen) { run.oxygen = run.maxO; toast("A rush of air! Oxygen replenished. 🫧", "good", 1600); }
    if (def.isBlob) { catchBlobfish(f.shiny); return; }
    if (def.isKraken) { catchKraken(f.shiny); return; }
    if (firstEver) toast("NEW! You caught a " + def.name + (def.secret ? " (Secret!)" : "") + "!", def.secret ? "epic" : "good", 2600);
    else if (firstShiny) toast("✦ SHINY " + def.name + "! ✦", "shiny", 2600);

    saveGame();
  }

  function catchCreature(c) {
    var def = c.def;
    var pocketed = c.shiny && state.items.shinyPocket;
    if (run.bagUsed + def.size > inventoryCap() && !pocketed) {
      if (run.time - (run.fullHint || -99) > 6) { run.fullHint = run.time; toast("Inventory full! Surface to sell.", "bad", 1400); }
      return false;
    }
    var val = def.value * (c.shiny ? D.SHINY_VALUE_MULT : 1) * creatureValueMult() * areaValueMult(def.area);
    run.bag.push({ fishId: def.id, shiny: c.shiny, size: def.size, value: val, name: def.name, color: def.color });
    run.bagUsed += def.size;
    var firstEver = !state.discovered[def.id];
    var firstShiny = c.shiny && !state.shinyFound[def.id];
    state.discovered[def.id] = true;
    if (c.shiny) state.shinyFound[def.id] = true;
    state.counts[def.id] = (state.counts[def.id] || 0) + 1;
    state.stats.totalCaught++;
    run.floaters.push({ x: c.x, y: c.y, text: (c.shiny ? "✦ " : "") + def.name, color: c.shiny ? "#ffe66d" : "#dff", life: 1.4 });
    if (firstEver) toast("NEW! Netted a " + def.name + "!", "good", 2400);
    else if (firstShiny) toast("✦ SHINY " + def.name + "! ✦", "shiny", 2400);
    saveGame();
    return true;
  }

  function spawnAmbientBird() {
    if (!run) return;
    var allContent = D.LOCATIONS[run.area].allContent;
    var pool = D.BIRDS.map(function (id) { return D.FISH_BY_ID[id]; }).filter(function (d) { return (allContent || d.area === run.area) && (!d.night || run.night) && (!d.day || !run.night) && (!d.secret || state.hints[d.id]); });
    if (!pool.length) return;
    var ambient = 0;
    for (var i = 0; i < run.birds.length; i++) if (run.birds[i].mode === "ambient") ambient++;
    if (ambient >= 4) return;
    var loc = D.LOCATIONS[run.area], def = pool[(Math.random() * pool.length) | 0];
    var dir = Math.random() < 0.5 ? 1 : -1, by = -180 - Math.random() * 90;
    run.birds.push({ def: def, x: dir > 0 ? -60 : loc.worldWidth + 60, baseY: by, y: by,
      vx: dir * (20 + Math.random() * 22), phase: Math.random() * 6, shiny: false, mode: "ambient" });
  }

  // throw a harpoon at the boss — aim with the joystick, else auto-aim
  function throwHarpoon() {
    if (!run || !run.bossPresent) return;
    if (!(state.harpoons > 0)) { toast("No harpoons! Buy some at the Tool Shop.", "bad"); return; }
    // find the boss
    var boss = null;
    for (var i = 0; i < run.fish.length; i++) if (run.fish[i].isBoss && run.fish[i].hp > 0) { boss = run.fish[i]; break; }
    if (!boss) return;
    var ax, ay;
    if (joy.active && joy.mag > 0.2) { ax = joy.dx; ay = joy.dy; }   // aimed throw
    else { ax = boss.x - run.diver.x; ay = boss.y - run.diver.y; var l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l; } // auto-aim
    state.harpoons--; saveGame();
    var spd = 460;
    run.harpoonFx.push({ x: run.diver.x, y: run.diver.y, vx: ax * spd, vy: ay * spd, life: 1.4, ang: Math.atan2(ay, ax) });
  }

  // ===== Boss combat AI: charge, grab + O2 drain (wiggle out), kaiju breath =====
  function updateBossAI(boss, dt, diver) {
    if (boss.mode == null) { boss.mode = "roam"; boss.atkT = (boss.def.aggressive ? 1.2 : 3) + Math.random() * (boss.def.aggressive ? 1.2 : 3); boss.modeT = 0; }
    boss.face = diver.x < boss.x ? -1 : 1;
    var isKaiju = boss.def.id === "kaiju" || boss.def.id === "leviathanking" || boss.def.id === "mechakaiju";
    if (boss.hitFlash > 0) { boss.atkT = Math.max(boss.atkT, 1.0); } // don't attack mid-flinch

    if (boss.mode === "roam") {
      boss.atkT -= dt;
      if (boss.atkT <= 0 && !run.grab) {
        if (boss.def.torpedoes && Math.random() < 0.55) startTorpedo(boss);
        else if (boss.def.fireballs && Math.random() < 0.6) spitFireballs(boss, diver);
        else if (isKaiju && Math.random() < 0.55) startBreath(boss, diver);
        else startCharge(boss, diver);
      }
    } else if (boss.mode === "deploy") {
      // hatch on top opens, a torpedo-fish rises out, then launches
      boss.modeT -= dt;
      boss.hatch = Math.min(1, (boss.hatch || 0) + dt * 2.5);
      if (boss.modeT <= 0) {
        run.torpedoes.push({ x: boss.x, y: boss.y - 30 - boss.size * 2, vx: 0, vy: -120,
          beep: 0, life: 9, born: 0 });
        if (window.AUDIO) AUDIO.rumble();
        toast("🚀 The Rig Titan launches a TORPEDO FISH — RUN! 💨", "bad", 1600);
        endBossAttack(boss);
      }
    } else if (boss.mode === "charge") {
      boss.modeT -= dt;
      boss.x += boss.cvx * dt; boss.baseY += boss.cvy * dt; boss.y = boss.baseY;
      if (!run.grab && Math.hypot(boss.x - diver.x, boss.y - diver.y) < 34 + boss.size * 2) startGrab(boss);
      if (boss.modeT <= 0) endBossAttack(boss);
    } else if (boss.mode === "breath") {
      boss.modeT -= dt;
      // a blue energy beam locked toward where the diver was; drains O2 if you're in it
      var bd = run.bossBeam;
      if (bd) {
        // distance from diver to the beam ray
        var rx = diver.x - bd.x, ry = diver.y - bd.y;
        var along = rx * bd.dx + ry * bd.dy;            // projection along the beam
        var perp = Math.abs(rx * -bd.dy + ry * bd.dx);  // perpendicular distance
        if (along > 0 && along < bd.len && perp < 34) {
          run.oxygen -= 14 * dt; // the breath sears your air away
          if (Math.random() < 0.5) run.bubbles.push({ x: diver.x + (Math.random() - 0.5) * 12, y: diver.y, r: 2 + Math.random() * 3, vy: 50, life: 1 });
        }
      }
      if (boss.modeT <= 0) endBossAttack(boss);
    } else if (boss.mode === "grab" && run.grab && run.grab.boss === boss) {
      boss.modeT -= dt;
      boss.x = diver.x + boss.face * (18 + boss.size); boss.baseY = diver.y; boss.y = diver.y;
      run.oxygen -= (7 + totalBossesBeaten() * 0.7 + (boss.def.aggressive ? 10 : 0)) * dt;  // the "wiggle tax" — grip drains air (Captain Carp drains a LOT)
      // wiggle free: strong steering input builds the meter — the Diver's Knife saws you out faster
      var input = (joy.active ? joy.mag : 0) + (keys["a"] || keys["d"] || keys["w"] || keys["s"] || keys["arrowleft"] || keys["arrowright"] || keys["arrowup"] || keys["arrowdown"] ? 1 : 0);
      run.grab.wig += input * dt * 0.9 * (D.UPGRADES.knife ? up("knife") : 1);
      if (run.grab.wig >= 1 || boss.modeT <= 0) {
        diver.vx = -boss.face * 200; diver.vy = -60;     // knock free
        run.grab = null; endBossAttack(boss);
      }
    }
  }
  function startCharge(boss, diver) {
    boss.mode = "charge"; boss.modeT = 0.9;
    var ax = diver.x - boss.x, ay = diver.y - boss.y, l = Math.hypot(ax, ay) || 1;
    var spd = 380 + boss.size * 8 + totalBossesBeaten() * 12 + areaTier(boss.def.area) * 14; // bosses get faster deeper into the game
    boss.cvx = (ax / l) * spd; boss.cvy = (ay / l) * spd;
    toast(boss.def.jawLunge ? boss.def.name + "'s jaws SHOOT out at you! 😱" : boss.def.name + " charges! 💨", "bad", 1200);
  }
  function startGrab(boss) {
    run.grab = { boss: boss, wig: 0 }; boss.mode = "grab"; boss.modeT = 4.0;
    toast("GRABBED! Wiggle the joystick to break free! 🌀", "bad", 2000);
    if (window.AUDIO) AUDIO.rumble();
  }
  // the Sea Dragon spits a volley of fireballs toward where you are
  function spitFireballs(boss, diver) {
    boss.mode = "roam"; boss.atkT = 0.6; // quick recovery so it stays aggressive-ish
    toast(boss.def.name + " spits FIRE! 🔥", "bad", 1200);
    if (window.AUDIO) AUDIO.rumble();
    for (var i = 0; i < 3; i++) {
      var ang = Math.atan2(diver.y - boss.y, diver.x - boss.x) + (i - 1) * 0.22;
      var spd = 240 + Math.random() * 60;
      run.fireballs.push({ x: boss.x + boss.face * 10, y: boss.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 4 });
    }
  }
  function updateFireballs(dt, diver, loc) {
    for (var i = run.fireballs.length - 1; i >= 0; i--) {
      var fb = run.fireballs[i];
      fb.vy += 60 * dt; // slight arc
      fb.x += fb.vx * dt; fb.y += fb.vy * dt; fb.life -= dt;
      if (Math.hypot(fb.x - diver.x, fb.y - diver.y) < 22) {
        run.oxygen -= 14; for (var b = 0; b < 6; b++) run.bubbles.push({ x: fb.x, y: fb.y, r: 3, vy: 50, life: 0.6 });
        toast("🔥 A fireball scorches you!", "bad", 1400); run.fireballs.splice(i, 1); continue;
      }
      if (fb.y > loc.maxDepth * PXPM - 4 || fb.x < 4 || fb.x > loc.worldWidth - 4 || fb.life <= 0) { run.fireballs.splice(i, 1); }
    }
  }
  function drawFireballs() {
    for (var i = 0; i < run.fireballs.length; i++) {
      var fb = run.fireballs[i], x = fb.x - cam.x, y = fb.y - cam.y;
      if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
      drawGlow(x, y, 14, "#ff7a1a", 0.6);
      ctx.fillStyle = "#ffcf3a"; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff7c0"; ctx.beginPath(); ctx.arc(x - 1, y - 1, 2, 0, 7); ctx.fill();
      // little trailing flame
      ctx.fillStyle = "rgba(255,90,20,0.4)"; ctx.beginPath(); ctx.arc(x - fb.vx * 0.02, y - fb.vy * 0.02, 4, 0, 7); ctx.fill();
    }
  }
  function startTorpedo(boss) {
    boss.mode = "deploy"; boss.modeT = 0.7; boss.hatch = 0;
    if (window.AUDIO) AUDIO.ui("back");
  }
  // homing torpedo-fish: chase the diver, beep faster as they near, explode on
  // contact (or the seabed), draining your oxygen
  function updateTorpedoes(dt, diver, loc) {
    for (var i = run.torpedoes.length - 1; i >= 0; i--) {
      var tp = run.torpedoes[i];
      tp.born += dt; tp.life -= dt;
      var dx = diver.x - tp.x, dy = diver.y - tp.y, dist = Math.hypot(dx, dy) || 1;
      // after a short arming delay it homes in, accelerating
      var spd = tp.born < 0.6 ? 90 : Math.min(260, 120 + tp.born * 60);
      var steer = tp.born < 0.6 ? 0.5 : 3.0;
      tp.vx += ((dx / dist) * spd - tp.vx) * Math.min(1, steer * dt);
      tp.vy += ((dy / dist) * spd - tp.vy) * Math.min(1, steer * dt);
      tp.x += tp.vx * dt; tp.y += tp.vy * dt;
      tp.angle = Math.atan2(tp.vy, tp.vx);
      // proximity beeping — interval shrinks as it closes in
      var closeness = clamp(1 - dist / 420, 0, 1);
      tp.beep -= dt;
      if (tp.beep <= 0) { tp.beep = 0.5 - closeness * 0.42; if (window.AUDIO) AUDIO.torpedoBeep(closeness); }
      // explode on the diver
      if (dist < 26) { explodeTorpedo(tp, true); run.torpedoes.splice(i, 1); continue; }
      // explode on the seabed / surface / world edge / timeout
      if (tp.y > loc.maxDepth * PXPM - 6 || tp.y < 6 || tp.x < 4 || tp.x > loc.worldWidth - 4 || tp.life <= 0) {
        explodeTorpedo(tp, false); run.torpedoes.splice(i, 1); continue;
      }
    }
  }
  function explodeTorpedo(tp, hitDiver) {
    for (var b = 0; b < 10; b++) run.bubbles.push({ x: tp.x + (Math.random() - 0.5) * 30, y: tp.y + (Math.random() - 0.5) * 30, r: 3 + Math.random() * 4, vy: 40 + Math.random() * 60, life: 0.8 });
    run.floaters.push({ x: tp.x, y: tp.y, text: "💥", color: "#ff8a3a", life: 0.7 });
    if (window.AUDIO) AUDIO.rumble();
    if (hitDiver) {
      run.oxygen -= 16;                          // the blast tears your air away
      run.diver.vx += (run.diver.x > tp.x ? 1 : -1) * 160; run.diver.vy -= 60; // knockback
      toast("💥 The torpedo detonates on you — oxygen blown out!", "bad", 1800);
    }
  }
  function drawJewel() {
    if (run.jewel) {
      var jx = run.jewel.x - cam.x, jy = run.jewel.y - cam.y + Math.sin(run.time * 2 + run.jewel.phase) * 3;
      var pulse = 0.6 + 0.4 * Math.sin(run.time * 3 + run.jewel.phase);
      drawGlow(jx, jy, 22 * pulse, run.jewel.col, 0.6);
      drawTreasureSprite("ruby", jx, jy, run.jewel.col); // faceted gem shape, jewel-coloured
      if (Math.sin(run.time * 4) > 0.5) { ctx.fillStyle = "#fff"; ctx.fillRect(jx - 3 | 0, jy - 4 | 0, 2, 2); }
    }
    if (run.pyramid) {
      var px = run.pyramid.x - cam.x, py = run.pyramid.y - cam.y;
      var pw = 130;
      ctx.fillStyle = "#caa14a";
      ctx.beginPath(); ctx.moveTo(px, py - 150); ctx.lineTo(px - pw, py); ctx.lineTo(px + pw, py); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.moveTo(px, py - 150); ctx.lineTo(px + pw, py); ctx.lineTo(px, py); ctx.closePath(); ctx.fill();
      // glowing sealed doorway
      drawGlow(px, py - 30, 26 + Math.sin(run.time * 3) * 6, "#3ad0e0", 0.5);
      ctx.fillStyle = "#0a3a4a"; ctx.fillRect(px - 14, py - 50, 28, 50);
      ctx.fillStyle = "#caa14a"; for (var b = 0; b < 6; b += 2) ctx.fillRect(px - 14, py - 50 + b * 8, 28, 2);
    }
  }
  function drawLanterns() {
    if (!run.lanterns || !run.lanterns.length) return;
    for (var i = 0; i < run.lanterns.length; i++) {
      var ln = run.lanterns[i], x = ln.x - cam.x, y = ln.y - cam.y + Math.sin(run.time + ln.bob) * 3;
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      // chain + iron frame
      ctx.strokeStyle = "rgba(60,55,45,0.8)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 8); ctx.stroke();
      ctx.fillStyle = ln.lit ? "#5a4a2a" : "#2a2620";
      ctx.fillRect(x - 7, y - 8, 14, 16);
      if (ln.lit) {
        var fl = 0.7 + 0.3 * Math.sin(run.time * 8 + ln.bob);
        drawGlow(x, y, 40 * fl, "#ffd27a", 0.5 * fl);
        ctx.fillStyle = "rgba(255,220,130," + (0.7 * fl).toFixed(2) + ")";
        ctx.fillRect(x - 4, y - 5, 8, 10);
        ctx.fillStyle = "#fff6c0"; ctx.fillRect(x - 2, y - 3, 4, 6);
      } else {
        ctx.fillStyle = "rgba(30,28,24,0.9)"; ctx.fillRect(x - 4, y - 5, 8, 10);
        // a thread of smoke
        ctx.fillStyle = "rgba(120,120,120,0.18)"; ctx.fillRect(x - 1, y - 16, 2, 8);
      }
      // iron cap
      ctx.fillStyle = "rgba(50,45,38,0.9)"; ctx.fillRect(x - 8, y - 9, 16, 3);
    }
  }
  function drawTorpedoes() {
    // a torpedo rising out of the Rig Titan's deploy hatch
    for (var bi = 0; bi < run.fish.length; bi++) {
      var bo = run.fish[bi];
      if (!(bo.isBoss && bo.mode === "deploy" && bo.hatch > 0)) continue;
      var bx = bo.x - cam.x, topy = bo.y - cam.y - 24 - bo.size * 2;
      ctx.save();
      // open hatch doors
      ctx.fillStyle = "#2a2f36";
      ctx.fillRect(bx - 16, topy + 6, 14, 5); ctx.fillRect(bx + 2, topy + 6, 14, 5);
      // rising torpedo (clipped to emerge upward)
      var rise = bo.hatch * 22;
      drawGlow(bx, topy + 8 - rise, 12, "#ff3a1a", 0.4);
      ctx.translate(bx, topy + 8 - rise); ctx.rotate(-Math.PI / 2);
      SPRITES.draw(ctx, "torpedo", 0, 0, { color: "#c8c0a0", accent: "#ff3a1a", targetH: 20 });
      ctx.restore();
    }
    for (var i = 0; i < run.torpedoes.length; i++) {
      var tp = run.torpedoes[i], x = tp.x - cam.x, y = tp.y - cam.y;
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      // warning glow that pulses with the beeps
      var warn = 0.4 + 0.4 * Math.sin(tp.born * 18);
      drawGlow(x, y, 16, "#ff3a1a", 0.3 + warn * 0.3);
      ctx.save(); ctx.translate(x, y); ctx.rotate(tp.angle || 0);
      SPRITES.draw(ctx, "torpedo", 0, 0, { color: "#c8c0a0", accent: "#ff3a1a", targetH: 22 });
      ctx.restore();
      // little bubble trail
      if (Math.random() < 0.6) run.bubbles.push({ x: tp.x - Math.cos(tp.angle || 0) * 14, y: tp.y - Math.sin(tp.angle || 0) * 14, r: 2, vy: 30, life: 0.5 });
    }
  }
  function startBreath(boss, diver) {
    boss.mode = "breath"; boss.modeT = 1.8; boss.face = diver.x < boss.x ? -1 : 1;
    var ax = diver.x - boss.x, ay = diver.y - boss.y, l = Math.hypot(ax, ay) || 1;
    run.bossBeam = { x: boss.x, y: boss.y, dx: ax / l, dy: ay / l, len: 560, t: 0 };
    toast(boss.def.name + " unleashes an energy breath! 🔵", "bad", 1600);
    if (window.AUDIO) AUDIO.rumble();
  }
  function endBossAttack(boss) {
    boss.mode = "roam"; boss.atkT = (boss.def.aggressive ? 1.0 : 2.3) + Math.random() * (boss.def.aggressive ? 1.2 : 2.4); run.bossBeam = null;
  }

  // Kaiju Breath: fire a blue beam in your facing/aim direction that bags fish
  function fireBreath() {
    if (!state.items.kaijubreath || run.breathCd > 0) return;
    var ax, ay;
    if (joy.active && joy.mag > 0.2) { ax = joy.dx; ay = joy.dy; }
    else { ax = run.aimX != null ? run.aimX : (run.diver.face < 0 ? -1 : 1); ay = run.aimY || 0; }
    var l = Math.hypot(ax, ay) || 1;
    run.playerBeam = { x: run.diver.x, y: run.diver.y, dx: ax / l, dy: ay / l, len: 360, life: 0.9 };
    run.breathCd = 8; // longer recharge
    if (window.AUDIO) AUDIO.rumble();
  }

  // Slingshot: fire a pebble to knock a bird out of the sky (catch on hit)
  function fireSling() {
    if (slingShotsMax() <= 0 || run.slingShots <= 0) { toast("No slingshot shots left this dive.", "bad"); return; }
    var ax, ay;
    if (joy.active && joy.mag > 0.2) { ax = joy.dx; ay = joy.dy; }   // aim with joystick
    else {
      // auto-aim at the nearest bird, else straight up
      var best = null, bd = 1e9;
      for (var i = 0; i < run.birds.length; i++) { var b = run.birds[i]; var d = Math.hypot(b.x - run.diver.x, b.y - run.diver.y); if (d < bd) { bd = d; best = b; } }
      if (best) { ax = best.x - run.diver.x; ay = best.y - run.diver.y; var l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l; }
      else { ax = run.diver.face < 0 ? -0.3 : 0.3; ay = -1; }
    }
    run.slingShots--;
    run.pebbles.push({ x: run.diver.x, y: run.diver.y, vx: ax * 520, vy: ay * 520, life: 1.6 });
    if (window.AUDIO) AUDIO.ui("click");
  }

  function harpoonHit(boss) {
    boss.hp--; boss.hitFlash = 0.4; boss.fleeing = 0.5;
    if (boss.hp <= 0) {
      if (boss.secretBoss) catchSecretBoss(boss);
      else if (boss.areaBoss) catchAreaBoss(boss);
      else if (boss.isBlob) catchBlobfish(boss.shiny);
      else catchKraken(boss.shiny);
      run.bossPresent = false;
      var bi = run.fish.indexOf(boss); if (bi >= 0) run.fish.splice(bi, 1);
    } else {
      toast("HIT! " + boss.hp + " more to go! 🔱", "epic", 1400);
    }
  }

  var CLAM_PEARL = null, COIN_CHEST = null;
  function dropPearl(c) {
    if (!CLAM_PEARL) { for (var i = 0; i < D.TREASURES.length; i++) if (D.TREASURES[i].id === "clampearl") CLAM_PEARL = D.TREASURES[i]; }
    if (!CLAM_PEARL) return;
    var mult = (itemOn("necklace") ? 2 : 1) * (1 + Math.max(0, shovelLevel() - 1) * 0.5); // bigger shovel = richer pearls
    run.bagTreasure.push({ id: CLAM_PEARL.id, value: CLAM_PEARL.value * mult, name: CLAM_PEARL.name, color: CLAM_PEARL.color });
    state.treasures[CLAM_PEARL.id] = (state.treasures[CLAM_PEARL.id] || 0) + 1;
    run.floaters.push({ x: c.x, y: c.y - 16, text: "✦ Pearl!", color: "#fff0f6", life: 1.8 });
    toast("A pearl inside! 🦪✨", "shiny", 1800);
    saveGame();
  }

  function catchSecretBoss(boss) {
    var def = boss.def;
    state[def.id + "Caught"] = true;   // davyjonesCaught / leatherbackCaught / magmawyrmCaught
    state.discovered[def.id] = true;   // show it in the Collection
    run.grab = null;                   // release any grab it had on you
    var pay = Math.round(def.value * areaValueMult(def.area));
    state.money += pay;
    state.stats.earned += pay;
    if (def.reward === "serpenteye") state.items.serpenteye = true;
    else if (def.reward === "kaijubreath") state.items.kaijubreath = true;
    else if (def.reward === "nullzone") state.items.nullzone = true;
    var bi = run.fish.indexOf(boss); if (bi >= 0) run.fish.splice(bi, 1);
    saveGame();
    setTimeout(function () { showSecretBossEnding(def, pay); }, 700);
  }
  function showSecretBossEnding(def, pay) {
    scene = "ending"; sellHud(false);
    var ov = overlay("modal");
    var img = SPRITES.dataURL(SPRITES.archetypeForShape(def.shape), { color: def.color, accent: def.accent, scale: 5 });
    var html = '<div class="panel ending-panel"><h1>☠️ ' + def.name + ' defeated! ☠️</h1>';
    html += '<div class="blob-reveal" style="background-image:url(' + img + ')"></div>';
    html += '<p>The captain\'s curse breaks. A flood of plunder is yours — <b>+$' + fmt(pay || def.value) + '</b>.</p>';
    if (def.reward === "serpenteye") html += '<p class="prize">You take the <b>Eye of the Serpent</b> 👁️ — golden <b>coin chests</b> now wash up in <b>every</b> dive site.</p>';
    html += '<button id="btn-resume" class="big primary">🤿 Keep Diving</button>';
    html += '<button id="btn-continue" class="big">⬆ Back to Boat</button></div>';
    ov.innerHTML = html; ov.classList.add("open");
    bind("btn-resume", function () { resumeDive(); });
    bind("btn-continue", function () { closeOverlay("modal"); scene = "boat"; if (window.AUDIO) AUDIO.playMenu(state && state.nextNight); showBoat(); });
    saveGame();
  }

  function catchAreaBoss(boss) {
    var def = boss.def;
    state.areaBossCaught[def.id] = true;
    var pay = Math.round(def.value * areaValueMult(def.area));
    state.money += pay;
    state.stats.earned += pay;
    if (def.reward === "necklace") state.items.necklace = true;
    else if (def.reward === "stinger") state.items.jellystinger = true;
    else if (def.reward === "megtooth") state.items.megtooth = true;
    else if (def.reward === "sonar") state.items.sonar = true;
    else if (def.reward === "rocfeather") state.items.rocfeather = true;
    else if (def.reward === "crabcrown") state.items.crabcrown = true;
    else if (def.reward === "kaijubreath") state.items.kaijubreath = true;
    run.bossPresent = false;
    saveGame();
    setTimeout(function () { showAreaBossEnding(def, pay); }, 700);
  }

  function useSeed(birdId) {
    if (!run || run.diver.y > 26) { toast("Scatter seed at the surface!", "bad"); return; }
    var def = D.FISH_BY_ID[birdId];
    if (def.area !== run.area && !D.LOCATIONS[run.area].allContent) { toast(def.name + " doesn't visit here.", "bad"); return; }
    if (def.night && !run.night) { toast(def.name + " only comes out at night. 🌙", "bad"); return; }
    if (def.day && run.night) { toast(def.name + " only comes out by day. ☀️", "bad"); return; }
    if (!(state.seeds[birdId] > 0)) { toast("No " + def.name + " seed — buy some at the Seed Shop.", "bad"); return; }
    state.seeds[birdId]--; saveGame();
    run.birds.push({
      def: def,
      x: run.diver.x + (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 80),
      y: -230 - Math.random() * 40,
      vx: (Math.random() < 0.5 ? -1 : 1) * 30, phase: Math.random() * 6,
      shiny: Math.random() < shinyChance(run.area), mode: "descend",
    });
    toast("🌾 You scatter " + def.name + " seed...", "good", 1400);
  }

  function catchBird(b) {
    var def = b.def;
    var val = def.value * (b.shiny ? D.SHINY_VALUE_MULT : 1) * areaValueMult(def.area);
    run.bag.push({ fishId: def.id, shiny: b.shiny, size: def.size, value: val, name: def.name, color: def.color });
    run.bagUsed += def.size;
    var firstEver = !state.discovered[def.id], firstShiny = b.shiny && !state.shinyFound[def.id];
    state.discovered[def.id] = true; if (b.shiny) state.shinyFound[def.id] = true;
    state.counts[def.id] = (state.counts[def.id] || 0) + 1; state.stats.totalCaught++;
    run.floaters.push({ x: b.x, y: b.y, text: (b.shiny ? "✦ " : "") + def.name, color: b.shiny ? "#ffe66d" : "#dff", life: 1.4 });
    if (firstEver) toast("NEW! A " + def.name + " landed on your boat!", "good", 2400);
    else if (firstShiny) toast("✦ SHINY " + def.name + "! ✦", "shiny", 2400);
    saveGame();
  }

  function catchBlobfish(shiny) {
    state.blobfishCaught = true;
    if (shiny) state.blobfishShiny = true;
    run.bossPresent = false;
    saveGame();
    setTimeout(function () { showBlobEnding(shiny); }, 700);
  }

  function catchKraken(shiny) {
    state.krakenCaught = true;
    if (shiny) state.krakenShiny = true;
    saveGame();
    setTimeout(function () { showEnding(shiny); }, 900);
  }

  function collectTreasure(tr) {
    var def = tr.def;
    var mult = itemOn("necklace") ? 2 : 1; // Multiplier Necklace doubles treasure
    run.bagTreasure.push({ id: def.id, value: def.value * mult, name: def.name, color: def.color });
    state.treasures[def.id] = (state.treasures[def.id] || 0) + 1;
    run.floaters.push({ x: tr.x, y: tr.y, text: def.name + (mult > 1 ? " ×2" : ""), color: def.color, life: 1.5 });
    toast("Treasure recovered: " + def.name + "!", "good", 1600);
    saveGame();
  }

  // ---------------------------------------------------------------------
  //  Surface
  // ---------------------------------------------------------------------
  // Cozy: running out of air just floats you gently home WITH your haul.
  function driftHome() {
    toast("Out of air — you drift gently back to the boat with your haul. 🫧", "good", 2600);
    goToBoat();
  }

  function surface() {
    goToBoat();
  }

  function goToBoat() {
    state.lastArea = run.area;
    // day/night takes turns: whatever this dive was, the next one flips
    if (run) state.nextNight = !run.night;
    saveGame();
    scene = "boat";
    showBoat();
    if (window.AUDIO) AUDIO.playMenu(state && state.nextNight);
  }

  // ---------------------------------------------------------------------
  //  Rendering
  // ---------------------------------------------------------------------
  function render() {
    var loc = D.LOCATIONS[run.area];
    ctx.clearRect(0, 0, W, H);

    // Night-Vision Goggles: with goggles + night vision toggled on, the night
    // reads as bright as day (no nocturnal gloom, full sun rays/caustics).
    var nvOn = nightVisionOn();
    // the open sky never goes dark; the cavern is extra gloomy
    var darkness = loc.airArea ? 0 : depthFactor(run.diver.y, loc);
    // caves are moody-dark but never blinding (capped so you can always see to play)
    if (loc.caveArea) darkness = Math.min(0.7, darkness + 0.2);
    if (run.night && !nvOn) darkness = Math.min(0.95, darkness + (loc.airArea ? 0.3 : 0.4)); // nocturnal gloom

    // --- background, lighting & scenery ---
    drawBackground(loc);
    drawSky(loc);
    drawBirds();
    drawHills(loc);
    drawBgFlora(loc);
    drawSeabed(loc);

    // --- scene objects ---
    drawSecretPassageCue(loc);
    for (var i = 0; i < run.wrecks.length; i++) drawWreck(run.wrecks[i]);
    drawCages();
    drawOilRig();
    drawCreatures();
    for (var t = 0; t < run.treasures.length; t++) drawTreasure(run.treasures[t]);
    for (var f = 0; f < run.fish.length; f++) drawFishEntity(run.fish[f]);
    drawBubbles();
    drawDiver();
    drawBuddy();
    drawHarpoons();
    drawPebbles();
    drawBossBeam();
    drawNetFx();
    drawTrap();
    drawLanterns();
    drawJewel();
    drawTorpedoes();
    drawFireballs();
    drawSmoke();
    drawGoblinDarkness();
    drawStormFlash();

    // --- volumetric lighting / depth darkness ---
    drawLighting(loc, darkness);

    // --- UI overlays (crisp) ---
    for (var fl = 0; fl < run.floaters.length; fl++) {
      var ff = run.floaters[fl];
      ctx.globalAlpha = clamp(ff.life, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.font = "bold 14px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ff.text, ff.x - cam.x + 1, ff.y - cam.y + 1);
      ctx.fillStyle = ff.color;
      ctx.fillText(ff.text, ff.x - cam.x, ff.y - cam.y);
      ctx.globalAlpha = 1;
    }
    drawFishLabels();

    if (joy.active) drawJoystick();

    // grab struggle meter
    if (run.grab) {
      var mw = 220, mh = 18, mx = (W - mw) / 2, my = H * 0.32;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(mx - 4, my - 22, mw + 8, mh + 26);
      ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'Segoe UI',sans-serif"; ctx.textAlign = "center";
      ctx.fillText("🌀 WIGGLE FREE!", W / 2, my - 6);
      ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(mx, my, mw, mh);
      ctx.fillStyle = "#7afcff"; ctx.fillRect(mx, my, mw * clamp(run.grab.wig, 0, 1), mh);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
    }
  }

  // ---------------------------------------------------------------------
  //  Background / scenery / lighting (pixel-art glow-up)
  // ---------------------------------------------------------------------
  function drawBackground(loc) {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, mix(loc.topColor, loc.deepColor, depthFactor(cam.y, loc)));
    grad.addColorStop(1, mix(loc.topColor, loc.deepColor, depthFactor(cam.y + H, loc)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // big drifting background clouds for the Cloud Reaches
    if (loc.airArea) {
      for (var ci = 0; ci < 14; ci++) {
        var s = 2 + (ci % 3);
        var cxp = ((ci * 357 - cam.x * (0.2 + (ci % 3) * 0.12) + run.time * (6 + (ci % 4) * 4)) % (W + 360) + (W + 360)) % (W + 360) - 180;
        var cyp = ((ci * 211 + 80 - cam.y * 0.5) % (H + 200) + (H + 200)) % (H + 200) - 100;
        ctx.globalAlpha = 0.5;
        drawCloud(cxp, cyp, s);
        ctx.globalAlpha = 1;
      }
    }

    // The Backrooms: damp yellow office walls behind the water
    if (loc.id === "backrooms") drawBackroomsAtmos(loc);

    // Flooded Freighter: drifting silt + pairs of shy eyes peering from the dark
    if (loc.id === "flooded") drawFloodedAtmos(loc);

    // Buried Dunes / Ancient Grotto: great pyramids on the horizon
    if (loc.pyramids) drawPyramidsBg(loc);
    // Ancient Grotto: vines trailing from the ceiling + a glittering floor
    if (loc.id === "grotto") drawGrottoAtmos(loc);

    // Ornate Ocean: red torii gates in the haze + drifting cherry-blossom petals
    if (loc.id === "japan") drawJapanAtmos(loc);

    // Storm: forks of lightning + screen flashes (reusable wherever loc.storm)
    if (loc.storm) drawStorm(loc);
    if (loc.peaks) drawPeaks(loc);

    // nocturnal tint over the whole scene (lifted by night-vision goggles)
    if (run.night && !nightVisionOn()) { ctx.fillStyle = "rgba(8,12,42,0.5)"; ctx.fillRect(0, 0, W, H); }

    if (loc.starfield) drawStarfield();

    // god rays from the surface (fade with depth; sun rays return with night vision)
    var rayStrength = (run.night && !nightVisionOn()) ? 0 : 1 - clamp(cam.y / (520), 0, 1);
    if (rayStrength > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < 6; i++) {
        var bx = ((i * 220 + Math.sin(run.time * 0.2 + i) * 40) - cam.x * 0.3);
        bx = ((bx % (W + 400)) + (W + 400)) % (W + 400) - 200;
        var grd = ctx.createLinearGradient(bx, 0, bx + 60, H);
        var a = 0.05 * rayStrength;
        grd.addColorStop(0, "rgba(255,255,240," + a + ")");
        grd.addColorStop(1, "rgba(255,255,240,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(bx, 0); ctx.lineTo(bx + 70, 0);
        ctx.lineTo(bx + 180, H); ctx.lineTo(bx + 60, H);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    // animated caustics: rippling dappled light near the surface (all areas)
    var caustic = (run.night && !nightVisionOn()) ? 0 : 1 - clamp(cam.y / 700, 0, 1);
    if (caustic > 0.03 && !loc.caveArea) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var tint = loc.starfield ? "rgba(190,170,255," : (loc.airArea ? "rgba(255,255,255," : "rgba(180,235,255,");
      for (var cz = 0; cz < 7; cz++) {
        var cy2 = ((cz * 84 - cam.y * 0.5) % (H + 120) + (H + 120)) % (H + 120) - 60;
        ctx.beginPath();
        for (var sxp = -10; sxp <= W + 10; sxp += 18) {
          var wy = cy2 + Math.sin((sxp + cam.x) * 0.012 + run.time * 1.3 + cz) * 9 + Math.sin((sxp) * 0.05 + run.time * 2.1) * 4;
          if (sxp === -10) ctx.moveTo(sxp, wy); else ctx.lineTo(sxp, wy);
        }
        ctx.lineWidth = 2 + (cz % 2);
        ctx.strokeStyle = tint + (0.05 * caustic).toFixed(3) + ")";
        ctx.stroke();
      }
      ctx.restore();
    }

    // drifting plankton motes (gentle organic sway)
    ctx.save();
    ctx.fillStyle = loc.starfield ? "rgba(200,180,255,0.5)" : "rgba(220,240,255,0.35)";
    for (var p = 0; p < 46; p++) {
      var px = ((p * 211 - cam.x * 0.6 + run.time * (6 + (p % 3) * 4)) % W + W) % W;
      var py = ((p * 97 + Math.sin(run.time * 0.5 + p) * 16 + Math.cos(run.time * 0.3 + p * 2) * 8 - cam.y * 0.6) % H + H) % H;
      var s = p % 5 === 0 ? 2 : 1;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(run.time + p);
      ctx.fillRect(px | 0, py | 0, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // reusable storm weather: occasional lightning bolt + bright flash + thunder
  function makeBolt() {
    var x = 80 + Math.random() * (W - 160), pts = [{ x: x, y: 0 }], y = 0;
    while (y < 240) { y += 14 + Math.random() * 20; x += (Math.random() - 0.5) * 50; pts.push({ x: x, y: y }); }
    return pts;
  }
  function drawStorm(loc) {
    // weather areas trigger their own periodic strikes
    if (run.stormNext == null) run.stormNext = run.time + 1.5 + Math.random() * 4;
    if (run.time > run.stormNext) {
      run.stormFlash = 1; run.stormBolt = makeBolt();
      run.stormNext = run.time + 2.5 + Math.random() * 6;
      if (window.AUDIO) AUDIO.rumble();
    }
  }
  // renders the lightning flash + bolt (storm areas AND the Storm Summoner)
  function drawStormFlash() {
    if (!(run.stormFlash > 0)) return;
    ctx.fillStyle = "rgba(214,226,255," + (run.stormFlash * 0.45).toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);
    if (run.stormBolt && run.stormFlash > 0.4) {
      ctx.save();
      ctx.strokeStyle = "rgba(245,250,255,0.95)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
      ctx.shadowColor = "#bcd6ff"; ctx.shadowBlur = 12;
      ctx.beginPath();
      for (var i = 0; i < run.stormBolt.length; i++) { var p = run.stormBolt[i]; if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
      ctx.stroke(); ctx.restore();
    }
    run.stormFlash -= 0.05;
  }
  // ⚡ Storm Summoner: strike fish near the surface — or open Olympus at the peak
  function summonStorm() {
    if (!run || !state.items.stormsummoner) return;
    var loc = D.LOCATIONS[run.area];
    if (loc.peaks && !state.areas.olympus && run.peakX != null && Math.hypot(run.diver.x - run.peakX, run.diver.y - 24) < 110) {
      unlockSecretArea("olympus", "⚡ You raise the Storm Summoner at the peak — the clouds split open onto OLYMPUS AERIE! (Now in Change Area.)");
      return;
    }
    if (run.stormCd > 0) { toast("The summoner is still recharging...", "bad", 1200); return; }
    run.stormCd = 5; run.stormFlash = 1; run.stormBolt = makeBolt();
    if (window.AUDIO) AUDIO.rumble();
    var got = 0;
    for (var i = run.fish.length - 1; i >= 0; i--) {
      var f = run.fish[i];
      if (f.isBoss) continue;
      if (f.y < 150) { catchFish(f, true); got++; }   // anything near the surface is struck & bagged
    }
    toast(got ? "⚡ Lightning strikes the surface — " + got + " fish bagged!" : "⚡ Lightning splits the surface! (lure fish up high first)", got ? "good" : "bad", 1800);
  }

  // towering submerged mountains; the tallest (at run.peakX) reaches the surface
  function drawPeaks(loc) {
    var fy = run.floorY - cam.y;
    // two parallax background ridges
    [[0.22, 0.55, "#2a3a4a"], [0.8, 0.55, "#2e3e4e"]].forEach(function (m) {
      var sx = m[0] * loc.worldWidth - cam.x * m[1], topY = fy - 360;
      ctx.fillStyle = m[2];
      ctx.beginPath(); ctx.moveTo(sx - 180, fy); ctx.lineTo(sx, topY); ctx.lineTo(sx + 180, fy); ctx.closePath(); ctx.fill();
    });
    // the tallest peak — drawn at the true world x so you can align with its tip
    var px = run.peakX - cam.x, tipY = 18 - cam.y;
    ctx.fillStyle = "#46586a";
    ctx.beginPath(); ctx.moveTo(px - 220, fy); ctx.lineTo(px, tipY); ctx.lineTo(px + 220, fy); ctx.closePath(); ctx.fill();
    // snowy cap
    ctx.fillStyle = "#dfeaf2";
    ctx.beginPath(); ctx.moveTo(px - 34, tipY + 70); ctx.lineTo(px, tipY); ctx.lineTo(px + 34, tipY + 70); ctx.lineTo(px + 16, tipY + 60); ctx.lineTo(px, tipY + 72); ctx.lineTo(px - 16, tipY + 60); ctx.closePath(); ctx.fill();
    // glinting marker at the tip if you carry the Storm Summoner
    if (state.items.stormsummoner && !state.areas.olympus && Math.sin(run.time * 4) > 0) drawGlow(px, tipY + 8, 22, "#cfe0ff", 0.6);
  }

  // red torii gates standing in the haze + falling pink petals (Ornate Ocean)
  function drawJapanAtmos(loc) {
    ctx.save();
    // torii gates — anchored to the SEABED so they stand on the floor and rise
    // tall (rather than floating in the middle of the screen)
    var floorScreenY = loc.maxDepth * PXPM - cam.y;
    for (var g = 0; g < 5; g++) {
      var gx = ((g * 620 - cam.x * 0.4) % (W + 300) + (W + 300)) % (W + 300) - 150;
      var base = floorScreenY - 8, hgt = 360 + (g % 3) * 90, wid = 120 + (g % 2) * 40;
      if (base < -40) continue; // seabed (and gates) above the view — skip
      ctx.fillStyle = "rgba(150,30,40,0.30)";
      ctx.fillRect(gx - wid / 2, base - hgt, 12, hgt);                 // left post
      ctx.fillRect(gx + wid / 2 - 12, base - hgt, 12, hgt);            // right post
      ctx.fillRect(gx - wid / 2 - 16, base - hgt - 10, wid + 32, 14);  // top lintel (kasagi)
      ctx.fillRect(gx - wid / 2 - 8, base - hgt + 20, wid + 16, 9);    // second beam (nuki)
    }
    // falling cherry-blossom petals
    for (var p = 0; p < 36; p++) {
      var t = run.time * 0.5 + p;
      var px = ((p * 173 + Math.sin(t) * 30 - cam.x * 0.5) % (W + 40) + (W + 40)) % (W + 40) - 20;
      var py = ((p * 137 + run.time * (24 + (p % 4) * 8)) % (H + 40)) - 20;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = p % 3 === 0 ? "#ffd6e6" : "#ff9ec4";
      ctx.fillRect(px | 0, py | 0, 3, 2);
      ctx.fillRect((px + Math.sin(t) * 2) | 0, (py + 2) | 0, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawHills(loc) {
    for (var h = 0; h < run.hills.length; h++) {
      var hill = run.hills[h];
      ctx.fillStyle = hill.color;
      ctx.beginPath();
      ctx.moveTo(-50, H + 60);
      for (var i = 0; i < hill.pts.length; i++) {
        var pt = hill.pts[i];
        // horizontal parallax only; depth (y) tracks the camera 1:1
        ctx.lineTo(pt.x - cam.x * hill.parallax, pt.y - cam.y);
      }
      ctx.lineTo(W + 50, H + 60);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawSeabed(loc) {
    var fy = run.floorY - cam.y;
    if (fy < H + 60) {
      // floor slab
      ctx.fillStyle = run.floorColor;
      ctx.fillRect(0, fy, W, H - fy + 60);
      // chunky pixel rim
      ctx.fillStyle = mix(run.floorColor, "#ffffff", 0.12);
      for (var rx = 0; rx < W; rx += 8) {
        var bump = (Math.sin((rx + cam.x) * 0.05) > 0.3) ? 4 : 0;
        ctx.fillRect(rx, fy - bump, 8, 6 + bump);
      }
    }
    // plants / rocks
    for (var i = 0; i < run.decor.length; i++) {
      var d = run.decor[i];
      var x = d.x - cam.x, y = d.y - cam.y;
      if (x < -60 || x > W + 60 || y < -40 || y > H + 120) continue;
      drawPlant(d, x, y);
    }
  }

  function drawPlant(d, x, y) {
    var sway = Math.sin(run.time * 1.2 + d.sway) * 4 * d.size;
    ctx.save();
    ctx.translate(x, y);
    if (d.type === "kelp") {
      ctx.fillStyle = d.color;
      var segs = 6 + (d.size * 4 | 0);
      for (var s = 0; s < segs; s++) {
        var t = s / segs;
        ctx.fillRect(Math.round(sway * t * 1.4) - 3, -s * 8 - 8, 6, 8);
      }
    } else if (d.type === "coral") {
      ctx.fillStyle = d.color;
      ctx.fillRect(-3, -10, 6, 12);
      ctx.fillRect(-10, -16, 6, 10);
      ctx.fillRect(5, -18, 6, 12);
      ctx.fillRect(-2, -22, 6, 12);
    } else if (d.type === "anemone") {
      ctx.fillStyle = d.color;
      for (var a = -3; a <= 3; a++) {
        ctx.fillRect(a * 4, -8 - Math.abs(Math.sin(run.time + a + d.sway)) * 10, 3, 12);
      }
    } else if (d.type === "crystal") {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.moveTo(0, -26 * d.size); ctx.lineTo(7, -4); ctx.lineTo(-7, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = mix(d.color, "#ffffff", 0.5);
      ctx.fillRect(-2, -22 * d.size, 2, 18 * d.size);
    } else if (d.type === "vent") {
      ctx.fillStyle = run.rockColor;
      ctx.fillRect(-9, -16, 18, 18);
      ctx.fillStyle = "#3a2030";
      ctx.fillRect(-4, -22, 8, 8);
      // rising smoke
      ctx.fillStyle = "rgba(120,90,110,0.35)";
      for (var v = 0; v < 4; v++) {
        var sy = (-20 - ((run.time * 18 + v * 22) % 80));
        ctx.fillRect(-3 + Math.sin(run.time + v) * 3, sy, 6, 6);
      }
    } else { // rock
      ctx.fillStyle = run.rockColor;
      ctx.fillRect(-12 * d.size, -10 * d.size, 24 * d.size, 12 * d.size);
      ctx.fillStyle = mix(run.rockColor, "#ffffff", 0.1);
      ctx.fillRect(-12 * d.size, -10 * d.size, 24 * d.size, 3);
    }
    ctx.restore();
  }

  function drawCloud(x, y, s) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(x, y, 30 * s, 8 * s);
    ctx.fillRect(x + 6 * s, y - 6 * s, 18 * s, 10 * s);
    ctx.fillRect(x + 2 * s, y - 3 * s, 10 * s, 8 * s);
  }

  // Sky above the waterline (different per area) + the rippling water surface.
  // Birds will eventually fly in this sky strip.
  // suspended office drop-ceiling: a grid of ceiling tiles with humming
  // fluorescent light panels — stands in for the "sky" in the Backrooms
  function drawDropCeiling(surfaceY) {
    ctx.fillStyle = "#c9bd6a";
    ctx.fillRect(0, 0, W, surfaceY);
    var tile = 46, ox = -(cam.x * 0.4 % tile);
    // tile grid
    ctx.strokeStyle = "rgba(90,80,30,0.55)"; ctx.lineWidth = 2;
    for (var gx = ox - tile; gx < W + tile; gx += tile) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, surfaceY); ctx.stroke();
    }
    for (var gy = 0; gy < surfaceY; gy += tile) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      // speckled ceiling-tile texture
      ctx.fillStyle = "rgba(120,108,40,0.25)";
      for (var sp = 0; sp < W; sp += 13) ctx.fillRect((sp + (gy * 7) % 13) | 0, (gy + ((sp * 5) % tile)) | 0, 2, 2);
    }
    // fluorescent light panels (every few tiles), gently flickering/humming
    for (var lx = ox - tile; lx < W + tile; lx += tile * 3) {
      for (var ly = tile; ly + tile < surfaceY; ly += tile * 2) {
        var flick = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(run.time * 9 + lx * 0.3 + ly));
        if (Math.sin(lx * 1.7 + ly) > 0.6) flick *= 0.4; // an occasional dead/buzzing panel
        ctx.fillStyle = "rgba(255,255,235," + (0.55 * flick).toFixed(2) + ")";
        ctx.fillRect(lx + 5, ly + 5, tile - 10, tile - 10);
        ctx.fillStyle = "rgba(255,255,255," + (0.35 * flick).toFixed(2) + ")";
        ctx.fillRect(lx + 9, ly + 9, tile - 18, 3);
        drawGlow(lx + tile / 2, ly + tile / 2, 30 * flick, "#fffbe0", 0.12 * flick);
      }
    }
  }
  // damp yellow wallpaper office walls seen behind the flooded rooms
  function drawBackroomsAtmos(loc) {
    var ox = -(cam.x * 0.5 % 120);
    // mono-yellow wallpaper panels with a faint vertical pattern
    for (var px = ox - 120; px < W + 120; px += 120) {
      ctx.fillStyle = (((px / 120) | 0) % 2 === 0) ? "rgba(180,160,40,0.10)" : "rgba(150,135,30,0.10)";
      ctx.fillRect(px, 0, 120, H);
      ctx.fillStyle = "rgba(110,98,24,0.10)";
      ctx.fillRect(px + 58, 0, 3, H); // panel seam
    }
    // faint horizontal wainscoting / skirting band
    var bandY = -cam.y + 140;
    if (bandY > -20 && bandY < H) { ctx.fillStyle = "rgba(90,80,24,0.18)"; ctx.fillRect(0, bandY, W, 10); }
    // damp water stains
    ctx.fillStyle = "rgba(70,60,20,0.10)";
    for (var s = 0; s < 5; s++) {
      var stx = ((s * 421 - cam.x * 0.5) % (W + 200) + (W + 200)) % (W + 200) - 100;
      var sty = ((s * 233) % H);
      ctx.beginPath(); ctx.ellipse(stx, sty, 50, 28, 0, 0, 7); ctx.fill();
    }
  }
  // creepy-but-fun flooded-hold atmosphere: floating silt motes drifting in the
  // gloom, and pairs of timid glowing eyes that blink at you from the dark
  function drawFloodedAtmos(loc) {
    // drifting silt / dust motes
    ctx.save();
    for (var m = 0; m < 36; m++) {
      var mx = ((m * 173 - cam.x * 0.5) % (W + 40) + (W + 40)) % (W + 40) - 20;
      var my = ((m * 211 + run.time * (6 + (m % 4) * 4) - cam.y * 0.5) % (H + 40) + (H + 40)) % (H + 40) - 20;
      ctx.fillStyle = "rgba(180,200,180," + (0.05 + (m % 3) * 0.04).toFixed(2) + ")";
      ctx.fillRect(mx | 0, my | 0, 2, 2);
    }
    // a few pairs of shy eyes that fade in and out in the murk
    for (var e = 0; e < 5; e++) {
      var sx = (e * 521 + 120) - cam.x * 0.6;
      sx = ((sx % (W + 200)) + (W + 200)) % (W + 200) - 100;
      var sy = ((e * 331 + 80 - cam.y * 0.5) % (H - 80)) + 40;
      var blink = Math.sin(run.time * 0.7 + e * 1.3);
      if (blink > 0.4) {
        var a = (blink - 0.4) * 0.7;
        ctx.fillStyle = "rgba(120,255,180," + a.toFixed(2) + ")";
        ctx.fillRect(sx | 0, sy | 0, 3, 3); ctx.fillRect((sx + 9) | 0, sy | 0, 3, 3);
        ctx.fillStyle = "rgba(255,255,255," + (a * 0.8).toFixed(2) + ")";
        ctx.fillRect((sx + 1) | 0, sy | 0, 1, 1); ctx.fillRect((sx + 10) | 0, sy | 0, 1, 1);
      }
    }
    ctx.restore();
  }
  // great pyramids silhouetted on the horizon (Buried Dunes & the Grotto)
  function drawPyramidsBg(loc) {
    var floorScreenY = loc.maxDepth * PXPM - cam.y;
    ctx.save();
    for (var p = 0; p < 4; p++) {
      var px = ((p * 760 - cam.x * 0.25) % (W + 500) + (W + 500)) % (W + 500) - 250;
      var ph = 180 + (p % 3) * 70, pw = ph * 1.1;
      var base = floorScreenY - 6;
      if (base < -40) continue;
      ctx.fillStyle = "rgba(150,120,60,0.22)";
      ctx.beginPath(); ctx.moveTo(px, base - ph); ctx.lineTo(px - pw, base); ctx.lineTo(px + pw, base); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(80,60,30,0.12)";
      ctx.beginPath(); ctx.moveTo(px, base - ph); ctx.lineTo(px + pw, base); ctx.lineTo(px, base); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // hanging vines from the ceiling + sparkling gemstone sand (Ancient Grotto)
  function drawGrottoAtmos(loc) {
    ctx.save();
    // vines trailing down from the top of the cavern
    for (var v = 0; v < 9; v++) {
      var vx = ((v * 311 - cam.x * 0.5) % (W + 60) + (W + 60)) % (W + 60) - 30;
      var vlen = 60 + (v % 4) * 40, sway = Math.sin(run.time * 0.6 + v) * 10;
      ctx.strokeStyle = "rgba(40,140,90,0.4)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(vx, -cam.y < 0 ? 0 : -cam.y);
      var top = Math.max(0, -cam.y);
      ctx.moveTo(vx, top); ctx.quadraticCurveTo(vx + sway * 0.5, top + vlen * 0.6, vx + sway, top + vlen); ctx.stroke();
      ctx.fillStyle = "rgba(60,180,110,0.4)";
      for (var lf = 1; lf < 4; lf++) ctx.fillRect((vx + sway * lf / 3) | 0, (top + vlen * lf / 4) | 0, 4, 3);
    }
    // glittering gemstone flecks drifting in the crystal-blue water
    for (var s = 0; s < 30; s++) {
      var sx = ((s * 173 - cam.x * 0.6) % (W + 40) + (W + 40)) % (W + 40) - 20;
      var sy = ((s * 211 + run.time * 8 - cam.y * 0.6) % (H + 40) + (H + 40)) % (H + 40) - 20;
      if (Math.sin(run.time * 3 + s) > 0.3) { ctx.fillStyle = ["rgba(255,210,80,0.6)", "rgba(90,230,255,0.6)", "rgba(230,90,120,0.5)"][s % 3]; ctx.fillRect(sx | 0, sy | 0, 2, 2); }
    }
    ctx.restore();
  }
  // a rough rock ceiling hung with stalactites (caves / the Gloom Cavern)
  function drawCaveCeiling(surfaceY, loc) {
    var rock = (DECOR[loc.id] && DECOR[loc.id].rock) || "#2a2620";
    var g = ctx.createLinearGradient(0, 0, 0, surfaceY);
    g.addColorStop(0, mix(rock, "#000000", 0.45)); g.addColorStop(1, rock);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, surfaceY);
    // lumpy underside of the ceiling
    ctx.fillStyle = mix(rock, "#000000", 0.25);
    for (var b = 0; b < W + 60; b += 60) {
      var bx = b - (cam.x * 0.3 % 60);
      ctx.beginPath(); ctx.arc(bx, surfaceY - 6, 34, Math.PI, 0); ctx.fill();
    }
    // stalactites hanging down toward the water
    for (var s = 0; s < 14; s++) {
      var sx = ((s * 137 - cam.x * 0.3) % (W + 80) + (W + 80)) % (W + 80) - 40;
      var slen = 24 + ((s * 53) % 60), sw = 8 + (s % 3) * 4;
      ctx.fillStyle = mix(rock, "#000000", 0.15);
      ctx.beginPath(); ctx.moveTo(sx - sw, surfaceY * 0.1); ctx.lineTo(sx + sw, surfaceY * 0.1);
      ctx.lineTo(sx, Math.min(surfaceY - 2, surfaceY * 0.1 + slen)); ctx.closePath(); ctx.fill();
      // a wet drip glint
      if (Math.sin(run.time * 1.5 + s) > 0.7) { ctx.fillStyle = "rgba(180,220,255,0.5)"; ctx.fillRect(sx | 0, (Math.min(surfaceY - 2, surfaceY * 0.1 + slen)) | 0, 2, 4); }
    }
    // faint waterline shimmer
    var wb = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + 18);
    wb.addColorStop(0, "rgba(120,160,200,0.18)"); wb.addColorStop(1, "rgba(120,160,200,0)");
    ctx.fillStyle = wb; ctx.fillRect(0, surfaceY, W, 18);
  }
  // boiling dark volcanic cloud cover with a smouldering red horizon glow
  // (used for the Magma Vents; reusable for other volcanic skies)
  function drawVolcanoSky(surfaceY) {
    var g = ctx.createLinearGradient(0, 0, 0, surfaceY);
    g.addColorStop(0, "#1a0a08"); g.addColorStop(0.7, "#3a120a"); g.addColorStop(1, "#6a1e0e");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, surfaceY);
    // roiling dark clouds
    for (var c = 0; c < 10; c++) {
      var cx = ((c * 213 - cam.x * 0.1 + run.time * (4 + (c % 3) * 3)) % (W + 240) + (W + 240)) % (W + 240) - 120;
      var cy = surfaceY * (0.15 + (c % 4) * 0.18);
      var rr = 40 + (c % 3) * 26;
      var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      cg.addColorStop(0, "rgba(20,10,8,0.7)"); cg.addColorStop(1, "rgba(20,10,8,0)");
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill();
    }
    // smouldering glow at the waterline
    drawGlow(W * 0.5, surfaceY, W * 0.6, "#ff4a1a", 0.16 + 0.05 * Math.sin(run.time * 2));
    // the odd ember rising
    for (var e = 0; e < 6; e++) {
      var ex = ((e * 331 + run.time * 20) % W);
      var ey = surfaceY - ((run.time * 30 + e * 40) % surfaceY);
      ctx.fillStyle = "rgba(255,140,40,0.6)"; ctx.fillRect(ex | 0, ey | 0, 2, 2);
    }
  }
  function drawSky(loc) {
    var surfaceY = -cam.y;            // screen y of the waterline (world y = 0)
    if (surfaceY <= 0) return;        // fully underwater — no sky in view
    var sky = loc.sky || { top: "#9fd8ff", bottom: "#e6f7ff" };
    var isNight = run.night || sky.night;
    // The Backrooms: the "sky" is a humming office drop-ceiling, not open air
    if (loc.id === "backrooms") {
      drawDropCeiling(surfaceY);
      // waterline band just below the ceiling
      var wbk = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + 24);
      wbk.addColorStop(0, "rgba(220,220,160,0.3)"); wbk.addColorStop(1, "rgba(220,220,160,0)");
      ctx.fillStyle = wbk; ctx.fillRect(0, surfaceY, W, 24);
      return;
    }
    // Volcano sky: boiling dark clouds with a smouldering red glow on the horizon
    if (sky.volcano) {
      drawVolcanoSky(surfaceY);
      return;
    }
    // Cave sky: a rocky ceiling hung with stalactites instead of open air
    if (loc.caveArea || sky.cave) {
      drawCaveCeiling(surfaceY, loc);
      return;
    }
    var g = ctx.createLinearGradient(0, 0, 0, surfaceY);
    if (isNight) { g.addColorStop(0, "#0a1030"); g.addColorStop(1, "#22305a"); }
    else { g.addColorStop(0, sky.top); g.addColorStop(1, sky.bottom); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, surfaceY);

    if (isNight) {
      ctx.fillStyle = "#fff";
      for (var i = 0; i < 40; i++) {
        var sxp = (i * 137.5) % W, syp = (i * 53.7) % Math.max(1, surfaceY);
        if (Math.sin(run.time + i) > 0.2) ctx.fillRect(sxp | 0, syp | 0, 2, 2);
      }
      ctx.fillStyle = "rgba(230,235,255,0.9)";
      ctx.beginPath(); ctx.arc(W * 0.8, surfaceY * 0.35, 16, 0, 7); ctx.fill(); // moon
    } else {
      ctx.fillStyle = "rgba(255,250,205,0.85)";
      ctx.beginPath(); ctx.arc(W * 0.8, surfaceY * 0.34, 20, 0, 7); ctx.fill(); // sun
      var drift = (run.time * 8) % (W + 120);
      drawCloud(((W * 0.2 - cam.x * 0.05 + drift) % (W + 120)) - 60, surfaceY * 0.3, 1);
      drawCloud(((W * 0.6 - cam.x * 0.05 + drift * 0.7) % (W + 120)) - 60, surfaceY * 0.5, 0.7);
    }

    // the boat floats on the surface
    drawBoat(loc.worldWidth / 2 - cam.x, surfaceY - 2);

    // bright band just below the surface
    var wb = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + 30);
    wb.addColorStop(0, "rgba(255,255,255,0.32)"); wb.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = wb; ctx.fillRect(0, surfaceY, W, 30);
    // rippling waterline
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    var chop = loc.storm ? 7 : 2; // stormy seas churn with big choppy swells
    for (var x = 0; x < W; x += 6) {
      var wy = surfaceY + Math.sin((x + cam.x) * 0.05 + run.time * 1.6) * chop + (loc.storm ? Math.sin((x + cam.x) * 0.13 + run.time * 3.2) * 4 : 0);
      ctx.fillRect(x, wy - 1, 6, 2);
    }
    ctx.restore();
  }

  function drawCages() {
    if (!run.cages) return;
    for (var i = 0; i < run.cages.length; i++) {
      var cg = run.cages[i]; if (cg.opened) continue;
      var bob = Math.sin(run.time * 1.1 + (cg.bob || 0)) * 3;
      var x = cg.x - cam.x, y = cg.y - cam.y + bob;
      if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
      // a rusty iron crate: chunky corner posts, cross bars, padlock + loot glint
      var rust = "#7a5a3a", iron = "#5a5048", dark = "#2a241c";
      ctx.fillStyle = dark; ctx.fillRect(x - 17, y - 21, 34, 38);          // interior
      ctx.fillStyle = "#ffcf3a";                                            // treasure glint inside
      for (var b = 0; b < 3; b++) { if (Math.sin(run.time * 2 + b + (cg.bob || 0)) > 0) ctx.fillRect(x - 9 + b * 8, y + 4 + (b % 2) * 4, 3, 3); }
      ctx.strokeStyle = iron; ctx.lineWidth = 2;                            // vertical bars
      for (var bx = -12; bx <= 12; bx += 8) { ctx.beginPath(); ctx.moveTo(x + bx, y - 21); ctx.lineTo(x + bx, y + 17); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(x - 17, y - 4); ctx.lineTo(x + 17, y - 4); ctx.stroke(); // cross bar
      ctx.strokeStyle = rust; ctx.lineWidth = 4;                            // rusty frame
      ctx.strokeRect(x - 17, y - 21, 34, 38);
      ctx.fillStyle = rust; [[-17, -21], [13, -21], [-17, 13], [13, 13]].forEach(function (p) { ctx.fillRect(x + p[0], y + p[1], 4, 8); ctx.fillRect(x + p[0], y + p[1], 8, 4); }); // corner brackets
      // padlock
      ctx.fillStyle = cg.hasKey ? "#ffe14d" : "#9aa6b0";
      ctx.fillRect(x - 4, y - 2, 8, 7); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 2, 3, Math.PI, 0); ctx.stroke();
      if (cg.hasKey) drawGlow(x, y, 26, "#ffe14d", 0.35);
    }
  }
  function drawOilRig() {
    if (!run.oilrig) return;
    var x = run.oilrig.x - cam.x, top = -cam.y; // rig stands from the surface down
    if (x < -160 || x > W + 160) return;
    ctx.save();
    // legs from the seabed up through the water
    var fy = run.floorY - cam.y;
    ctx.strokeStyle = "#5a4a32"; ctx.lineWidth = 6;
    [-46, -16, 16, 46].forEach(function (lx) { ctx.beginPath(); ctx.moveTo(x + lx, fy); ctx.lineTo(x + lx * 0.5, Math.max(top, -40)); ctx.stroke(); });
    // platform at the surface
    var py = Math.max(top - 4, -30);
    ctx.fillStyle = "#3a3220"; ctx.fillRect(x - 70, py - 14, 140, 16);
    ctx.fillStyle = "#caa14a"; ctx.fillRect(x - 18, py - 60, 36, 48);      // derrick base
    ctx.strokeStyle = "#8a7a4a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 18, py - 12); ctx.lineTo(x, py - 80); ctx.lineTo(x + 18, py - 12); ctx.stroke();
    // hatch glow if you still need the key
    if (!state.areas.oilrig) { ctx.fillStyle = state.items.cagekey ? "#7affa0" : "#ff7a3a"; ctx.beginPath(); ctx.arc(x, fy - 28, 7, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  function drawBeam(bd, c0, c1) {
    var x = bd.x - cam.x, y = bd.y - cam.y, ex = x + bd.dx * bd.len, ey = y + bd.dy * bd.len;
    var nx = -bd.dy, ny = bd.dx, w0 = 8, w1 = 40 + Math.sin(run.time * 30) * 4;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var g = ctx.createLinearGradient(x, y, ex, ey);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + nx * w0, y + ny * w0); ctx.lineTo(x - nx * w0, y - ny * w0);
    ctx.lineTo(ex - nx * w1, ey - ny * w1); ctx.lineTo(ex + nx * w1, ey + ny * w1);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawBossBeam() {
    if (run.bossBeam) drawBeam(run.bossBeam, "rgba(120,200,255,0.85)", "rgba(60,120,255,0.1)");
    if (run.playerBeam) drawBeam(run.playerBeam, "rgba(150,230,255,0.9)", "rgba(80,160,255,0.12)");
  }
  function drawPebbles() {
    if (!run.pebbles) return;
    for (var i = 0; i < run.pebbles.length; i++) {
      var pb = run.pebbles[i], x = pb.x - cam.x, y = pb.y - cam.y;
      ctx.fillStyle = "#cbb89a"; ctx.fillRect((x - 2) | 0, (y - 2) | 0, 4, 4);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect((x - 2) | 0, (y - 2) | 0, 2, 1);
    }
  }
  // drifting puffs that obscure whatever's inside them
  // dark ash for the Ashen Caldera; pale icy fog for the Arctic
  function drawSmoke() {
    if (!run.smoke || !run.smoke.length) return;
    var fog = run.loc && run.loc.fog;
    var col = fog ? "224,238,247" : "40,34,30";
    for (var i = 0; i < run.smoke.length; i++) {
      var sm = run.smoke[i], x = sm.x - cam.x, y = sm.y - cam.y;
      if (x < -sm.r - 40 || x > W + sm.r + 40 || y < -sm.r - 40 || y > H + sm.r + 40) continue;
      var fade = Math.min(1, sm.life / 2) * Math.min(1, (8 - sm.life > 0 ? 1 : sm.life));
      var a = (fog ? 0.42 : 0.5) * fade;
      // a few overlapping blobs per puff for a billowing look
      for (var b = 0; b < 4; b++) {
        var ox = Math.sin(sm.phase + b * 1.7) * sm.r * 0.4, oy = Math.cos(sm.phase * 0.8 + b) * sm.r * 0.3;
        var rr = sm.r * (0.6 + 0.2 * (b % 2));
        var g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
        g.addColorStop(0, "rgba(" + col + "," + a.toFixed(3) + ")");
        g.addColorStop(1, "rgba(" + col + ",0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + ox, y + oy, rr, 0, 7); ctx.fill();
      }
    }
  }
  // a dark tunnel-mouth dug into the seabed (or the right wall) that you swim
  // THROUGH to reach a hidden site — no portal, just a hole in the floor.
  function drawSecretPassageCue(loc) {
    for (var i = 0; i < SECRET_PASSAGES.length; i++) {
      var p = SECRET_PASSAGES[i];
      if (p.from !== run.area) continue;
      var known = !!state.areas[p.to];
      var rightEdge = /worldWidth/.test(p.at.toString());
      // anchor the hole on the seabed floor (or the bottom-right corner)
      var wx = rightEdge ? loc.worldWidth - 34 : 30;
      var wy = loc.maxDepth * PXPM - 10;
      var x = wx - cam.x, y = wy - cam.y;
      if (x < -90 || x > W + 90 || y < -60 || y > H + 90) continue;
      var rx = 40, ry = 22;
      // rocky rim around the opening
      ctx.save();
      ctx.fillStyle = "#0a0c10";
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
      // a darker throat that fades to black (the tunnel going down)
      var g = ctx.createRadialGradient(x, y - 2, 2, x, y, rx);
      g.addColorStop(0, "#000000"); g.addColorStop(0.7, "#05060a"); g.addColorStop(1, "rgba(5,6,10,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
      // chunky rock lip
      ctx.strokeStyle = "rgba(40,44,52,0.9)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, Math.PI * 0.92, Math.PI * 2.08); ctx.stroke();
      // a faint hint of light from the far side once you've been through it
      if (known) {
        var pulse = 0.18 + Math.sin(run.time * 2) * 0.06;
        drawGlow(x, y, 16 + Math.sin(run.time * 2) * 3, "#bfe0ff", pulse);
      }
      // a couple of bubbles drifting up out of the hole
      for (var b = 0; b < 3; b++) {
        var bt = (run.time * 0.6 + b * 0.4) % 1;
        ctx.fillStyle = "rgba(200,230,255," + (0.3 * (1 - bt)).toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(x + Math.sin(b * 2 + run.time) * 10, y - bt * 34, 2, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
  }
  // the Goblin Shark trails a roiling cloud of inky darkness that swallows the
  // light around it (gets thicker the closer it is to you)
  function drawGoblinDarkness() {
    for (var i = 0; i < run.fish.length; i++) {
      var f = run.fish[i];
      if (!(f.isBoss && f.def && f.def.shape === "goblin")) continue;
      var gx = f.x - cam.x, gy = f.y - cam.y;
      var r = 150 + f.size * 8 + Math.sin(run.time * 1.5) * 14;
      var g = ctx.createRadialGradient(gx, gy, 8, gx, gy, r);
      g.addColorStop(0, "rgba(2,3,6,0.92)");
      g.addColorStop(0.55, "rgba(2,3,6,0.6)");
      g.addColorStop(1, "rgba(2,3,6,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(gx, gy, r, 0, 7); ctx.fill();
    }
  }
  function drawTrap() {
    if (!run.trap || !run.trap.active || run.trap.r <= 0) return;
    var x = run.trap.x - cam.x, y = run.trap.y - cam.y, r = run.trap.r;
    if (x < -r - 40 || x > W + r + 40 || y < -r - 40 || y > H + r + 40) return;
    ctx.save();
    ctx.strokeStyle = "rgba(180,255,180,0.5)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    // net mesh
    ctx.strokeStyle = "rgba(200,255,200,0.18)"; ctx.lineWidth = 1;
    for (var g = -r; g <= r; g += 16) {
      ctx.beginPath(); ctx.moveTo(x + g, y - r); ctx.lineTo(x + g, y + r); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r, y + g); ctx.lineTo(x + r, y + g); ctx.stroke();
    }
    ctx.fillStyle = "rgba(120,220,120,0.08)"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawBubbles() {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (var b = 0; b < run.bubbles.length; b++) {
      var bb = run.bubbles[b];
      var x = (bb.x - cam.x) | 0, y = (bb.y - cam.y) | 0, s = Math.max(1, bb.r | 0);
      ctx.fillRect(x, y, s, s);
    }
  }

  function drawGlow(x, y, r, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawLighting(loc, darkness) {
    var dx = run.diver.x - cam.x, dy = run.diver.y - cam.y;
    var gog = state.items.goggles ? 260 : 0;      // goggles substantially widen your view
    // FOV grows with each Dive Light upgrade level (and again with goggles)
    var fov = lightRadius() * 1.5 + gog;
    // warm dive-light glow that grows useful as it gets darker
    if (darkness > 0.2) {
      drawGlow(dx, dy, 130 + fov, "#ffe7a8", Math.min(0.5, darkness * 0.5));
    }
    // depth darkness vignette with a clear hole around the diver
    if (darkness > 0.22) {
      var lr = 150 + fov;
      var rg = ctx.createRadialGradient(dx, dy, lr * 0.35, dx, dy, lr * 1.15);
      var a = Math.min(0.86, (darkness - 0.22) * 1.5) * (state.items.goggles ? 0.72 : 1); // goggles also lighten the gloom
      rg.addColorStop(0, "rgba(0,0,8,0)");
      rg.addColorStop(1, "rgba(0,0,10," + a + ")");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
    // Torch: a bright beam in the direction you steer — only lit at night
    if (state.items.torch && run.night) {
      var reach = 320, halfW = 130;
      var aim = Math.atan2(run.aimY || 0, run.aimX != null ? run.aimX : (run.diver.face < 0 ? -1 : 1));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(dx, dy); ctx.rotate(aim);
      var lg = ctx.createLinearGradient(0, 0, reach, 0);
      lg.addColorStop(0, "rgba(255,244,200,0.42)");
      lg.addColorStop(1, "rgba(255,244,200,0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.lineTo(reach, halfW);
      ctx.lineTo(reach, -halfW);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      drawGlow(dx + Math.cos(aim) * 18, dy + Math.sin(aim) * 18, 50, "#fff4c8", 0.5); // bright lamp at the source
    }
  }

  function drawJoystick() {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath(); ctx.arc(joy.sx, joy.sy, JOY_MAX, 0, 7); ctx.stroke();
    ctx.fillStyle = "rgba(63,208,255,0.55)";
    ctx.beginPath(); ctx.arc(joy.cx, joy.cy, 26, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawStarfield() {
    ctx.save();
    for (var i = 0; i < 60; i++) {
      var sx = (i * 137.5 % W);
      var sy = ((i * 71.3) % H);
      var tw = 0.4 + 0.6 * Math.abs(Math.sin(run.time * 1.5 + i));
      ctx.globalAlpha = tw * 0.7;
      ctx.fillStyle = i % 5 === 0 ? "#ffd6ff" : "#cfe6ff";
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.restore();
  }

  function drawBoat(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#5a3a22";
    ctx.beginPath();
    ctx.moveTo(-46, 0); ctx.lineTo(46, 0); ctx.lineTo(34, 14); ctx.lineTo(-34, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(-4, -34, 8, 34);
    ctx.fillStyle = "#ecf0f1";
    ctx.beginPath(); ctx.moveTo(6, -32); ctx.lineTo(30, -10); ctx.lineTo(6, -10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawWreck(wk) {
    // a fully-stripped wreck sinks away into the silt and vanishes
    if ((wk.looted || 0) >= wreckCap(wk)) { wk.fade = Math.min(1, (wk.fade || 0) + 0.02); if (wk.fade >= 1) return; }
    var x = wk.x - cam.x, y = wk.y - cam.y;
    if (x < -wk.w || x > W + wk.w || y < -120 || y > H + 80) return;
    ctx.save();
    if (wk.fade) ctx.globalAlpha = 1 - wk.fade;
    ctx.translate(x, y);
    ctx.lineWidth = 4;
    if (wk.type === "plane") {
      // sunken plane: fuselage + broken wing + tail
      ctx.fillStyle = "rgba(36,42,50,0.92)";
      ctx.strokeStyle = "rgba(120,140,155,0.9)";
      var hw = wk.w / 2;
      ctx.beginPath();
      ctx.moveTo(-hw, 0);
      ctx.quadraticCurveTo(-hw - 16, 14, -hw, 26);
      ctx.lineTo(hw - 10, 22);
      ctx.quadraticCurveTo(hw + 18, 12, hw - 6, 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // windows
      ctx.fillStyle = "rgba(120,200,255,0.5)";
      for (var w = -hw + 18; w < hw - 24; w += 16) ctx.fillRect(w, 8, 7, 5);
      // broken wing
      ctx.fillStyle = "rgba(46,54,64,0.92)";
      ctx.beginPath(); ctx.moveTo(-6, 18); ctx.lineTo(38, 50); ctx.lineTo(54, 46); ctx.lineTo(2, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
      // tail fin
      ctx.beginPath(); ctx.moveTo(-hw + 4, 2); ctx.lineTo(-hw - 6, -34); ctx.lineTo(-hw + 16, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (wk.type === "yacht") {
      // sleek capsized luxury yacht — white hull, gold trim, tilted
      var yhw = wk.w / 2;
      ctx.rotate(-0.12);
      ctx.fillStyle = "rgba(228,232,238,0.95)"; ctx.strokeStyle = "rgba(150,160,172,0.9)";
      ctx.beginPath();
      ctx.moveTo(-yhw, 0); ctx.quadraticCurveTo(-yhw + 6, 26, 4, 30);
      ctx.quadraticCurveTo(yhw + 22, 22, yhw, -4); ctx.lineTo(-yhw + 10, -4);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,207,58,0.9)"; ctx.fillRect(-yhw + 10, -4, yhw * 1.4, 3); // gold waterline stripe
      // cabin + tinted windows
      ctx.fillStyle = "rgba(210,216,224,0.95)"; ctx.fillRect(-yhw * 0.4, -22, yhw * 0.8, 18);
      ctx.fillStyle = "rgba(90,150,200,0.55)"; for (var yw = -yhw * 0.3; yw < yhw * 0.4; yw += 12) ctx.fillRect(yw, -18, 8, 8);
      ctx.fillStyle = "rgba(255,207,58,0.5)"; ctx.fillRect(-yhw * 0.4, -24, yhw * 0.8, 2);
    } else if (wk.type === "cargo") {
      // huge container freighter on its side, stacked with shipping containers
      var chw = wk.w / 2;
      ctx.fillStyle = "rgba(40,46,54,0.94)"; ctx.strokeStyle = "rgba(80,92,104,0.9)";
      ctx.beginPath();
      ctx.moveTo(-chw, 0); ctx.lineTo(chw, 0); ctx.quadraticCurveTo(chw + 26, 24, chw - 16, 40);
      ctx.lineTo(-chw + 10, 40); ctx.quadraticCurveTo(-chw - 8, 22, -chw, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // rusty hull streaks
      ctx.fillStyle = "rgba(120,70,40,0.4)"; for (var rs = -chw + 16; rs < chw - 10; rs += 30) ctx.fillRect(rs, 4, 4, 30);
      // stacked containers across the deck (2 rows)
      var cols2 = ["#b14a3a", "#3a72a0", "#caa14a", "#4a8a5a", "#8a5aa0"];
      for (var cc = 0; cc < Math.floor(wk.w / 30); cc++) {
        var cx0 = -chw + 8 + cc * 30;
        ctx.fillStyle = cols2[cc % cols2.length]; ctx.fillRect(cx0, -16, 26, 14);
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(cx0, -16, 26, 2);
        if (cc % 2 === 0) { ctx.fillStyle = cols2[(cc + 2) % cols2.length]; ctx.fillRect(cx0 + 2, -30, 22, 13); }
      }
      // crane gantry
      ctx.strokeStyle = "rgba(150,160,170,0.8)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(chw - 40, -30); ctx.lineTo(chw - 40, -54); ctx.lineTo(chw - 80, -54); ctx.stroke();
      ctx.lineWidth = 4;
    } else {
      ctx.fillStyle = "rgba(20,30,30,0.9)";
      ctx.strokeStyle = "rgba(60,90,80,0.9)";
      ctx.beginPath();
      ctx.moveTo(-wk.w / 2, 0);
      ctx.quadraticCurveTo(-wk.w / 2, 50, 0, 56);
      ctx.quadraticCurveTo(wk.w / 2, 50, wk.w / 2, 0);
      ctx.lineTo(wk.w / 2 - 20, -8);
      ctx.lineTo(-wk.w / 2 + 20, -8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(40,60,55,0.9)";
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-30, -64); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTreasure(tr) {
    var x = (tr.x - cam.x) | 0, y = (tr.y - cam.y + Math.sin(tr.phase) * 3) | 0;
    var pulse = 0.5 + 0.5 * Math.sin(tr.phase * 2);
    var rare = tr.def.rarity && D.RARITY[tr.def.rarity] && D.RARITY[tr.def.rarity].order >= 3;
    drawGlow(x, y, 14 + pulse * 8, tr.def.color, rare ? 0.7 : 0.5);
    if (rare) drawGlow(x, y, 22 + pulse * 10, "#fff7c0", 0.18); // rarer loot sparkles brighter
    drawTreasureSprite(tr.def.id, x, y, tr.def.color);
    // twinkle
    if (Math.sin(tr.phase * 2.3) > 0.7) { ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fillRect(x + 5, y - 6, 2, 2); }
  }
  // hand-drawn pixel sprite for each treasure kind (centred on x,y)
  function drawTreasureSprite(id, x, y, col) {
    function R(ax, ay, aw, ah, c) { ctx.fillStyle = c; ctx.fillRect(x + ax, y + ay, aw, ah); }
    var dk = mix(col, "#000000", 0.4), lt = mix(col, "#ffffff", 0.5), wht = "rgba(255,255,255,0.9)";
    switch (id) {
      case "coins": case "coinchest":
        if (id === "coinchest") { // treasure chest brimming with gold
          R(-9, -2, 18, 9, "#5a3a1c"); R(-9, -2, 18, 2, "#7a4f28"); R(-9, 5, 18, 2, "#3a2410");
          R(-9, -7, 18, 5, "#6a4420"); R(-9, -7, 18, 2, "#8a5a2c"); // curved lid
          R(-2, -5, 4, 8, "#ffcf3a"); R(-1, -5, 2, 8, "#fff0a0"); // lock band
          R(-7, -9, 3, 3, col); R(0, -10, 3, 3, lt); R(5, -9, 3, 3, col); // spilling coins
        } else { // coin stack
          R(-6, 3, 12, 3, dk); R(-6, 0, 12, 3, col); R(-5, 0, 10, 1, lt);
          R(-5, -3, 10, 3, col); R(-4, -3, 8, 1, lt); R(-4, -6, 8, 3, col); R(-3, -6, 6, 1, lt);
        }
        break;
      case "bottle":
        R(-2, -8, 4, 3, "#caa15a"); R(-1, -10, 2, 2, "#8a6a3a"); // cork
        R(-4, -5, 8, 12, col); R(-3, -5, 2, 11, lt); R(2, -4, 1, 10, dk);
        R(-3, -1, 6, 5, "#f3e6c8"); // rolled message
        break;
      case "pearl": case "clampearl":
        if (id === "clampearl") { R(-8, 2, 16, 4, mix(col, "#c890b0", 0.5)); R(-8, 2, 16, 1, "#fff"); } // shell
        R(-4, -4, 8, 8, "#fff0f6"); R(-5, -2, 1, 4, mix(col, "#d0a0c0", 0.5));
        R(4, -2, 1, 4, mix(col, "#d0a0c0", 0.5)); R(-2, -2, 3, 3, wht);
        break;
      case "goblet":
        R(-5, -7, 10, 4, lt); R(-5, -7, 10, 1, wht); R(-4, -3, 8, 2, col); // cup
        R(-1, -1, 2, 6, lt); R(-4, 5, 8, 2, dk); R(-3, 5, 6, 1, col); // stem + base
        break;
      case "ruby": case "amulet":
        if (id === "amulet") { R(-7, -7, 3, 2, "#caa15a"); R(4, -7, 3, 2, "#caa15a"); R(-1, -8, 2, 2, "#caa15a"); } // chain
        R(-2, -5, 4, 1, lt); R(-5, -4, 10, 2, col); R(-6, -2, 12, 3, col); // faceted gem
        R(-4, 1, 8, 2, col); R(-2, 3, 4, 2, dk); R(-3, -3, 2, 2, wht);
        break;
      case "crown":
        R(-8, 1, 16, 4, col); R(-8, 1, 16, 1, lt); // band
        R(-8, -5, 3, 6, col); R(-1, -7, 3, 8, col); R(6, -5, 3, 6, col); R(-4, -2, 2, 3, col); R(3, -2, 2, 3, col); // points
        R(-7, -6, 2, 2, "#e23b5a"); R(0, -8, 2, 2, "#49d6c0"); R(6, -6, 2, 2, "#5b8aff"); // jewels
        break;
      case "blackbox":
        R(-6, -4, 12, 9, "#e8852a"); R(-6, -4, 12, 2, "#ffae6a"); R(-6, 3, 12, 2, "#a85a18");
        R(-4, -2, 3, 2, "#222"); R(2, -2, 2, 4, "#222"); break; // flight recorder
      case "pilotwatch":
        R(-5, -5, 10, 10, "#3a3f46"); R(-4, -4, 8, 8, lt); R(-3, -3, 6, 6, "#1a2028");
        R(-1, -2, 1, 3, wht); R(0, -1, 2, 1, wht); R(-1, -7, 2, 2, "#caa15a"); R(-1, 5, 2, 2, "#caa15a"); break;
      case "turbine":
        R(-6, -6, 12, 12, "#3a4650"); R(-5, -5, 10, 10, mix(col, "#000", 0.2)); R(-2, -2, 4, 4, "#cfd6de");
        R(-1, -7, 2, 5, lt); R(-7, -1, 5, 2, lt); R(2, -1, 5, 2, lt); R(-1, 2, 2, 5, lt); break; // engine + blades
      case "goldwings":
        R(-1, -5, 2, 9, dk); // body
        R(-9, -3, 8, 2, col); R(-8, -1, 7, 2, lt); R(-7, 1, 6, 2, col); // left wing
        R(1, -3, 8, 2, col); R(1, -1, 7, 2, lt); R(1, 1, 6, 2, col); // right wing
        break;
      case "champagne": // yacht-exclusive
        R(-2, -9, 4, 3, "#3a2a14"); R(-3, -6, 6, 13, mix(col, "#1a6a3a", 0.4)); R(-2, -6, 1, 12, lt);
        R(-3, 0, 6, 1, "#ffd24a"); R(-3, -3, 6, 1, "#ffd24a"); break; // bubbly bottle with gold labels
      case "rolex": // yacht-exclusive luxury watch
        R(-6, -4, 12, 8, "#ffcf3a"); R(-5, -3, 10, 6, "#fff0a0"); R(-3, -2, 6, 4, "#1a2028");
        R(-7, -3, 2, 6, lt); R(5, -3, 2, 6, lt); R(0, 0, 1, 2, wht); break;
      case "container": // cargo-ship container
        R(-9, -4, 18, 9, col); R(-9, -4, 18, 1, lt); R(-9, 4, 18, 1, dk);
        for (var c = -8; c < 9; c += 3) R(c, -3, 1, 7, dk); break; // corrugated sides
      default: // generic gem fallback
        R(-2, -6, 4, 2, col); R(-4, -4, 8, 2, col); R(-6, -2, 12, 4, col); R(-4, 2, 8, 2, col); R(-2, 4, 4, 2, col);
        R(-3, -2, 2, 2, wht);
    }
  }

  function drawReel() {
    var dx = run.diver.x - cam.x, dy = run.diver.y - cam.y;
    ctx.save();
    ctx.translate(dx, dy - 30);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(-22, -5, 44, 8);
    ctx.fillStyle = "#ffe14d";
    ctx.fillRect(-21, -4, 42 * clamp(run.reel, 0, 1), 6);
    ctx.restore();
  }

  // a mini fish/creature/bird companion (chosen in the Collection) that trails you
  function drawBuddy() {
    if (!state.buddy) return;
    var def = D.FISH_BY_ID[state.buddy.id]; if (!def) return;
    var face = run.diver.face < 0 ? -1 : 1;
    var tx = run.diver.x - face * 28, ty = run.diver.y + 12 + Math.sin(run.time * 2.2) * 5;
    if (run.buddyX == null) { run.buddyX = tx; run.buddyY = ty; }
    run.buddyX += (tx - run.buddyX) * 0.14; run.buddyY += (ty - run.buddyY) * 0.14;
    var x = run.buddyX - cam.x, y = run.buddyY - cam.y;
    var flip = (tx - run.buddyX) < 0; // face the way it's swimming
    var th = 14;
    if (state.buddy.shiny) drawGlow(x, y, th, "#fff0a0", 0.4);
    var arch = SPRITES.archetypeForShape(def.shape);
    if (def.bird) drawFlapBird(arch, x, y, { color: def.color, accent: def.accent, shiny: state.buddy.shiny, flip: flip, targetH: th }, run.time * 5);
    else SPRITES.draw(ctx, arch, x, y, { color: def.color, accent: def.accent, shiny: state.buddy.shiny, flip: flip, targetH: th });
  }
  function drawDiver() {
    var x = run.diver.x - cam.x, y = run.diver.y - cam.y;
    // magnet field — soft pulsing aura
    var mr = catchRadius();
    var pulse = 0.5 + 0.5 * Math.sin(run.time * 3);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var rg = ctx.createRadialGradient(x, y, mr * 0.2, x, y, mr);
    rg.addColorStop(0, "rgba(120,220,255,0)");
    rg.addColorStop(0.8, "rgba(120,220,255," + (0.04 + pulse * 0.04) + ")");
    rg.addColorStop(1, "rgba(120,220,255,0)");
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(x, y, mr, 0, 7); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(160,230,255,0.12)";
    ctx.beginPath(); ctx.arc(x, y, mr, 0, 7); ctx.stroke();
    var moving = Math.abs(run.diver.vx) + Math.abs(run.diver.vy) > 5;
    var kick = run.time * (moving ? 11 : 3.5);
    // Camo Suit: tint the diver to the surrounding water and render faint so you
    // melt into the background (a little less faint while you're moving)
    if (state.diver.suit === "camo") {
      var loc = D.LOCATIONS[run.area];
      var bg = mix(loc.topColor, loc.deepColor, depthFactor(run.diver.y, loc));
      var camoOpts = { skin: state.diver.skin, hair: state.diver.hair, look: state.diver.look,
        suit: bg, suitAccent: mix(bg, "#ffffff", 0.12), suitTrim: mix(bg, "#ffffff", 0.2), camoSkin: bg };
      ctx.save();
      ctx.globalAlpha = moving ? 0.34 : 0.16;
      drawDiverPixel(ctx, x, y, 3, run.diver.face < 0 ? -1 : 1, camoOpts, kick);
      ctx.restore();
      return;
    }
    drawDiverPixel(ctx, x, y, 3, run.diver.face < 0 ? -1 : 1, state.diver, kick);
  }

  // ----- diver customization palettes -----
  var SKIN_TONES = ["#f4c9a3", "#e8b088", "#d39a6e", "#b87a4f", "#8d5524", "#5a3318"];
  var HAIR_COLORS = ["#2b1d12", "#5a3a1a", "#a85e2e", "#caa33a", "#d8d8da", "#3a3f55", "#8a3b6b", "#2f6f5e"];
  var SUITS = [
    { id: "teal",   color: "#1f7d9c", accent: "#ffd24a", trim: "#bfe9ff", cost: 0 },
    { id: "navy",   color: "#26407a", accent: "#e08a3a", trim: "#9fc0ff", cost: 0 },
    { id: "red",    color: "#b03a3a", accent: "#f3e6c8", trim: "#ffae6a", cost: 0 },
    { id: "green",  color: "#2f7d4a", accent: "#ffd24a", trim: "#bfffa0", cost: 0 },
    { id: "purple", color: "#6a3aa0", accent: "#7affd0", trim: "#ff9af0", cost: 0 },
    { id: "pink",   color: "#c0508f", accent: "#ffe14d", trim: "#7afcff", cost: 250 },
    { id: "orange", color: "#d8742e", accent: "#2a5a7a", trim: "#ffe14d", cost: 250 },
    { id: "gold",   color: "#c79a2e", accent: "#3a2a10", trim: "#fff3b0", cost: 1500 },
    { id: "neon",   color: "#1fd6a0", accent: "#ff5bd0", trim: "#f6ff5b", cost: 1500 },
    { id: "void",   color: "#2a2350", accent: "#9f7bff", trim: "#5bf0ff", cost: 3000 },
    { id: "rainbow", color: "#ff5b7f", accent: "#7afcff", trim: "#f6ff5b", cost: 8000 },
  ];
  function suitAccentFor(color) { return mix(color, "#ffffff", 0.42); }
  function suitTrimFor(color, accent) { return mix(accent || mix(color, "#ffffff", 0.42), "#ffffff", 0.4); }
  var LOOKS = [
    { id: "short",    name: "Short" },
    { id: "long",     name: "Long" },
    { id: "bun",      name: "Bun" },
    { id: "buzz",     name: "Buzz" },
    { id: "ponytail", name: "Ponytail" },
    { id: "mohawk",   name: "Mohawk" },
    { id: "afro",     name: "Afro" },
    { id: "braids",   name: "Braids" },
  ];
  // Themed wetsuits: one per location (unlock as you reach the area) ...
  var LOCATION_SUITS = [
    { name: "Coral",     area: "coral",     color: "#2bb3c9", always: true },
    { name: "River",     area: "river",     color: "#4a9e6a", always: true },
    { name: "Kelp",      area: "kelp",      color: "#2f9e8f" },
    { name: "Prism",     area: "prism",     color: "#ff7ad0" },
    { name: "Arctic",    area: "arctic",    color: "#bfe6ff" },
    { name: "Open Sea",  area: "opensea",   color: "#1f7fc4" },
    { name: "Fossil",    area: "ancient",   color: "#a8843e" },
    { name: "Grove",     area: "forest",    color: "#5fae4a" },
    { name: "Swamp",     area: "swamp",     color: "#7a8a3a" },
    { name: "Boneyard",  area: "boneyard",  color: "#cfc6b4" },
    { name: "Gloom",     area: "cave",      color: "#8a7ad0" },
    { name: "Cloud",     area: "cloud",     color: "#bfe0ff" },
    { name: "Trench",    area: "trench",    color: "#1a5fa0" },
    { name: "Starlight", area: "sanctuary", color: "#7a5cff" },
    // secret-area suits — hidden (no spoiler) until you find the place
    { name: "Backrooms", area: "backrooms", color: "#d8c84a", secret: true },
    { name: "Ornate",    area: "japan",     color: "#e0556a", secret: true },
    { name: "Hollow",    area: "secretcave",color: "#9a8ad0" },
    { name: "Oil Rig",   area: "oilrig",    color: "#caa14a", secret: true },
    { name: "Stormy",    area: "storm",     color: "#46506a" },
    { name: "Sunlit",    area: "mountain",  color: "#8a9aae" },
    { name: "Caldera",   area: "ashen",     color: "#e0552a", secret: true },
    { name: "Pirate",    area: "pirate",    color: "#8a6a3a", secret: true },
    { name: "Olympus",   area: "olympus",   color: "#ffe07a", secret: true },
  ];
  // ... and one per secret fish (unlock by catching that secret)
  var SECRET_SUITS = D.FISH.filter(function (f) { return f.secret; })
    .map(function (f) { return { id: f.id, name: f.name, color: f.color, accent: f.accent, trim: f.trim }; });
  // ... and one per boss you defeat (area bosses + hinted secret bosses)
  var BOSS_SUITS = D.FISH.filter(function (f) { return f.areaBoss || (f.secretBoss && f.hint); })
    .map(function (f) { return { id: f.id, name: f.name, color: f.color, accent: f.accent || suitAccentFor(f.color), trim: f.trim, area: f.area, secretArea: D.LOCATIONS[f.area] && D.LOCATIONS[f.area].secret }; });

  // Draw a clearly-human side-view diver with kicking legs/fins.
  // ctx2: target context · (cx,cy): screen centre · SC: pixel scale ·
  // face: 1 right / -1 left · opts: state.diver · kick: animation phase
  function drawDiverPixel(ctx2, cx, cy, SC, face, opts, kick) {
    opts = opts || {};
    var skin = opts.camoSkin || SKIN_TONES[opts.skin != null ? opts.skin : 2] || SKIN_TONES[2];
    var suit = opts.suit || "#1f7d9c";
    if (suit === "camo") suit = "#46584a"; // safe fallback if drawn raw (e.g. aquarium)
    var suitD = mix(suit, "#000000", 0.4);
    var hair = opts.hair != null ? HAIR_COLORS[opts.hair] : HAIR_COLORS[0];
    var fin = mix(suit, "#000000", 0.25);
    var mask = "#bfe9ff";
    var look = opts.look || "short";

    function R(ax, ay, aw, ah, col) {
      ctx2.fillStyle = col;
      var X = face > 0 ? (cx + ax * SC) : (cx - (ax + aw) * SC);
      ctx2.fillRect(Math.round(X), Math.round(cy + ay * SC), aw * SC, ah * SC);
    }

    var legTop = Math.round(Math.sin(kick) * 1.6);
    var legBot = Math.round(Math.sin(kick + Math.PI) * 1.6);
    var maskGlass = mix(suit, "#cfeeff", 0.7);
    // gear reflects upgrades: bigger tank with oxygen, longer fins with fins
    var ox = (state && state.upgrades) ? state.upgrades.oxygen : 0;
    var finLv = (state && state.upgrades) ? state.upgrades.fins : 0;
    var tankX = Math.min(3, Math.floor(ox / 2));     // extra tank size
    var finLen = 4 + Math.min(4, Math.floor((finLv + 1) / 2)); // fin length

    // back air tank (grows with oxygen upgrade)
    R(-6 - tankX, -4 - tankX, 3 + tankX, 5 + tankX * 2, "#39424d");
    R(-6 - tankX, -4 - tankX, 3 + tankX, 1, "#6b7a88");   // tank top highlight
    R(-5, -5 - tankX, 1, 1, "#9aa6b0");                   // valve
    // shoulder strap
    R(-3, -2, 1, 5, suitD);
    // fins + legs (trailing left, kicking; fins grow with fins upgrade)
    R(-8 - finLen, -2 + legTop, finLen, 2, fin); R(-8 - finLen, -2 + legTop, finLen, 1, mix(fin, "#fff", 0.25));
    R(-8, -1 + legTop, 4, 2, suit);
    R(-8 - finLen, 4 + legBot, finLen, 2, fin); R(-8 - finLen, 5 + legBot, finLen, 1, suitD);
    R(-8, 3 + legBot, 4, 2, suit);
    var accent = opts.suitAccent || mix(suit, "#ffffff", 0.4);
    var trim = opts.suitTrim || mix(accent, "#ffffff", 0.32); // third suit colour (piping / gear)
    var trimD = mix(trim, "#000000", 0.3);
    // torso (wetsuit) — chunky & cute, now THREE-tone
    R(-4, -2, 9, 5, suit);
    R(-4, -2, 9, 1, mix(suit, "#fff", 0.3));    // top highlight
    R(-4, -1, 9, 1, accent);                    // chest panel (accent)
    R(-4, 0, 9, 1, trim);                       // two-tone trim stripe
    R(-4, 2, 9, 1, "#2c2620");                  // weight belt
    R(-3, 2, 2, 1, trim);                       // belt buckle (trim)
    R(-4, -2, 1, 5, mix(suit, "#fff", 0.14));   // back rim light
    R(-1, -1, 2, 2, trimD);                     // chest dive-computer
    R(0, -1, 1, 1, mix(trim, "#fff", 0.6));     // gauge glint
    // forward arm + glove
    R(3, 2, 5, 2, suit); R(3, 3, 5, 1, suitD);
    R(5, 2, 1, 2, accent);                      // shoulder seam (accent)
    R(6, 2, 1, 2, trim);                        // cuff (trim)
    R(7, 2, 2, 2, skin);                        // hand
    // BIG cute head
    R(5, -6, 5, 7, skin);
    R(5, -6, 5, 1, mix(skin, "#fff", 0.35));    // forehead highlight
    R(5, 1, 5, 1, mix(skin, "#000", 0.22));     // chin shadow
    R(10, -2, 1, 1, mix(skin, "#ff9a9a", 0.55)); // rosy cheek :)
    // hood collar behind the head (trim-lined)
    R(4, 0, 2, 1, suitD); R(4, -1, 1, 2, trim);
    // hair by look
    if (look === "short") { R(4, -7, 6, 2, hair); R(4, -6, 1, 4, hair); }
    else if (look === "long") { R(4, -7, 6, 2, hair); R(3, -6, 2, 8, hair); }
    else if (look === "bun") { R(4, -7, 6, 2, hair); R(3, -8, 2, 2, hair); R(2, -8, 1, 1, hair); }
    else if (look === "ponytail") { R(4, -7, 6, 2, hair); R(4, -6, 1, 3, hair); R(2, -7, 2, 1, hair); R(1, -7, 1, 5, hair); R(0, -5, 1, 3, hair); }
    else if (look === "mohawk") { R(5, -9, 1, 3, hair); R(6, -8, 1, 2, hair); R(7, -8, 1, 1, hair); R(4, -7, 4, 1, hair); }
    else if (look === "afro") { R(3, -9, 8, 4, hair); R(2, -8, 1, 3, hair); R(11, -8, 1, 3, hair); R(4, -5, 1, 2, hair); }
    else if (look === "braids") { R(4, -7, 6, 2, hair); R(3, -6, 1, 7, hair); R(3, -1, 1, 1, trim); R(10, -6, 1, 6, hair); R(10, 0, 1, 1, trim); }
    else { R(5, -7, 5, 1, hair); } // buzz
    // mask strap
    R(4, -3, 5, 1, "#16323f");
    // big round dive mask + cute eye
    R(7, -4, 5, 1, "#16323f");
    R(7, -3, 5, 4, maskGlass);
    R(8, -2, 2, 2, "#0b2a3a");                  // big eye
    R(9, -2, 1, 1, "#ffffff");                  // sparkle
    R(11, -3, 1, 1, mix(maskGlass, "#fff", 0.7));
    R(7, 1, 5, 1, "#16323f");
    // regulator + hose
    R(10, 2, 1, 1, "#2a2f36");
    R(7, 2, 1, 1, "#222831"); R(5, 1, 1, 1, "#222831");
    R(2, 0, 1, 1, "#222831"); R(0, -1, 1, 1, "#222831"); R(-2, -2, 1, 1, "#222831");

    // --- gear that visibly reflects your upgrades & items ---
    var up = (state && state.upgrades) || {};
    var items = (state && state.items) || {};
    R(-8 - finLen, -2 + legTop, finLen, 1, trim);     // fin trim (third colour)
    R(-8 - finLen, 5 + legBot, finLen, 1, trim);      // lower fin trim
    if (up.net > 0) { R(5, 3, 3, 1, "#9aa6b0"); R(8, 2, 1, 1, "#5cd0ff"); }            // wrist magnet
    if (up.scoop > 0) { R(-6, -6, 1, 5, "#caa15a"); R(-8, -8, 5, 3, mix(suit, "#fff", 0.5)); R(-8, -8, 5, 1, "#caa15a"); } // net on the back
    if (up.suit >= D.UPGRADES.suit.levels.length - 1) { R(-4, 0, 9, 1, "#ffd24a"); }  // maxed suit gold trim
    if (items.shinyPocket) { R(-1, 2, 2, 2, "#ffd24a"); R(0, 1, 1, 1, "#fff7c0"); }   // shiny pouch
    if (up.light > 0) { R(6, -8, 2, 2, "#2a2f36"); R(7, -8, 1, 1, "#fff3b0"); }       // headlamp
    if (up.knife > 0) { R(-3, 1, 1, 3, "#3a2f22"); R(-3, 3, 1, 2, "#d8dee6"); R(-3, 4, 1, 1, "#ffffff"); } // dive knife strapped to thigh
    if (items.goggles) {                                                              // wide-view goggles
      R(6, -4, 6, 1, "#0e2a36"); R(6, -3, 6, 4, mix(maskGlass, "#fff", 0.15));
      R(6, 1, 6, 1, "#0e2a36"); R(8, -2, 2, 2, "#0b2a3a"); R(9, -2, 1, 1, "#ffffff");
    }
  }

  function fishTargetH(f) { return f.isKraken ? 160 : 22 + f.size * 6; }

  function fishGlow(f) {
    if (f.isKraken) return { color: f.shiny ? "#fff2a0" : "#ff5b7f", alpha: 0.55 };
    if (f.legendary) return { color: f.shiny ? "#fff2a0" : "#ffd24a", alpha: 0.5 };
    if (f.shiny) return { color: "#fff0a0", alpha: 0.38 };
    var d = f.def;
    var biolum = d.glow || d.shape === "jelly" || d.shape === "angler" || d.shape === "lantern"
      || (d.area === "trench" && D.RARITY[d.rarity].order >= 2) || d.area === "sanctuary";
    if (biolum) return { color: d.color, alpha: 0.26 };
    return null;
  }

  // a hinged clam that opens (openAmt 0..1); shows a pearl inside when open
  function drawClam(x, y, th, color, accent, openAmt, hasPearl, shiny) {
    var w = th * 0.9, hh = th * 0.42, lip = mix(color, "#000000", 0.35), inner = mix(color, "#ffffff", 0.6);
    var gap = openAmt * hh * 0.9;
    // bottom shell
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x | 0, (y + 1) | 0, w / 2, hh / 2, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = inner;
    ctx.beginPath(); ctx.ellipse(x | 0, (y + 1) | 0, w / 2 - 2, hh / 2 - 2, 0, 0, Math.PI); ctx.fill();
    // the open gap reveals the inside (+ pearl)
    if (hasPearl && openAmt > 0.25) {
      var pr = Math.max(2, th * 0.13);
      ctx.fillStyle = "#fff0f6"; ctx.beginPath(); ctx.arc(x | 0, (y - gap * 0.4) | 0, pr, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect((x - pr * 0.3) | 0, (y - gap * 0.4 - pr * 0.3) | 0, 2, 2);
      if (Math.sin(run.time * 4) > 0.5) drawGlow(x, y - gap * 0.4, pr * 2.2, "#ffd6e6", 0.4);
    }
    // top shell, hinged open
    ctx.save();
    ctx.translate(x, y - 1);
    ctx.rotate(-openAmt * 0.5);
    ctx.fillStyle = lip;
    ctx.beginPath(); ctx.ellipse(0, -gap * 0.5, w / 2, hh / 2, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, -gap * 0.5 - 1, w / 2 - 2, hh / 2 - 1, 0, Math.PI, Math.PI * 2); ctx.fill();
    // ribs
    ctx.strokeStyle = accent || "#ffffff"; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
    for (var r = -2; r <= 2; r++) { ctx.beginPath(); ctx.moveTo(r * w * 0.12, -gap * 0.5); ctx.lineTo(r * w * 0.18, -gap * 0.5 - hh / 2 + 1); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (shiny && Math.sin(run.time * 3) > 0.6) { ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fillRect((x + w * 0.3) | 0, (y - hh * 0.3) | 0, 2, 2); }
  }

  // sea-floor creatures (crawling, caught with the net)
  function drawCreatures() {
    var noNet = netSize() <= 0;
    for (var i = 0; i < run.creatures.length; i++) {
      var c = run.creatures[i];
      var x = c.x - cam.x, y = c.y - cam.y;
      if (x < -120 || x > W + 120 || y < -120 || y > H + 120) continue;
      var th = 18 + c.size * 5;
      var arch = SPRITES.archetypeForShape(c.def.shape);
      var biolum = c.shiny || c.def.area === "sanctuary";
      if (biolum) drawGlow(x, y, th * 0.9, c.shiny ? "#fff0a0" : c.def.color, c.shiny ? 0.4 : 0.22);
      // clams: a hinged shell that opens & closes, with a pearl visible when open
      if (c.def.shape === "clam") { drawClam(x, y, th, c.def.color, c.def.accent, Math.max(0, Math.sin(c.phase)), c.hasPearl, c.shiny); continue; }
      // movement animation: crabs/lobsters/bugs scuttle (little hops); starfish
      // & urchins barely move (slow drift/rotate)
      var sh = c.def.shape, hop = 0, rot = 0;
      if (sh === "crab" || sh === "lobster" || sh === "bug") { hop = Math.abs(Math.sin(c.phase)) * 2.5; rot = Math.sin(c.phase) * 0.06; }
      else if (sh === "starfish") { rot = Math.sin(c.phase * 0.18) * 0.18; }
      else { rot = Math.sin(c.phase * 0.4) * 0.04; }
      ctx.save();
      ctx.translate(x, y - hop);
      ctx.rotate(rot);
      if (noNet) ctx.globalAlpha = 0.85;
      SPRITES.draw(ctx, arch, 0, 0, { color: c.def.color, shiny: c.shiny, flip: c.vx < 0, targetH: th });
      ctx.restore();
      if (c.shiny) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        if (Math.sin(run.time * 3 + c.phase) > 0.6) ctx.fillRect((x + th * 0.3) | 0, (y - th * 0.3) | 0, 2, 2);
      }
      var dist = Math.hypot(c.x - run.diver.x, c.y - run.diver.y);
      if ((D.RARITY[c.def.rarity].order >= 2 || c.shiny) && dist < 220) {
        ctx.fillStyle = c.shiny ? "#ffe66d" : D.RARITY[c.def.rarity].color;
        ctx.font = "11px 'Segoe UI', sans-serif"; ctx.textAlign = "center";
        ctx.fillText((c.shiny ? "✦" : "") + c.def.name, x, y - th * 0.6 - 6);
      }
    }
  }

  // net-scoop animation: creature gets caught in a net that swipes back to you
  function startNetFx(c, netR) {
    run.netFx.push({ x: c.x, y: c.y, dx: run.diver.x, dy: run.diver.y, life: 0.55, max: 0.55,
      size: 12 + netR * 0.16, def: c.def, shiny: c.shiny });
  }
  function drawNetFx() {
    for (var i = 0; i < run.netFx.length; i++) {
      var fx = run.netFx[i];
      var p = 1 - fx.life / fx.max;                 // 0 -> 1
      var px = fx.x + (fx.dx - fx.x) * p, py = fx.y + (fx.dy - fx.y) * p;
      var sx = px - cam.x, sy = py - cam.y, sz = fx.size * (1 - p * 0.35);
      var dvx = fx.dx - cam.x, dvy = fx.dy - cam.y;
      ctx.save();
      ctx.globalAlpha = fx.life > 0.12 ? 1 : Math.max(0, fx.life / 0.12);
      // handle from the diver to the net (the swipe)
      ctx.strokeStyle = "rgba(225,232,240,0.85)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(dvx, dvy); ctx.lineTo(sx, sy); ctx.stroke();
      // the trapped creature, jiggling
      var jig = Math.sin(run.time * 30 + i) * 1.5;
      SPRITES.draw(ctx, SPRITES.archetypeForShape(fx.def.shape), sx + jig, sy, { color: fx.def.color, shiny: fx.shiny, targetH: sz * 1.5 });
      // mesh
      ctx.strokeStyle = "rgba(240,248,255,0.55)"; ctx.lineWidth = 1;
      for (var m = -2; m <= 2; m++) {
        ctx.beginPath(); ctx.moveTo(sx + m * sz * 0.45, sy - sz); ctx.lineTo(sx + m * sz * 0.45, sy + sz); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx - sz, sy + m * sz * 0.45); ctx.lineTo(sx + sz, sy + m * sz * 0.45); ctx.stroke();
      }
      // golden rim
      ctx.strokeStyle = "#d9b24a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy, sz, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }

  // procedural flapping bird (pixel)
  function drawBirdPixel(ctx2, cx, cy, SC, color, phase, flip) {
    var d = mix(color, "#000000", 0.42), l = mix(color, "#ffffff", 0.4);
    function R(ax, ay, aw, ah, col) { ctx2.fillStyle = col; var X = flip ? (cx - (ax + aw) * SC) : (cx + ax * SC); ctx2.fillRect(Math.round(X), Math.round(cy + ay * SC), aw * SC, ah * SC); }
    var flap = Math.round(Math.sin(phase) * 3);
    R(-5, -1, 1, 2, d);                 // tail
    R(-4, -1, 7, 3, color);             // body
    R(-4, -1, 7, 1, l);                 // back highlight
    R(2, -3, 3, 3, color); R(2, -3, 3, 1, l); // head
    R(5, -2, 2, 1, "#e8a83a");          // beak
    R(3, -2, 1, 1, "#10121a");          // eye
    R(-2, 2 + Math.round(flap * 0.4), 4, 1, d); // far wing
    R(-2, -1 - flap, 5, 2, d);          // near wing (flaps)
    R(-2, -1 - flap, 5, 1, color);
  }
  // distinctive birds (owls, cranes, herons, storks) use their own sprite;
  // generic "bird"-shape ones keep the lively procedural flap
  function birdUsesSprite(def) { return def.shape && def.shape !== "bird"; }
  // draw a sprite bird with a wing-flap (vertical squash/stretch) so every
  // bird visibly beats its wings rather than gliding stiffly
  function drawFlapBird(arch, x, y, opts, phase) {
    var s = 1 + Math.sin(phase) * 0.2;
    ctx.save();
    ctx.translate(x, y - Math.abs(Math.sin(phase)) * 2); // tiny bob with the beat
    ctx.scale(1, s);
    SPRITES.draw(ctx, arch, 0, 0, opts);
    ctx.restore();
  }
  function drawBirds() {
    for (var i = 0; i < run.birds.length; i++) {
      var b = run.birds[i];
      var x = b.x - cam.x, y = b.y - cam.y;
      if (x < -90 || x > W + 90 || y < -90 || y > H + 90) continue;
      var th = 14 + b.def.size * 4;
      var SC = Math.max(2, Math.round(th / 7));
      var flip = run.diver.x < b.x;
      if (b.shiny) drawGlow(x, y, th * 1.1, "#fff0a0", 0.4);
      if (birdUsesSprite(b.def)) drawFlapBird(SPRITES.archetypeForShape(b.def.shape), x, y, { color: b.def.color, accent: b.def.accent, shiny: b.shiny, flip: flip, targetH: th + 8 }, b.phase * 5);
      else drawBirdPixel(ctx, x, y, SC, b.def.color, b.phase, flip);
      if (b.shiny && Math.sin(run.time * 3 + b.phase) > 0.6) { ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fillRect((x + th * 0.3) | 0, (y - th * 0.3) | 0, 2, 2); }
      ctx.fillStyle = b.shiny ? "#ffe66d" : D.RARITY[b.def.rarity].color;
      ctx.font = "11px 'Segoe UI', sans-serif"; ctx.textAlign = "center";
      ctx.fillText((b.shiny ? "✦" : "") + b.def.name, x, y - th - 4);
    }
  }

  function drawHarpoons() {
    for (var i = 0; i < run.harpoonFx.length; i++) {
      var hp = run.harpoonFx[i];
      var x = hp.x - cam.x, y = hp.y - cam.y;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(hp.ang);
      ctx.fillStyle = "#b98a4a"; ctx.fillRect(-14, -1, 22, 2);          // shaft
      ctx.fillStyle = "#e6edf2";
      ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(17, 0); ctx.lineTo(8, 4); ctx.closePath(); ctx.fill(); // tip
      ctx.fillStyle = "#8a6a3a"; ctx.fillRect(-14, -3, 2, 6);           // fletch
      ctx.restore();
    }
  }

  // how much each body type wiggles when swimming
  var WIGGLE = { eel: 0.55, whale: 0.4, kraken: 0.3, jelly: 0, squid: 0.5, octopus: 0.4, seahorse: 0.2, turtle: 0.5, ray: 0.7 };

  // Fish drawing — pixel sprites with a swim wiggle, glow & sparkle
  function drawFishEntity(f) {
    var x = f.x - cam.x, y = f.y - cam.y;
    var th = fishTargetH(f);
    if (x < -200 || x > W + 200 || y < -200 || y > H + 200) return;
    var flip = f.vx < 0; // sprites face right by default

    // Cloud Reaches birds swim in the magnet pool but should look like the
    // flapping birds you see in every other area's sky.
    if (f.def.bird) {
      var bglow = fishGlow(f);
      if (bglow) drawGlow(x, y, th * 0.95, bglow.color, bglow.alpha);
      if (birdUsesSprite(f.def)) drawFlapBird(SPRITES.archetypeForShape(f.def.shape), x, y, { color: f.def.color, accent: f.def.accent, shiny: f.shiny, flip: !flip, targetH: th + 8 }, f.phase * 5);
      else { var bSC = Math.max(2, Math.round((14 + f.def.size * 4) / 7)); drawBirdPixel(ctx, x, y, bSC, f.def.color, f.phase * 4, !flip); }
      return; // labels handled by drawFishLabels()
    }
    var arch = SPRITES.archetypeForShape(f.def.shape);

    // camouflage species (cuttlefish) melt into the background — render very faint,
    // with only a soft shimmer that flickers it into view for a moment
    if (f.def.camo && !f.pulled) {
      var camoA = 0.16 + 0.16 * (0.5 + 0.5 * Math.sin(run.time * 1.7 + f.x * 0.05));
      ctx.save();
      ctx.globalAlpha = camoA;
      SPRITES.draw(ctx, arch, x, y, { color: f.def.color, accent: f.def.accent, shiny: f.shiny, flip: flip, targetH: th });
      ctx.restore();
      return; // labels handled by drawFishLabels()
    }

    // rainbow species shimmer through the colour wheel
    if (f.def.rainbow) {
      var RB = ["#ff5b7f", "#ff9a4a", "#ffe14d", "#6dd36d", "#4aa3ff", "#b96bff"];
      var rci = Math.floor((run.time * 4 + f.x * 0.04) % RB.length);
      drawGlow(x, y, th * 1.1, RB[(rci + RB.length) % RB.length], 0.55);
    }

    var glow = fishGlow(f);
    if (glow) drawGlow(x, y, th * 0.95, glow.color, glow.alpha);

    // boss flashes red & shakes when harpooned
    if (f.isBoss && f.hitFlash > 0) {
      drawGlow(x, y, th, "#ff3030", Math.min(0.85, f.hitFlash * 2.2));
      x += (Math.random() - 0.5) * 7; y += (Math.random() - 0.5) * 7;
    }

    // swim animation: gentle body tilt + squash/stretch (jellies pulse instead)
    var wig = WIGGLE[f.def.shape] != null ? WIGGLE[f.def.shape] : 1;
    var phase = f.phase * 1.7;
    var tilt = Math.sin(phase) * 0.13 * wig;
    var sx = 1 + Math.sin(phase) * 0.05 * wig;          // stretch
    var sy = 1 - Math.sin(phase) * 0.05 * wig;
    if (f.def.shape === "jelly") { sy = 1 + Math.sin(phase) * 0.16; sx = 1 - Math.sin(phase) * 0.1; tilt = 0; }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(sx, sy);
    SPRITES.draw(ctx, arch, 0, 0, {
      color: f.def.color, accent: f.def.accent, shiny: f.shiny, flip: flip, targetH: th,
    });
    ctx.restore();

    if (f.shiny) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      for (var s = 0; s < 3; s++) {
        var a = run.time * 3 + s * 2.1 + f.phase;
        if (Math.sin(a) > 0.55) {
          ctx.fillRect((x + Math.cos(a * 1.7) * th * 0.42) | 0, (y + Math.sin(a * 1.3) * th * 0.32) | 0, 2, 2);
        }
      }
    }
  }

  // rare/shiny name labels, drawn crisp on top of the pixel scene
  function drawFishLabels() {
    ctx.textAlign = "center";
    ctx.font = "11px 'Segoe UI', sans-serif";
    var range = state.items.goggles ? 460 : 220; // Wide-View Goggles see further
    for (var i = 0; i < run.fish.length; i++) {
      var f = run.fish[i];
      var dist = Math.hypot(f.x - run.diver.x, f.y - run.diver.y);
      if (!((D.RARITY[f.def.rarity].order >= 2 || f.shiny) && dist < range)) continue;
      var x = f.x - cam.x, y = f.y - cam.y - fishTargetH(f) * 0.6 - 8;
      var label = (f.shiny ? "✦" : "") + f.def.name;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillText(label, x + 1, y + 1);
      ctx.fillStyle = f.shiny ? "#ffe66d" : D.RARITY[f.def.rarity].color;
      ctx.fillText(label, x, y);
    }
  }

  // ---------------------------------------------------------------------
  //  HUD
  // ---------------------------------------------------------------------
  var dispMoney = null; // animated money counter (rolls toward state.money)
  function updateHud() {
    var hud = document.getElementById("hud");
    if (!hud) return;
    var depthM = Math.floor(run.diver.y / PXPM);
    var oxPct = clamp(run.oxygen / run.maxO, 0, 1);
    document.getElementById("ox-fill").style.width = (oxPct * 100) + "%";
    document.getElementById("ox-fill").style.background = oxPct < 0.25 ? "#e74c3c" : (oxPct < 0.5 ? "#f39c12" : "#3fd0ff");
    document.getElementById("ox-text").textContent = Math.ceil(run.oxygen) + "s";
    document.getElementById("depth-text").textContent = depthM + "m";
    // money rolls smoothly toward the real total instead of snapping
    if (dispMoney == null) dispMoney = state.money;
    var diff = state.money - dispMoney;
    if (Math.abs(diff) < 1) dispMoney = state.money;
    else dispMoney += diff * 0.18;
    document.getElementById("money-text").textContent = "$" + fmt(Math.round(dispMoney));
    document.getElementById("cargo-text").textContent = run.bagUsed + " / " + inventoryCap();
    document.getElementById("area-name").textContent = D.LOCATIONS[run.area].name;
    var atTop = run.diver.y <= 30;
    document.getElementById("surface-hint").style.display = atTop ? "block" : "none";
    document.getElementById("btn-seed").style.display = atTop ? "block" : "none";
    // vent button: only useful once submerged (dump air for low-oxygen secrets)
    var vb = document.getElementById("btn-vent");
    if (vb) {
      vb.style.display = atTop ? "none" : "block";
      if (atTop && run.venting) { run.venting = false; vb.classList.remove("venting"); }
    }
    // deploy-net button: shown when you own a Deploy Net and are submerged
    var tb = document.getElementById("btn-trap");
    if (tb) {
      tb.style.display = (!atTop && trapSize() > 0) ? "block" : "none";
      tb.textContent = (run.trap && run.trap.active) ? "🪤 Move Net" : "🪤 Deploy Net";
    }
    // slingshot button: shown when you own a slingshot and have shots left
    var slb = document.getElementById("btn-sling");
    if (slb) {
      slb.style.display = (slingShotsMax() > 0 && run.slingShots > 0) ? "block" : "none";
      slb.textContent = "🪃 Sling (" + run.slingShots + ")";
    }
    var stb = document.getElementById("btn-storm");
    if (stb) {
      stb.style.display = state.items.stormsummoner ? "block" : "none";
      stb.textContent = run.stormCd > 0 ? "⚡ (" + Math.ceil(run.stormCd) + ")" : "⚡ Storm";
    }
    var esb = document.getElementById("btn-enter-secret");
    if (esb) {
      var edge = run.secretEdge && D.LOCATIONS[run.secretEdge];
      esb.style.display = edge ? "block" : "none";
      if (edge) esb.textContent = "🌀 Enter " + D.LOCATIONS[run.secretEdge].name;
    }
    var hb = document.getElementById("btn-harpoon");
    hb.style.display = (run.bossPresent && state.harpoons > 0) ? "block" : "none";
    if (run.bossPresent && state.harpoons > 0) hb.textContent = "🔱 Harpoon (" + state.harpoons + ")";
    // Kaiju Breath button (own the breath + submerged)
    var brb = document.getElementById("btn-breath");
    if (brb) {
      brb.style.display = (!atTop && state.items.kaijubreath) ? "block" : "none";
      brb.textContent = run.breathCd > 0 ? "🔵 (" + Math.ceil(run.breathCd) + ")" : "🔵 Breath";
    }
  }

  // ---------------------------------------------------------------------
  //  Toasts
  // ---------------------------------------------------------------------
  var _lastToastT = 0;
  function toast(msg, kind, dur) {
    var host = document.getElementById("toasts");
    if (!host) return;
    // de-clutter: throttle low-priority chatter (plain/"good" notices) so only
    // important alerts (epic/bad/shiny/secret) come through rapidly
    var now = Date.now();
    var lowPri = !kind || kind === "good";
    if (lowPri && now - _lastToastT < 1500) return;
    _lastToastT = now;
    // never let toasts blanket the screen: drop the oldest if too many stack up
    while (host.children && host.children.length >= 3) host.removeChild(host.firstChild);
    // skip exact duplicate of the most recent toast still showing
    if (host.lastChild && host.lastChild.textContent === msg) return;
    var el = document.createElement("div");
    el.className = "toast " + (kind || "");
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () { el.classList.add("show"); }, 10);
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
    }, dur || 2000);
  }

  // ---------------------------------------------------------------------
  //  Overlays / UI screens
  // ---------------------------------------------------------------------
  function overlay(id) { return document.getElementById(id); }
  function openOverlay(id) { overlay(id).classList.add("open"); }
  function closeOverlay(id) { overlay(id).classList.remove("open"); }
  function closeTopOverlay() {
    var open = document.querySelectorAll(".overlay.open");
    if (open.length) open[open.length - 1].classList.remove("open");
  }

  // ----- Start screen (save slots) -----
  function showStart() {
    scene = "start";
    if (window.AUDIO) AUDIO.playMenu(state && state.nextNight); // carries menu ambience once audio is awake
    var saves = listSaves();
    var html = '<div class="panel start-panel">';
    html += '<h1>🌊 Deep Sea Diver 🐙</h1>';
    html += '<p class="sub">Dive deep. Catch everything. Awaken the Kraken.</p>';
    html += '<div class="update-banner">🛠️ NEW: the <b>Tools Update</b>! Grab a <b>Sledgehammer</b> to crack open cages, a <b>Shovel</b> to pry pearl-filled clams, and a <b>Deploy Net</b> that traps fish even when your hold is full — all in the Shop\'s Tools tab.</div>';
    html += '<div class="slot-list">';
    saves.forEach(function (s) {
      if (s.data) {
        var d = s.data;
        var caught = Object.keys(d.discovered || {}).length;
        var total = D.COMPLETION_FISH.length;
        html += '<div class="slot filled">'
          + '<div class="slot-main"><b>' + (d.username || "Diver") + ' <span class="slot-num">· Slot ' + s.slot + '</span></b>'
          + '<span>$' + fmt(d.money) + ' · ' + caught + '/' + total + ' fish · ' + (d.stats ? d.stats.maxDepth : 0) + 'm deep</span></div>'
          + '<div class="slot-btns">'
          + '<button data-load="' + s.slot + '">Continue</button>'
          + '<button class="danger" data-del="' + s.slot + '">Delete</button>'
          + '</div></div>';
      } else {
        html += '<div class="slot empty">'
          + '<div class="slot-main"><b>Slot ' + s.slot + '</b><span>Empty</span></div>'
          + '<div class="slot-btns"><button data-new="' + s.slot + '">New Game</button></div></div>';
      }
    });
    html += '</div><p class="tiny">📱 Drag anywhere to steer your diver · swim near fish to auto-reel them in · float back to the top and tap <b>Board the Boat</b> to sell &amp; shop. (On desktop: WASD / Arrows.)</p>';
    html += '</div>';
    var ov = overlay("modal");
    ov.innerHTML = html;
    ov.classList.add("open");
    ov.querySelectorAll("[data-new]").forEach(function (b) {
      b.onclick = function () {
        var slot = +b.getAttribute("data-new");
        askText("Name your captain", "Diver", function (name) {
          if (name == null) return;
          activeSlot = slot; state = defaultState(); state.username = name || "Diver";
          saveGame(); enterBoat();
        });
      };
    });
    ov.querySelectorAll("[data-load]").forEach(function (b) {
      b.onclick = function () {
        activeSlot = +b.getAttribute("data-load");
        state = migrate(JSON.parse(localStorage.getItem(SAVE_PREFIX + activeSlot)));
        enterBoat();
      };
    });
    ov.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () {
        if (confirm("Delete Slot " + b.getAttribute("data-del") + "? This cannot be undone.")) {
          deleteSave(+b.getAttribute("data-del")); showStart();
        }
      };
    });
  }

  function migrate(s) {
    var base = defaultState();
    for (var k in base) if (!(k in s)) s[k] = base[k];
    for (var u in base.upgrades) if (s.upgrades[u] == null) s.upgrades[u] = 0;
    for (var a in base.areas) if (s.areas[a] == null) s.areas[a] = base.areas[a];
    // carry over the old one-time hammer/shovel items into the new upgrade tracks
    if (s.items) {
      if (s.items.sledgehammer && !s.upgrades.hammer) s.upgrades.hammer = 1;
      if (s.items.shovel && !s.upgrades.shovel) s.upgrades.shovel = 1;
    }
    if (!s.stats) s.stats = base.stats;
    if (!s.locHints) s.locHints = {};
    // anyone who'd bought the old all-in-one guide keeps every location hint
    if (s.secretGuide) { SECRET_SITE_GUIDE.forEach(function (g) { s.locHints[g.area] = true; }); }
    return s;
  }

  function enterBoat() {
    closeOverlay("modal");
    scene = "boat";
    if (window.AUDIO) { AUDIO.setMuted(state.settings.muted); AUDIO.setMusicMuted(state.settings.musicMuted); AUDIO.setSfxMuted(state.settings.sfxMuted); AUDIO.playMenu(state && state.nextNight); }
    showBoat();
  }

  // ----- Boat / hub -----
  function showBoat() {
    sellHud(false);
    var ov = overlay("modal");
    var bagCount = run ? run.bag.length : 0;
    var saleVal = run ? totalBagValue() : 0;
    var html = '<div class="panel boat-panel">';
    html += '<h2>⛵ The Boat</h2>';
    html += '<div class="captain-line">Captain <b>' + (state.username || "Diver") + '</b> <button id="btn-rename" class="mini-btn">✏️</button></div>';
    html += '<div class="money-line">💰 $' + fmt(state.money) + '</div>';

    // day/night indicator for your NEXT dive (clickable if you own the Stopwatch)
    var night = !!state.nextNight, hasWatch = !!state.items.stopwatch;
    html += '<div id="daynight" class="daynight ' + (night ? 'night' : 'day') + (hasWatch ? ' tappable' : '') + '">'
      + (night ? '🌙' : '☀️') + ' Next dive: <b>' + (night ? 'Night' : 'Day') + '</b>'
      + (hasWatch ? ' <span class="tiny">(tap to switch)</span>' : '') + '</div>';

    if (run && (run.bag.length || run.bagTreasure.length)) {
      html += '<div class="sell-box"><b>Today\'s haul:</b> ' + run.bag.length + ' fish, '
        + run.bagTreasure.length + ' treasures — worth <b>$' + fmt(saleVal) + '</b>'
        + '<button id="btn-sell" class="primary">Sell All ($' + fmt(saleVal) + ')</button></div>';
    }

    html += '<div class="boat-grid">';
    html += '<button id="btn-dive" class="big primary">🤿 Dive</button>';
    html += '<button id="btn-shop" class="big">🛒 Shop</button>';
    html += '<button id="btn-collection" class="big">🐠 Aquarium</button>';
    html += '<button id="btn-diver" class="big">🤿 Customise Diver</button>';
    html += '<button id="btn-area" class="big">🗺️ Change Area</button>';
    html += '<button id="btn-stats" class="big">📊 Stats</button>';
    html += '<button id="btn-seedshop" class="big">🌾 Seed Shop</button>';
    html += '<button id="btn-items" class="big">🎒 Items</button>';
    html += '<button id="btn-bossgear" class="big">⚔️ Boss Gear</button>';
    html += '<button id="btn-treasures" class="big">🏺 Treasures</button>';
    html += '<button id="btn-achievements" class="big">🏆 Achievements</button>';
    html += '<button id="btn-trade" class="big">🎁 Gift Fish</button>';
    html += '<button id="btn-music" class="big">' + (state.settings.musicMuted ? '🎵 Music: Off' : '🎵 Music: On') + '</button>';
    html += '<button id="btn-sfx" class="big">' + (state.settings.sfxMuted ? '🔈 SFX: Off' : '🔊 SFX: On') + '</button>';
    html += '<button id="btn-menu" class="big">💾 Save &amp; Menu</button>';
    html += '</div>';

    html += '<div class="area-current">Current dive site: <b>' + D.LOCATIONS[state.lastArea].name + '</b></div>';

    if (!state.krakenCaught) {
      if (trueComplete()) {
        html += '<div class="kraken-alert">🦑 100% complete!! The <b>TRUE Kraken</b> now stirs in the deepest <b>Sunken Trench</b>. Go and face it with harpoons.</div>';
      } else if (requiredMet() && !state.blobfishCaught) {
        html += '<div class="kraken-alert">🦑 You\'ve caught every <b>required</b> fish... surely the Kraken awaits in the deep <b>Sunken Trench</b>? Dive and find out.</div>';
      } else if (state.blobfishCaught) {
        html += '<div class="kraken-alert">🫠 The real Kraken needs <b>100% of everything</b> caught. You\'re at ' + Object.keys(state.discovered).length + '... keep going!</div>';
      }
    } else if (state.blobfishCaught && !state.areas.sanctuary) {
      html += '<div class="kraken-alert">✦ Every boss is beaten! The <b>Starlight Sanctuary</b> can now be unlocked ($90k) — <b>every</b> creature gathers there, with sky-high shiny odds. 🗺️</div>';
    }
    html += '</div>';
    ov.innerHTML = html;
    ov.classList.add("open");

    bind("btn-dive", function () { startDive(state.lastArea); });
    bind("btn-shop", showShop);
    bind("btn-collection", showAquarium);
    bind("btn-diver", function () { diverPreviewSuit = null; showDiverShop(); });
    bind("btn-area", showAreas);
    bind("btn-stats", showStats);
    bind("btn-seedshop", showSeedShop);
    bind("btn-items", showInventory);
    bind("btn-bossgear", showBossGear);
    bind("btn-treasures", showTreasureGallery);
    bind("btn-achievements", showAchievements);
    bind("btn-trade", function () { lastGiftCode = null; showTrade(); });
    bind("btn-rename", function () {
      askText("Name your captain", state.username || "Diver", function (name) {
        if (name == null) return;
        state.username = name; saveGame(); showBoat();
      });
    });
    bind("btn-music", function () {
      state.settings.musicMuted = !state.settings.musicMuted;
      if (window.AUDIO) AUDIO.setMusicMuted(state.settings.musicMuted);
      saveGame(); showBoat();
    });
    bind("btn-sfx", function () {
      state.settings.sfxMuted = !state.settings.sfxMuted;
      if (window.AUDIO) AUDIO.setSfxMuted(state.settings.sfxMuted);
      saveGame(); showBoat();
    });
    bind("btn-menu", function () { saveGame(); toast("Game saved.", "good", 1200); showStart(); });
    if (state.items.stopwatch) bind("daynight", function () {
      state.nextNight = !state.nextNight; saveGame();
      toast(state.nextNight ? "Stopwatch set to 🌙 Night" : "Stopwatch set to ☀️ Day", "good", 1200);
      if (window.AUDIO) AUDIO.playMenu(state.nextNight); // swap to/from night ambience
      showBoat();
    });
    bind("btn-sell", sellAll);
  }

  function totalBagValue() {
    var v = 0;
    run.bag.forEach(function (b) { v += b.value; });
    run.bagTreasure.forEach(function (b) { v += b.value; });
    return v;
  }

  function sellAll() {
    var v = totalBagValue();
    state.money += v;
    state.stats.earned += v;
    run.bag = []; run.bagTreasure = []; run.bagUsed = 0;
    saveGame();
    toast("Sold haul for $" + fmt(v) + "!", "good", 1800);
    showBoat();
  }

  function startDive(areaId) {
    if (!state.areas[areaId]) { toast("That area is locked.", "bad"); return; }
    var L = D.LOCATIONS[areaId];
    if (L.requireItem && !state.items[L.requireItem]) { toast("You need the " + (L.requireItem === "heatsuit" ? "Heat Suit" : L.requireItem) + " to survive here!", "bad"); return; }
    closeOverlay("modal");
    sellHud(true);
    scene = "dive";
    newRun(areaId);
    state.lastArea = areaId;
    if (!state.visited) state.visited = {};
    state.visited[areaId] = true; // unlocks this area's wetsuit
    if (window.AUDIO) AUDIO.playArea(areaId, run && run.night);
  }

  // dive straight from the current run into a (now-known) secret area,
  // keeping the haul you've already collected this dive.
  function enterSecretArea(areaId) {
    if (!D.LOCATIONS[areaId]) return;
    startDive(areaId); // newRun carries your bag over
    if (window.AUDIO) AUDIO.rumble();
  }

  // return to an in-progress dive after a boss-defeat overlay (so you can
  // keep exploring the run instead of being yanked back to the boat).
  function resumeDive() {
    closeOverlay("modal");
    if (!run) { goToBoat(); return; }
    for (var i = run.fish.length - 1; i >= 0; i--) {
      if (run.fish[i].isBoss && run.fish[i].hp <= 0) run.fish.splice(i, 1);
    }
    scene = "dive";
    sellHud(true);
    if (window.AUDIO) AUDIO.playArea(run.area, run.night);
  }

  function sellHud(show) {
    document.getElementById("hud").style.display = show ? "flex" : "none";
    document.getElementById("surface-hint").style.display = "none";
    document.getElementById("btn-seed").style.display = "none";
    document.getElementById("btn-harpoon").style.display = "none";
    var vb = document.getElementById("btn-vent");
    if (vb) { vb.style.display = "none"; vb.classList.remove("venting"); }
    var tb = document.getElementById("btn-trap");
    if (tb) tb.style.display = "none";
    var slb = document.getElementById("btn-sling");
    if (slb) slb.style.display = "none";
    var stb = document.getElementById("btn-storm");
    if (stb) stb.style.display = "none";
    var esb = document.getElementById("btn-enter-secret");
    if (esb) esb.style.display = "none";
    var brb = document.getElementById("btn-breath");
    if (brb) brb.style.display = "none";
    if (run) run.venting = false;
    document.getElementById("btn-return").style.display = show ? "block" : "none";
  }

  // ----- Shop -----
  var shopTab = "gear"; // remembered across re-renders (e.g. after a purchase)
  function showShop() {
    var ov = overlay("shop");
    // remember the scroll position so a purchase doesn't yank you to the top
    var prevScroll = 0, oldPanel = ov.querySelector(".panel");
    if (ov.classList.contains("open") && oldPanel) prevScroll = oldPanel.scrollTop;
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>🛒 Helpful Shop</h2>'
      + '<div class="money-line">💰 $' + fmt(state.money) + '</div>'
      + '<button class="close" data-close="shop">✕</button></div>';

    function tabBtn(id, label) {
      return '<button class="tab' + (shopTab === id ? ' active' : '') + '" data-tab="' + id + '">' + label + '</button>';
    }
    function bodyClass(id) { return shopTab === id ? '' : ' hidden'; }

    html += '<div class="shop-tabs">'
      + tabBtn("gear", "Gear")
      + tabBtn("tools", "Tools")
      + tabBtn("charms", "Charms")
      + tabBtn("hints", "Hints")
      + '</div>';

    // GEAR (everything except the net, which lives under Tools)
    html += '<div class="tab-body' + bodyClass("gear") + '" data-body="gear">';
    for (var key in D.UPGRADES) {
      if (key === "scoop" || key === "trap" || key === "hammer" || key === "shovel" || key === "sling" || key === "knife") continue; // these live in the Tools tab
      html += upgradeRow(key);
    }
    var hasHeat = !!state.items.heatsuit;
    html += '<div class="shop-item"><div class="si-info"><b>🟥 Heat Suit</b>' + (hasHeat ? ' <span class="lvl">✓ Owned</span>' : '')
      + '<p>A reflective lava-proof suit — recommended for hot dive sites (the <b>Magma Vents</b> &amp; <b>Drowned Cove</b>). Without it the heat burns your oxygen ~2x faster.</p></div>'
      + '<div class="si-buy">' + (hasHeat ? '<span class="maxed">✓</span>'
        : '<button data-buytool="heatsuit:60000" ' + (state.money < 60000 ? 'disabled' : '') + '>$60,000</button>') + '</div></div>';
    var hasCold = !!state.items.coldsuit;
    html += '<div class="shop-item"><div class="si-info"><b>🟦 Cold Suit</b>' + (hasCold ? ' <span class="lvl">✓ Owned</span>' : '')
      + '<p>Insulated drysuit — recommended for cold dive sites (the <b>Arctic Shelf</b> &amp; <b>Boneyard</b>). Without it the cold burns your oxygen twice as fast.</p></div>'
      + '<div class="si-buy">' + (hasCold ? '<span class="maxed">✓</span>'
        : '<button data-buytool="coldsuit:18000" ' + (state.money < 18000 ? 'disabled' : '') + '>$18,000</button>') + '</div></div>';
    html += '</div>';

    // TOOLS — Fishing Net + Deploy Net + Harpoons + special tools
    html += '<div class="tab-body' + bodyClass("tools") + '" data-body="tools">';
    html += upgradeRow("scoop");
    html += upgradeRow("trap");
    html += upgradeRow("hammer");
    html += upgradeRow("shovel");
    html += upgradeRow("sling");
    html += upgradeRow("knife");
    html += '<div class="shop-item"><div class="si-info"><b>Harpoons</b> <span class="lvl">×' + state.harpoons + '</span>'
      + '<p>Ammo for boss fights. Aim with the joystick and tap 🔱 to throw — 3 hits beats the Kraken or blobfish.</p></div>'
      + '<div class="si-buy">'
      + '<button data-buyharpoon="1" ' + (state.money < 520 ? 'disabled' : '') + '>1 — $520</button>'
      + '<button data-buyharpoon="6" ' + (state.money < 3120 ? 'disabled' : '') + '>6 — $3,120</button>'
      + '</div></div>';
    var hasTorch = !!state.items.torch;
    html += '<div class="shop-item"><div class="si-info"><b>🔦 Torch</b>' + (hasTorch ? ' <span class="lvl">✓ Owned</span>' : '')
      + '<p>Casts a bright <b>beam of light</b> in the direction you face — pierces the gloom of the deep and dark caves.</p></div>'
      + '<div class="si-buy">' + (hasTorch ? '<span class="maxed">✓</span>'
        : '<button data-buytool="torch:9000" ' + (state.money < 9000 ? 'disabled' : '') + '>$9,000</button>') + '</div></div>';
    var hasBell = !!state.items.divingbell;
    html += '<div class="shop-item"><div class="si-info"><b>🛎️ Diving Bell</b>' + (hasBell ? ' <span class="lvl">✓ Owned</span>' : '')
      + '<p>An emergency air reserve — <b>once per dive</b>, if you run out of oxygen it refills you instead of sending you home.</p></div>'
      + '<div class="si-buy">' + (hasBell ? '<span class="maxed">✓</span>'
        : '<button data-buytool="divingbell:14000" ' + (state.money < 14000 ? 'disabled' : '') + '>$14,000</button>') + '</div></div>';
    var hasStorm = !!state.items.stormsummoner;
    html += '<div class="shop-item"><div class="si-info"><b>⚡ Storm Summoner</b>' + (hasStorm ? ' <span class="lvl">✓ Owned</span>' : '')
      + '<p>A relic that calls down lightning — tap ⚡ near the surface to <b>strike fish</b> dead and bag them. Raise it at the very tip of the tallest peak to find something divine...</p></div>'
      + '<div class="si-buy">' + (hasStorm ? '<span class="maxed">✓</span>'
        : '<button data-buytool="stormsummoner:150000" ' + (state.money < 150000 ? 'disabled' : '') + '>$150,000</button>') + '</div></div>';
    var hasWatch = !!state.items.stopwatch;
    html += '<div class="shop-item"><div class="si-info"><b>Tide Stopwatch</b>' + (hasWatch ? ' <span class="lvl">✓ Owned</span>' : '')
      + '<p>Choose whether each dive is <b>day or night</b> — tap the ☀️/🌙 on the boat to set it. Without it, day &amp; night just take turns.</p></div>'
      + '<div class="si-buy">' + (hasWatch ? '<span class="maxed">✓</span>'
        : '<button data-buystopwatch="1" ' + (state.money < 5000 ? 'disabled' : '') + '>$5,000</button>') + '</div></div>';
    html += '</div>';

    // CHARMS
    html += '<div class="tab-body' + bodyClass("charms") + '" data-body="charms">';
    for (var ck in D.CHARMS) {
      var c = D.CHARMS[ck];
      var owned = state.charms[ck];
      var atMax = owned >= c.maxStack;
      var nextCost = charmCost(ck);
      var effect = ck === "rarity"
        ? "+" + Math.round(owned * c.perStack * 100) + "% rarity tilt"
        : "+" + (owned * c.perStack * 100).toFixed(1) + "% shiny chance";
      html += '<div class="shop-item">'
        + '<div class="si-info"><b>' + c.name + '</b> <span class="lvl">×' + owned + (atMax ? ' · MAX' : '') + '</span>'
        + '<p>' + c.desc + '</p>'
        + '<small>Current effect: ' + effect + '</small></div>'
        + '<div class="si-buy">'
        + (atMax ? '<span class="maxed">MAX</span>'
          : '<button data-buycharm="' + ck + '" ' + (state.money < nextCost ? 'disabled' : '') + '>$' + fmt(nextCost) + '</button>')
        + '</div></div>';
    }
    // one-time items live in the charms tab
    for (var ik in D.ITEMS) {
      var it = D.ITEMS[ik];
      var have = !!state.items[ik];
      html += '<div class="shop-item">'
        + '<div class="si-info"><b>' + it.name + '</b>' + (have ? ' <span class="lvl">✓ Owned</span>' : '')
        + '<p>' + it.desc + '</p></div>'
        + '<div class="si-buy">'
        + (have ? '<span class="maxed">✓</span>'
          : '<button data-buyitem="' + ik + '" ' + (state.money < it.cost ? 'disabled' : '') + '>$' + fmt(it.cost) + '</button>')
        + '</div></div>';
    }
    html += '<p class="tiny">Base shiny chance is just ' + (D.BASE_SHINY_CHANCE * 100).toFixed(2)
      + '% — shinies are genuinely rare. Charms nudge it up a little. A shiny Kraken unlocks a secret ending...</p>';
    html += '</div>';

    // HINTS
    html += '<div class="tab-body' + bodyClass("hints") + '" data-body="hints">';
    // Hidden-location hints — each secret dive site has its OWN hint to buy.
    // (You can still stumble into any of them unaided.)
    html += '<h3 style="margin:4px 0 6px">🗺️ Hidden Sites</h3>';
    var anySite = false;
    SECRET_SITE_GUIDE.forEach(function (g) {
      var found = !!state.areas[g.area];      // already discovered it
      var bought = !!state.locHints[g.area];
      if (found && !bought) return;           // found on your own — no need for a hint
      // no early spoilers: only rumour a site once its source area is unlocked
      if (!bought && g.requires && !state.areas[g.requires]) return;
      anySite = true;
      if (found || bought) {
        var nm = D.LOCATIONS[g.area] ? D.LOCATIONS[g.area].name : "A hidden site";
        html += '<div class="shop-item"><div class="si-info"><b>🗺️ ' + nm + '</b> '
          + (found ? '<span class="lvl">✓ Discovered</span>' : '<span class="lvl">Hint owned</span>')
          + '<p>' + g.how + '</p></div></div>';
      } else {
        // unbought: a vague teaser only — never names the hidden site (no spoiler)
        html += '<div class="shop-item"><div class="si-info"><b>🗺️ Rumoured hidden site</b>'
          + '<p>' + g.teaser + '</p></div>'
          + '<div class="si-buy"><button data-buyloc="' + g.area + '" ' + (state.money < g.price ? 'disabled' : '') + '>$' + fmt(g.price) + '</button></div></div>';
      }
    });
    if (!anySite) html += '<p class="tiny">No rumours of hidden sites right now — keep exploring!</p>';
    html += '<p class="tiny" style="margin-top:10px">Every area also hides a <b>secret fish</b>. Buy its hint here, then meet the condition while diving.</p>';
    D.FISH.filter(function (f) {
      if ((!f.secret && !(f.secretBoss && f.hint)) || !D.LOCATIONS[f.area]) return false;
      if (D.LOCATIONS[f.area].secret && !state.areas[f.area]) return false; // don't spoil undiscovered secret areas
      return true;
    }).forEach(function (f) {
      var owned = state.hints[f.id];
      var found = state.discovered[f.id];
      var cost = hintCost(f);
      html += '<div class="shop-item">'
        + '<div class="si-info"><b>' + (owned ? f.name : "??? (" + D.LOCATIONS[f.area].name + ")") + '</b> '
        + (found ? '<span class="lvl">✓ Caught</span>' : (owned ? '<span class="lvl">Hint owned</span>' : ''))
        + '<p>' + (owned ? f.hint : "A mysterious creature said to dwell in " + D.LOCATIONS[f.area].name + ".") + '</p></div>'
        + '<div class="si-buy">'
        + (owned ? '<span class="maxed">' + (found ? '✓' : 'Owned') + '</span>'
          : '<button data-buyhint="' + f.id + '" ' + (state.money < cost ? 'disabled' : '') + '>$' + fmt(cost) + '</button>')
        + '</div></div>';
    });
    html += '</div>';

    html += '</div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    if (prevScroll) { var np = ov.querySelector(".panel"); if (np) np.scrollTop = prevScroll; }

    // tab switching
    ov.querySelectorAll(".tab").forEach(function (t) {
      t.onclick = function () {
        shopTab = t.getAttribute("data-tab");
        ov.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
        ov.querySelectorAll(".tab-body").forEach(function (x) { x.classList.add("hidden"); });
        t.classList.add("active");
        ov.querySelector('[data-body="' + shopTab + '"]').classList.remove("hidden");
      };
    });
    ov.querySelector('[data-close="shop"]').onclick = function () { closeOverlay("shop"); };
    ov.querySelectorAll("[data-buyup]").forEach(function (b) {
      b.onclick = function () { buyUpgrade(b.getAttribute("data-buyup")); };
    });
    ov.querySelectorAll("[data-buycharm]").forEach(function (b) {
      b.onclick = function () { buyCharm(b.getAttribute("data-buycharm")); };
    });
    ov.querySelectorAll("[data-buyitem]").forEach(function (b) {
      b.onclick = function () {
        var ik = b.getAttribute("data-buyitem"), it = D.ITEMS[ik];
        if (state.items[ik] || state.money < it.cost) return;
        state.money -= it.cost; state.items[ik] = true; saveGame();
        toast(it.name + " acquired!", "good", 1600); showShop();
      };
    });
    ov.querySelectorAll("[data-buyharpoon]").forEach(function (b) {
      b.onclick = function () {
        var qty = parseInt(b.getAttribute("data-buyharpoon"), 10) || 1, cost = qty * 520;
        if (state.money < cost) return;
        state.money -= cost; state.harpoons += qty; saveGame();
        toast("Bought " + qty + " harpoon" + (qty > 1 ? "s" : "") + "! (×" + state.harpoons + ")", "good", 1500); showShop();
      };
    });
    ov.querySelectorAll("[data-buytool]").forEach(function (b) {
      b.onclick = function () {
        var p = b.getAttribute("data-buytool").split(":"), id = p[0], cost = +p[1];
        if (state.items[id] || state.money < cost) return;
        state.money -= cost; state.items[id] = true; saveGame();
        var NM = { torch: "🔦 Torch", divingbell: "🛎️ Diving Bell", heatsuit: "🟥 Heat Suit", coldsuit: "🟦 Cold Suit", stormsummoner: "⚡ Storm Summoner" };
        toast((NM[id] || "Tool") + " acquired!", "good", 1800); showShop();
      };
    });
    ov.querySelectorAll("[data-buystopwatch]").forEach(function (b) {
      b.onclick = function () {
        if (state.items.stopwatch || state.money < 5000) return;
        state.money -= 5000; state.items.stopwatch = true; saveGame();
        toast("Tide Stopwatch acquired! Tap ☀️/🌙 on the boat to set day or night.", "good", 2200); showShop();
      };
    });
    ov.querySelectorAll("[data-buyhint]").forEach(function (b) {
      b.onclick = function () { buyHint(b.getAttribute("data-buyhint")); };
    });
    ov.querySelectorAll("[data-buyloc]").forEach(function (b) {
      b.onclick = function () {
        var area = b.getAttribute("data-buyloc");
        var g = SECRET_SITE_GUIDE.filter(function (x) { return x.area === area; })[0];
        if (!g || state.locHints[area] || state.areas[area] || state.money < g.price) return;
        state.money -= g.price; state.locHints[area] = true; saveGame();
        toast("🗺️ Hint acquired — check the Hidden Sites list!", "epic", 2600);
        showShop();
      };
    });
  }

  function upgradeRow(key) {
    var u = D.UPGRADES[key];
    var lvl = state.upgrades[key];
    var maxed = lvl >= u.levels.length - 1;
    var cur = u.levels[lvl].value;
    var next = maxed ? null : u.levels[lvl + 1];
    return '<div class="shop-item">'
      + '<div class="si-info"><b>' + u.name + '</b> <span class="lvl">Lv ' + lvl + (maxed ? ' · MAX' : '') + '</span>'
      + '<p>' + u.desc + '</p>'
      + '<small>Now: ' + fmtVal(cur, u.unit) + (next ? ' → ' + fmtVal(next.value, u.unit) : '') + '</small></div>'
      + '<div class="si-buy">'
      + (maxed ? '<span class="maxed">MAX</span>'
        : '<button data-buyup="' + key + '" ' + (state.money < next.cost ? 'disabled' : '') + '>$' + fmt(next.cost) + '</button>')
      + '</div></div>';
  }

  function buyUpgrade(key) {
    var u = D.UPGRADES[key];
    var lvl = state.upgrades[key];
    if (lvl >= u.levels.length - 1) return;
    var cost = u.levels[lvl + 1].cost;
    if (state.money < cost) return;
    state.money -= cost;
    state.upgrades[key]++;
    saveGame();
    toast(u.name + " upgraded to Lv " + state.upgrades[key] + "!", "good", 1400);
    showShop();
  }

  // charms get pricier with every one you own (×1.55 each), so they can't be
  // mass-bought to trivialise rarity/shiny odds.
  function charmCost(key) {
    var c = D.CHARMS[key];
    return Math.round(c.cost * Math.pow(1.55, state.charms[key] || 0) / 10) * 10;
  }
  function buyCharm(key) {
    var c = D.CHARMS[key];
    if (state.charms[key] >= c.maxStack) return;
    var cost = charmCost(key);
    if (state.money < cost) return;
    state.money -= cost;
    state.charms[key]++;
    saveGame();
    toast(c.name + " acquired (×" + state.charms[key] + ")!", "good", 1400);
    showShop();
  }

  // secret-fish hints now cost real money, scaled to the price of their area
  function hintCost(f) {
    var loc = D.LOCATIONS[f.area];
    var base = loc ? loc.cost : 4000;
    return Math.max(3000, Math.min(60000, Math.round(base * 0.08 / 100) * 100));
  }
  function buyHint(id) {
    var f = D.FISH_BY_ID[id];
    var cost = hintCost(f);
    if (state.money < cost || state.hints[id]) return;
    state.money -= cost;
    state.hints[id] = true;
    saveGame();
    toast("Hint unlocked: " + f.name, "epic", 2600);
    showShop();
  }

  // pixel sprite image (data URL) for a Collection card
  var collSpriteCache = {};
  function collSprite(f, found, shiny, hidden) {
    var key = f.id + (found ? (shiny ? "s" : "f") : (hidden ? "h" : "m"));
    if (collSpriteCache[key]) return collSpriteCache[key];
    var arch = SPRITES.archetypeForShape(f.shape);
    var url;
    if (hidden) url = SPRITES.dataURL(arch, { silhouette: "#0e1822", scale: 4 });
    else if (found) url = SPRITES.dataURL(arch, { color: f.color, accent: f.accent, shiny: shiny, scale: 4 });
    else url = SPRITES.dataURL(arch, { silhouette: "#16242f", scale: 4 });
    collSpriteCache[key] = url;
    return url;
  }

  // ----- Aquarium (live tanks of everything you've caught) -----
  var aqua = null;
  function aquaAreaHasContent(areaId) {
    for (var i = 0; i < D.FISH.length; i++) {
      var f = D.FISH[i]; if (f.area !== areaId) continue;
      if (f.isKraken) { if (state.krakenCaught) return true; }
      else if (f.isBlob) { if (state.blobfishCaught) return true; }
      else if (f.areaBoss || f.secretBoss) { if (state.areaBossCaught[f.id] || state[f.id + "Caught"]) return true; }
      else if (state.discovered[f.id]) return true;
    }
    return false;
  }
  function showAquarium() {
    closeOverlay("modal"); closeOverlay("shop"); sellHud(false);
    scene = "aquarium";
    // only show tanks for areas you've actually caught something in (no endless empty tanks)
    var list = Object.keys(D.LOCATIONS).filter(function (a) { return !(D.LOCATIONS[a].secret && !state.areas[a]) && aquaAreaHasContent(a); });
    if (!list.length) list = ["coral"];
    aqua = { areaList: list, idx: 0, time: 0, entities: [], diverActive: false, night: false, focus: false, focusIdx: 0,
      diver: { x: W / 2, y: H / 2, vx: 0, vy: 0, face: 1 } };
    setupTank(0);
    var dn = document.getElementById("aqua-daynight"); if (dn) dn.textContent = "🌙 Night";
    var sw = document.getElementById("aqua-swim"); if (sw) { sw.style.display = ""; sw.textContent = "🤿 Swim"; }
    var fb = document.getElementById("aqua-focus"); if (fb) fb.textContent = "🔍 Close-up";
    document.getElementById("aqua-ui").style.display = "flex";
  }
  function exitAquarium() {
    aqua = null;
    document.getElementById("aqua-ui").style.display = "none";
    // clear any transient swim input so it can't bleed into the next dive
    joy.active = false; joy.id = null; joy.dx = joy.dy = joy.mag = 0;
    for (var k in keys) keys[k] = false;
    scene = "boat";
    if (window.AUDIO) AUDIO.playMenu(state && state.nextNight);
    showBoat();
  }
  function aquaNav(dir) {
    if (!aqua) return;
    if (aqua.focus) {                       // cycle through the focused fish one by one
      if (!aqua.entities.length) return;
      aqua.focusIdx = (aqua.focusIdx + dir + aqua.entities.length) % aqua.entities.length;
      aquaFocusTitle();
      return;
    }
    var n = aqua.areaList.length;
    aqua.idx = (aqua.idx + dir + n) % n;
    setupTank(aqua.idx);
    if (window.AUDIO) AUDIO.playArea(aqua.area, aqua.night);
  }
  // toggle the single-fish "focus" view (zooms one specimen so it always fills the frame)
  function aquaToggleFocus() {
    if (!aqua) return;
    if (!aqua.focus && !aqua.entities.length) { toast("Nothing discovered in this tank yet.", "bad"); return; }
    aqua.focus = !aqua.focus; aqua.focusIdx = 0; aqua.diverActive = false;
    var sw = document.getElementById("aqua-swim"); if (sw) { sw.style.display = aqua.focus ? "none" : ""; sw.textContent = "🤿 Swim"; }
    var fb = document.getElementById("aqua-focus"); if (fb) fb.textContent = aqua.focus ? "🏞️ Tank" : "🔍 Close-up";
    if (aqua.focus) aquaFocusTitle(); else document.getElementById("aqua-title").textContent = D.LOCATIONS[aqua.area].name + " · " + aqua.entities.length + " here";
  }
  function aquaFocusTitle() {
    var e = aqua.entities[aqua.focusIdx]; if (!e) return;
    document.getElementById("aqua-title").textContent = (e.shiny ? "✦ " : "") + e.def.name + " · " + (aqua.focusIdx + 1) + "/" + aqua.entities.length;
  }
  function setupTank(idx) {
    var areaId = aqua.areaList[idx];
    aqua.area = areaId; aqua.entities = [];
    D.FISH.forEach(function (f) {
      if (f.area !== areaId) return;
      var found, sh;
      if (f.isKraken) { found = state.krakenCaught; sh = state.krakenShiny; }
      else if (f.isBlob) { found = state.blobfishCaught; sh = state.blobfishShiny; }
      else if (f.areaBoss) { found = !!state.areaBossCaught[f.id]; sh = false; }
      else { found = !!state.discovered[f.id]; sh = !!state.shinyFound[f.id]; }
      if (found) addAquaEntity(f, false);
      if (sh) addAquaEntity(f, true);
    });
    document.getElementById("aqua-title").textContent = D.LOCATIONS[areaId].name + " · " + aqua.entities.length + " here";
  }
  function addAquaEntity(f, shiny) {
    var kind = f.bird ? "bird" : (f.creature ? "creature" : "fish");
    var th = f.isKraken ? 100 : (f.isBoss || f.areaBoss) ? 76 : Math.min(58, 14 + f.size * 5);
    var floorY = H - 56, top = 54;
    var e = { def: f, shiny: shiny, kind: kind, phase: Math.random() * 6, th: th };
    if (kind === "bird") { e.x = Math.random() * W; e.baseY = 18 + Math.random() * 22; e.vx = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 20); }
    else if (kind === "creature") { e.x = Math.random() * W; e.baseY = floorY - 6; e.vx = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 8); }
    else { e.x = 40 + Math.random() * (W - 80); e.baseY = top + 36 + Math.random() * (floorY - top - 72); e.vx = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 30); }
    e.y = e.baseY;
    aqua.entities.push(e);
  }
  function updateAquarium(dt) {
    aqua.time += dt;
    var floorY = H - 56, top = 54;
    for (var i = 0; i < aqua.entities.length; i++) {
      var e = aqua.entities[i];
      e.phase += dt * 2; e.x += e.vx * dt;
      if (e.x < 20) { e.x = 20; e.vx = Math.abs(e.vx); }
      if (e.x > W - 20) { e.x = W - 20; e.vx = -Math.abs(e.vx); }
      if (e.kind === "bird") e.y = e.baseY + Math.sin(e.phase) * 4;
      else if (e.kind === "creature") e.y = e.baseY + Math.abs(Math.sin(e.phase * 2)) * 1.5;
      else e.y = e.baseY + Math.sin(e.phase) * 8;
    }
    if (aqua.diverActive) {
      var ax = 0, ay = 0, mag = 1;
      if (keys["a"] || keys["arrowleft"]) ax -= 1;
      if (keys["d"] || keys["arrowright"]) ax += 1;
      if (keys["w"] || keys["arrowup"]) ay -= 1;
      if (keys["s"] || keys["arrowdown"]) ay += 1;
      if (joy.active && joy.mag > 0.08) { ax = joy.dx; ay = joy.dy; mag = joy.mag; }
      var len = Math.hypot(ax, ay), d = aqua.diver;
      if (len > 0.001) {
        d.vx = (ax / len) * 190 * mag; d.vy = (ay / len) * 190 * mag;
        d.x = clamp(d.x + d.vx * dt, 20, W - 20); d.y = clamp(d.y + d.vy * dt, top, floorY);
        if (Math.abs(ax) > 0.05) d.face = ax > 0 ? 1 : -1;
      } else { d.vx = d.vy = 0; }
    }
  }
  // single-specimen "focus" view: one fish, zoomed so it always fills the frame
  // regardless of how tiny or huge it is (scale is relative to that fish)
  function renderAquaFocus() {
    var e = aqua.entities[aqua.focusIdx]; if (!e) { aqua.focus = false; return; }
    var loc = D.LOCATIONS[aqua.area], night = !!aqua.night;
    ctx.clearRect(0, 0, W, H);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    if (night) { g.addColorStop(0, "#0a1030"); g.addColorStop(1, "#03060f"); }
    else { g.addColorStop(0, loc.topColor); g.addColorStop(1, mix(loc.topColor, loc.deepColor, 0.7)); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // soft spotlight
    drawGlow(W / 2, H / 2 - 10, Math.min(W, H) * 0.5, e.shiny ? "#fff0a0" : mix(e.def.color, "#ffffff", 0.4), 0.18);
    var cx = W / 2, cy = H / 2 - 6;
    var bob = Math.sin(aqua.time * 1.4) * 8, tilt = Math.sin(aqua.time * 1.4) * 0.06;
    if (e.kind === "bird" && !birdUsesSprite(e.def)) {
      drawBirdPixel(ctx, cx, cy + bob, 16, e.def.color, aqua.time * 4, false);
    } else {
      var arch = SPRITES.archetypeForShape(e.def.shape);
      var d = SPRITES.dims(arch);
      // fit the sprite to ~62% height AND ~82% width so long/tall fish both fit
      var scale = Math.max(3, Math.floor(Math.min((H * 0.62) / d.h, (W * 0.82) / d.w)));
      if (e.shiny) drawGlow(cx, cy + bob, d.h * scale * 0.6, "#fff0a0", 0.4);
      ctx.save(); ctx.translate(cx, cy + bob); ctx.rotate(tilt);
      SPRITES.draw(ctx, arch, 0, 0, { color: e.def.color, accent: e.def.accent, shiny: e.shiny, scale: scale });
      ctx.restore();
    }
    // info card
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, H - 72, W, 72);
    ctx.textAlign = "center";
    ctx.fillStyle = e.shiny ? "#ffe66d" : "#fff"; ctx.font = "bold 22px 'Segoe UI',sans-serif";
    ctx.fillText((e.shiny ? "✦ " : "") + e.def.name, W / 2, H - 42);
    ctx.fillStyle = D.RARITY[e.def.rarity].color; ctx.font = "14px 'Segoe UI',sans-serif";
    var tags = D.RARITY[e.def.rarity].name + (e.def.bird ? " · Bird" : e.def.creature ? " · Creature" : "")
      + (e.def.night ? " · 🌙" : e.def.day ? " · ☀️" : "") + (e.def.value ? " · $" + fmt(e.def.value) : "");
    ctx.fillText(tags, W / 2, H - 20);
    // glass frame
    ctx.strokeStyle = "rgba(200,230,255,0.5)"; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
  }

  function renderAquarium() {
    if (aqua.focus) { renderAquaFocus(); return; }
    var loc = D.LOCATIONS[aqua.area], floorY = H - 56, top = 54;
    var night = !!aqua.night;
    ctx.clearRect(0, 0, W, H);
    var sky = loc.sky || { top: "#aee0ff", bottom: "#e8f6ff" };
    var sg = ctx.createLinearGradient(0, 0, 0, top);
    if (night) { sg.addColorStop(0, "#0a1030"); sg.addColorStop(1, "#22305a"); }
    else { sg.addColorStop(0, sky.top); sg.addColorStop(1, sky.bottom); }
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, top);
    if (night) { // stars + moon
      ctx.fillStyle = "#fff";
      for (var st = 0; st < 22; st++) { if (Math.sin(aqua.time * 0.6 + st) > 0.1) ctx.fillRect((st * 47) % W, (st * 17) % top, 2, 2); }
      ctx.fillStyle = "rgba(230,235,255,0.9)"; ctx.beginPath(); ctx.arc(W * 0.82, top * 0.5, 10, 0, 7); ctx.fill();
    }
    var wg = ctx.createLinearGradient(0, top, 0, floorY);
    if (night) { wg.addColorStop(0, mix(loc.topColor, "#04060f", 0.55)); wg.addColorStop(1, mix(loc.deepColor, "#04060f", 0.4)); }
    else { wg.addColorStop(0, loc.topColor); wg.addColorStop(1, mix(loc.topColor, loc.deepColor, 0.6)); }
    ctx.fillStyle = wg; ctx.fillRect(0, top, W, floorY - top);
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(0, top - 2, W, 3);
    var d = DECOR[aqua.area] || DECOR.coral;
    ctx.fillStyle = d.floor; ctx.fillRect(0, floorY, W, H - floorY);
    // simple gravel plants
    ctx.fillStyle = d.plantColors ? d.plantColors[0] : "#3fa34d";
    for (var px = 30; px < W; px += 90) {
      var hh = 14 + ((px * 7) % 26) + Math.sin(aqua.time + px) * 3;
      ctx.fillRect(px, floorY - hh, 6, hh);
    }
    for (var i = 0; i < aqua.entities.length; i++) drawAquaEntity(aqua.entities[i]);
    if (aqua.diverActive) {
      var moving = Math.abs(aqua.diver.vx) + Math.abs(aqua.diver.vy) > 5;
      drawDiverPixel(ctx, aqua.diver.x, aqua.diver.y, 3, aqua.diver.face < 0 ? -1 : 1, state.diver, aqua.time * (moving ? 11 : 3.5));
    }
    // glass tank frame
    ctx.strokeStyle = "rgba(200,230,255,0.5)"; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 2; ctx.strokeRect(11, 11, W - 22, H - 22);
    if (!aqua.entities.length) {
      ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = "15px 'Segoe UI', sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Nothing from " + loc.name + " yet — go catch some!", W / 2, H / 2);
    }
  }
  function drawAquaEntity(e) {
    var x = e.x, y = e.y, th = e.th;
    if (e.shiny) drawGlow(x, y, th * 0.9, "#fff0a0", 0.4);
    if (e.kind === "bird") {
      if (birdUsesSprite(e.def)) drawFlapBird(SPRITES.archetypeForShape(e.def.shape), x, y, { color: e.def.color, accent: e.def.accent, shiny: e.shiny, flip: e.vx < 0, targetH: th }, (e.phase + aqua.time) * 4);
      else drawBirdPixel(ctx, x, y, Math.max(2, Math.round(th / 7)), e.def.color, e.phase, e.vx < 0);
    } else {
      ctx.save(); ctx.translate(x, y);
      if (e.kind === "fish") ctx.rotate(Math.sin(e.phase * 1.6) * 0.1);
      SPRITES.draw(ctx, SPRITES.archetypeForShape(e.def.shape), 0, 0, { color: e.def.color, accent: e.def.accent, shiny: e.shiny, flip: e.vx < 0, targetH: th });
      ctx.restore();
    }
    if (e.shiny && Math.sin(aqua.time * 3 + e.phase) > 0.6) { ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect((x + th * 0.3) | 0, (y - th * 0.3) | 0, 2, 2); }
  }


  // ----- Collection (now opened as the "List" view from the Aquarium) -----
  var collShinyView = false;
  function showCollection() {
    var ov = overlay("shop");
    var byArea = {};
    D.FISH.forEach(function (f) { (byArea[f.area] = byArea[f.area] || []).push(f); });
    var REQ = {}; D.REQUIRED_FISH.forEach(function (id) { REQ[id] = true; });
    var totalFound = 0, totalAll = 0, shinyFound = 0;
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>📖 Collection</h2>'
      + '<button id="coll-shiny-toggle" class="coll-toggle ' + (collShinyView ? 'on' : '') + '">' + (collShinyView ? '✦ Shiny view' : 'Normal view') + '</button>'
      + '<button class="close" data-close="shop">✕</button></div>';
    html += '<div class="collection-scroll">';
    var reqDone = 0; D.REQUIRED_FISH.forEach(function (id) { if (state.discovered[id]) reqDone++; });
    html += '<div class="req-banner">🗝️ <b>Kraken requirements:</b> ' + reqDone + '/' + D.REQUIRED_FISH.length
      + ' required fish caught (marked 🗝️). <span class="tiny">...or so the legend says.</span></div>';

    for (var areaId in D.LOCATIONS) {
      if (D.LOCATIONS[areaId].secret && !state.areas[areaId]) continue; // hide undiscovered secret areas
      var fishes = byArea[areaId] || [];
      if (!fishes.length) continue;
      html += '<h3>' + D.LOCATIONS[areaId].name + '</h3><div class="coll-grid">';
      fishes.forEach(function (f) {
        var special = f.isKraken || f.isBlob || f.areaBoss || f.secretBoss;
        var found, sh, hidden;
        if (f.isKraken) { found = state.krakenCaught; sh = state.krakenShiny; }
        else if (f.isBlob) { found = state.blobfishCaught; sh = state.blobfishShiny; }
        else if (f.areaBoss) { found = !!state.areaBossCaught[f.id]; sh = !!state.shinyFound[f.id]; }
        else if (f.secretBoss) { found = !!state[f.id + "Caught"]; sh = !!state.shinyFound[f.id]; }
        else { found = !!state.discovered[f.id]; sh = !!state.shinyFound[f.id]; }
        hidden = !found; // never reveal a name (or sprite) until you've actually caught/beaten it
        if (!special) { totalAll++; if (found) totalFound++; if (sh) shinyFound++; }
        var showShiny = collShinyView && sh && found;
        html += '<div class="coll-card ' + (found ? 'found' : 'missing') + ' r-' + f.rarity + (REQ[f.id] ? ' required' : '') + '">';
        if (REQ[f.id]) html += '<div class="req-badge" title="Required to summon the Kraken">🗝️</div>';
        html += '<div class="coll-sprite" style="background-image:url(' + collSprite(f, found, showShiny, hidden) + ')"></div>';
        var nm = hidden ? "???" : (f.isBlob ? "Blobfish 🫠" : f.name);
        html += '<div class="coll-name">' + nm + (sh ? ' <span class="shiny-tag">✦</span>' : '') + '</div>';
        var tod = f.night ? ' · 🌙 Night' : (f.day ? ' · ☀️ Day' : (special ? '' : ' · ⏱️ Any time'));
        html += '<div class="coll-meta">' + D.RARITY[f.rarity].name
          + (found && !special ? ' · ' + (state.counts[f.id] || 0) + ' caught' : '')
          + (f.creature ? ' · Creature' : (f.bird ? ' · Bird' : '')) + (f.secret ? ' · Secret' : '') + tod + '</div>';
        if (!special) html += '<div class="coll-meta">Size ' + f.size + ' · $' + fmt(f.value) + '</div>';
        else {
          var bossKind = (f.isKraken || f.isBlob) ? '🦑 Legendary Boss' : f.secretBoss ? '⭐ Secret Boss' : '⚔️ Area Boss';
          html += '<div class="coll-meta">' + (found ? '✓ Defeated! · ' + bossKind : '🔒 ' + bossKind) + '</div>';
        }
        // take a mini version of this fish along as a companion (shiny if you're in shiny view)
        if (found) {
          var isBuddy = state.buddy && state.buddy.id === f.id && !!state.buddy.shiny === !!showShiny;
          html += '<button class="coll-buddy' + (isBuddy ? ' on' : '') + '" data-buddy="' + f.id + ':' + (showShiny ? 1 : 0) + '">'
            + (isBuddy ? '🐾 Following' : '🐾 Take with me') + '</button>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    html += '<div class="coll-footer">Discovered <b>' + totalFound + '/' + totalAll + '</b> · Shinies <b>' + shinyFound + '</b> ✦ '
      + '· <span class="tiny">' + (collShinyView ? 'showing shiny colours' : 'tap "Normal view" to flip shiny ↔ normal') + '</span></div>';
    html += '</div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    ov.querySelector('[data-close="shop"]').onclick = function () { closeOverlay("shop"); };
    var tg = ov.querySelector("#coll-shiny-toggle");
    if (tg) tg.onclick = function () {
      collShinyView = !collShinyView;
      showCollection();
      // jump back to the top so you don't lose your place mid-list
      var o = document.getElementById("shop");
      if (o) { o.scrollTop = 0; var cs = o.querySelector(".collection-scroll"); if (cs) cs.scrollTop = 0; }
    };
    ov.querySelectorAll("[data-buddy]").forEach(function (b) {
      b.onclick = function () {
        var p = b.getAttribute("data-buddy").split(":"), id = p[0], shiny = p[1] === "1";
        if (state.buddy && state.buddy.id === id && !!state.buddy.shiny === shiny) { state.buddy = null; toast("Companion sent home.", "good", 1200); }
        else { state.buddy = { id: id, shiny: shiny }; toast("🐾 " + (shiny ? "✦ " : "") + D.FISH_BY_ID[id].name + " is now your companion!", "good", 1600); }
        saveGame();
        var o = document.getElementById("shop"), sp = o ? o.scrollTop : 0, cs = o ? o.querySelector(".collection-scroll") : null, csp = cs ? cs.scrollTop : 0;
        showCollection();
        o = document.getElementById("shop"); if (o) o.scrollTop = sp; cs = o ? o.querySelector(".collection-scroll") : null; if (cs) cs.scrollTop = csp;
      };
    });
  }

  // ----- Diver customization -----
  var diverPreviewTimer = null;
  var diverPreviewSuit = null; // {name,color,owned,buy,lockReason} being previewed
  var diverSuitList = [];
  function stopDiverPreview() { if (diverPreviewTimer) { clearInterval(diverPreviewTimer); diverPreviewTimer = null; } }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function renderDiverPreview() {
    var c = document.getElementById("diver-preview");
    if (!c) { stopDiverPreview(); return; }
    var p = c.getContext("2d");
    p.imageSmoothingEnabled = false;
    var g = p.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, "#2a6e9a"); g.addColorStop(1, "#0a2c48");
    p.fillStyle = g; p.fillRect(0, 0, c.width, c.height);
    var t = Date.now() / 1000;
    p.fillStyle = "rgba(255,255,255,0.25)";
    for (var i = 0; i < 6; i++) {
      var bx = (i * 27 + 12) % c.width;
      var by = c.height - ((t * 22 + i * 33) % c.height);
      p.fillRect(bx | 0, by | 0, 2, 2);
    }
    // preview the focused suit (colour + accent) without committing
    var suitCol = (diverPreviewSuit && diverPreviewSuit.owned !== false && diverPreviewSuit.color) ? diverPreviewSuit.color
      : (diverPreviewSuit && diverPreviewSuit.previewColor) ? diverPreviewSuit.previewColor
      : state.diver.suit;
    var suitAcc = diverPreviewSuit ? diverPreviewSuit.accent : state.diver.suitAccent;
    var suitTri = diverPreviewSuit ? (diverPreviewSuit.trim || suitTrimFor(suitCol, suitAcc)) : state.diver.suitTrim;
    // Camo Suit preview: blend the diver into the preview water
    var isCamo = suitCol === "camo" || (diverPreviewSuit && diverPreviewSuit.camo);
    if (isCamo) {
      var bg = "#1a4868";
      var opts = { skin: state.diver.skin, hair: state.diver.hair, look: state.diver.look, suit: bg, suitAccent: mix(bg, "#fff", 0.12), suitTrim: mix(bg, "#fff", 0.2), camoSkin: bg };
      p.save(); p.globalAlpha = 0.3; drawDiverPixel(p, c.width / 2, c.height / 2, 6, 1, opts, t * 7); p.restore();
      return;
    }
    var opts = { skin: state.diver.skin, hair: state.diver.hair, look: state.diver.look, suit: suitCol, suitAccent: suitAcc, suitTrim: suitTri };
    drawDiverPixel(p, c.width / 2, c.height / 2, 6, 1, opts, t * 7);
  }

  // is a given boss defeated? (area bosses + secret bosses)
  function bossDefeated(id) {
    if (state.areaBossCaught && state.areaBossCaught[id]) return true;
    return !!state[id + "Caught"];
  }

  // unified list of all wetsuits with names + ownership/buy/lock metadata
  function buildSuitList() {
    var list = [];
    SUITS.forEach(function (s) {
      var owned = s.cost === 0 || state.diverUnlocks[s.id];
      list.push({ key: "s_" + s.id, name: cap(s.id), color: s.color, accent: s.accent, trim: s.trim, owned: owned,
        buy: (!owned && s.cost > 0) ? { id: s.id, cost: s.cost } : null, group: "Wetsuits" });
    });
    LOCATION_SUITS.forEach(function (s) {
      var visited = s.always || (state.visited && state.visited[s.area]);
      var trim = suitTrimFor(s.color);
      // a suit for an as-yet-undiscovered SECRET site stays a "???" mystery
      if (s.secret && !state.areas[s.area]) {
        list.push({ key: "l_" + s.area, name: "???", color: "#16242f", accent: suitAccentFor(s.color), trim: trim, owned: false,
          lockReason: "Discover a hidden dive site", group: "Location suits" });
        return;
      }
      list.push({ key: "l_" + s.area, name: s.name, color: s.color, accent: suitAccentFor(s.color), trim: trim, owned: !!visited,
        previewColor: s.color, lockReason: visited ? null : ("Dive the " + (D.LOCATIONS[s.area] ? D.LOCATIONS[s.area].name : s.name)), group: "Location suits" });
    });
    SECRET_SUITS.forEach(function (s) {
      var unlocked = !!state.discovered[s.id];
      list.push({ key: "x_" + s.id, name: unlocked ? s.name : "???", color: unlocked ? s.color : "#16242f", accent: s.accent || suitAccentFor(s.color), trim: s.trim || suitTrimFor(s.color, s.accent), owned: unlocked,
        lockReason: unlocked ? null : "Catch its secret fish", group: "Secret suits" });
    });
    BOSS_SUITS.forEach(function (s) {
      var beaten = bossDefeated(s.id);
      // hidden secret-boss suits stay "???" so we never spoil their existence
      if (s.secretArea && !state.areas[s.area] && !beaten) {
        list.push({ key: "b_" + s.id, name: "???", color: "#1a1622", accent: "#4a4060", trim: "#6a5a8a", owned: false,
          lockReason: "Defeat a hidden boss", group: "Boss suits" });
        return;
      }
      list.push({ key: "b_" + s.id, name: beaten ? s.name : "???", color: beaten ? s.color : "#1a1622", accent: beaten ? s.accent : "#4a4060", trim: beaten ? (s.trim || suitTrimFor(s.color, s.accent)) : "#6a5a8a", owned: beaten,
        lockReason: beaten ? null : "Defeat this boss", group: "Boss suits" });
    });
    // Reward: the Camo Suit — unlocked once EVERY other costume is collected.
    // It seamlessly blends the diver into whatever background you're diving.
    var allOwned = list.every(function (s) { return s.owned; });
    list.push({ key: "r_camo", name: allOwned ? "Camo Suit" : "???", color: "camo", accent: "camo", trim: "camo",
      owned: allOwned, camo: true, lockReason: allOwned ? null : "Collect EVERY other costume to unlock", group: "Reward" });
    return list;
  }

  function showDiverShop() {
    var ov = overlay("shop");
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>🤿 Your Diver</h2>'
      + '<div class="money-line">💰 $' + fmt(state.money) + '</div>'
      + '<button class="close" data-close="shop">✕</button></div>';

    html += '<div class="diver-preview-wrap"><canvas id="diver-preview" width="170" height="150"></canvas></div>';

    // preview action bar — shows the focused suit's name + Equip/Buy/Locked
    diverSuitList = buildSuitList();
    var pv = diverPreviewSuit;
    if (!pv) { pv = null; for (var pi = 0; pi < diverSuitList.length; pi++) { if (diverSuitList[pi].color === state.diver.suit && diverSuitList[pi].owned) { pv = diverSuitList[pi]; break; } } }
    if (!pv) pv = { name: "Current suit", color: state.diver.suit, owned: true };
    html += '<div class="preview-bar"><div class="pv-name">' + pv.name + ' Suit</div>';
    if (pv.lockReason) html += '<span class="pv-locked">🔒 ' + pv.lockReason + '</span>';
    else if (pv.buy) html += '<button class="primary" data-suitbuy="' + pv.buy.id + '" ' + (state.money < pv.buy.cost ? 'disabled' : '') + '>Buy &amp; Wear — $' + fmt(pv.buy.cost) + '</button>';
    else if (state.diver.suit === pv.color) html += '<button disabled>Wearing ✓</button>';
    else html += '<button class="primary" data-suitequip="' + pv.color + '" data-suitaccent="' + (pv.accent || "") + '" data-suittrim="' + (pv.trim || "") + '">Equip</button>';
    html += '</div>';
    html += '<p class="tiny" style="text-align:center">Tap any item to preview it on your diver. Purely cosmetic!</p>';

    // Look
    html += '<h3>Look</h3><div class="swatch-row">';
    LOOKS.forEach(function (l) {
      html += '<button class="look-btn ' + (state.diver.look === l.id ? 'sel' : '') + '" data-look="' + l.id + '">' + l.name + '</button>';
    });
    html += '</div>';

    // Skin tone
    html += '<h3>Skin tone</h3><div class="swatch-row">';
    SKIN_TONES.forEach(function (col, i) {
      html += '<button class="swatch ' + (state.diver.skin === i ? 'sel' : '') + '" data-skin="' + i + '" style="background:' + col + '"></button>';
    });
    html += '</div>';

    // Hair colour
    html += '<h3>Hair colour</h3><div class="swatch-row">';
    HAIR_COLORS.forEach(function (col, i) {
      html += '<button class="swatch ' + (state.diver.hair === i ? 'sel' : '') + '" data-hair="' + i + '" style="background:' + col + '"></button>';
    });
    html += '</div>';

    // Wetsuits, grouped, each labelled with its name
    ["Wetsuits", "Location suits", "Secret suits", "Boss suits", "Reward"].forEach(function (grp) {
      html += '<h3>' + grp + '</h3><div class="suit-grid">';
      diverSuitList.filter(function (s) { return s.group === grp; }).forEach(function (s) {
        var sel = state.diver.suit === s.color && s.owned;
        var chipBg = s.camo ? 'linear-gradient(135deg,#3a5a4a,#6a7a5a 40%,#8a9a7a 60%,#4a5a4a)' : s.color;
        html += '<button class="suit-cell ' + (sel ? 'sel' : '') + (s.owned ? '' : ' locked') + '" data-suitpick="' + s.key + '">'
          + '<span class="suit-chip" style="background:' + chipBg + '">' + (s.owned ? '' : '<span class="lock">🔒</span>') + '</span>'
          + '<span class="suit-label">' + s.name + '</span></button>';
      });
      html += '</div>';
    });
    html += '<p class="tiny">Location suits unlock as you reach each area. Secret suits unlock when you catch that area\'s secret fish. Boss suits unlock when you defeat each boss. The <b>Camo Suit</b> is the reward for collecting them ALL — it blends you into the background.</p>';
    html += '</div>';

    ov.innerHTML = html;
    ov.classList.add("open");
    stopDiverPreview();
    diverPreviewTimer = setInterval(renderDiverPreview, 60);
    renderDiverPreview();

    ov.querySelector('[data-close="shop"]').onclick = function () { stopDiverPreview(); closeOverlay("shop"); };
    ov.querySelectorAll("[data-look]").forEach(function (b) {
      b.onclick = function () { state.diver.look = b.getAttribute("data-look"); saveGame(); showDiverShop(); };
    });
    ov.querySelectorAll("[data-skin]").forEach(function (b) {
      b.onclick = function () { state.diver.skin = +b.getAttribute("data-skin"); saveGame(); showDiverShop(); };
    });
    ov.querySelectorAll("[data-hair]").forEach(function (b) {
      b.onclick = function () { state.diver.hair = +b.getAttribute("data-hair"); saveGame(); showDiverShop(); };
    });
    // tap a suit to PREVIEW it (no commit) — action bar handles equip/buy
    ov.querySelectorAll("[data-suitpick]").forEach(function (b) {
      b.onclick = function () {
        var key = b.getAttribute("data-suitpick");
        diverPreviewSuit = diverSuitList.filter(function (s) { return s.key === key; })[0] || null;
        showDiverShop();
      };
    });
    ov.querySelectorAll("[data-suitequip]").forEach(function (b) {
      b.onclick = function () {
        state.diver.suit = b.getAttribute("data-suitequip");
        state.diver.suitAccent = b.getAttribute("data-suitaccent") || suitAccentFor(state.diver.suit);
        state.diver.suitTrim = b.getAttribute("data-suittrim") || suitTrimFor(state.diver.suit, state.diver.suitAccent);
        saveGame(); toast("Wetsuit equipped!", "good", 1200); showDiverShop();
      };
    });
    ov.querySelectorAll("[data-suitbuy]").forEach(function (b) {
      b.onclick = function () {
        var s = SUITS.filter(function (x) { return x.id === b.getAttribute("data-suitbuy"); })[0];
        if (!s || state.money < s.cost || state.diverUnlocks[s.id]) return;
        state.money -= s.cost; state.diverUnlocks[s.id] = true; state.diver.suit = s.color; state.diver.suitAccent = s.accent; state.diver.suitTrim = s.trim || suitTrimFor(s.color, s.accent);
        saveGame(); toast("Unlocked & equipped the " + cap(s.id) + " wetsuit!", "good", 1800);
        diverPreviewSuit = null; showDiverShop();
      };
    });
  }

  // end-game areas gate themselves (Trench/Sanctuary/Cloud) — they're not part
  // of the linear cheapest-first purchase chain
  function isSpecialArea(L) { return !!(L.requireAreas || L.requireBosses || L.requireAllBirds || L.requireAllCreatures); }
  function nextNormalAreaToBuy() {
    var best = null, bc = Infinity;
    for (var a in D.LOCATIONS) {
      var L = D.LOCATIONS[a];
      if (L.secret || state.areas[a] || isSpecialArea(L)) continue;
      if ((L.cost || 0) < bc) { bc = L.cost || 0; best = a; }
    }
    return best;
  }
  // ----- Area select -----
  function showAreas() {
    var ov = overlay("shop");
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>🗺️ Dive Sites</h2>'
      + '<div class="money-line">💰 $' + fmt(state.money) + '</div>'
      + '<button class="close" data-close="shop">✕</button></div><div class="area-list">';
    for (var id in D.LOCATIONS) {
      var loc = D.LOCATIONS[id];
      var unlocked = state.areas[id];
      if (loc.secret && !unlocked) continue; // hidden until you discover it
      // gating: Trench needs the earlier areas first; Sanctuary needs both bosses
      var gate = null;
      if (!unlocked && loc.requireAreas) {
        var missing = loc.requireAreas.filter(function (a) { return !state.areas[a]; });
        if (missing.length) gate = "Unlock the earlier dive sites first";
      }
      if (!unlocked && loc.requireBosses && !(state.krakenCaught && state.blobfishCaught)) {
        gate = "🔒 Defeat the Kraken (and the blobfish) to unlock";
      }
      if (!unlocked && loc.requireItem && !state.items[loc.requireItem]) {
        gate = "🔒 Buy the " + (loc.requireItem === "heatsuit" ? "Heat Suit" : loc.requireItem) + " (Shop → Gear) first";
      }
      if (!unlocked && loc.requireAllBirds && !allBirdsFound()) {
        gate = "🔒 Discover every bird first";
      }
      if (!unlocked && loc.requireAllCreatures && !allCreaturesFound()) {
        gate = "🔒 Discover every sea creature first";
      }
      // sequential progression: you can't skip ahead to a harder site — every
      // CHEAPER ordinary dive site must be owned first (special end-game areas
      // keep their own gates and are excluded so this can never soft-lock).
      if (!unlocked && !gate && !loc.secret && !isSpecialArea(loc)) {
        var nb = nextNormalAreaToBuy();
        if (nb && nb !== id) gate = "🔒 Unlock " + D.LOCATIONS[nb].name + " first";
      }
      var tint = loc.tint || "#6fd0ff";
      var cardStyle = ' style="border-left:5px solid ' + tint + ';"';
      var goStyle = ' style="background:' + tint + ';border-color:' + tint + ';color:#04121c;"';
      html += '<div class="area-card ' + (unlocked ? '' : 'locked') + (id === "sanctuary" ? ' sanctuary' : '') + '"' + cardStyle + '>'
        + '<div class="area-info"><b style="color:' + tint + ';">' + loc.name + '</b>'
        + '<p>' + loc.blurb + '</p>'
        + '<small>Max depth ' + loc.maxDepth + 'm' + (loc.shinyBonus ? ' · ✦ Shiny haven' : '')
        + (loc.cold ? ' · 🧊 Cold Suit recommended' : '') + (loc.hot ? ' · 🔥 Heat Suit recommended' : '') + '</small></div>'
        + '<div class="area-act">'
        + (unlocked
            ? '<button data-go="' + id + '"' + goStyle + '>Dive Here</button>'
            : gate
              ? '<span class="pv-locked">' + gate + '</span>'
              : '<button data-unlock="' + id + '" ' + (state.money < loc.cost ? 'disabled' : '') + '>Unlock $' + fmt(loc.cost) + '</button>')
        + '</div></div>';
    }
    html += '</div></div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    ov.querySelector('[data-close="shop"]').onclick = function () { closeOverlay("shop"); };
    ov.querySelectorAll("[data-go]").forEach(function (b) {
      b.onclick = function () { closeOverlay("shop"); startDive(b.getAttribute("data-go")); };
    });
    ov.querySelectorAll("[data-unlock]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-unlock");
        if (state.money < D.LOCATIONS[id].cost) return;
        state.money -= D.LOCATIONS[id].cost;
        state.areas[id] = true;
        saveGame();
        toast("Unlocked " + D.LOCATIONS[id].name + "!", "epic", 2200);
        showAreas();
      };
    });
  }

  // ----- Stats -----
  function showStats() {
    var ov = overlay("shop");
    var s = state.stats;
    var disc = Object.keys(state.discovered).length;
    var shiny = Object.keys(state.shinyFound).length;
    var treas = 0; for (var t in state.treasures) treas += state.treasures[t];
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>📊 Logbook</h2>'
      + '<button class="close" data-close="shop">✕</button></div>'
      + '<div class="stats-list">'
      + statRow("Money", "$" + fmt(state.money))
      + statRow("Total earned", "$" + fmt(s.earned))
      + statRow("Fish species found", disc + " / " + (D.FISH.length - 1))
      + statRow("Shiny species found", shiny + " ✦")
      + statRow("Total fish caught", fmt(s.totalCaught))
      + statRow("Treasures recovered", fmt(treas))
      + statRow("Deepest dive", s.maxDepth + " m")
      + statRow("Dives completed", fmt(s.dives))
      + statRow("Rarity charms", "×" + state.charms.rarity)
      + statRow("Shiny charms", "×" + state.charms.shiny)
      + statRow("Kraken", state.krakenCaught ? (state.krakenShiny ? "✦ SHINY Defeated!" : "Defeated") : "At large")
      + '</div></div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    ov.querySelector('[data-close="shop"]').onclick = function () { closeOverlay("shop"); };
  }
  function statRow(k, v) { return '<div class="stat-row"><span>' + k + '</span><b>' + v + '</b></div>'; }

  // ----- Ending -----
  function showEnding(shiny) {
    scene = "ending";
    sellHud(false);
    var ov = overlay("modal");
    var html = '<div class="panel ending-panel ' + (shiny ? 'secret' : '') + '">';
    if (shiny) {
      html += '<h1>✦ THE SECRET ENDING ✦</h1>';
      html += '<p>Against impossible odds, the beast that rose from the abyss shimmered with an otherworldly light — a <b>SHINY KRAKEN</b>.</p>';
      html += '<p>As your harpoon line went taut, the entire ocean lit up like a galaxy. Sailors will tell stories of the diver who caught the uncatchable, in its rarest form, for a thousand years.</p>';
      html += '<p class="prize">You are a <b>legend among legends</b>. 100% of the impossible, complete.</p>';
    } else {
      html += '<h1>🦑 THE KRAKEN FALLS 🦑</h1>';
      html += '<p>You catalogued every fish in the seven seas, and the legendary Kraken finally rose to challenge you. After an epic struggle, the colossus is yours.</p>';
      html += '<p>The ocean is quiet again. You are the greatest deep sea diver who ever lived.</p>';
      html += '<p class="prize">Rumor says the Kraken can appear in a <b>shiny</b> form for those with enough shiny charms... a secret ending awaits the truly dedicated.</p>';
    }
    html += '<div class="ending-stats">Fish found: ' + Object.keys(state.discovered).length + ' · Shinies: '
      + Object.keys(state.shinyFound).length + ' · Earned: $' + fmt(state.stats.earned) + '</div>';
    html += '<button id="btn-continue" class="big primary">Continue Exploring</button>';
    html += '</div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    bind("btn-continue", function () { closeOverlay("modal"); scene = "boat"; if (window.AUDIO) AUDIO.playMenu(state && state.nextNight); showBoat(); });
    saveGame();
  }

  // the blobfish fake-out "ending"
  function showBlobEnding(shiny) {
    scene = "ending";
    sellHud(false);
    var ov = overlay("modal");
    var img = SPRITES.dataURL("blob", { color: "#e0909e", shiny: !!shiny, scale: 6 });
    var html = '<div class="panel ending-panel">';
    html += '<h1>🦑 ... the legend rises ... 🦑</h1>';
    html += '<div class="blob-reveal" style="background-image:url(' + img + ')"></div>';
    html += '<p>The whole ocean shook. You braced for the Kraken itself... and up floated —</p>';
    html += '<p class="prize">— a <b>Blobfish</b>. 🫠</p>';
    html += '<p>It looks at you. You look at it. Somewhere, a crab laughs.</p>';
    html += '<p>Turns out that list of "required" fish was a load of barnacles. To truly summon the Kraken you must catch <b>100% of everything</b> — every fish, and one day every bird and sea creature too.</p>';
    html += '<button id="btn-resume" class="big primary">🤿 Keep Diving</button>';
    html += '<button id="btn-continue" class="big">⬆ Back to Boat</button>';
    html += '</div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    bind("btn-resume", function () { resumeDive(); });
    bind("btn-continue", function () { closeOverlay("modal"); scene = "boat"; if (window.AUDIO) AUDIO.playMenu(state && state.nextNight); showBoat(); });
    saveGame();
  }

  function showAreaBossEnding(def, pay) {
    scene = "ending";
    sellHud(false);
    var ov = overlay("modal");
    var img = SPRITES.dataURL(SPRITES.archetypeForShape(def.shape), { color: def.color, accent: def.accent, scale: 5 });
    var html = '<div class="panel ending-panel">';
    html += '<h1>⚔️ ' + def.name + ' defeated! ⚔️</h1>';
    html += '<div class="blob-reveal" style="background-image:url(' + img + ')"></div>';
    if (def.reward === "necklace") {
      html += '<p>Tangled in its tendrils you find the legendary <b>Multiplier Necklace</b>! ✨</p>';
      html += '<p class="prize">Every treasure you recover is now worth <b>DOUBLE</b>.</p>';
    } else if (def.reward === "stinger") {
      html += '<p>You harvest a crackling <b>Jelly Stinger</b>! ⚡</p>';
      html += '<p class="prize">Nearby fish are now <b>shocked still</b> — no more fleeing from your magnet.</p>';
    } else if (def.reward === "megtooth") {
      html += '<p>You pry loose a giant <b>Meg Tooth</b>! 🦷</p>';
      html += '<p class="prize">Every boss now takes <b>one fewer harpoon</b> to defeat.</p>';
    } else if (def.reward === "sonar") {
      html += '<p>You salvage the orca\'s uncanny <b>Sonar Radar</b>! 📡</p>';
      html += '<p class="prize">It now <b>beeps hot &amp; cold</b> as you near a sunken wreck — faster pings mean treasure is close.</p>';
    } else if (def.reward === "rocfeather") {
      html += '<p>You pluck a colossal <b>Roc Feather</b>! 🪶</p>';
      html += '<p class="prize">You can now <b>leap up out of the water</b> in any area to snatch birds from the sky — no seeds needed!</p>';
    } else if (def.reward === "crabcrown") {
      html += '<p>You claim the jewelled <b>Spider Crab Crown</b>! 👑</p>';
      html += '<p class="prize">Every sea creature you catch is now worth <b>DOUBLE</b>.</p>';
    } else if (def.reward === "kaijubreath") {
      html += '<p>You absorb the beast\'s power — the <b>Kaiju Breath</b>! 🔵</p>';
      html += '<p class="prize">Tap 🔵 in a dive to fire a beam of blue energy that <b>vacuums up every fish</b> it touches.</p>';
    } else {
      html += '<p>A mighty trophy added to your collection.</p>';
      html += '<p class="prize">+$' + fmt(pay || def.value) + '</p>';
    }
    html += '<button id="btn-resume" class="big primary">🤿 Keep Diving</button>';
    html += '<button id="btn-continue" class="big">⬆ Back to Boat</button></div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    bind("btn-resume", function () { resumeDive(); });
    bind("btn-continue", function () { closeOverlay("modal"); scene = "boat"; if (window.AUDIO) AUDIO.playMenu(state && state.nextNight); showBoat(); });
    saveGame();
  }

  // ---------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------
  function bind(id, fn) { var el = document.getElementById(id); if (el) el.onclick = fn; }

  // simple text-input modal (used for usernames)
  function askText(title, def, cb) {
    var ov = document.createElement("div");
    ov.className = "overlay open"; ov.style.zIndex = 60;
    ov.innerHTML = '<div class="panel" style="max-width:360px"><h2>' + title + '</h2>'
      + '<input id="ask-input" maxlength="16" value="' + String(def || "").replace(/"/g, "&quot;") + '" '
      + 'style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:rgba(0,0,0,0.3);color:#fff;font:inherit;margin-bottom:12px"/>'
      + '<div style="display:flex;gap:8px"><button id="ask-ok" class="primary big" style="flex:1">OK</button>'
      + '<button id="ask-cancel" class="big" style="flex:1">Cancel</button></div></div>';
    document.body.appendChild(ov);
    var input = ov.querySelector("#ask-input");
    setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 50);
    function done(v) { if (ov.parentNode) ov.parentNode.removeChild(ov); cb(v); }
    ov.querySelector("#ask-ok").onclick = function () { done((input.value || "").trim().slice(0, 16) || (def || "Diver")); };
    ov.querySelector("#ask-cancel").onclick = function () { done(null); };
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") ov.querySelector("#ask-ok").click(); });
  }

  // ----- Gift codes (offline fish trading) -----
  function giftEncode(item) {
    try { return "DSD1:" + btoa(JSON.stringify({ f: item.fishId, s: item.shiny ? 1 : 0, v: Math.round(item.value) })); }
    catch (e) { return null; }
  }
  function giftDecode(code) {
    code = (code || "").trim();
    if (code.indexOf("DSD1:") !== 0) return null;
    try {
      var o = JSON.parse(atob(code.slice(5)));
      var def = D.FISH_BY_ID[o.f];
      if (!def) return null;
      return { fishId: def.id, shiny: !!o.s, size: def.size, name: def.name, color: def.color,
        value: o.v || def.value * (o.s ? D.SHINY_VALUE_MULT : 1) };
    } catch (e) { return null; }
  }

  var lastGiftCode = null, lastGiftName = null;
  function showTrade() {
    var ov = overlay("shop");
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>🎁 Gift Fish</h2>'
      + '<button class="close" data-close="shop">✕</button></div>';
    html += '<p class="tiny">Trade fish with friends via codes — no internet needed. Turn a fish from your haul into a code, send it to a friend, and they paste it in to receive it. (Codes are trust-based — keep them between friends!)</p>';

    html += '<h3>Receive a fish</h3>';
    html += '<div class="trade-row"><input id="trade-in" placeholder="Paste a gift code (DSD1:...)" '
      + 'style="flex:1;padding:11px;border-radius:10px;border:1px solid var(--line);background:rgba(0,0,0,0.3);color:#fff;font:inherit"/>'
      + '<button id="trade-receive" class="primary">Receive</button></div>';

    if (lastGiftCode) {
      html += '<div class="gift-code-box"><b>Gift code for ' + lastGiftName + ' — send it to a friend:</b>'
        + '<textarea readonly id="gift-code" rows="2" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid var(--line);background:rgba(0,0,0,0.35);color:#9fe;font:inherit">' + lastGiftCode + '</textarea>'
        + '<button id="gift-copy" class="primary" style="margin-top:6px">Copy code</button></div>';
    }

    html += '<h3>Send a fish from your haul</h3>';
    if (run && run.bag && run.bag.length) {
      html += '<div class="trade-list">';
      run.bag.forEach(function (b, i) {
        html += '<div class="shop-item"><div class="si-info"><b>' + (b.shiny ? "✦ " : "") + b.name + '</b>'
          + '<small>$' + fmt(b.value) + ' · size ' + b.size + '</small></div>'
          + '<div class="si-buy"><button data-gift="' + i + '">Gift</button></div></div>';
      });
      html += '</div>';
    } else {
      html += '<p class="tiny">Catch some fish and come back here <b>before selling</b> to gift them.</p>';
    }
    html += '</div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    ov.querySelector('[data-close="shop"]').onclick = function () { lastGiftCode = null; closeOverlay("shop"); };

    var rb = ov.querySelector("#trade-receive");
    if (rb) rb.onclick = function () {
      var item = giftDecode(ov.querySelector("#trade-in").value);
      if (!item) { toast("That code isn't valid.", "bad"); return; }
      var firstEver = !state.discovered[item.fishId];
      var firstShiny = item.shiny && !state.shinyFound[item.fishId];
      state.discovered[item.fishId] = true;
      if (item.shiny) state.shinyFound[item.fishId] = true;
      state.counts[item.fishId] = (state.counts[item.fishId] || 0) + 1;
      state.money += item.value; state.stats.earned += item.value; state.stats.totalCaught++;
      saveGame();
      toast("Received " + (item.shiny ? "✦ " : "") + item.name + "! +$" + fmt(item.value)
        + (firstEver ? " · NEW!" : "") + (firstShiny ? " · ✦ first shiny!" : ""), "good", 2600);
      showTrade();
    };
    var cp = ov.querySelector("#gift-copy");
    if (cp) cp.onclick = function () {
      var ta = ov.querySelector("#gift-code");
      try { if (navigator.clipboard) navigator.clipboard.writeText(lastGiftCode); else { ta.select(); document.execCommand("copy"); } toast("Code copied!", "good", 1200); }
      catch (e) { ta.select(); toast("Select & copy the code above.", "good", 1600); }
    };
    ov.querySelectorAll("[data-gift]").forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute("data-gift"), item = run.bag[i];
        if (!item) return;
        var code = giftEncode(item);
        if (!code) { toast("Couldn't make a code.", "bad"); return; }
        run.bagUsed -= item.size; run.bag.splice(i, 1);
        lastGiftCode = code; lastGiftName = item.name;
        saveGame();
        showTrade();
      };
    });
  }

  // ----- Seeds & birds -----
  function seedPackPrice(def) { return Math.max(15, Math.round(def.value * 0.85)); }

  // in-water quick picker: scatter a seed for one of this area's birds
  function showSeedPicker() {
    var allC = D.LOCATIONS[run.area].allContent;
    var birds = D.BIRDS.map(function (id) { return D.FISH_BY_ID[id]; }).filter(function (d) { return allC || d.area === run.area; });
    var ov = document.createElement("div");
    ov.className = "overlay open"; ov.style.zIndex = 40;
    var h = '<div class="panel" style="max-width:380px"><h2>🌾 Scatter Seed</h2>'
      + '<p class="tiny">Birds of the matching seed will flutter down to you while you stay at the surface.</p><div class="trade-list">';
    birds.forEach(function (d) {
      var n = state.seeds[d.id] || 0;
      h += '<div class="shop-item"><div class="si-info"><b>' + d.name + '</b><small>' + n + ' seed' + (n === 1 ? '' : 's') + '</small></div>'
        + '<div class="si-buy"><button data-seed="' + d.id + '" ' + (n > 0 ? '' : 'disabled') + '>Scatter</button></div></div>';
    });
    h += '</div><button id="seed-close" class="big" style="width:100%;margin-top:8px">Close</button>'
      + '<p class="tiny">Buy seeds at the boat\'s Seed Shop.</p></div>';
    ov.innerHTML = h;
    document.body.appendChild(ov);
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.querySelector("#seed-close").onclick = close;
    ov.querySelectorAll("[data-seed]").forEach(function (b) {
      b.onclick = function () { useSeed(b.getAttribute("data-seed")); close(); };
    });
  }

  // boat Seed Shop — buy seeds for any bird
  function showSeedShop() {
    var ov = overlay("shop");
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>🌾 Seed Shop</h2>'
      + '<div class="money-line">💰 $' + fmt(state.money) + '</div>'
      + '<button class="close" data-close="shop">✕</button></div>'
      + '<p class="tiny">Each bird is drawn down by its own seed. Take seeds on a dive, surface, and scatter them. Birds count toward 100%!</p>';
    for (var areaId in D.LOCATIONS) {
      if (D.LOCATIONS[areaId].secret && !state.areas[areaId]) continue; // don't spoil hidden sites
      // only seed-buyable birds (secret / slingshot-only birds aren't sold here)
      var birds = D.BIRDS.map(function (id) { return D.FISH_BY_ID[id]; }).filter(function (d) { return d.area === areaId && !d.secret && d.seedCost > 0; });
      if (!birds.length) continue;
      html += '<h3>' + D.LOCATIONS[areaId].name + '</h3>';
      birds.forEach(function (d) {
        var price = seedPackPrice(d), n = state.seeds[d.id] || 0;
        var seen = !!state.discovered[d.id];   // don't spoil birds you haven't caught yet
        var nm = seen ? d.name : '<span class="unseen">??? </span>';
        var btod = d.night ? ' · 🌙 night' : (d.day ? ' · ☀️ day' : '');
        var info = seen ? (D.RARITY[d.rarity].name + ' bird' + btod + ' · sells for $' + fmt(d.value))
                        : ('A mystery bird' + (d.night ? ' 🌙 (night)' : '') + ' — scatter its seed to reveal it');
        html += '<div class="shop-item"><div class="si-info"><b>' + nm + '</b> <span class="lvl">×' + n + ' seeds</span>'
          + '<p>' + info + '</p></div>'
          + '<div class="si-buy"><button data-buyseed="' + d.id + '" ' + (state.money < price ? 'disabled' : '') + '>3 seeds — $' + fmt(price) + '</button></div></div>';
      });
    }
    html += '</div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    ov.querySelector('[data-close="shop"]').onclick = function () { closeOverlay("shop"); };
    ov.querySelectorAll("[data-buyseed]").forEach(function (b) {
      b.onclick = function () {
        var d = D.FISH_BY_ID[b.getAttribute("data-buyseed")], price = seedPackPrice(d);
        if (state.money < price) return;
        state.money -= price; state.seeds[d.id] = (state.seeds[d.id] || 0) + 3; saveGame();
        var seen = !!state.discovered[d.id];
        toast("Bought 3 " + (seen ? d.name : "mystery bird") + " seeds!", "good", 1400);
        showSeedShop();
        var o = document.getElementById("shop"); if (o) o.scrollTop = 0; // back to the top
      };
    });
  }

  // ----- Boss Gear viewer (toggle each boss-drop on/off) -----
  // metadata: item id -> { name, effect, toggle (can switch off), boss reward key }
  var BOSS_GEAR = [
    { id: "necklace",     name: "Multiplier Necklace", effect: "Every treasure you recover is worth DOUBLE.", reward: "necklace", toggle: true },
    { id: "jellystinger", name: "Jelly Stinger",       effect: "Nearby fish are shocked still — they stop fleeing your magnet.", reward: "stinger", toggle: true },
    { id: "megtooth",     name: "Meg Tooth",           effect: "Every boss takes ONE fewer harpoon to defeat.", reward: "megtooth", toggle: true },
    { id: "sonar",        name: "Sonar Radar",         effect: "Pings hot & cold as you near a sunken wreck.", reward: "sonar", toggle: true },
    { id: "rocfeather",   name: "Roc Feather",         effect: "Leap out of the water in any area to snatch birds — no seeds needed.", reward: "rocfeather", toggle: true },
    { id: "crabcrown",    name: "Spider Crab Crown",   effect: "Every sea creature you catch is worth DOUBLE.", reward: "crabcrown", toggle: true },
    { id: "kaijubreath",  name: "Kaiju Breath",        effect: "Tap 🔵 in a dive to fire a beam that vacuums up fish.", reward: "kaijubreath", toggle: false },
    { id: "serpenteye",   name: "Eye of the Serpent",  effect: "Golden coin chests wash up in every dive site.", reward: "serpenteye", toggle: false },
    { id: "nullzone",     name: "Null Zone",           effect: "Swim off the RIGHT edge of the world and reappear on the LEFT (and vice versa).", reward: "nullzone", toggle: true },
  ];
  function bossForReward(rk) {
    for (var i = 0; i < D.FISH.length; i++) if (D.FISH[i].reward === rk && (D.FISH[i].areaBoss || D.FISH[i].secretBoss)) return D.FISH[i];
    return null;
  }
  function showBossGear() {
    var ov = overlay("shop");
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>⚔️ Boss Gear</h2>'
      + '<button class="close" data-close="shop">✕</button></div>';
    html += '<p class="tiny">Relics dropped by the bosses you\'ve defeated. Toggle each one ON or OFF — some hidden sites only open when your boss gear is switched OFF.</p>';
    var owned = 0;
    BOSS_GEAR.forEach(function (g) {
      if (!state.items[g.id]) return;
      owned++;
      var on = itemOn(g.id);
      var boss = bossForReward(g.reward);
      var img = boss ? SPRITES.dataURL(SPRITES.archetypeForShape(boss.shape), { color: boss.color, accent: boss.accent, scale: 3 }) : null;
      html += '<div class="shop-item">'
        + '<div class="si-info" style="display:flex;align-items:center;gap:10px;">'
        + (img ? '<span class="bg-icon" style="background-image:url(' + img + ')"></span>' : '')
        + '<span><b>' + g.name + '</b>' + (boss ? ' <span class="tiny">— from ' + boss.name + '</span>' : '')
        + '<p>' + g.effect + '</p></span></div>'
        + '<div class="si-buy">'
        + (g.toggle
            ? '<button class="bosstoggle ' + (on ? 'on' : 'off') + '" data-toggleitem="' + g.id + '">' + (on ? '✅ ON' : '⬜ OFF') + '</button>'
            : '<span class="lvl">Always on</span>')
        + '</div></div>';
    });
    if (!owned) html += '<div class="shop-item"><div class="si-info"><b>No boss gear yet</b><p>Defeat area bosses and secret bosses to claim their relics — they\'ll appear here to toggle on and off.</p></div></div>';
    html += '</div>';
    ov.innerHTML = html; ov.classList.add("open");
    ov.querySelector('[data-close="shop"]').onclick = function () { closeOverlay("shop"); };
    ov.querySelectorAll("[data-toggleitem]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-toggleitem");
        if (!state.itemsOff) state.itemsOff = {};
        state.itemsOff[id] = !state.itemsOff[id];
        saveGame(); showBossGear();
      };
    });
  }

  // ----- Owned items -----
  function showInventory() {
    var ov = overlay("shop");
    function row(n, v) { return '<div class="stat-row"><span>' + n + '</span><b>' + v + '</b></div>'; }
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>🎒 Your Items</h2>'
      + '<button class="close" data-close="shop">✕</button></div><div class="stats-list">';
    html += row("🔱 Harpoons", state.harpoons);
    html += row("🥅 Fishing Net", state.upgrades.scoop > 0 ? "Lv " + state.upgrades.scoop : "— not owned");
    // boss gear: tap to toggle on/off (a couple of secret areas only open with it OFF)
    function bossRow(id, label) {
      if (!state.items[id]) return "";
      var on = itemOn(id);
      return '<div class="stat-row"><span>' + label + '</span>'
        + '<button class="mini-btn bosstoggle" data-toggleitem="' + id + '">' + (on ? "✅ ON" : "⬜ OFF") + '</button></div>';
    }
    var bossHtml = bossRow("necklace", "📿 Multiplier Necklace · treasures ×2")
      + bossRow("megtooth", "🦷 Meg Tooth · bosses −1 hit")
      + bossRow("jellystinger", "⚡ Jelly Stinger · fish stop fleeing")
      + bossRow("sonar", "📡 Sonar Radar · pings near wrecks")
      + bossRow("rocfeather", "🪶 Roc Feather · leap up to grab birds")
      + bossRow("crabcrown", "👑 Spider Crab Crown · creatures ×2");
    if (bossHtml) html += bossHtml;
    if (state.items.stopwatch) html += row("⏱️ Tide Stopwatch", "pick day or night");
    if (state.items.shinyPocket) html += row("✨ Shiny Pocket", "grab shinies when full");
    if (state.items.goggles) {
      html += row("🥽 Night-Vision Goggles", "see further");
      html += '<div class="stat-row"><span>🌙 Night vision · night = day</span>'
        + '<button class="mini-btn bosstoggle" data-nightvision="1">' + (state.nightVision ? "✅ ON" : "⬜ OFF") + '</button></div>';
    }
    if (state.items.torch) html += row("🔦 Torch", "beam of light");
    if (state.items.kaijubreath) html += row("🔵 Kaiju Breath", "beam vacuums fish");
    if (state.items.serpenteye) html += row("👁️ Eye of the Serpent", "coin chests everywhere");
    if (state.areas.pirate && !state.davyjonesCaught) html += row("☠️ Captain's Key", state.keyPieces + " / 4 pieces");
    if (!state.leatherbackCaught && (state.openseaClams || 0) > 0) html += row("🐢 Open Sea clams", (state.openseaClams || 0) + " / 15");
    if (state.items.divingbell) html += row("🛎️ Diving Bell", "1 air save / dive");
    if (hammerLevel() > 0) html += row("🔨 Sledgehammer", "Lv " + hammerLevel());
    if (shovelLevel() > 0) html += row("⛏️ Shovel", "Lv " + shovelLevel());
    if (slingShotsMax() > 0) html += row("🪃 Slingshot", slingShotsMax() + " shots/dive");
    var seedTotal = 0; for (var s in state.seeds) seedTotal += state.seeds[s];
    html += row("🌾 Bird seeds", seedTotal);
    html += row("🍀 Rarity Charms", "×" + state.charms.rarity);
    html += row("✦ Shiny Charms", "×" + state.charms.shiny);
    var ab = 0; for (var b in state.areaBossCaught) if (state.areaBossCaught[b]) ab++;
    html += row("⚔️ Area bosses beaten", ab + " / " + Object.keys(AREA_BOSS_BY_AREA).length);
    html += row("🦑 Kraken", state.krakenCaught ? (state.krakenShiny ? "✦ shiny!" : "defeated") : "at large");
    html += '</div>';
    // ----- View Upgrades: current level + value of every upgrade -----
    html += '<h3 style="margin:14px 0 6px">🔧 Upgrades</h3><div class="stats-list">';
    for (var uk in D.UPGRADES) {
      var u = D.UPGRADES[uk], lv = state.upgrades[uk], maxed = lv >= u.levels.length - 1;
      html += row(u.name, "Lv " + lv + "/" + (u.levels.length - 1) + (maxed ? " · MAX" : "") + " · " + fmtVal(u.levels[lv].value, u.unit));
    }
    html += '</div></div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    ov.querySelector('[data-close="shop"]').onclick = function () { closeOverlay("shop"); };
    ov.querySelectorAll("[data-toggleitem]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-toggleitem");
        if (!state.itemsOff) state.itemsOff = {};
        state.itemsOff[id] = !state.itemsOff[id];
        saveGame(); showInventory();
      };
    });
    var nvBtn = ov.querySelector("[data-nightvision]");
    if (nvBtn) nvBtn.onclick = function () { state.nightVision = !state.nightVision; saveGame(); showInventory(); };
  }

  // ----- Achievements panel -----
  function showAchievements() {
    if (!state.achievements) state.achievements = {};
    var ov = overlay("shop");
    var got = 0; for (var g = 0; g < ACHIEVEMENTS.length; g++) if (state.achievements[ACHIEVEMENTS[g].id]) got++;
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>🏆 Achievements</h2>'
      + '<div class="money-line">' + got + ' / ' + ACHIEVEMENTS.length + '</div>'
      + '<button class="close" data-close="shop">✕</button></div><div class="stats-list">';
    ACHIEVEMENTS.forEach(function (a) {
      var done = !!state.achievements[a.id];
      html += '<div class="shop-item"><div class="si-info"><b>' + (done ? '🏆 ' : '🔒 ') + a.name + '</b>'
        + '<p>' + a.desc + '</p></div>'
        + '<div class="si-buy">' + (done ? '<span class="lvl">✓</span>' : '<span class="tiny">—</span>') + '</div></div>';
    });
    html += '</div></div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    ov.querySelector('[data-close="shop"]').onclick = function () { closeOverlay("shop"); };
  }

  // ----- Treasure gallery -----
  function showTreasureGallery() {
    var ov = overlay("shop");
    var found = 0, total = D.TREASURES.length, worth = 0;
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>🏺 Treasure Gallery</h2>'
      + '<button class="close" data-close="shop">✕</button></div><div class="collection-scroll">';
    [["Shipwreck loot", false], ["✈ Plane-wreck loot (rare!)", true]].forEach(function (g) {
      html += '<h3>' + g[0] + '</h3><div class="coll-grid">';
      D.TREASURES.filter(function (t) { return !!t.plane === g[1]; }).forEach(function (t) {
        var n = state.treasures[t.id] || 0, got = n > 0;
        if (got) { found++; worth += n * t.value; }
        html += '<div class="coll-card ' + (got ? 'found' : 'missing') + ' r-' + t.rarity + '">'
          + '<div class="treasure-gem" style="background:' + (got ? t.color : '#16242f') + '"></div>'
          + '<div class="coll-name">' + (got ? t.name : '???') + '</div>'
          + '<div class="coll-meta">' + D.RARITY[t.rarity].name + (got ? ' · ×' + n : '') + '</div>'
          + '<div class="coll-meta">$' + fmt(t.value) + ' each</div></div>';
      });
      html += '</div>';
    });
    html += '</div><div class="coll-footer">Recovered <b>' + found + '/' + total + '</b> kinds · total pawned <b>$' + fmt(worth) + '</b></div></div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    ov.querySelector('[data-close="shop"]').onclick = function () { closeOverlay("shop"); };
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fmt(n) { return (n | 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function fmtVal(v, unit) {
    if (unit === "x") return v.toFixed(2) + "×";
    if (unit === "%O₂") return Math.round(v * 100) + "% O₂ use";
    if (unit === "px") return v === 0 ? "none" : Math.round(v) + "px";
    return v + " " + unit;
  }
  function mix(c1, c2, t) {
    t = clamp(t, 0, 1);
    var a = hex(c1), b = hex(c2);
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," + Math.round(a[1] + (b[1] - a[1]) * t) + "," + Math.round(a[2] + (b[2] - a[2]) * t) + ")";
  }
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function rgba(h, a) { var c = hex(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function shinyColor(base) {
    // shift hue toward a glittery alt palette
    var c = hex(base);
    var alt = [(c[0] + 140) % 256, (c[1] + 90) % 256, (c[2] + 200) % 256];
    return "rgb(" + alt[0] + "," + alt[1] + "," + alt[2] + ")";
  }

  // ---------------------------------------------------------------------
  //  Boot
  // ---------------------------------------------------------------------
  function boot() {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", function () { setTimeout(resize, 250); });
    setupTouch();
    // audio needs a user gesture to start — kick it off on the first tap/key
    if (window.AUDIO) {
      AUDIO.init(false);
      var firstGesture = function () {
        AUDIO.resume();
        if (state && state.settings) { AUDIO.setMuted(state.settings.muted); AUDIO.setMusicMuted(state.settings.musicMuted); AUDIO.setSfxMuted(state.settings.sfxMuted); }
        if (scene === "dive" && run) AUDIO.playArea(run.area, run.night);
        else AUDIO.playMenu(state && state.nextNight);
        window.removeEventListener("pointerdown", firstGesture);
        window.removeEventListener("keydown", firstGesture);
      };
      window.addEventListener("pointerdown", firstGesture);
      window.addEventListener("keydown", firstGesture);
    }
    // surface button (tap to board the boat — mobile friendly)
    var sh = document.getElementById("surface-hint");
    if (sh) sh.addEventListener("click", function () {
      if (scene === "dive" && run && run.diver.y <= 30) surface();
    });
    // instant return-to-surface button
    var rb = document.getElementById("btn-return");
    if (rb) rb.addEventListener("click", function () {
      if (scene === "dive" && run) { toast("Surfacing with your haul...", "good", 1200); surface(); }
    });
    // scatter-seed button (surface) → bird picker
    var sb = document.getElementById("btn-seed");
    if (sb) sb.addEventListener("click", function () { if (scene === "dive" && run) showSeedPicker(); });
    // harpoon throw button (boss fights)
    var hb = document.getElementById("btn-harpoon");
    if (hb) hb.addEventListener("click", function () { if (scene === "dive" && run) throwHarpoon(); });
    // deploy-net button (drop a trap net at your position)
    var tb = document.getElementById("btn-trap");
    if (tb) tb.addEventListener("click", function () {
      if (scene !== "dive" || !run || trapSize() <= 0) return;
      run.trap.active = true; run.trap.x = run.diver.x; run.trap.y = run.diver.y; run.trap.r = trapSize();
      toast("🪤 Net deployed! Anything that swims in is bagged.", "good", 1600);
    });
    // slingshot button (shoot a pebble to knock down birds)
    var slb = document.getElementById("btn-sling");
    if (slb) slb.addEventListener("click", function () { if (scene === "dive" && run) fireSling(); });
    // kaiju-breath button (beam that vacuums up fish)
    var brb = document.getElementById("btn-breath");
    if (brb) brb.addEventListener("click", function () { if (scene === "dive" && run) fireBreath(); });
    // storm-summoner button (lightning strike / open Olympus at the peak)
    var stb = document.getElementById("btn-storm");
    if (stb) stb.addEventListener("click", function () { if (scene === "dive" && run) summonStorm(); });
    // enter-secret-location button (dive straight into a known hidden site)
    var esb = document.getElementById("btn-enter-secret");
    if (esb) esb.addEventListener("click", function () { if (scene === "dive" && run && run.secretEdge) enterSecretArea(run.secretEdge); });
    // vent-air button (press & hold to drain oxygen)
    var vb = document.getElementById("btn-vent");
    if (vb) {
      var startVent = function (e) { if (e) e.preventDefault(); if (scene === "dive" && run) { run.venting = true; vb.classList.add("venting"); } };
      var stopVent = function () { if (run) run.venting = false; vb.classList.remove("venting"); };
      vb.addEventListener("pointerdown", startVent);
      vb.addEventListener("pointerup", stopVent);
      vb.addEventListener("pointerleave", stopVent);
      vb.addEventListener("pointercancel", stopVent);
      vb.addEventListener("touchstart", startVent, { passive: false });
      vb.addEventListener("touchend", stopVent);
    }
    // aquarium controls
    bind("aqua-prev", function () { aquaNav(-1); });
    bind("aqua-next", function () { aquaNav(1); });
    bind("aqua-daynight", function () {
      if (!aqua) return;
      aqua.night = !aqua.night;
      document.getElementById("aqua-daynight").textContent = aqua.night ? "☀️ Day" : "🌙 Night";
      if (window.AUDIO) AUDIO.playArea(aqua.area, aqua.night);
    });
    bind("aqua-focus", aquaToggleFocus);
    bind("aqua-close", exitAquarium);
    bind("aqua-list", showCollection);
    bind("aqua-swim", function () {
      if (!aqua) return;
      aqua.diverActive = !aqua.diverActive;
      aqua.diver.x = W / 2; aqua.diver.y = H / 2;
      document.getElementById("aqua-swim").textContent = aqua.diverActive ? "🛑 Stop" : "🤿 Swim";
    });
    // diver's hut controls
    // cozy UI click sounds
    document.addEventListener("click", function (e) {
      var el = e.target;
      if (el && el.tagName === "BUTTON" && window.AUDIO) {
        var k = (el.classList.contains("primary") || el.getAttribute("data-buyup") || el.getAttribute("data-buycharm") || el.getAttribute("data-buyhint") || el.getAttribute("data-suit")) ? "buy" : "click";
        AUDIO.ui(k);
      }
    });
    requestAnimationFrame(loop);
    showStart();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // expose a tiny debug handle (also used by the headless smoke test)
  window.DEEPSEA = {
    state: function () { return state; },
    run: function () { return run; },
    _test: {
      newGame: function () { activeSlot = 1; state = defaultState(); },
      unlockAll: function () { for (var a in state.areas) state.areas[a] = true; },
      dive: function (area) { startDive(area); },
      frame: function (dt) { if (scene === "dive" && run) { update(dt || 0.016); render(); } },
      spawnKraken: function () { spawnBoss("kraken", false); },
      spawnBlobfish: function () { spawnBoss("blobfish", true); },
      summonBird: function () {
        if (!run) return;
        var d = D.FISH.filter(function (f) { return f.bird && f.area === run.area; })[0];
        if (d) run.birds.push({ def: d, x: run.diver.x + 100, y: -180, vx: 10, phase: 0, shiny: true, mode: "descend" });
      },
      throwHarpoon: function () { state.harpoons = 10; throwHarpoon(); },
      spawnAreaBoss: function () { if (!run) return; var f = D.FISH.filter(function (x) { return x.areaBoss && x.area === run.area; })[0]; if (f) spawnAreaBoss(f.id); },
      aquarium: function () { showAquarium(); },
      aquaFrame: function (dt) { if (scene === "aquarium" && aqua) { updateAquarium(dt || 0.05); renderAquarium(); } },
      aquaNav: function (d) { aquaNav(d); },
      aquaFocus: function () { aquaToggleFocus(); },
      aquaExit: function () { exitAquarium(); },
      aquaInfo: function () { return aqua ? { tanks: aqua.areaList.length, idx: aqua.idx, area: aqua.area, focus: aqua.focus, entities: aqua.entities.length } : null; },
      scene: function () { return scene; },
      discoverAll: function () { D.FISH.forEach(function (f) { state.discovered[f.id] = true; if (f.areaBoss) state.areaBossCaught[f.id] = true; else if (f.secretBoss) state[f.id + "Caught"] = true; }); state.krakenCaught = true; state.blobfishCaught = true; },
      forceShinyNext: function () { state.charms.shiny = 999; },
      fishKinds: function () { var o = { fish: 0, bird: 0, creature: 0, boss: 0 }; if (run) run.fish.forEach(function (f) { if (f.isBoss) o.boss++; else if (f.def.bird) o.bird++; else if (f.def.creature) o.creature++; else o.fish++; }); return o; },
    },
  };
})();
