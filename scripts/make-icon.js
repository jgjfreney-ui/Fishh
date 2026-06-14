/* Generates the app icon / splash source images (no image libraries — a tiny
 * hand-rolled PNG encoder). The art is the game's Kraken. Outputs into assets/
 * for @capacitor/assets to turn into Android launcher icons + splash. */
"use strict";
var fs = require("fs");
var path = require("path");
var zlib = require("zlib");

// ---- minimal PNG encoder (RGBA, 8-bit) ----
var CRC = (function () {
  var t = [];
  for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { var c = ~0; for (var i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (~c) >>> 0; }
function chunk(type, data) {
  var len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  var t = Buffer.from(type, "ascii");
  var crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  var sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  var raw = Buffer.alloc(h * (w * 4 + 1));
  for (var y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  var idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- tiny painter ----
function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
function mix(a, b, t) { var x = hex(a), y = hex(b); return [Math.round(x[0] + (y[0] - x[0]) * t), Math.round(x[1] + (y[1] - x[1]) * t), Math.round(x[2] + (y[2] - x[2]) * t)]; }
function Painter(w, h) { this.w = w; this.h = h; this.buf = Buffer.alloc(w * h * 4, 0); }
Painter.prototype.px = function (x, y, c, a) {
  x = x | 0; y = y | 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  var i = (y * this.w + x) * 4; this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2]; this.buf[i + 3] = a == null ? 255 : a;
};
Painter.prototype.gradient = function (top, bot) {
  for (var y = 0; y < this.h; y++) { var c = mix(top, bot, y / this.h); for (var x = 0; x < this.w; x++) this.px(x, y, c); }
};
Painter.prototype.ellipse = function (cx, cy, rx, ry, c, a) {
  for (var y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (var x = Math.floor(cx - rx); x <= cx + rx; x++) {
      var dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.px(x, y, c, a);
    }
  }
};

// ---- the Kraken ----
function drawKraken(p, cx, cy, u) {
  var body = hex("#7a2f8f"), bodyD = hex("#46184f"), bodyL = hex("#a755bd");
  var eye = hex("#ffe14d"), pup = hex("#241027"), white = hex("#ffffff");
  // tentacles (behind the head)
  for (var k = -3; k <= 3; k++) {
    if (k === 0) continue;
    for (var seg = 0; seg < 7; seg++) {
      var sx = cx + k * 1.9 * u + Math.sin(seg * 0.55 + k) * 1.1 * u + k * 0.35 * u;
      var sy = cy + 3.4 * u + seg * 1.25 * u;
      var rr = (1.5 - seg * 0.14) * u; if (rr < 0.3 * u) rr = 0.3 * u;
      p.ellipse(sx, sy, rr, rr, seg % 2 ? bodyD : body);
    }
  }
  // mantle / head
  p.ellipse(cx, cy - 1 * u, 6.4 * u, 7.3 * u, bodyD);
  p.ellipse(cx, cy - 1 * u, 5.7 * u, 6.6 * u, body);
  p.ellipse(cx, cy - 3.4 * u, 4.3 * u, 3.4 * u, bodyL);   // top highlight
  p.ellipse(cx, cy - 0.2 * u, 5.7 * u, 4.4 * u, body);    // brow
  // eyes
  p.ellipse(cx - 2.4 * u, cy - 0.4 * u, 1.8 * u, 2.1 * u, eye);
  p.ellipse(cx + 2.4 * u, cy - 0.4 * u, 1.8 * u, 2.1 * u, eye);
  p.ellipse(cx - 2.1 * u, cy - 0.1 * u, 0.85 * u, 1.15 * u, pup);
  p.ellipse(cx + 2.7 * u, cy - 0.1 * u, 0.85 * u, 1.15 * u, pup);
  p.ellipse(cx - 2.9 * u, cy - 1.1 * u, 0.45 * u, 0.45 * u, white);
  p.ellipse(cx + 1.9 * u, cy - 1.1 * u, 0.45 * u, 0.45 * u, white);
}

function bubbles(p) {
  var pts = [[0.16, 0.22], [0.82, 0.18], [0.86, 0.46], [0.2, 0.6], [0.5, 0.1]];
  pts.forEach(function (b, i) {
    var r = Math.round((3 + (i % 3)) * (p.w / 256));
    p.ellipse(b[0] * p.w, b[1] * p.h, r, r, hex("#bfe6ff"), 140);
  });
}

var outDir = path.join(__dirname, "..", "assets");
fs.mkdirSync(outDir, { recursive: true });
function save(name, p) { fs.writeFileSync(path.join(outDir, name), encodePNG(p.w, p.h, p.buf)); console.log("wrote assets/" + name + " (" + p.w + "x" + p.h + ")"); }

// adaptive background
save("icon-background.png", (function () { var p = new Painter(1024, 1024); p.gradient("#1c5478", "#0a1f38"); return p; })());
// adaptive foreground (kraken inside safe zone)
save("icon-foreground.png", (function () { var p = new Painter(1024, 1024); drawKraken(p, 512, 430, 40); return p; })());
// legacy square icon
save("icon-only.png", (function () { var p = new Painter(1024, 1024); p.gradient("#1c5478", "#0a1f38"); bubbles(p); drawKraken(p, 512, 460, 44); return p; })());
// splashes
save("splash.png", (function () { var p = new Painter(2732, 2732); p.gradient("#236a93", "#0a1f38"); bubbles(p); drawKraken(p, 1366, 1240, 110); return p; })());
save("splash-dark.png", (function () { var p = new Painter(2732, 2732); p.gradient("#123249", "#04101d"); bubbles(p); drawKraken(p, 1366, 1240, 110); return p; })());

console.log("Done.");
