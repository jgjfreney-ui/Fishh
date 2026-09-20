#!/usr/bin/env node
'use strict';

const fs = require('fs');
const file = 'js/game.js';
let src = fs.readFileSync(file, 'utf8');

if (src.includes('RESTORATION-PASS-1')) {
  console.log('Restoration patch already applied.');
  process.exit(0);
}

function exact(oldText, newText, label) {
  if (!src.includes(oldText)) throw new Error(`Could not find patch target: ${label}`);
  src = src.replace(oldText, newText);
  console.log(`patched: ${label}`);
}

function regex(re, replacement, label) {
  if (!re.test(src)) throw new Error(`Could not find patch target: ${label}`);
  src = src.replace(re, replacement);
  console.log(`patched: ${label}`);
}

// Marker makes this script safely idempotent if the workflow is retriggered.
exact(
  ' * Deep Sea Diver — Engine & Game Logic\n',
  ' * Deep Sea Diver — Engine & Game Logic\n * RESTORATION-PASS-1: reliability/progression restoration fixes applied.\n',
  'restoration marker'
);

// Old save comments still described the earlier five-cargo requirement, while
// the live mechanic and hint system correctly use three.
src = src.replace('cargo ships fully stripped (5 opens the Flooded Freighter)', 'cargo ships fully stripped (3 opens the Flooded Freighter)');
src = src.replace('state.cargoSearched = 5;', 'state.cargoSearched = 3;');

// Cave darkness used to be capped BEFORE night darkness was added, allowing a
// cave night to jump from the advertised playable cap to almost pitch black.
exact(
`    // the open sky never goes dark; the cavern is extra gloomy
    var darkness = loc.airArea ? 0 : depthFactor(run.diver.y, loc);
    // caves are moody-dark but never blinding (capped so you can always see to play)
    if (loc.caveArea) darkness = Math.min(0.5, darkness * 0.5 + 0.25);
    if (run.night && !nvOn) darkness = Math.min(0.95, darkness + (loc.airArea ? 0.3 : 0.4)); // nocturnal gloom
`,
`    // the open sky never goes dark; caves remain gloomy but must stay playable.
    var darkness = loc.airArea ? 0 : depthFactor(run.diver.y, loc);
    if (loc.caveArea) darkness = darkness * 0.5 + 0.25;
    if (run.night && !nvOn) darkness += (loc.airArea ? 0.3 : 0.4); // nocturnal gloom
    // IMPORTANT: clamp after all modifiers. The old order let night caves reach ~0.9.
    darkness = Math.min(loc.caveArea ? 0.68 : 0.95, darkness);
`,
  'cave darkness cap'
);

