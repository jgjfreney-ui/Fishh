/* Copies the web game (source of truth at repo root) into www/, which is the
 * webDir Capacitor bundles into the Android app. Keeps root files playable on
 * their own while giving Capacitor a clean asset folder. */
"use strict";
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var out = path.join(root, "www");
var ITEMS = ["index.html", "css", "js"]; // assets to bundle

function copyRecursive(src, dst) {
  var stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    fs.readdirSync(src).forEach(function (name) {
      copyRecursive(path.join(src, name), path.join(dst, name));
    });
  } else {
    fs.copyFileSync(src, dst);
  }
}

function replaceRequired(file, from, to, label) {
  var text = fs.readFileSync(file, "utf8");
  if (text.indexOf(from) < 0) {
    throw new Error("Could not apply " + label + " package patch; source pattern changed.");
  }
  text = text.replace(from, to);
  fs.writeFileSync(file, text);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

ITEMS.forEach(function (item) {
  var src = path.join(root, item);
  if (!fs.existsSync(src)) {
    console.error("! missing asset:", item);
    process.exit(1);
  }
  copyRecursive(src, path.join(out, item));
});

// -------------------------------------------------------------------------
// Android friend-build performance profile.
// Modern phones can expose DPR 3-4. The core game plus several independent
// full-screen remaster canvases was redrawing far too many physical pixels each
// frame, producing visible movement hitches. Recast is pixel art, so on a coarse
// pointer / Android device we intentionally use a 1x game backing buffer and
// skip presentation-only duplicate full-screen animation layers. The upgraded
// creature art and foreground diver remain active.
// -------------------------------------------------------------------------
var bundledGame = path.join(out, "js", "game.js");
replaceRequired(
  bundledGame,
  '    canvas.width = W * (window.devicePixelRatio || 1);\n    canvas.height = H * (window.devicePixelRatio || 1);\n    canvas.style.width = W + "px";\n    canvas.style.height = H + "px";\n    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);',
  '    var coarseRender = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || /Android/i.test((navigator && navigator.userAgent) || "");\n    var renderDpr = coarseRender ? 1 : Math.min(2, window.devicePixelRatio || 1); // RECAST_MOBILE_PERFORMANCE\n    canvas.width = Math.max(1, Math.floor(W * renderDpr));\n    canvas.height = Math.max(1, Math.floor(H * renderDpr));\n    canvas.style.width = W + "px";\n    canvas.style.height = H + "px";\n    ctx.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);',
  "mobile core DPR"
);
replaceRequired(bundledGame, '  var JOY_MAX = 60; // px to full tilt', '  var JOY_MAX = 52; // Recast: quicker full-tilt response on touch', "touch joystick response");
replaceRequired(bundledGame, '    var resp = 1 - Math.exp(-(len > 0.001 ? 11 : 14) * dt);', '    var resp = 1 - Math.exp(-(len > 0.001 ? 16 : 18) * dt); // Recast: responsive without snapping', "movement response");

function installMobileLiteGuard(rel, needle, replacement, label) {
  replaceRequired(path.join(out, rel), needle, replacement, label);
}
var mobileGuard = '  var recastMobileLite=(window.matchMedia&&window.matchMedia("(pointer: coarse)").matches)||/Android/i.test((navigator&&navigator.userAgent)||"");\n  if(recastMobileLite){window.RECAST_MOBILE_LIGHTWEIGHT=true;return;} // presentation-only layer disabled on mobile\n';
installMobileLiteGuard("js/remaster.js", "  'use strict';\n\n  var stage", "  'use strict';\n" + mobileGuard + "\n  var stage", "mobile atmosphere guard");
installMobileLiteGuard("js/remaster-scenes.js", "  'use strict';\n  var stage", "  'use strict';\n" + mobileGuard + "  var stage", "mobile scenery guard");
installMobileLiteGuard("js/remaster-trap.js", "  'use strict';\n  window.REMASTER_TRAP_LAYER=true;", "  'use strict';\n" + mobileGuard + "  window.REMASTER_TRAP_LAYER=true;", "mobile trap-canvas guard");
replaceRequired(
  path.join(out, "js", "remaster-foreground.js"),
  "var g=c.getContext('2d'),dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));",
  "var g=c.getContext('2d'),mobileLite=(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches)||/Android/i.test((navigator&&navigator.userAgent)||''),dpr=mobileLite?1:Math.max(1,Math.min(2,window.devicePixelRatio||1)); // RECAST_FOREGROUND_DPR",
  "mobile foreground DPR"
);

// -------------------------------------------------------------------------
// Recast audio balance. The base soundtrack shares a master with SFX, so lift
// only its music sub-bus. The Lounge/boss synth has its own master and needed a
// much larger correction: its individual note envelopes are intentionally soft.
// -------------------------------------------------------------------------
var bundledAudio = path.join(out, "js", "audio.js");
replaceRequired(
  bundledAudio,
  "musicBus = ctx.createGain(); musicBus.gain.value = musicMuted ? 0 : 1; musicBus.connect(master);",
  "musicBus = ctx.createGain(); musicBus.gain.value = musicMuted ? 0 : 1.65; musicBus.connect(master);",
  "base music initial gain"
);
replaceRequired(
  bundledAudio,
  "setMusicMuted: function (m) { musicMuted = !!m; if (musicBus) musicBus.gain.linearRampToValueAtTime(musicMuted ? 0 : 1, (ctx ? ctx.currentTime : 0) + 0.2); },",
  "setMusicMuted: function (m) { musicMuted = !!m; if (musicBus) musicBus.gain.linearRampToValueAtTime(musicMuted ? 0 : 1.65, (ctx ? ctx.currentTime : 0) + 0.2); },",
  "base music unmute gain"
);
replaceRequired(path.join(out, "js", "recast-audio.js"), "  var CUSTOM_MUSIC_GAIN=.14;", "  var CUSTOM_MUSIC_GAIN=.42; // Recast: Lounge + boss themes audible on phone speakers", "Lounge/boss gain");
replaceRequired(path.join(out, "js", "remaster-audio.js"), "  var MUSIC_GAIN=0.045;", "  var MUSIC_GAIN=0.055; // subtle ambience stays below the main soundtrack", "ambient gain");

console.log("Copied web assets -> www/ (" + ITEMS.join(", ") + ")");
console.log("Applied Recast Android performance profile: 1x core/foreground, decorative overlay loops disabled.");
console.log("Applied Recast music balance: base bus 1.65x, Lounge/boss master 0.42, ambience 0.055; SFX unchanged.");
