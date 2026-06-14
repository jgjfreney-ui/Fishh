/* ===========================================================================
 * Deep Sea Diver — Pixel Sprite System
 * Hand-authored pixel creatures. Each sprite is a grid of role characters that
 * gets recoloured per-species from a base colour (with auto-derived shades),
 * cached as a small canvas, and blitted crisp (nearest-neighbour) at any scale.
 *
 *   Legend:  . transparent   B body      b body-outline/shade   L belly/light
 *            F fin            E eye-white P pupil   M mouth/dark  A accent
 *            G glow/lure      W white-highlight
 * ======================================================================== */
(function () {
  "use strict";

  // ---- tiny colour helpers (self-contained) ----------------------------
  function hex(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function rgb(a) { return "rgb(" + (a[0] | 0) + "," + (a[1] | 0) + "," + (a[2] | 0) + ")"; }
  function shade(h, m) { var c = hex(h); return rgb([c[0] * m, c[1] * m, c[2] * m]); }
  function mix(h1, h2, t) {
    var a = hex(h1), b = hex(h2);
    return rgb([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  function shinyShift(h) {
    var c = hex(h);
    // hue-rotate-ish toward an iridescent palette + brighten
    var alt = [(c[0] * 0.4 + 150), (c[1] * 0.5 + 90), (c[2] * 0.6 + 180)];
    return rgb([Math.min(255, alt[0]), Math.min(255, alt[1]), Math.min(255, alt[2])]);
  }

  function deriveColors(base, accent, shiny) {
    var b = shiny ? shinyShift(base) : base;
    return {
      B: b,
      b: shade(b, 0.6),
      L: mix(b, "#ffffff", 0.55),
      F: shade(b, 0.78),
      M: shade(b, 0.4),
      A: accent || mix(b, "#ffffff", 0.78),
      E: "#f2fbff",
      P: "#14141d",
      G: shiny ? "#fff6c8" : "#ffe98a",
      W: "#ffffff",
      ".": null,
    };
  }

  // ---- sprite grids (face RIGHT by default) ----------------------------
  var GRID = {
    fish: [
      ".....bBBb.....",
      "...bBBBBBBb...",
      "f.bBBBBBBEPb..",
      "ffBLLBBBBEPBb.",
      "ffBLLBBBBBBBb.",
      "f.bBBBBBBBBb..",
      "...bBBBBBBb...",
      ".....bBBb.....",
    ],
    longfish: [
      "f...bBBBBBBBBb...",
      "ff.bBBBBBBBBBBEPb",
      "ffBBLLBBBBBBBBEPB",
      "ff.bBBBBBBBBBBBBb",
      "f...bBBBBBBBBb...",
    ],
    round: [
      "....bBBBb....",
      "..bBBBBBBBb..",
      ".bBBBBBBBBEP.",
      ".bBLLBBBBBEPB",
      "fbBLLBBBBBBBB",
      ".bBBBBBBBBBb.",
      "..bBBBBBBBb..",
      "....bBBBb....",
      ".A...A...A.A.",
    ],
    shark: [
      "...........B........",
      "..........BBB.......",
      "f.....BBBBBBBBBBBb..",
      "ffBBBBBBBBBBBBBBBEPb",
      "ffBBBBLLLLLLLBBBBEPB",
      "ffBBBBLLLLLLLBBBBBBb",
      "f.....BBBBBBBBBBBb..",
      "........bb...bb.....",
    ],
    sword: [
      "f.....BBBBBBBBBb.........",
      "ffBBBBBBBBBBBBBBEPAAAAAAA",
      "ffBBBLLLLLLBBBBBEPAAAAAAA",
      "ffBBBBBBBBBBBBBBBBb......",
      "f.....BBBBBBBBBb.........",
    ],
    hammer: [
      "f.....BBBBBBBBBB.AAA.",
      "ffBBBBBBBBBBBBBBBAAAE",
      "ffBBBLLLLLLBBBBBBAAAE",
      "ffBBBBBBBBBBBBBBBAAAE",
      "f.....BBBBBBBBBB.AAA.",
    ],
    whale: [
      "f.....BBBBBBBBBBBBBBBb...",
      "ffBBBBBBBBBBBBBBBBBBBBEPb",
      "ffBBBBBBBBBBBBBBBBBBBBEPB",
      "ffBBBBLLLLLLLLLLLLBBBBBBb",
      "f.LLLLLLLLLLLLLLLLLLLb...",
      "....bLLLLLLLLLLLLLb......",
    ],
    turtle: [
      "....bAAAAAAb....",
      "..bAAAAAAAAAAb..",
      "FFAAAbAAbAAAAEPb",
      "FFAAAAbbAAAAAEPB",
      "FFAAbAAbAAAAAAb.",
      "..bAAAAAAAAAAb..",
      "...FF....FF....",
    ],
    ray: [
      "......BBB.......",
      "...bBBBBBBBb....",
      "bBBBBBBBBBBBBBEP",
      "BBBBBBLLLBBBBBEP",
      "bBBBBBBBBBBBBBBb",
      "...bBBBBBBBb..AA",
      "......BBB...AA..",
      ".........AA....",
    ],
    eel: [
      "f.bBBBb.........",
      "fbBBBBBb...bBBb.",
      "fBBLLBBBbbBBBBEP",
      "fbBBBBBBBBBBBBEP",
      "f.bBBBBbbBBBBb..",
      ".....bBBb......",
    ],
    squid: [
      "....bBBBb....",
      "...bBBBBBBb..",
      "..bBBBBBBBBb.",
      "..bBLLBLLBBb.",
      "..bBEPBBEPBb.",
      "..bBBBBBBBBb.",
      "...bBBBBBBb..",
      "..A.A.AA.A.A.",
      ".A..A.AA.A..A",
      "A...A.AA.A...A",
    ],
    octopus: [
      "...bBBBBb...",
      ".bBBBBBBBBb.",
      "bBBEPBBEPBBb",
      "bBBBBBBBBBBb",
      "bBBBBBBBBBBb",
      ".bBBBBBBBBb.",
      "A.A.A.A.A.A",
      "A.A.A.A.A.A",
      ".A...A...A.",
    ],
    jelly: [
      "...bBBBBb...",
      ".bBBBBBBBBb.",
      "bBLLLLLLLLBb",
      "bBLLLLLLLLBb",
      "bBBBBBBBBBBb",
      ".B.B.B.B.B.B",
      "G.G.B.G.B.G.",
      ".G..G.G..G..",
      "G..G...G..G.",
    ],
    seahorse: [
      "...bBBb..",
      "..bBBEPb.",
      "..bBBBBA.",
      "...bBBb..",
      "...bBBb..",
      "..bBBb...",
      "..bBB....",
      "...bBBb..",
      "....bBb..",
    ],
    otter: [
      "..........bBBb.",
      "f........bBBEPb",
      "ffBBBBBBBBBBEPB",
      "ffBBLLLLLLBBBBb",
      "f.bBBBBBBBBBb..",
      "....bb...bb...",
    ],
    angler: [
      ".........G..",
      ".........G..",
      "....bBBbAA...",
      "..bBBBBBBb...",
      ".bBBEPBWWWWW.",
      "fbBBBBBMMMMM.",
      "fbBBLLBWWWWW.",
      ".bBBBBBBb...",
      "....bBBb....",
    ],
    lantern: [
      ".....bBBb.....",
      "...bBBGBBGb...",
      "f.bBBBBBBEPb..",
      "ffBGLLBGBEPBb.",
      "ffBBLLBBBBGBb.",
      "f.bBBGBBBBBb..",
      "...bBBGBBb....",
      ".....bBBb.....",
    ],
    kraken: [
      "..........GG..GG..........",
      ".........bBBBBBBb.........",
      ".......bBBBBBBBBBBb.......",
      "......bBBBBBBBBBBBBb......",
      ".....bBBGPBBBBGPBBBBb.....",
      ".....bBBGPBBBBGPBBBBb.....",
      "......bBBBBMMMMBBBBb......",
      ".......bBBBBBBBBBBb.......",
      "....A...bBBBBBBb...A......",
      "...A.A..A.bBBb.A..A.A.....",
      "..A...A.A.A..A.A.A...A....",
      ".A....A..A....A..A....A...",
      "A....A...A....A...A....A..",
      "....A...A......A...A......",
      "...A...A........A...A.....",
    ],
    diver: [
      "....bb....",
      "...bMMb...",
      "..bMWWMb..",
      "tBBBBBBb..",
      "tBBBBBBEP.",
      "tBBLLBBEP.",
      ".BBBBBBb..",
      "f.bBBBb...",
      "ff..ff....",
    ],
  };

  // diver uses a fixed palette
  var DIVER_COLORS = {
    B: "#1f7d9c", b: "#0e4a5e", L: "#7fd6ec", F: "#16505e", M: "#e8f6ff",
    W: "#0b3d5c", E: "#f2fbff", P: "#14141d", t: "#26323d", A: null,
    G: null, ".": null,
  };

  // normalise grids to equal-width rows (pad with transparent)
  function normalize(rows) {
    var w = 0;
    for (var i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
    var out = [];
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j];
      while (r.length < w) r += ".";
      out.push(r);
    }
    return { w: w, h: out.length, rows: out };
  }
  var SPR = {};
  for (var key in GRID) SPR[key] = normalize(GRID[key]);

  // Automatic shading: brighten top edges (rim light) and darken bottom
  // edges (occlusion) so flat sprites gain volume. Skips eyes/glow chars.
  var LIT = { E: 1, P: 1, G: 1, W: 1 }; // roles left unshaded
  function shadeNative(cnv, spr, colors) {
    try {
      var w = cnv.width, h = cnv.height, c = cnv.getContext("2d");
      var img = c.getImageData(0, 0, w, h), d = img.data, out = c.createImageData(w, h), o = out.data;
      function alpha(x, y) { return (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[(y * w + x) * 4 + 3]; }
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = d[i + 3];
          if (d[i + 3] === 0) continue;
          if (LIT[spr.rows[y][x]]) continue;
          if (alpha(x, y - 1) === 0) {            // top edge → highlight
            o[i] = Math.min(255, d[i] + 64); o[i + 1] = Math.min(255, d[i + 1] + 64); o[i + 2] = Math.min(255, d[i + 2] + 64);
          } else if (alpha(x, y + 1) === 0) {     // bottom edge → shadow
            o[i] = d[i] * 0.55; o[i + 1] = d[i + 1] * 0.55; o[i + 2] = d[i + 2] * 0.55;
          } else if (alpha(x - 1, y) === 0) {     // left edge → soft light
            o[i] = Math.min(255, d[i] + 26); o[i + 1] = Math.min(255, d[i + 1] + 26); o[i + 2] = Math.min(255, d[i + 2] + 26);
          }
        }
      }
      c.putImageData(out, 0, 0);
    } catch (e) { /* no getImageData (headless) — skip shading */ }
  }

  // paint a sprite at native (1px/cell) resolution, recoloured + shaded
  function paintNative(archetype, colors) {
    var spr = SPR[archetype] || SPR.fish;
    var cnv = document.createElement("canvas");
    cnv.width = spr.w; cnv.height = spr.h;
    var c = cnv.getContext("2d");
    for (var y = 0; y < spr.h; y++) {
      var row = spr.rows[y];
      for (var x = 0; x < spr.w; x++) {
        var col = colors[row[x]];
        if (!col) continue;
        c.fillStyle = col; c.fillRect(x, y, 1, 1);
      }
    }
    shadeNative(cnv, spr, colors);
    return { canvas: cnv, w: spr.w, h: spr.h };
  }

  // ---- cache of recoloured native-resolution canvases ------------------
  var cache = {};
  function get(archetype, base, accent, shiny) {
    var ckey = archetype + "|" + base + "|" + (accent || "") + "|" + (shiny ? 1 : 0);
    if (cache[ckey]) return cache[ckey];
    var colors = archetype === "diver" ? DIVER_COLORS : deriveColors(base, accent, shiny);
    cache[ckey] = paintNative(archetype, colors);
    return cache[ckey];
  }

  // ---- public draw -----------------------------------------------------
  // ctx must already have imageSmoothingEnabled = false for crisp pixels.
  // opts: { color, accent, shiny, flip, scale, targetH }
  function draw(ctx, archetype, x, y, opts) {
    opts = opts || {};
    var entry = archetype === "diver"
      ? get("diver", "#1f7d9c", null, false)
      : get(archetype, opts.color || "#8fa6b0", opts.accent, !!opts.shiny);
    var scale = opts.scale;
    if (!scale) {
      var targetH = opts.targetH || 24;
      scale = Math.max(2, Math.round(targetH / entry.h));
    }
    var dw = entry.w * scale, dh = entry.h * scale;
    var flip = opts.flip ? -1 : 1;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(flip, 1);
    ctx.drawImage(entry.canvas, Math.round(-dw / 2), Math.round(-dh / 2), dw, dh);
    ctx.restore();
    return { w: dw, h: dh, scale: scale };
  }

  // map a fish "shape" to a sprite archetype
  var SHAPE_MAP = {
    fish: "fish", round: "round", shark: "shark", sword: "sword", hammer: "hammer",
    whale: "whale", turtle: "turtle", ray: "ray", eel: "eel", squid: "squid",
    octopus: "octopus", jelly: "jelly", seahorse: "seahorse", otter: "otter",
    angler: "angler", lantern: "lantern", kraken: "kraken",
  };
  function archetypeForShape(shape) { return SHAPE_MAP[shape] || "fish"; }

  // build a standalone data-URL image of a sprite (for the Collection grid)
  function dataURL(archetype, opts) {
    opts = opts || {};
    var spr = SPR[archetype] || SPR.fish;
    var colors;
    if (opts.silhouette) {
      colors = { ".": null };
      "BbLFMAEPGWt".split("").forEach(function (k) { colors[k] = opts.silhouette; });
    } else if (archetype === "diver") {
      colors = DIVER_COLORS;
    } else {
      colors = deriveColors(opts.color || "#8fa6b0", opts.accent, !!opts.shiny);
    }
    var native = opts.silhouette ? rawNative(archetype, colors) : paintNative(archetype, colors);
    var scale = opts.scale || 4;
    var cnv = document.createElement("canvas");
    cnv.width = spr.w * scale; cnv.height = spr.h * scale;
    var c = cnv.getContext("2d");
    c.imageSmoothingEnabled = false;
    c.drawImage(native.canvas, 0, 0, cnv.width, cnv.height);
    return cnv.toDataURL();
  }

  // unshaded native paint (used for flat silhouettes)
  function rawNative(archetype, colors) {
    var spr = SPR[archetype] || SPR.fish;
    var cnv = document.createElement("canvas");
    cnv.width = spr.w; cnv.height = spr.h;
    var c = cnv.getContext("2d");
    for (var y = 0; y < spr.h; y++) {
      var row = spr.rows[y];
      for (var x = 0; x < spr.w; x++) {
        var col = colors[row[x]];
        if (!col) continue;
        c.fillStyle = col; c.fillRect(x, y, 1, 1);
      }
    }
    return { canvas: cnv, w: spr.w, h: spr.h };
  }

  window.SPRITES = {
    draw: draw,
    dataURL: dataURL,
    archetypeForShape: archetypeForShape,
    has: function (a) { return !!SPR[a]; },
  };
})();
