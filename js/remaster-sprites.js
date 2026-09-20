/* ===========================================================================
 * Ocean of Discovery — Remaster Sprite Layer
 * Wraps the restored pixel renderer rather than replacing it. This gives every
 * creature a cleaner silhouette, a little species-family variation, stronger
 * scale contrast, and several visually distinct shiny signatures.
 * ======================================================================== */
(function () {
  "use strict";

  if (!window.SPRITES || window.SPRITES.__remastered) return;

  var S = window.SPRITES;
  var baseDraw = S.draw.bind(S);
  var baseDataURL = S.dataURL.bind(S);

  function hash(str) {
    str = String(str || "");
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function clone(o) {
    var out = {};
    for (var k in (o || {})) out[k] = o[k];
    return out;
  }

  var GIANT = {
    whale:1.12, spermwhale:1.14, galaxywhale:1.15, voidwhale:1.15,
    wraithwhale:1.15, stormwhale:1.15, ghostwhale:1.15, whaleshark:1.12,
    megalodon:1.12, apexmega:1.14, mosasaur:1.11, kaiju:1.15,
    leviathanking:1.16, mechakaiju:1.15, magmakaiju:1.15, ancientlev:1.14,
    deeplev:1.13, stonetitan:1.12, kraken:1.10, youngkraken:1.08,
    giantsquid:1.08, leatherback:1.08
  };
  var DELICATE = {
    seahorse:0.90, guppy:0.91, goby:0.92, sardine:0.91, butterflyfish:0.94,
    finch:0.92, songbird:0.93, clione:0.91, glowworm:0.90, tadpole:0.90
  };

  function scaledOpts(archetype, opts) {
    var o = clone(opts || {});
    var seed = hash(archetype + "|" + (o.color || "") + "|" + (o.accent || ""));
    var family = GIANT[archetype] || DELICATE[archetype] || 1;
    // Stable species-level micro variation. This never changes frame to frame.
    var micro = 0.955 + (seed % 10) * 0.01;
    var mul = family * micro;
    if (o.targetH && !o.scale) o.targetH = Math.max(8, o.targetH * mul);
    return o;
  }

  function safeComposite(ctx, value) {
    try { ctx.globalCompositeOperation = value; } catch (e) {}
  }

  function drawShadow(ctx, archetype, x, y, opts) {
    if (archetype === "diver") return;
    var sh = clone(opts);
    sh.shiny = false;
    sh.color = "#07131b";
    sh.accent = "#07131b";
    ctx.save();
    ctx.globalAlpha *= 0.30;
    baseDraw(ctx, archetype, x + 1.2, y + 1.4, sh);
    ctx.restore();
  }

  function mark(ctx, x, y, w, h, seed, shiny) {
    // Tiny deterministic markings: stripes, freckles, dorsal dash, or belly dots.
    // They live on top of the original sprite and keep the handmade pixel feel.
    var style = seed % 4;
    var s = Math.max(1, Math.min(3, Math.round(Math.min(w, h) / 18)));
    var col = shiny ? "rgba(255,255,255,0.48)" : "rgba(255,255,255,0.16)";
    ctx.save();
    ctx.fillStyle = col;
    if (style === 0) {
      ctx.fillRect(x - w * 0.16, y - h * 0.22, s, Math.max(s, h * 0.32));
      ctx.fillRect(x + w * 0.02, y - h * 0.18, s, Math.max(s, h * 0.26));
    } else if (style === 1) {
      ctx.fillRect(x - w * 0.13, y - h * 0.18, s, s);
      ctx.fillRect(x + w * 0.05, y - h * 0.06, s, s);
      ctx.fillRect(x + w * 0.18, y + h * 0.07, s, s);
    } else if (style === 2) {
      ctx.fillRect(x - w * 0.12, y - h * 0.27, Math.max(s, w * 0.24), s);
    } else {
      ctx.fillRect(x - w * 0.10, y + h * 0.18, s, s);
      ctx.fillRect(x + w * 0.05, y + h * 0.18, s, s);
    }
    ctx.restore();
  }

  function shinySignature(ctx, archetype, x, y, result, opts, seed) {
    if (!opts.shiny || !result) return;
    var w = result.w || 24, h = result.h || 18;
    var family = seed % 6;
    var t = (performance && performance.now ? performance.now() : Date.now()) * 0.001;
    var pulse = 0.58 + Math.sin(t * 2.6 + (seed % 37)) * 0.16;

    ctx.save();
    safeComposite(ctx, "screen");

    if (family === 0) { // pearl / starlight
      ctx.globalAlpha *= 0.42 * pulse;
      ctx.strokeStyle = "#fff4c9";
      ctx.lineWidth = Math.max(1, result.scale || 1);
      ctx.beginPath(); ctx.arc(x, y, Math.max(w, h) * 0.42, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + w * 0.28, y - h * 0.32, 2, 2);
    } else if (family === 1) { // spectral cyan
      ctx.globalAlpha *= 0.34 * pulse;
      ctx.shadowColor = "#85f7ff"; ctx.shadowBlur = Math.max(5, h * 0.34);
      ctx.fillStyle = "rgba(130,245,255,0.22)";
      ctx.beginPath(); ctx.ellipse(x, y, w * 0.44, h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    } else if (family === 2) { // prism
      var cols = ["#ff90c8", "#8eeaff", "#ffe78a"];
      ctx.globalAlpha *= 0.50;
      for (var i = 0; i < 3; i++) {
        ctx.fillStyle = cols[i];
        ctx.fillRect(x - w * 0.20 + i * w * 0.16, y - h * 0.30 + Math.sin(t * 3 + i) * 2, Math.max(1, w * 0.035), h * 0.55);
      }
    } else if (family === 3) { // solar gold
      ctx.globalAlpha *= 0.35 * pulse;
      ctx.strokeStyle = "#ffd86f"; ctx.lineWidth = 2;
      var r = Math.max(w, h) * 0.42;
      for (var a = 0; a < 6; a++) {
        var an = a * Math.PI / 3 + t * 0.15;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
        ctx.lineTo(x + Math.cos(an) * (r + 4), y + Math.sin(an) * (r + 4));
        ctx.stroke();
      }
    } else if (family === 4) { // void shimmer
      ctx.globalAlpha *= 0.28 * pulse;
      ctx.shadowColor = "#b681ff"; ctx.shadowBlur = Math.max(7, h * 0.42);
      ctx.strokeStyle = "#c7a1ff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, w * 0.46, h * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
    } else { // bioluminescent motes
      ctx.globalAlpha *= 0.62;
      ctx.fillStyle = "#d8fff2";
      for (var m = 0; m < 4; m++) {
        var ph = t * (1.2 + m * 0.08) + (seed % 11) + m * 1.8;
        var mx = x + Math.cos(ph) * w * (0.32 + m * 0.02);
        var my = y + Math.sin(ph * 1.2) * h * 0.36;
        ctx.fillRect(mx | 0, my | 0, m % 2 ? 1 : 2, m % 2 ? 1 : 2);
      }
    }

    ctx.restore();
  }

  S.draw = function (ctx, archetype, x, y, opts) {
    var o = scaledOpts(archetype, opts || {});
    var seed = hash(archetype + "|" + (o.color || "") + "|" + (o.accent || ""));

    // One soft pixel-shadow is enough to separate small sprites from busy biomes.
    drawShadow(ctx, archetype, x, y, o);
    var result = baseDraw(ctx, archetype, x, y, o);

    if (result && archetype !== "diver") mark(ctx, x, y, result.w, result.h, seed, !!o.shiny);
    shinySignature(ctx, archetype, x, y, result, o, seed);

    // Diver sprite use is rare (the main diver has a bespoke renderer), but when
    // it appears in UI/aquarium contexts it gets a clean visor glint.
    if (archetype === "diver" && result) {
      ctx.save();
      ctx.globalAlpha *= 0.72;
      ctx.fillStyle = "#dffaff";
      ctx.fillRect(x + result.w * 0.08, y - result.h * 0.19, Math.max(1, result.scale), Math.max(1, result.scale));
      ctx.restore();
    }
    return result;
  };

  // Keep collection icons compatible, but expose a remaster flag so tests and
  // future code can detect that the layer is active.
  S.dataURL = function (archetype, opts) { return baseDataURL(archetype, opts); };
  S.__remastered = true;
  S.remasterVersion = "2.0-m1";
})();