// Draw darkness first, then additive light. Also allow the torch to function in
// genuinely dark caves even on a nominal daytime dive.
regex(
/  function drawLighting\(loc, darkness\) \{[\s\S]*?\n  \}\n\n  function drawJoystick\(\) \{/,
`  function drawLighting(loc, darkness) {
    var dx = run.diver.x - cam.x, dy = run.diver.y - cam.y;
    var gog = (state.items.goggles ? 260 : 0) + (state.items.wideGoggles ? 180 : 0);
    // FOV grows with each Dive Light upgrade level (and again with goggles).
    var fov = lightRadius() * 1.5 + gog;
    // Caves are dim but always grant a broad minimum playable field of view.
    if (loc.caveArea) fov += 300;

    // Paint the depth vignette BEFORE lamps/glows so light actually cuts through it.
    if (darkness > 0.22) {
      var lr = 150 + fov;
      var rg = ctx.createRadialGradient(dx, dy, lr * 0.35, dx, dy, lr * 1.15);
      var a = Math.min(0.86, (darkness - 0.22) * 1.5) * (state.items.goggles ? 0.72 : 1);
      rg.addColorStop(0, "rgba(0,0,8,0)");
      rg.addColorStop(1, "rgba(0,0,10," + a + ")");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }

    // Warm dive-light halo is composited after darkness so upgrades remain useful.
    if (darkness > 0.2) {
      drawGlow(dx, dy, 130 + fov, "#ffe7a8", Math.min(0.30, darkness * 0.34));
    }

    // A cave can be dark in daytime. The old night-only condition made the
    // purchased torch mysteriously stop working in Gloom/Hollow on every other dive.
    var torchUseful = state.items.torch && (run.night || loc.caveArea || darkness > 0.35);
    if (torchUseful) {
      var reach = 320, halfW = 130;
      var aim = Math.atan2(run.aimY || 0, run.aimX != null ? run.aimX : (run.diver.face < 0 ? -1 : 1));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(dx, dy); ctx.rotate(aim);
      var lg = ctx.createLinearGradient(0, 0, reach, 0);
      lg.addColorStop(0, "rgba(255,244,200,0.48)");
      lg.addColorStop(1, "rgba(255,244,200,0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.lineTo(reach, halfW);
      ctx.lineTo(reach, -halfW);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      drawGlow(dx + Math.cos(aim) * 18, dy + Math.sin(aim) * 18, 50, "#fff4c8", 0.55);
    }
  }

  function drawJoystick() {`,
  'lighting composition and cave torch'
);

// Mobile WebViews can emit a synthetic click after touchstart. In close-up mode
// that meant a single tap could advance two specimens.
exact(
`  var joy = { active: false, id: null, sx: 0, sy: 0, cx: 0, cy: 0, dx: 0, dy: 0, mag: 0 };
  var JOY_MAX = 60; // px to full tilt
`,
`  var joy = { active: false, id: null, sx: 0, sy: 0, cx: 0, cy: 0, dx: 0, dy: 0, mag: 0 };
  var JOY_MAX = 60; // px to full tilt
  var lastAquaFocusTouch = 0; // suppress synthetic click after a mobile tap
`,
  'aquarium touch debounce state'
);
exact(
`    // desktop: click to flip through close-up specimens
    canvas.addEventListener("click", function () { if (scene === "aquarium" && aqua && aqua.focus) aquaNav(1); });
`,
`    // desktop: click to flip through close-up specimens. Mobile may synthesize
    // a click after touchstart, so ignore it briefly after a real touch.
    canvas.addEventListener("click", function () {
      if (scene === "aquarium" && aqua && aqua.focus && Date.now() - lastAquaFocusTouch > 650) aquaNav(1);
    });
`,
  'aquarium click debounce'
);
exact(
`    // in the aquarium close-up, tap anywhere to flip to the next specimen
    if (scene === "aquarium" && aqua && aqua.focus) { e.preventDefault(); aquaNav(1); return; }
`,
`    // in the aquarium close-up, tap anywhere to flip to the next specimen
    if (scene === "aquarium" && aqua && aqua.focus) {
      e.preventDefault(); lastAquaFocusTouch = Date.now(); aquaNav(1); return;
    }
`,
  'aquarium touch debounce'
);

// Keep UI progress counts aligned with the actual Kraken completion rule rather
// than counting bosses/secrets against a denominator that excluded them.
regex(
/  \/\/ TRUE 100% — EVERYTHING:[\s\S]*?  function trueComplete\(\) \{[\s\S]*?\n  \}\n  \/\/ every ordinary/,
`  // TRUE 100% — EVERYTHING required by the real Kraken rule. Sanctuary is
  // post-game, and bosses are encounters rather than collection prerequisites.
  function completionProgressFor(profile) {
    profile = profile || state || {};
    var discovered = profile.discovered || {}, seen = {}, done = 0, total = 0;
    function add(id) {
      if (!id || seen[id]) return;
      seen[id] = true; total++;
      if (discovered[id]) done++;
    }
    for (var i = 0; i < D.COMPLETION_FISH.length; i++) {
      var cf = D.FISH_BY_ID[D.COMPLETION_FISH[i]];
      if (cf && cf.area !== "sanctuary") add(cf.id);
    }
    for (var j = 0; j < D.FISH.length; j++) {
      var f = D.FISH[j];
      if (f.secret && f.area !== "sanctuary") add(f.id);
    }
    return { done: done, total: total };
  }
  function trueComplete() {
    var p = completionProgressFor(state);
    return p.total > 0 && p.done === p.total;
  }
  // every ordinary`,
  'canonical completion progress helper'
);

exact(
`        var caught = Object.keys(d.discovered || {}).length;
        var total = D.COMPLETION_FISH.length;
`,
`        var prog = completionProgressFor(d);
        var caught = prog.done;
        var total = prog.total;
`,
  'save-slot progress count'
);

exact(
`    var bagCount = run ? run.bag.length : 0;
    var saleVal = run ? totalBagValue() : 0;
`,
`    var bagCount = run ? run.bag.length : 0;
    var saleVal = run ? totalBagValue() : 0;
    var completion = completionProgressFor(state);
`,
  'boat completion snapshot'
);

regex(
/        html \+= '<div class="kraken-alert">🫠 The real Kraken needs <b>100% of everything<\/b> caught\. You(?:\\)?'re at ' \+ Object\.keys\(state\.discovered\)\.length \+ '\.\.\. keep going!<\/div>';\n/,
`        html += '<div class="kraken-alert">🫠 The real Kraken needs <b>100% of the pre-Sanctuary collection</b>. Progress: ' + completion.done + '/' + completion.total + '... keep going!</div>';
`,
  'boat Kraken progress text'
);

exact(
`    var s = state.stats;
    var disc = Object.keys(state.discovered).length;
`,
`    var s = state.stats;
    var disc = Object.keys(state.discovered).length;
    var completion = completionProgressFor(state);
`,
  'stats completion snapshot'
);
exact(
`      + statRow("Fish species found", disc + " / " + (D.FISH.length - 1))
`,
`      + statRow("Kraken collection", completion.done + " / " + completion.total)
      + statRow("All species discovered", disc)
`,
  'stats progress labels'
);

// Deep-fill old saves. The previous migrator only filled the top level and a
// couple of maps, leaving older saves vulnerable to missing settings/home/diver
// subfields as the game grew.
regex(
/  function migrate\(s\) \{[\s\S]*?\n    return s;\n  \}\n\n  function enterBoat\(\) \{/,
`  function fillMissing(dst, defaults) {
    if (!dst || typeof dst !== "object" || Array.isArray(dst)) dst = {};
    for (var k in defaults) {
      var dv = defaults[k], has = Object.prototype.hasOwnProperty.call(dst, k) && dst[k] != null;
      if (!has) {
        dst[k] = (dv && typeof dv === "object") ? JSON.parse(JSON.stringify(dv)) : dv;
      } else if (dv && typeof dv === "object" && !Array.isArray(dv)) {
        dst[k] = fillMissing(dst[k], dv);
      }
    }
    return dst;
  }
  function migrate(s) {
    var base = defaultState();
    s = fillMissing(s || {}, base);
    // carry over the old one-time hammer/shovel items into the new upgrade tracks
    if (s.items) {
      if (s.items.sledgehammer && !s.upgrades.hammer) s.upgrades.hammer = 1;
      if (s.items.shovel && !s.upgrades.shovel) s.upgrades.shovel = 1;
    }
    // anyone who'd bought the old all-in-one guide keeps every location hint
    if (s.secretGuide) { SECRET_SITE_GUIDE.forEach(function (g) { s.locHints[g.area] = true; }); }
    // Version 3 denotes the restoration-safe nested save schema.
    if (!s.version || s.version < 3) s.version = 3;
    return s;
  }

  function enterBoat() {`,
  'deep old-save migration'
);

// New games should advertise the same schema version as migrated saves.
src = src.replace('      version: 2,', '      version: 3,');

// The implementation had two reachable hidden worlds with no hint entry despite
// the UI promise that every hidden dive site has its own purchasable clue.
exact(
`    { area: "grotto",     requires: "desert", price: 30000, teaser: "Legends tell of four ancient jewels and a tomb sealed beneath the dunes.",
      how: "Collect the four jewels — RED in Prism Reef, BLUE in the Open Sea, GREEN in River Run, YELLOW in the Buried Dunes — then enter the pyramid that rises in the <b>Buried Dunes</b>." },
  ];
`,
`    { area: "grotto",     requires: "desert", price: 30000, teaser: "Legends tell of four ancient jewels and a tomb sealed beneath the dunes.",
      how: "Collect the four jewels — RED in Prism Reef, BLUE in the Open Sea, GREEN in River Run, YELLOW in the Buried Dunes — then enter the pyramid that rises in the <b>Buried Dunes</b>." },
    { area: "jungle",     requires: "forest", price: 24000, teaser: "Divers in the <b>Tidal Grove</b> keep finding coconut shells tangled in a wall of vines.",
      how: "Catch <b>20 Coconut Puffers</b> in the Tidal Grove. On the twentieth catch, the vine wall parts and reveals the Emerald Jungle." },
    { area: "alien",      requires: "opensea", price: 50000, teaser: "Salvagers swear some wreckage in the open ocean was never built on Earth.",
      how: "Search wrecks for crashed <b>UFOs</b> and recover <b>100 alien artifacts</b>. The hundredth artifact opens the route to the Xeno Planet." },
  ];
`,
  'missing Jungle/Xeno hidden-site hints'
);

src = src.replace('// How to reach every hidden dive site (revealed by the $35k guide)', '// How to reach every hidden dive site (individual purchasable hints)');

fs.writeFileSync(file, src);
console.log('Restoration patch complete.');
