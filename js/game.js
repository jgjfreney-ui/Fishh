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
      money: 0,
      upgrades: { oxygen: 0, fins: 0, net: 0, reel: 0, inventory: 0, suit: 0, light: 0 },
      charms: { rarity: 0, shiny: 0 },
      areas: { coral: true, kelp: false, trench: false, sanctuary: false },
      hints: {},          // fishId -> true (purchased hint)
      discovered: {},     // fishId -> true (caught at least once)
      shinyFound: {},     // fishId -> true
      counts: {},         // fishId -> total caught
      treasures: {},      // treasureId -> count
      krakenCaught: false,
      krakenShiny: false,
      stats: { maxDepth: 0, totalCaught: 0, earned: 0, dives: 0 },
      lastArea: "coral",
    };
  }

  function listSaves() {
    var out = [];
    for (var i = 1; i <= 3; i++) {
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
      treasures: [],
      wrecks: [],
      bubbles: [],
      floaters: [],       // floating "+$" text etc
      target: null,       // current reel target id
      reel: 0,
      spawnTimer: 0,
      treasureTimer: 4,
      time: 0,
      surfaced: false,
      diveDepthReached: 0,
    };
    placeWrecks(loc);
    // initial population
    for (var i = 0; i < 14; i++) spawnFish(true);
    state.stats.dives++;
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
      if (f.isKraken) continue;
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
    if (def.secret && Math.random() > 0.12) return;

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

  function spawnKraken() {
    var loc = D.LOCATIONS[run.area];
    var def = D.FISH_BY_ID.kraken;
    var shiny = Math.random() < shinyChance(run.area);
    run.fish.push({
      uid: "kraken",
      def: def,
      x: loc.worldWidth / 2,
      y: loc.maxDepth * PXPM - 60,
      baseY: loc.maxDepth * PXPM - 60,
      vx: 20,
      phase: 0,
      shiny: shiny,
      size: def.size,
      fleeing: 0,
      isKraken: true,
    });
    run.krakenPresent = true;
    toast("The water trembles... THE KRAKEN has surfaced from the depths!", "epic", 5000);
  }

  function krakenReady() {
    if (state.krakenCaught) return false;
    for (var i = 0; i < D.COMPLETION_FISH.length; i++) {
      if (!state.discovered[D.COMPLETION_FISH[i]]) return false;
    }
    return true;
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
      if (run.oxygen <= 0) { blackout(); return; }
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
    // kraken summon
    if (!run.krakenPresent && run.area === "trench" && krakenReady() && depthM > 400) {
      spawnKraken();
    }

    // --- update fish ---
    var cr = catchRadius();
    var nearest = null, nearestD = 1e9;
    for (var i = run.fish.length - 1; i >= 0; i--) {
      var f = run.fish[i];
      f.phase += dt * 2;
      var speedScale = f.fleeing > 0 ? 2.4 : 1;
      f.x += f.vx * dt * speedScale;
      f.y = f.baseY + Math.sin(f.phase) * 10;
      if (f.fleeing > 0) f.fleeing -= dt;

      // wrap / despawn off-world
      if (f.x < -120 || f.x > loc.worldWidth + 120) {
        if (!f.isKraken) { run.fish.splice(i, 1); continue; }
        else { f.vx *= -1; }
      }

      var dx = f.x - diver.x, dy = f.y - diver.y;
      var dist = Math.hypot(dx, dy);
      if (dist < nearestD && dist < cr + f.size * 4) { nearestD = dist; nearest = f; }
    }

    // --- reeling / catching ---
    if (nearest) {
      if (run.target !== nearest.uid) { run.target = nearest.uid; run.reel = 0; }
      var rspeed = reelMul() / (0.5 + nearest.size * 0.28);
      run.reel += rspeed * dt;
      // big fish try to flee a bit
      if (nearest.size >= 4 && Math.random() < 0.01) nearest.fleeing = 0.6;
      if (run.reel >= 1) {
        catchFish(nearest);
        run.target = null; run.reel = 0;
      }
    } else {
      run.target = null;
      run.reel = Math.max(0, run.reel - dt * 0.8);
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

    // camera
    cam.x = clamp(diver.x - W / 2, 0, Math.max(0, loc.worldWidth - W));
    cam.y = clamp(diver.y - H / 2, 0, Math.max(0, loc.maxDepth * PXPM + 120 - H));

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
    if (run.bagUsed + def.size > inventoryCap()) {
      toast("Cargo hold full! Surface to sell.", "bad", 1400);
      // remove from world anyway? no — leave it, just block
      run.target = null; run.reel = 0;
      // push it away so it isn't instantly re-targeted
      f.fleeing = 1.0;
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

    if (def.isKraken) {
      catchKraken(f.shiny);
      return;
    }
    if (firstEver) toast("NEW! You caught a " + def.name + (def.secret ? " (Secret!)" : "") + "!", def.secret ? "epic" : "good", 2600);
    else if (firstShiny) toast("✦ SHINY " + def.name + "! ✦", "shiny", 2600);

    saveGame();
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
  //  Surface / blackout
  // ---------------------------------------------------------------------
  function blackout() {
    toast("Out of oxygen! You blacked out and dropped your catch...", "bad", 3200);
    // lose unsold fish & treasure
    run.bag = []; run.bagTreasure = []; run.bagUsed = 0;
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
  }

  // ---------------------------------------------------------------------
  //  Rendering
  // ---------------------------------------------------------------------
  function render() {
    var loc = D.LOCATIONS[run.area];
    ctx.clearRect(0, 0, W, H);

    // water gradient by depth band visible
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    var topd = depthFactor(cam.y, loc);
    var botd = depthFactor(cam.y + H, loc);
    grad.addColorStop(0, mix(loc.topColor, loc.deepColor, topd));
    grad.addColorStop(1, mix(loc.topColor, loc.deepColor, botd));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // starfield for sanctuary
    if (loc.starfield) drawStarfield();

    // surface line / boat
    if (cam.y < 60) {
      var sy = 16 - cam.y;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(0, 0, W, Math.max(0, sy));
      // boat
      drawBoat(loc.worldWidth / 2 - cam.x, 14 - cam.y);
    }

    // wrecks
    for (var i = 0; i < run.wrecks.length; i++) drawWreck(run.wrecks[i]);

    // light vignette in the deep
    var darkness = depthFactor(run.diver.y, loc);

    // treasures
    for (var t = 0; t < run.treasures.length; t++) drawTreasure(run.treasures[t]);

    // fish
    for (var f = 0; f < run.fish.length; f++) drawFishEntity(run.fish[f]);

    // bubbles
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (var b = 0; b < run.bubbles.length; b++) {
      var bb = run.bubbles[b];
      ctx.beginPath(); ctx.arc(bb.x - cam.x, bb.y - cam.y, bb.r, 0, 7); ctx.fill();
    }

    // diver
    drawDiver();

    // reel indicator
    if (run.target && run.reel > 0.02) drawReel();

    // floaters
    for (var fl = 0; fl < run.floaters.length; fl++) {
      var ff = run.floaters[fl];
      ctx.globalAlpha = clamp(ff.life, 0, 1);
      ctx.fillStyle = ff.color;
      ctx.font = "bold 14px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ff.text, ff.x - cam.x, ff.y - cam.y);
      ctx.globalAlpha = 1;
    }

    // darkness overlay in deep water (dive light cuts a hole)
    if (darkness > 0.25) {
      var dx = run.diver.x - cam.x, dy = run.diver.y - cam.y;
      var lr = 150 + lightRadius();
      var rg = ctx.createRadialGradient(dx, dy, lr * 0.3, dx, dy, lr);
      var a = Math.min(0.82, (darkness - 0.25) * 1.4);
      rg.addColorStop(0, "rgba(0,0,10,0)");
      rg.addColorStop(1, "rgba(0,0,12," + a + ")");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }

    // touch joystick
    if (joy.active) drawJoystick();
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
    var x = tr.x - cam.x, y = tr.y - cam.y + Math.sin(tr.phase) * 3;
    ctx.save();
    ctx.translate(x, y);
    var glow = 0.5 + 0.5 * Math.sin(tr.phase * 2);
    ctx.shadowColor = tr.def.color; ctx.shadowBlur = 8 + glow * 10;
    ctx.fillStyle = tr.def.color;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath(); ctx.arc(-2, -2, 2, 0, 7); ctx.fill();
    ctx.restore();
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
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(run.diver.face, 1);
    // tank
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(-10, -8, 7, 16);
    // body
    ctx.fillStyle = "#1f6f8b";
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 9, 0, 0, 7); ctx.fill();
    // head/mask
    ctx.fillStyle = "#e8f6ff";
    ctx.beginPath(); ctx.arc(8, -2, 6, 0, 7); ctx.fill();
    ctx.fillStyle = "#0b3d5c";
    ctx.beginPath(); ctx.arc(9, -2, 3.5, 0, 7); ctx.fill();
    // fin
    ctx.fillStyle = "#16505e";
    ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(-20, -8); ctx.lineTo(-16, 0); ctx.closePath(); ctx.fill();
    ctx.restore();

    // catch radius ring (subtle)
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.arc(x, y, catchRadius(), 0, 7); ctx.stroke();
  }

  // Fish drawing — varied by shape
  function drawFishEntity(f) {
    var x = f.x - cam.x, y = f.y - cam.y;
    if (x < -120 || x > W + 120 || y < -120 || y > H + 120) return;
    var dir = f.vx >= 0 ? 1 : -1;
    var r = 8 + f.size * 3.2;
    var col = f.shiny ? shinyColor(f.def.color) : f.def.color;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    if (f.shiny) { ctx.shadowColor = col; ctx.shadowBlur = 14; }
    ctx.fillStyle = col;
    var s = f.def.shape;

    if (s === "fish" || s === "lantern" || s === "angler") {
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r - r * 0.7, -r * 0.5); ctx.lineTo(-r - r * 0.7, r * 0.5); ctx.closePath(); ctx.fill();
      if (s === "lantern" || s === "angler") {
        ctx.fillStyle = "#fdfd8a";
        ctx.beginPath(); ctx.arc(r * 0.9, -r * 0.7, 3, 0, 7); ctx.fill();
      }
      eye(r * 0.5, -r * 0.15, r * 0.16);
    } else if (s === "round") {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(-r * 1.4, -r * 0.5); ctx.lineTo(-r * 1.4, r * 0.5); ctx.closePath(); ctx.fill();
      eye(r * 0.4, -r * 0.1, r * 0.15);
    } else if (s === "shark" || s === "hammer" || s === "sword") {
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.4, r * 0.55, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * 1.4, 0); ctx.lineTo(-r * 2, -r * 0.8); ctx.lineTo(-r * 1.6, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -r * 0.5); ctx.lineTo(r * 0.3, -r * 1.3); ctx.lineTo(r * 0.5, -r * 0.5); ctx.closePath(); ctx.fill();
      if (s === "sword") { ctx.fillRect(r * 1.3, -2, r * 0.9, 4); }
      if (s === "hammer") { ctx.fillRect(r * 1.2, -r * 0.7, 5, r * 1.4); }
      eye(r * 1.0, -r * 0.15, r * 0.13);
    } else if (s === "whale") {
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.7, r * 0.85, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * 1.7, 0); ctx.lineTo(-r * 2.4, -r); ctx.lineTo(-r * 2.4, r); ctx.closePath(); ctx.fill();
      eye(r * 1.2, -r * 0.2, r * 0.12);
    } else if (s === "turtle") {
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#3a6b46"; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.7, r * 0.55, 0, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(r, -r * 0.2, r * 0.3, 0, 7); ctx.fill();
      eye(r * 1.05, -r * 0.25, r * 0.1);
    } else if (s === "ray") {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-r * 1.6, -r, -r * 1.8, 0); ctx.quadraticCurveTo(-r * 1.6, r, 0, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.2, 0, r * 0.9, r * 0.5, 0, 0, 7); ctx.fill();
      ctx.fillRect(-r * 1.8, -1.5, -r, 3);
    } else if (s === "eel") {
      ctx.beginPath();
      for (var i = -1; i <= 1; i += 0.1) {
        var px = i * r * 1.8, py = Math.sin(i * 4 + f.phase) * r * 0.35;
        if (i === -1) ctx.moveTo(px, py - 4); else ctx.lineTo(px, py - 4);
      }
      for (var j = 1; j >= -1; j -= 0.1) {
        var px2 = j * r * 1.8, py2 = Math.sin(j * 4 + f.phase) * r * 0.35;
        ctx.lineTo(px2, py2 + 4);
      }
      ctx.closePath(); ctx.fill();
      eye(r * 1.5, -4, r * 0.12);
    } else if (s === "squid" || s === "octopus") {
      ctx.beginPath(); ctx.ellipse(0, -r * 0.3, r * 0.8, r, 0, 0, 7); ctx.fill();
      for (var ti = -3; ti <= 3; ti++) {
        ctx.beginPath();
        ctx.moveTo(ti * 3, r * 0.5);
        ctx.quadraticCurveTo(ti * 4, r * 1.3 + Math.sin(f.phase + ti) * 4, ti * 5, r * 1.7);
        ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
      }
      ctx.fillStyle = "#fff"; eye(-r * 0.25, -r * 0.4, r * 0.18); eye(r * 0.25, -r * 0.4, r * 0.18);
    } else if (s === "jelly") {
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, Math.PI, 0); ctx.fill();
      for (var ji = -2; ji <= 2; ji++) {
        ctx.beginPath(); ctx.moveTo(ji * 4, 0);
        ctx.quadraticCurveTo(ji * 4 + Math.sin(f.phase + ji) * 3, r, ji * 4, r * 1.4);
        ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (s === "seahorse") {
      ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 0.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, r * 0.4, r * 0.4, r * 0.7, 0, 0, 7); ctx.fill();
      eye(r * 0.2, -r * 0.4, r * 0.1);
    } else if (s === "otter") {
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * 0.6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(r, -r * 0.3, r * 0.45, 0, 7); ctx.fill();
      eye(r * 1.1, -r * 0.4, r * 0.1);
    } else if (s === "kraken") {
      ctx.shadowColor = col; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.ellipse(0, -r * 0.4, r * 1.1, r * 1.3, 0, 0, 7); ctx.fill();
      for (var ki = -4; ki <= 4; ki++) {
        ctx.beginPath();
        ctx.moveTo(ki * 5, r * 0.7);
        ctx.quadraticCurveTo(ki * 8 + Math.sin(f.phase * 1.5 + ki) * 14, r * 2 + 20, ki * 10, r * 3);
        ctx.lineWidth = 6; ctx.strokeStyle = col; ctx.stroke();
      }
      ctx.fillStyle = f.shiny ? "#fff7a0" : "#ffd24a";
      eye(-r * 0.4, -r * 0.5, r * 0.3); eye(r * 0.4, -r * 0.5, r * 0.3);
    } else {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // name label for rare+ when close
    var distToDiver = Math.hypot(f.x - run.diver.x, f.y - run.diver.y);
    if ((D.RARITY[f.def.rarity].order >= 2 || f.shiny) && distToDiver < 220) {
      ctx.fillStyle = f.shiny ? "#ffe66d" : D.RARITY[f.def.rarity].color;
      ctx.font = "11px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((f.shiny ? "✦" : "") + f.def.name, x, y - r - 8);
    }

    function eye(ex, ey, er) {
      ctx.save();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, er, 0, 7); ctx.fill();
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(ex + er * 0.3, ey, er * 0.5, 0, 7); ctx.fill();
      ctx.restore();
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
    var hint = document.getElementById("surface-hint");
    hint.style.display = run.diver.y <= 30 ? "block" : "none";
  }

  // ---------------------------------------------------------------------
  //  Toasts
  // ---------------------------------------------------------------------
  function toast(msg, kind, dur) {
    var host = document.getElementById("toasts");
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
          + '<div class="slot-main"><b>Slot ' + s.slot + '</b>'
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
      b.onclick = function () { activeSlot = +b.getAttribute("data-new"); state = defaultState(); saveGame(); enterBoat(); };
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
    html += '<button id="btn-area" class="big">🗺️ Change Area</button>';
    html += '<button id="btn-stats" class="big">📊 Stats</button>';
    html += '<button id="btn-menu" class="big">💾 Save &amp; Menu</button>';
    html += '</div>';

    html += '<div class="area-current">Current dive site: <b>' + D.LOCATIONS[state.lastArea].name + '</b></div>';

    if (krakenReady() && !state.krakenCaught) {
      html += '<div class="kraken-alert">🦑 The catalogue is complete... something <b>colossal</b> now lurks in the deepest reach of the <b>Sunken Trench</b>. Dive there.</div>';
    }
    html += '</div>';
    ov.innerHTML = html;
    ov.classList.add("open");

    bind("btn-dive", function () { startDive(state.lastArea); });
    bind("btn-shop", showShop);
    bind("btn-collection", showCollection);
    bind("btn-area", showAreas);
    bind("btn-stats", showStats);
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
  }

  function sellHud(show) {
    document.getElementById("hud").style.display = show ? "flex" : "none";
    document.getElementById("surface-hint").style.display = "none";
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
    html += '<p class="tiny">Base shiny chance is ' + (D.BASE_SHINY_CHANCE * 100).toFixed(1)
      + '%. The Starlight Sanctuary adds a huge bonus on top. A shiny Kraken unlocks a secret ending...</p>';
    html += '</div>';

    // HINTS
    html += '<div class="tab-body hidden" data-body="hints">';
    html += '<p class="tiny">Every area hides a <b>secret fish</b>. Buy its hint here, then meet the condition while diving.</p>';
    D.FISH.filter(function (f) { return f.secret; }).forEach(function (f) {
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

  // ----- Collection -----
  function showCollection() {
    var ov = overlay("shop");
    var byArea = {};
    D.FISH.forEach(function (f) {
      if (f.isKraken) return;
      (byArea[f.area] = byArea[f.area] || []).push(f);
    });
    var totalFound = 0, totalAll = 0, shinyFound = 0;
    var html = '<div class="panel shop-panel"><div class="panel-head"><h2>📖 Collection</h2>'
      + '<button class="close" data-close="shop">✕</button></div>';
    html += '<div class="collection-scroll">';

    for (var areaId in D.LOCATIONS) {
      var fishes = byArea[areaId] || [];
      html += '<h3>' + D.LOCATIONS[areaId].name + '</h3><div class="coll-grid">';
      fishes.forEach(function (f) {
        totalAll++;
        var found = !!state.discovered[f.id];
        if (found) totalFound++;
        var sh = !!state.shinyFound[f.id];
        if (sh) shinyFound++;
        var hidden = f.secret && !found && !state.hints[f.id];
        html += '<div class="coll-card ' + (found ? 'found' : 'missing') + ' r-' + f.rarity + '">';
        html += '<div class="coll-sprite" style="background:' + (found ? f.color : '#1a2733') + '"></div>';
        html += '<div class="coll-name">' + (hidden ? "???" : f.name) + (sh ? ' <span class="shiny-tag">✦</span>' : '') + '</div>';
        html += '<div class="coll-meta">' + D.RARITY[f.rarity].name
          + (found ? ' · ' + (state.counts[f.id] || 0) + ' caught' : '')
          + (f.secret ? ' · Secret' : '') + '</div>';
        html += '<div class="coll-meta">Size ' + f.size + ' · $' + fmt(f.value) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    // kraken card
    var k = D.FISH_BY_ID.kraken;
    html += '<h3>The Legend</h3><div class="coll-grid">';
    html += '<div class="coll-card ' + (state.krakenCaught ? 'found' : 'missing') + ' r-mythic">'
      + '<div class="coll-sprite" style="background:' + (state.krakenCaught ? k.color : '#1a2733') + '"></div>'
      + '<div class="coll-name">' + (state.krakenCaught ? "The Kraken" : "???") + (state.krakenShiny ? ' <span class="shiny-tag">✦</span>' : '') + '</div>'
      + '<div class="coll-meta">' + (state.krakenCaught ? "Vanquished" : "Catch every other fish to summon it") + '</div></div>';
    html += '</div>';

    html += '</div>';
    html += '<div class="coll-footer">Discovered <b>' + totalFound + '/' + totalAll + '</b> fish · Shinies <b>' + shinyFound + '</b> ✦</div>';
    html += '</div>';
    ov.innerHTML = html;
    ov.classList.add("open");
    ov.querySelector('[data-close="shop"]').onclick = function () { closeOverlay("shop"); };
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
    bind("btn-continue", function () { closeOverlay("modal"); scene = "boat"; showBoat(); });
    saveGame();
  }

  // ---------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------
  function bind(id, fn) { var el = document.getElementById(id); if (el) el.onclick = fn; }
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
    // surface button (tap to board the boat — mobile friendly)
    var sh = document.getElementById("surface-hint");
    if (sh) sh.addEventListener("click", function () {
      if (scene === "dive" && run && run.diver.y <= 30) surface();
    });
    requestAnimationFrame(loop);
    showStart();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // expose a tiny debug handle
  window.DEEPSEA = { state: function () { return state; }, run: function () { return run; } };
})();
