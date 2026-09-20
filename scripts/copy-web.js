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
    throw new Error("Could not apply " + label + " music mix patch; source pattern changed.");
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

// Recast mix balance: the original audio engine shares a master with SFX, so
// raise only its music sub-bus in the packaged app. SFX stay at their original
// level. The Phase Two ambience and Recast boss/Lounge synths have their own
// masters and are balanced in their source files.
var bundledAudio = path.join(out, "js", "audio.js");
replaceRequired(
  bundledAudio,
  "musicBus = ctx.createGain(); musicBus.gain.value = musicMuted ? 0 : 1; musicBus.connect(master);",
  "musicBus = ctx.createGain(); musicBus.gain.value = musicMuted ? 0 : 1.28; musicBus.connect(master);",
  "initial"
);
replaceRequired(
  bundledAudio,
  "setMusicMuted: function (m) { musicMuted = !!m; if (musicBus) musicBus.gain.linearRampToValueAtTime(musicMuted ? 0 : 1, (ctx ? ctx.currentTime : 0) + 0.2); },",
  "setMusicMuted: function (m) { musicMuted = !!m; if (musicBus) musicBus.gain.linearRampToValueAtTime(musicMuted ? 0 : 1.28, (ctx ? ctx.currentTime : 0) + 0.2); },",
  "unmute"
);

console.log("Copied web assets -> www/ (" + ITEMS.join(", ") + ")");
console.log("Applied Recast music balance: base music +28%, SFX unchanged.");
