/* Generates the app icon / splash images as TRUE pixel art (low-res sprite,
 * block-scaled with nearest-neighbour) using a hand-rolled PNG encoder — no
 * image libraries. Subject: the game's Kraken. */
"use strict";
var fs = require("fs");
var path = require("path");
var zlib = require("zlib");

// ---- minimal PNG encoder (RGBA, 8-bit) ----
var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(b) { var c = ~0; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (~c) >>> 0; }
function chunk(type, data) { var l = Buffer.alloc(4); l.writeUInt32BE(data.length, 0); var t = Buffer.from(type, "ascii"); var cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([t, data])), 0); return Buffer.concat([l, t, data, cr]); }
function encodePNG(w, h, rgba) {
  var sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  var ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  var raw = Buffer.alloc(h * (w * 4 + 1));
  for (var y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---- low-res pixel canvas ----
function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16), 255]; }
function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255]; }
function Art(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
Art.prototype.set = function (x, y, c) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[y * this.w + x] = c; };

var PAL = {
  K: hex("#241026"), B: hex("#7a2f8f"), D: hex("#4a1a5a"), L: hex("#a755bd"),
  E: hex("#ffe14d"), P: hex("#241027"), W: hex("#ffe9b0"), ".": null,
};

// hand-authored Kraken head (20 wide x 15)
var HEAD = [
  "......KKKKKKKK......",
  "....KKBBBBBBBBKK....",
  "...KBBBBBBBBBBBBK...",
  "..KBBBBBBBBBBBBBBK..",
  "..KBBLLLLLLLLLLBBK..",
  ".KBBLLLLLLLLLLLLBBK.",
  ".KBBLLLLLLLLLLLLBBK.",
  ".KBEEEDBBBBBBDEEEBK.",
  ".KBEPEDBBBBBBDEPEBK.",
  ".KBEEEDBBBBBBDEEEBK.",
  ".KBBBBBBBWWBBBBBBBK.",
  "..KBBBBBKWWKBBBBBK..",
  "..KBBBBBBBBBBBBBBK..",
  "...KKBBBBBBBBBBKK...",
  ".....KKKKKKKKKK.....",
];

function blitHead(art, ox, oy) {
  for (var y = 0; y < HEAD.length; y++) for (var x = 0; x < HEAD[y].length; x++) {
    var c = PAL[HEAD[y][x]]; if (c) art.set(ox + x, oy + y, c);
  }
}
function tentacles(art, cx, topY, botY) {
  for (var k = 0; k < 7; k++) {
    var off = k - 3;
    for (var seg = 0; topY + seg < botY; seg++) {
      var yy = topY + seg;
      var xx = Math.round(cx + off * 2.6 + Math.sin(seg * 0.6 + k) * 1.6 + off * 0.4);
      art.set(xx - 1, yy, PAL.K); art.set(xx, yy, seg % 2 ? PAL.D : PAL.B);
      art.set(xx + 1, yy, PAL.B); art.set(xx + 2, yy, PAL.K);
    }
  }
}

function makeArt(size, withBg) {
  var a = new Art(size, size);
  if (withBg) {
    var top = hex("#1c5478"), bot = hex("#081a30");
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var band = Math.floor((y / size) * 7) / 7;
      var c = mix(top, bot, band);
      if ((x + y) % 7 === 0) c = mix(c, hex("#ffffff"), 0.06); // subtle dither sparkle
      a.set(x, y, c);
    }
  }
  var cx = Math.floor(size / 2);
  tentacles(a, cx, Math.floor(size * 0.55), size - 1);
  blitHead(a, cx - 10, Math.floor(size * 0.1));
  return a;
}

// sample (nearest-neighbour) an Art up to w×h RGBA buffer
function render(art, w, h) {
  var buf = Buffer.alloc(w * h * 4, 0);
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
    var c = art.d[Math.floor(y * art.h / h) * art.w + Math.floor(x * art.w / w)];
    if (!c) continue;
    var i = (y * w + x) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
  }
  return buf;
}

var outDir = path.join(__dirname, "..", "assets");
fs.mkdirSync(outDir, { recursive: true });
function save(name, w, h, buf) { fs.writeFileSync(path.join(outDir, name), encodePNG(w, h, buf)); console.log("wrote assets/" + name + " (" + w + "x" + h + ")"); }

var artBg = makeArt(32, true);   // 32px pixel-art scene
var artFg = makeArt(32, false);  // transparent foreground (kraken only)
// background plate (solid-ish) for adaptive
var bgPlate = new Art(1, 1); bgPlate.set(0, 0, hex("#0b2438"));

save("icon-background.png", 1024, 1024, render((function () { var a = makeArt(32, true); return a; })(), 1024, 1024));
save("icon-foreground.png", 1024, 1024, render(artFg, 1024, 1024));
save("icon-only.png", 1024, 1024, render(artBg, 1024, 1024));
save("splash.png", 2732, 2732, render(makeArt(48, true), 2732, 2732));
save("splash-dark.png", 2732, 2732, render((function () { var a = new Art(48, 48); for (var y = 0; y < 48; y++) for (var x = 0; x < 48; x++) { var band = Math.floor((y / 48) * 7) / 7; a.set(x, y, mix(hex("#123249"), hex("#04101d"), band)); } tentacles(a, 24, 26, 47); blitHead(a, 14, 5); return a; })(), 2732, 2732));

console.log("Done.");
