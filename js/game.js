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
      upgrades: { oxygen: 0, fins: 0, net: 0, reel: 0, inventory: 0, suit: 0, light: 0, scoop: 0 },
      charms: { rarity: 0, shiny: 0 },
      areas: { coral: true, river: false, kelp: false, trench: false, sanctuary: false },
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
      settings: { muted: false },
      diver: { skin: 2, suit: "#1f7d9c", suitAccent: "#ffd24a", look: "short" },
      diverUnlocks: {}, // premium suit colour id -> true
      items: {},        // one-time items, e.g. shinyPocket
      seeds: {},        // birdId -> seed count
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
  function reelMul() { return up("reel"); }
  function inventoryCap() { return up("inventory"); }
  function oxygenMul() { return up("suit"); }
  function lightRadius() { return up("light"); }
  function netSize() { return up("scoop"); }

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
      diver: { x: loc.worldWidth / 2, y: 14, vx: 0, vy: 0, face: 1 },
      oxygen: maxOxygen(),
      maxO: maxOxygen(),
      bag: carryBag,      // [{fishId, shiny, size, value}]
      bagTreasure: carryTreasure,
      bagUsed: carryUsed,
      fish: [],
      creatures: [],
      birds: [],
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
    };
    placeWrecks(loc);
    generateDecor(loc);
    // initial population
    for (var i = 0; i < 14; i++) spawnFish(true);
    for (var ci = 0; ci < 4; ci++) spawnCreature(true);
    state.stats.dives++;
  }

  function spawnCreature(initial) {
    var loc = D.LOCATIONS[run.area];
    if (run.creatures.length > 7) return;
    var pool = D.CREATURES.map(function (id) { return D.FISH_BY_ID[id]; })
      .filter(function (c) { return c.area === run.area; });
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
    });
  }

  // per-area decoration recipe: seabed flora/rock + a couple of background ridges
  var DECOR = {
    coral:     { plants: ["coral", "coral", "anemone"], plantColors: ["#ff6f91", "#ff9f43", "#5ad1c8", "#c77dff"], rock: "#3a5a6b", floor: "#2a6e7a" },
    river:     { plants: ["kelp", "kelp", "rock"], plantColors: ["#3f8f4d", "#6cae4a", "#2f7f5f"], rock: "#5a6a4a", floor: "#6a7a52" },
    kelp:      { plants: ["kelp", "kelp", "coral"], plantColors: ["#3fa34d", "#5cc46a", "#2f8f6f"], rock: "#244a3a", floor: "#1c3f33" },
    trench:    { plants: ["vent", "rock", "rock"], plantColors: ["#6b4a8f", "#8a5a32", "#3a4a55"], rock: "#1a232c", floor: "#0a1119" },
    sanctuary: { plants: ["crystal", "crystal", "coral"], plantColors: ["#a07bff", "#7affd0", "#ff8be0", "#9fd8ff"], rock: "#2a1e55", floor: "#1a0f3a" },
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
    var bigType = { coral: "bigcoral", river: "bigkelp", kelp: "bigkelp", trench: "spire", sanctuary: "bigcrystal" }[loc.id] || "bigkelp";
    var bcount = Math.round(loc.worldWidth / 190);
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

  function drawBgFlora() {
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
    var n = loc.maxDepth > 700 ? 3 : 2;
    for (var i = 0; i < n; i++) {
      run.wrecks.push({
        x: 200 + Math.random() * (loc.worldWidth - 400),
        y: loc.maxDepth * (0.45 + 0.5 * (i / n)) + Math.random() * 40,
        w: 180 + Math.random() * 120,
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
    for (var i = 0; i < D.FISH.length; i++) {
      var f = D.FISH[i];
      if (f.area !== areaId) continue;
      if (f.rarity !== rarity) continue;
      if (f.isKraken || f.isBlob || f.creature || f.bird) continue;
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
    return true;
  }

  function spawnFish(initial) {
    var loc = D.LOCATIONS[run.area];
    if (run.fish.length > 26) return;

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

    // Secrets / mythics are extra rare even once eligible
    if (def.secret && Math.random() > 0.6) return; // hint owned → show up readily

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
      isKraken: !isBlob, isBlob: isBlob,
    });
    run.bossPresent = true;
    if (window.AUDIO) { AUDIO.rumble(); AUDIO.playBoss(); }
    toast("The water TREMBLES... something colossal rises from the abyss!", "epic", 5000);
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
  // TRUE 100% — every catalogued fish AND every secret (later: birds + creatures).
  function trueComplete() {
    for (var i = 0; i < D.COMPLETION_FISH.length; i++) if (!state.discovered[D.COMPLETION_FISH[i]]) return false;
    for (var j = 0; j < D.FISH.length; j++) { var f = D.FISH[j]; if (f.secret && !state.discovered[f.id]) return false; }
    return true;
  }
  // What (if anything) should rise in the Trench right now? Blobfish first —
  // so you still meet it even if you hit 100% before triggering the fake-out.
  function bossToSummon() {
    if (!state.blobfishCaught && requiredMet()) return "blobfish";
    if (!state.krakenCaught && trueComplete()) return "kraken";
    return null;
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
    if (scene !== "dive") return;
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
    if (scene === "dive" && run) {
      update(dt);
      render();
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
    if (len > 0.001) {
      diver.vx = (ax / len) * sp * mag;
      diver.vy = (ay / len) * sp * mag;
      diver.x = clamp(diver.x + diver.vx * dt, 12, loc.worldWidth - 12);
      diver.y = clamp(diver.y + diver.vy * dt, 0, loc.maxDepth * PXPM);
      if (Math.abs(ax) > 0.05) diver.face = ax > 0 ? 1 : -1;
    } else {
      diver.vx = diver.vy = 0;
    }

    var depthM = diver.y / PXPM;
    run.diveDepthReached = Math.max(run.diveDepthReached, depthM);
    if (depthM > state.stats.maxDepth) state.stats.maxDepth = Math.floor(depthM);

    // --- oxygen ---
    if (diver.y > 26) {
      var drain = (1 + depthFactor(diver.y, loc) * 0.6) * oxygenMul();
      run.oxygen -= drain * dt;
      if (run.oxygen <= 0) { driftHome(); return; }
    } else {
      run.oxygen = run.maxO; // refill at surface
    }

    // --- bubbles from diver ---
    if (Math.random() < 0.4 && diver.y > 20) {
      run.bubbles.push({ x: diver.x + (Math.random() - 0.5) * 8, y: diver.y - 6, r: 1 + Math.random() * 3, vy: 40 + Math.random() * 30, life: 2 });
    }

    // --- spawn fish over time ---
    run.spawnTimer -= dt;
    if (run.spawnTimer <= 0) {
      run.spawnTimer = 0.5 + Math.random() * 0.8;
      spawnFish(false);
    }
    // boss summon (blobfish fake-out, or the true Kraken at 100%)
    if (!run.bossPresent && run.area === "trench" && depthM > 400) {
      var boss = bossToSummon();
      if (boss === "kraken") spawnBoss("kraken", false);
      else if (boss === "blobfish") spawnBoss("blobfish", true);
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
        if (dist < 15 + f.size * 2) { catchFish(f); continue; }
      }
      if (!grabbing) {
        var speedScale = f.fleeing > 0 ? 2.4 : 1;
        f.x += f.vx * dt * speedScale;
      }
      f.y = f.baseY + Math.sin(f.phase) * 10;
      if (f.fleeing > 0) f.fleeing -= dt;
      if (f.pulled > 0) f.pulled -= dt;

      // wrap / despawn off-world
      if (f.x < -120 || f.x > loc.worldWidth + 120) {
        if (!f.isKraken) { run.fish.splice(i, 1); continue; }
        else { f.vx *= -1; }
      }
    }
    var cr = mRange;

    // --- sea-floor creatures (caught with a Net; magnet ignores them) ---
    run.creatureTimer -= dt;
    if (run.creatureTimer <= 0) { run.creatureTimer = 1.5 + Math.random() * 2.5; spawnCreature(false); }
    var netR = netSize();              // Fishing Net upgrade size (0 = none)
    var hasNet = netR > 0;
    for (var ci = run.creatures.length - 1; ci >= 0; ci--) {
      var c = run.creatures[ci];
      c.phase += dt * 5;
      c.x += c.vx * dt;
      c.y = run.floorY - 8 + Math.sin(c.phase) * 1.2;
      if (c.x < -60 || c.x > loc.worldWidth + 60) { run.creatures.splice(ci, 1); continue; }
      var cdx = diver.x - c.x, cdy = diver.y - c.y, cdist = Math.hypot(cdx, cdy);
      if (hasNet) {
        if (cdist < netR && catchCreature(c)) { startNetFx(c, netR); run.creatures.splice(ci, 1); }
      } else if (cdist < 60 && run.time - (run.netHint || -99) > 12) {
        run.netHint = run.time;
        toast("Buy a Fishing Net (Shop → Gear) to scoop up sea creatures!", "bad", 2400);
      }
    }
    // advance net-swipe effects
    for (var ni = run.netFx.length - 1; ni >= 0; ni--) { run.netFx[ni].life -= dt; if (run.netFx[ni].life <= 0) run.netFx.splice(ni, 1); }

    // --- birds (in the sky; lured down with seeds while at the surface) ---
    var atSurface = diver.y <= 70;
    for (var bi = run.birds.length - 1; bi >= 0; bi--) {
      var b = run.birds[bi];
      b.phase += dt * 9; // wing flap
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
    var skyReveal = diver.y < 80 ? -290 : -150;
    cam.x = Math.round(clamp(diver.x - W / 2, 0, Math.max(0, loc.worldWidth - W)));
    cam.y = Math.round(clamp(diver.y - H / 2, skyReveal, Math.max(0, loc.maxDepth * PXPM + 120 - H)));

    updateHud();
  }

  function maybeSpawnTreasure() {
    if (run.wrecks.length === 0) return;
    var wreck = run.wrecks[(Math.random() * run.wrecks.length) | 0];
    // weighted treasure by depth
    var df = depthFactor(wreck.y, D.LOCATIONS[run.area]);
    var pool = D.TREASURES.filter(function (tt) {
      var ro = D.RARITY[tt.rarity].order;
      return Math.random() < (0.3 + df * 0.9) || ro <= 1;
    });
    if (pool.length === 0) pool = D.TREASURES;
    var def = pool[(Math.random() * pool.length) | 0];
    run.treasures.push({
      def: def, x: wreck.x + (Math.random() - 0.5) * wreck.w, y: wreck.y - 10 - Math.random() * 30, phase: Math.random() * 6,
    });
  }

  // ---------------------------------------------------------------------
  //  Catch / collect
  // ---------------------------------------------------------------------
  function catchFish(f) {
    var def = f.def;
    // Shiny Pocket lets shinies through even when the hold is full
    var pocketed = f.shiny && state.items.shinyPocket;
    if (run.bagUsed + def.size > inventoryCap() && !pocketed) {
      if (run.time - (run.fullHint || -99) > 6) { run.fullHint = run.time; toast("Cargo hold full! Surface to sell.", "bad", 1400); }
      f.fleeing = 1.0; // push it away so the magnet doesn't keep grabbing
      return;
    }
    // remove from world
    var idx = run.fish.indexOf(f);
    if (idx >= 0) run.fish.splice(idx, 1);

    var val = def.value * (f.shiny ? D.SHINY_VALUE_MULT : 1);
    run.bag.push({ fishId: def.id, shiny: f.shiny, size: def.size, value: val, name: def.name, color: def.color });
    run.bagUsed += def.size;

    var firstEver = !state.discovered[def.id];
    var firstShiny = f.shiny && !state.shinyFound[def.id];
    state.discovered[def.id] = true;
    if (f.shiny) state.shinyFound[def.id] = true;
    state.counts[def.id] = (state.counts[def.id] || 0) + 1;
    state.stats.totalCaught++;

    run.floaters.push({ x: f.x, y: f.y, text: (f.shiny ? "✦ " : "") + def.name, color: f.shiny ? "#ffe66d" : "#dff", life: 1.4 });

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
      if (run.time - (run.fullHint || -99) > 6) { run.fullHint = run.time; toast("Cargo hold full! Surface to sell.", "bad", 1400); }
      return false;
    }
    var val = def.value * (c.shiny ? D.SHINY_VALUE_MULT : 1);
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

  function useSeed(birdId) {
    if (!run || run.diver.y > 26) { toast("Scatter seed at the surface!", "bad"); return; }
    var def = D.FISH_BY_ID[birdId];
    if (def.area !== run.area) { toast(def.name + " doesn't visit here.", "bad"); return; }
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
    var val = def.value * (b.shiny ? D.SHINY_VALUE_MULT : 1);
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
    run.bagTreasure.push({ id: def.id, value: def.value, name: def.name, color: def.color });
    state.treasures[def.id] = (state.treasures[def.id] || 0) + 1;
    run.floaters.push({ x: tr.x, y: tr.y, text: def.name, color: def.color, life: 1.5 });
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
    saveGame();
    scene = "boat";
    showBoat();
    if (window.AUDIO) AUDIO.playMenu();
  }

  // ---------------------------------------------------------------------
  //  Rendering
  // ---------------------------------------------------------------------
  function render() {
    var loc = D.LOCATIONS[run.area];
    ctx.clearRect(0, 0, W, H);

    var darkness = depthFactor(run.diver.y, loc);

    // --- background, lighting & scenery ---
    drawBackground(loc);
    drawSky(loc);
    drawBirds();
    drawHills(loc);
    drawBgFlora();
    drawSeabed(loc);

    // --- scene objects ---
    for (var i = 0; i < run.wrecks.length; i++) drawWreck(run.wrecks[i]);
    drawCreatures();
    for (var t = 0; t < run.treasures.length; t++) drawTreasure(run.treasures[t]);
    for (var f = 0; f < run.fish.length; f++) drawFishEntity(run.fish[f]);
    drawBubbles();
    drawDiver();
    drawNetFx();

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

    if (loc.starfield) drawStarfield();

    // god rays from the surface (fade with depth)
    var rayStrength = 1 - clamp(cam.y / (520), 0, 1);
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

    // drifting plankton motes
    ctx.save();
    ctx.fillStyle = loc.starfield ? "rgba(200,180,255,0.5)" : "rgba(220,240,255,0.35)";
    for (var p = 0; p < 40; p++) {
      var px = ((p * 211 - cam.x * 0.6 + run.time * 8) % W + W) % W;
      var py = ((p * 97 + Math.sin(run.time * 0.5 + p) * 12 - cam.y * 0.6) % H + H) % H;
      var s = p % 4 === 0 ? 2 : 1;
      ctx.fillRect(px | 0, py | 0, s, s);
    }
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
  function drawSky(loc) {
    var surfaceY = -cam.y;            // screen y of the waterline (world y = 0)
    if (surfaceY <= 0) return;        // fully underwater — no sky in view
    var sky = loc.sky || { top: "#9fd8ff", bottom: "#e6f7ff" };
    var g = ctx.createLinearGradient(0, 0, 0, surfaceY);
    g.addColorStop(0, sky.top); g.addColorStop(1, sky.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, surfaceY);

    if (sky.night) {
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
    for (var x = 0; x < W; x += 6) {
      var wy = surfaceY + Math.sin((x + cam.x) * 0.05 + run.time * 1.6) * 2;
      ctx.fillRect(x, wy - 1, 6, 2);
    }
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
    var gog = state.items.goggles ? 130 : 0; // goggles widen your view in the dark
    // warm dive-light glow that grows useful as it gets darker
    if (darkness > 0.2) {
      drawGlow(dx, dy, 130 + lightRadius() + gog, "#ffe7a8", Math.min(0.5, darkness * 0.5));
    }
    // depth darkness vignette with a clear hole around the diver
    if (darkness > 0.22) {
      var lr = 150 + lightRadius() + gog;
      var rg = ctx.createRadialGradient(dx, dy, lr * 0.35, dx, dy, lr * 1.15);
      var a = Math.min(0.86, (darkness - 0.22) * 1.5);
      rg.addColorStop(0, "rgba(0,0,8,0)");
      rg.addColorStop(1, "rgba(0,0,10," + a + ")");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
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
    var x = wk.x - cam.x, y = wk.y - cam.y;
    if (x < -wk.w || x > W + wk.w || y < -120 || y > H + 80) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(20,30,30,0.9)";
    ctx.strokeStyle = "rgba(60,90,80,0.9)";
    ctx.lineWidth = 4;
    // hull
    ctx.beginPath();
    ctx.moveTo(-wk.w / 2, 0);
    ctx.quadraticCurveTo(-wk.w / 2, 50, 0, 56);
    ctx.quadraticCurveTo(wk.w / 2, 50, wk.w / 2, 0);
    ctx.lineTo(wk.w / 2 - 20, -8);
    ctx.lineTo(-wk.w / 2 + 20, -8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // broken mast
    ctx.strokeStyle = "rgba(40,60,55,0.9)";
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-30, -64); ctx.stroke();
    ctx.restore();
  }

  function drawTreasure(tr) {
    var x = (tr.x - cam.x) | 0, y = (tr.y - cam.y + Math.sin(tr.phase) * 3) | 0;
    var pulse = 0.5 + 0.5 * Math.sin(tr.phase * 2);
    drawGlow(x, y, 14 + pulse * 8, tr.def.color, 0.55);
    // chunky pixel gem
    ctx.fillStyle = tr.def.color;
    ctx.fillRect(x - 2, y - 6, 4, 2);
    ctx.fillRect(x - 4, y - 4, 8, 2);
    ctx.fillRect(x - 6, y - 2, 12, 4);
    ctx.fillRect(x - 4, y + 2, 8, 2);
    ctx.fillRect(x - 2, y + 4, 4, 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(x - 3, y - 2, 2, 2);
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
    drawDiverPixel(ctx, x, y, 3, run.diver.face < 0 ? -1 : 1, state.diver, kick);
  }

  // ----- diver customization palettes -----
  var SKIN_TONES = ["#f4c9a3", "#e8b088", "#d39a6e", "#b87a4f", "#8d5524", "#5a3318"];
  var HAIR_COLORS = ["#2b1d12", "#5a3a1a", "#a85e2e", "#caa33a", "#d8d8da", "#3a3f55", "#8a3b6b", "#2f6f5e"];
  var SUITS = [
    { id: "teal",   color: "#1f7d9c", accent: "#ffd24a", cost: 0 },
    { id: "navy",   color: "#26407a", accent: "#e08a3a", cost: 0 },
    { id: "red",    color: "#b03a3a", accent: "#f3e6c8", cost: 0 },
    { id: "green",  color: "#2f7d4a", accent: "#ffd24a", cost: 0 },
    { id: "purple", color: "#6a3aa0", accent: "#7affd0", cost: 0 },
    { id: "pink",   color: "#c0508f", accent: "#ffe14d", cost: 250 },
    { id: "orange", color: "#d8742e", accent: "#2a5a7a", cost: 250 },
    { id: "gold",   color: "#c79a2e", accent: "#3a2a10", cost: 1500 },
    { id: "neon",   color: "#1fd6a0", accent: "#ff5bd0", cost: 1500 },
    { id: "void",   color: "#2a2350", accent: "#9f7bff", cost: 3000 },
  ];
  function suitAccentFor(color) { return mix(color, "#ffffff", 0.42); }
  var LOOKS = [
    { id: "short", name: "Short" },
    { id: "long",  name: "Long" },
    { id: "bun",   name: "Bun" },
    { id: "buzz",  name: "Buzz" },
  ];
  // Themed wetsuits: one per location (unlock as you reach the area) ...
  var LOCATION_SUITS = [
    { name: "Coral",     area: "coral",     color: "#2bb3c9", always: true },
    { name: "River",     area: "river",     color: "#4a9e6a", always: true },
    { name: "Kelp",      area: "kelp",      color: "#2f9e8f" },
    { name: "Trench",    area: "trench",    color: "#1a5fa0" },
    { name: "Starlight", area: "sanctuary", color: "#7a5cff" },
  ];
  // ... and one per secret fish (unlock by catching that secret)
  var SECRET_SUITS = D.FISH.filter(function (f) { return f.secret; })
    .map(function (f) { return { id: f.id, name: f.name, color: f.color }; });

  // Draw a clearly-human side-view diver with kicking legs/fins.
  // ctx2: target context · (cx,cy): screen centre · SC: pixel scale ·
  // face: 1 right / -1 left · opts: state.diver · kick: animation phase
  function drawDiverPixel(ctx2, cx, cy, SC, face, opts, kick) {
    opts = opts || {};
    var skin = SKIN_TONES[opts.skin != null ? opts.skin : 2] || SKIN_TONES[2];
    var suit = opts.suit || "#1f7d9c";
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
    // torso (wetsuit) — chunky & cute, two-tone
    R(-4, -2, 9, 5, suit);
    R(-4, -2, 9, 1, mix(suit, "#fff", 0.3));    // top highlight
    R(-4, 0, 9, 1, accent);                     // two-tone accent stripe
    R(-4, 2, 9, 1, "#2c2620");                  // weight belt
    R(-4, -2, 1, 5, mix(suit, "#fff", 0.14));   // back rim light
    // forward arm + glove
    R(3, 2, 5, 2, suit); R(3, 3, 5, 1, suitD);
    R(6, 2, 1, 2, accent);                      // cuff (accent)
    R(7, 2, 2, 2, skin);                        // hand
    // BIG cute head
    R(5, -6, 5, 7, skin);
    R(5, -6, 5, 1, mix(skin, "#fff", 0.35));    // forehead highlight
    R(5, 1, 5, 1, mix(skin, "#000", 0.22));     // chin shadow
    R(10, -2, 1, 1, mix(skin, "#ff9a9a", 0.55)); // rosy cheek :)
    // hair by look
    if (look === "short") { R(4, -7, 6, 2, hair); R(4, -6, 1, 4, hair); }
    else if (look === "long") { R(4, -7, 6, 2, hair); R(3, -6, 2, 8, hair); }
    else if (look === "bun") { R(4, -7, 6, 2, hair); R(3, -8, 2, 2, hair); }
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
    R(-8 - finLen, -2 + legTop, finLen, 1, accent);   // fin trim (two-tone)
    if (up.net > 0) { R(5, 3, 3, 1, "#9aa6b0"); R(8, 2, 1, 1, "#5cd0ff"); }            // wrist magnet
    if (up.scoop > 0) { R(-6, -6, 1, 5, "#caa15a"); R(-8, -8, 5, 3, mix(suit, "#fff", 0.5)); R(-8, -8, 5, 1, "#caa15a"); } // net on the back
    if (up.suit >= D.UPGRADES.suit.levels.length - 1) { R(-4, 0, 9, 1, "#ffd24a"); }  // maxed suit gold trim
    if (items.shinyPocket) { R(-1, 2, 2, 2, "#ffd24a"); R(0, 1, 1, 1, "#fff7c0"); }   // shiny pouch
    if (up.light > 0) { R(6, -8, 2, 2, "#2a2f36"); R(7, -8, 1, 1, "#fff3b0"); }       // headlamp
    if (items.goggles) {                                                              // wide-view goggles
      R(6, -4, 6, 1, "#0e2a36"); R(6, -3, 6, 4, mix(maskGlass, "#fff", 0.15));
      R(6, 1, 6, 1, "#0e2a36"); R(8, -2, 2, 2, "#0b2a3a"); R(9, -2, 1, 1, "#ffffff");
    }
  }

  function fishTargetH(f) { return f.isKraken ? 160 : 22 + f.size * 6; }

  function fishGlow(f) {
    if (f.isKraken) return { color: f.shiny ? "#fff2a0" : "#ff5b7f", alpha: 0.55 };
    if (f.shiny) return { color: "#fff0a0", alpha: 0.38 };
    var d = f.def;
    var biolum = d.glow || d.shape === "jelly" || d.shape === "angler" || d.shape === "lantern"
      || (d.area === "trench" && D.RARITY[d.rarity].order >= 2) || d.area === "sanctuary";
    if (biolum) return { color: d.color, alpha: 0.26 };
    return null;
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
  function drawBirds() {
    for (var i = 0; i < run.birds.length; i++) {
      var b = run.birds[i];
      var x = b.x - cam.x, y = b.y - cam.y;
      if (x < -90 || x > W + 90 || y < -90 || y > H + 90) continue;
      var th = 14 + b.def.size * 4;
      var SC = Math.max(2, Math.round(th / 7));
      var flip = run.diver.x < b.x;
      if (b.shiny) drawGlow(x, y, th * 1.1, "#fff0a0", 0.4);
      drawBirdPixel(ctx, x, y, SC, b.def.color, b.phase, flip);
      if (b.shiny && Math.sin(run.time * 3 + b.phase) > 0.6) { ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fillRect((x + th * 0.3) | 0, (y - th * 0.3) | 0, 2, 2); }
      ctx.fillStyle = b.shiny ? "#ffe66d" : D.RARITY[b.def.rarity].color;
      ctx.font = "11px 'Segoe UI', sans-serif"; ctx.textAlign = "center";
      ctx.fillText((b.shiny ? "✦" : "") + b.def.name, x, y - th - 4);
    }
  }

  // how much each body type wiggles when swimming
  var WIGGLE = { eel: 0.55, whale: 0.4, kraken: 0.3, jelly: 0, squid: 0.5, octopus: 0.4, seahorse: 0.2, turtle: 0.5, ray: 0.7 };

  // Fish drawing — pixel sprites with a swim wiggle, glow & sparkle
  function drawFishEntity(f) {
    var x = f.x - cam.x, y = f.y - cam.y;
    var th = fishTargetH(f);
    if (x < -200 || x > W + 200 || y < -200 || y > H + 200) return;
    var arch = SPRITES.archetypeForShape(f.def.shape);
    var flip = f.vx < 0; // sprites face right by default

    var glow = fishGlow(f);
    if (glow) drawGlow(x, y, th * 0.95, glow.color, glow.alpha);

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
  function updateHud() {
    var hud = document.getElementById("hud");
    if (!hud) return;
    var depthM = Math.floor(run.diver.y / PXPM);
    var oxPct = clamp(run.oxygen / run.maxO, 0, 1);
    document.getElementById("ox-fill").style.width = (oxPct * 100) + "%";
    document.getElementById("ox-fill").style.background = oxPct < 0.25 ? "#e74c3c" : (oxPct < 0.5 ? "#f39c12" : "#3fd0ff");
    document.getElementById("ox-text").textContent = Math.ceil(run.oxygen) + "s";
    document.getElementById("depth-text").textContent = depthM + "m";
    document.getElementById("money-text").textContent = "$" + fmt(state.money);
    document.getElementById("cargo-text").textContent = run.bagUsed + " / " + inventoryCap();
    document.getElementById("area-name").textContent = D.LOCATIONS[run.area].name;
    var atTop = run.diver.y <= 30;
    document.getElementById("surface-hint").style.display = atTop ? "block" : "none";
    document.getElementById("btn-seed").style.display = atTop ? "block" : "none";
  }

  // ---------------------------------------------------------------------
  //  Toasts
  // ---------------------------------------------------------------------
  function toast(msg, kind, dur) {
    var host = document.getElementById("toasts");
    if (!host) return;
    // never let toasts blanket the screen: drop the oldest if too many stack up
    while (host.children && host.children.length >= 4) host.removeChild(host.firstChild);
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
    if (window.AUDIO) AUDIO.playMenu(); // carries menu ambience once audio is awake
    var saves = listSaves();
    var html = '<div class="panel start-panel">';
    html += '<h1>🌊 Deep Sea Diver 🐙</h1>';
    html += '<p class="sub">Dive deep. Catch everything. Awaken the Kraken.</p>';
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
    if (!s.stats) s.stats = base.stats;
    return s;
  }

  function enterBoat() {
    closeOverlay("modal");
    scene = "boat";
    if (window.AUDIO) { AUDIO.setMuted(state.settings.muted); AUDIO.playMenu(); }
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

    if (run && (run.bag.length || run.bagTreasure.length)) {
      html += '<div class="sell-box"><b>Today\'s haul:</b> ' + run.bag.length + ' fish, '
        + run.bagTreasure.length + ' treasures — worth <b>$' + fmt(saleVal) + '</b>'
        + '<button id="btn-sell" class="primary">Sell All ($' + fmt(saleVal) + ')</button></div>';
    }

    html += '<div class="boat-grid">';
    html += '<button id="btn-dive" class="big primary">🤿 Dive</button>';
    html += '<button id="btn-shop" class="big">🛒 Shop</button>';
    html += '<button id="btn-collection" class="big">📖 Collection</button>';
    html += '<button id="btn-diver" class="big">🤿 Customise Diver</button>';
    html += '<button id="btn-area" class="big">🗺️ Change Area</button>';
    html += '<button id="btn-stats" class="big">📊 Stats</button>';
    html += '<button id="btn-seedshop" class="big">🌾 Seed Shop</button>';
    html += '<button id="btn-trade" class="big">🎁 Gift Fish</button>';
    html += '<button id="btn-sound" class="big">' + (state.settings.muted ? '🔇 Sound: Off' : '🔊 Sound: On') + '</button>';
    html += '<button id="btn-menu" class="big">💾 Save &amp; Menu</button>';
    html += '</div>';

    html += '<div class="area-current">Current dive site: <b>' + D.LOCATIONS[state.lastArea].name + '</b></div>';

    if (!state.krakenCaught) {
      if (trueComplete()) {
        html += '<div class="kraken-alert">🦑 100% complete!! The <b>TRUE Kraken</b> now stirs in the deepest <b>Sunken Trench</b>. Go and face it.</div>';
      } else if (requiredMet() && !state.blobfishCaught) {
        html += '<div class="kraken-alert">🦑 You\'ve caught every <b>required</b> fish... surely the Kraken awaits in the deep <b>Sunken Trench</b>? Dive and find out.</div>';
      } else if (state.blobfishCaught) {
        html += '<div class="kraken-alert">🫠 The real Kraken needs <b>100% of everything</b> caught. You\'re at ' + Object.keys(state.discovered).length + '... keep going!</div>';
      }
    }
    html += '</div>';
    ov.innerHTML = html;
    ov.classList.add("open");

    bind("btn-dive", function () { startDive(state.lastArea); });
    bind("btn-shop", showShop);
    bind("btn-collection", showCollection);
    bind("btn-diver", function () { diverPreviewSuit = null; showDiverShop(); });
    bind("btn-area", showAreas);
    bind("btn-stats", showStats);
    bind("btn-seedshop", showSeedShop);
    bind("btn-trade", function () { lastGiftCode = null; showTrade(); });
    bind("btn-rename", function () {
      askText("Name your captain", state.username || "Diver", function (name) {
        if (name == null) return;
        state.username = name; saveGame(); showBoat();
      });
    });
    bind("btn-sound", function () {
      state.settings.muted = !state.settings.muted;
      if (window.AUDIO) AUDIO.setMuted(state.settings.muted);
      saveGame();
      showBoat();
    });
    bind("btn-menu", function () { saveGame(); toast("Game saved.", "good", 1200); showStart(); });
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
    closeOverlay("modal");
    sellHud(true);
    scene = "dive";
    newRun(areaId);
    state.lastArea = areaId;
    if (window.AUDIO) AUDIO.playArea(areaId);
  }

  function sellHud(show) {
    document.getElementById("hud").style.display = show ? "flex" : "none";
    document.getElementById("surface-hint").style.display = "none";
    document.getElementById("btn-seed").style.display = "none";
    document.getElementById("btn-return").style.display = show ? "block" : "none";
  }

  // ----- Shop -----
  function showShop() {
    var ov = overlay("shop");
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>🛒 Helpful Shop</h2>'
      + '<div class="money-line">💰 $' + fmt(state.money) + '</div>'
      + '<button class="close" data-close="shop">✕</button></div>';

    html += '<div class="shop-tabs">'
      + '<button class="tab active" data-tab="gear">Gear</button>'
      + '<button class="tab" data-tab="charms">Charms</button>'
      + '<button class="tab" data-tab="hints">Secret Hints</button>'
      + '</div>';

    // GEAR
    html += '<div class="tab-body" data-body="gear">';
    for (var key in D.UPGRADES) {
      var u = D.UPGRADES[key];
      var lvl = state.upgrades[key];
      var maxed = lvl >= u.levels.length - 1;
      var cur = u.levels[lvl].value;
      var next = maxed ? null : u.levels[lvl + 1];
      html += '<div class="shop-item">'
        + '<div class="si-info"><b>' + u.name + '</b> <span class="lvl">Lv ' + lvl + (maxed ? ' · MAX' : '') + '</span>'
        + '<p>' + u.desc + '</p>'
        + '<small>Now: ' + fmtVal(cur, u.unit) + (next ? ' → ' + fmtVal(next.value, u.unit) : '') + '</small></div>'
        + '<div class="si-buy">'
        + (maxed ? '<span class="maxed">MAX</span>'
          : '<button data-buyup="' + key + '" ' + (state.money < next.cost ? 'disabled' : '') + '>$' + fmt(next.cost) + '</button>')
        + '</div></div>';
    }
    html += '</div>';

    // CHARMS
    html += '<div class="tab-body hidden" data-body="charms">';
    for (var ck in D.CHARMS) {
      var c = D.CHARMS[ck];
      var owned = state.charms[ck];
      var atMax = owned >= c.maxStack;
      var effect = ck === "rarity"
        ? "+" + Math.round(owned * c.perStack * 100) + "% rarity tilt"
        : "+" + (owned * c.perStack * 100).toFixed(1) + "% shiny chance";
      html += '<div class="shop-item">'
        + '<div class="si-info"><b>' + c.name + '</b> <span class="lvl">×' + owned + (atMax ? ' · MAX' : '') + '</span>'
        + '<p>' + c.desc + '</p>'
        + '<small>Current effect: ' + effect + '</small></div>'
        + '<div class="si-buy">'
        + (atMax ? '<span class="maxed">MAX</span>'
          : '<button data-buycharm="' + ck + '" ' + (state.money < c.cost ? 'disabled' : '') + '>$' + fmt(c.cost) + '</button>')
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
    html += '<div class="tab-body hidden" data-body="hints">';
    html += '<p class="tiny">Every area hides a <b>secret fish</b>. Buy its hint here, then meet the condition while diving.</p>';
    D.FISH.filter(function (f) { return f.secret && D.LOCATIONS[f.area]; }).forEach(function (f) {
      var owned = state.hints[f.id];
      var found = state.discovered[f.id];
      var cost = 1000;
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

    // tab switching
    ov.querySelectorAll(".tab").forEach(function (t) {
      t.onclick = function () {
        ov.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
        ov.querySelectorAll(".tab-body").forEach(function (x) { x.classList.add("hidden"); });
        t.classList.add("active");
        ov.querySelector('[data-body="' + t.getAttribute("data-tab") + '"]').classList.remove("hidden");
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
    ov.querySelectorAll("[data-buyhint]").forEach(function (b) {
      b.onclick = function () { buyHint(b.getAttribute("data-buyhint")); };
    });
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

  function buyCharm(key) {
    var c = D.CHARMS[key];
    if (state.charms[key] >= c.maxStack) return;
    if (state.money < c.cost) return;
    state.money -= c.cost;
    state.charms[key]++;
    saveGame();
    toast(c.name + " acquired (×" + state.charms[key] + ")!", "good", 1400);
    showShop();
  }

  function buyHint(id) {
    var cost = 1000;
    if (state.money < cost || state.hints[id]) return;
    state.money -= cost;
    state.hints[id] = true;
    saveGame();
    var f = D.FISH_BY_ID[id];
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

  // ----- Collection -----
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
      var fishes = byArea[areaId] || [];
      if (!fishes.length) continue;
      html += '<h3>' + D.LOCATIONS[areaId].name + '</h3><div class="coll-grid">';
      fishes.forEach(function (f) {
        var special = f.isKraken || f.isBlob;
        var found, sh, hidden;
        if (f.isKraken) { found = state.krakenCaught; sh = state.krakenShiny; hidden = !found; }
        else if (f.isBlob) { found = state.blobfishCaught; sh = state.blobfishShiny; hidden = !found; }
        else { found = !!state.discovered[f.id]; sh = !!state.shinyFound[f.id]; hidden = f.secret && !found && !state.hints[f.id]; }
        if (!special) { totalAll++; if (found) totalFound++; if (sh) shinyFound++; }
        var showShiny = collShinyView && sh && found;
        html += '<div class="coll-card ' + (found ? 'found' : 'missing') + ' r-' + f.rarity + (REQ[f.id] ? ' required' : '') + '">';
        if (REQ[f.id]) html += '<div class="req-badge" title="Required to summon the Kraken">🗝️</div>';
        html += '<div class="coll-sprite" style="background-image:url(' + collSprite(f, found, showShiny, hidden) + ')"></div>';
        var nm = hidden ? "???" : (f.isBlob ? "Blobfish 🫠" : f.name);
        html += '<div class="coll-name">' + nm + (sh ? ' <span class="shiny-tag">✦</span>' : '') + '</div>';
        html += '<div class="coll-meta">' + D.RARITY[f.rarity].name
          + (found && !special ? ' · ' + (state.counts[f.id] || 0) + ' caught' : '')
          + (f.creature ? ' · Creature' : '') + (f.secret ? ' · Secret' : '') + '</div>';
        if (!special) html += '<div class="coll-meta">Size ' + f.size + ' · $' + fmt(f.value) + '</div>';
        else html += '<div class="coll-meta">' + (found ? 'Caught!' : 'Needs 100%') + '</div>';
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
    if (tg) tg.onclick = function () { collShinyView = !collShinyView; showCollection(); };
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
    var opts = { skin: state.diver.skin, hair: state.diver.hair, look: state.diver.look, suit: suitCol, suitAccent: suitAcc };
    drawDiverPixel(p, c.width / 2, c.height / 2, 6, 1, opts, t * 7);
  }

  // unified list of all wetsuits with names + ownership/buy/lock metadata
  function buildSuitList() {
    var list = [];
    SUITS.forEach(function (s) {
      var owned = s.cost === 0 || state.diverUnlocks[s.id];
      list.push({ key: "s_" + s.id, name: cap(s.id), color: s.color, accent: s.accent, owned: owned,
        buy: (!owned && s.cost > 0) ? { id: s.id, cost: s.cost } : null, group: "Wetsuits" });
    });
    LOCATION_SUITS.forEach(function (s) {
      var unlocked = s.always || state.areas[s.area];
      list.push({ key: "l_" + s.area, name: s.name, color: s.color, accent: suitAccentFor(s.color), owned: unlocked,
        previewColor: s.color, lockReason: unlocked ? null : ("Reach " + (D.LOCATIONS[s.area] ? D.LOCATIONS[s.area].name : s.name)), group: "Location suits" });
    });
    SECRET_SUITS.forEach(function (s) {
      var unlocked = !!state.discovered[s.id];
      list.push({ key: "x_" + s.id, name: unlocked ? s.name : "???", color: unlocked ? s.color : "#16242f", accent: suitAccentFor(s.color), owned: unlocked,
        lockReason: unlocked ? null : "Catch its secret fish", group: "Secret suits" });
    });
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
    else html += '<button class="primary" data-suitequip="' + pv.color + '" data-suitaccent="' + (pv.accent || "") + '">Equip</button>';
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
    ["Wetsuits", "Location suits", "Secret suits"].forEach(function (grp) {
      html += '<h3>' + grp + '</h3><div class="suit-grid">';
      diverSuitList.filter(function (s) { return s.group === grp; }).forEach(function (s) {
        var sel = state.diver.suit === s.color && s.owned;
        html += '<button class="suit-cell ' + (sel ? 'sel' : '') + (s.owned ? '' : ' locked') + '" data-suitpick="' + s.key + '">'
          + '<span class="suit-chip" style="background:' + s.color + '">' + (s.owned ? '' : '<span class="lock">🔒</span>') + '</span>'
          + '<span class="suit-label">' + s.name + '</span></button>';
      });
      html += '</div>';
    });
    html += '<p class="tiny">Location suits unlock as you reach each area. Secret suits unlock when you catch that area\'s secret fish.</p>';
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
        saveGame(); toast("Wetsuit equipped!", "good", 1200); showDiverShop();
      };
    });
    ov.querySelectorAll("[data-suitbuy]").forEach(function (b) {
      b.onclick = function () {
        var s = SUITS.filter(function (x) { return x.id === b.getAttribute("data-suitbuy"); })[0];
        if (!s || state.money < s.cost || state.diverUnlocks[s.id]) return;
        state.money -= s.cost; state.diverUnlocks[s.id] = true; state.diver.suit = s.color; state.diver.suitAccent = s.accent;
        saveGame(); toast("Unlocked & equipped the " + cap(s.id) + " wetsuit!", "good", 1800);
        diverPreviewSuit = null; showDiverShop();
      };
    });
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
      html += '<div class="area-card ' + (unlocked ? '' : 'locked') + (id === "sanctuary" ? ' sanctuary' : '') + '">'
        + '<div class="area-info"><b>' + loc.name + '</b>'
        + '<p>' + loc.blurb + '</p>'
        + '<small>Max depth ' + loc.maxDepth + 'm' + (loc.shinyBonus ? ' · ✦ Shiny haven' : '') + '</small></div>'
        + '<div class="area-act">'
        + (unlocked
            ? '<button data-go="' + id + '">Dive Here</button>'
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
    bind("btn-continue", function () { closeOverlay("modal"); scene = "boat"; if (window.AUDIO) AUDIO.playMenu(); showBoat(); });
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
    html += '<button id="btn-continue" class="big primary">Hmph. Back to it.</button>';
    html += '</div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    bind("btn-continue", function () { closeOverlay("modal"); scene = "boat"; if (window.AUDIO) AUDIO.playMenu(); showBoat(); });
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
    var birds = D.BIRDS.map(function (id) { return D.FISH_BY_ID[id]; }).filter(function (d) { return d.area === run.area; });
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
      var birds = D.BIRDS.map(function (id) { return D.FISH_BY_ID[id]; }).filter(function (d) { return d.area === areaId; });
      if (!birds.length) continue;
      html += '<h3>' + D.LOCATIONS[areaId].name + '</h3>';
      birds.forEach(function (d) {
        var price = seedPackPrice(d), n = state.seeds[d.id] || 0;
        html += '<div class="shop-item"><div class="si-info"><b>' + d.name + '</b> <span class="lvl">×' + n + ' seeds</span>'
          + '<p>' + D.RARITY[d.rarity].name + ' bird · sells for $' + fmt(d.value) + '</p></div>'
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
        toast("Bought 3 " + d.name + " seeds!", "good", 1400); showSeedShop();
      };
    });
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
        if (state && state.settings) AUDIO.setMuted(state.settings.muted);
        if (scene === "dive" && run) AUDIO.playArea(run.area);
        else AUDIO.playMenu();
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
      forceShinyNext: function () { state.charms.shiny = 999; },
    },
  };
})();
