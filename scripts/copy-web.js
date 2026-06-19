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

console.log("Copied web assets -> www/ (" + ITEMS.join(", ") + ")");
