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
  // shiny = remap the hue and boost saturation/brightness so each species gets
  // its OWN distinct shiny colour. We *stretch* the hue wheel (not just rotate)
  // so the many similar blue/teal base colours diverge into real variety
  // instead of all collapsing into the same pink.
  function shinyShift(h) {
    var c = hex(h), r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = 0, hh = 0;
    if (mx !== mn) {
      var dd = mx - mn;
      s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
      if (mx === r) hh = (g - b) / dd + (g < b ? 6 : 0);
      else if (mx === g) hh = (b - r) / dd + 2;
      else hh = (r - g) / dd + 4;
      hh /= 6;
    }
    hh = (hh * 1.6 + 0.12) % 1;                  // stretch + offset → spread of hues
    s = Math.min(1, s * 1.2 + 0.45);             // more saturated
    l = Math.min(0.76, Math.max(0.52, l * 0.8 + 0.24)); // brighter
    function h2(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return rgb([h2(p, q, hh + 1 / 3) * 255, h2(p, q, hh) * 255, h2(p, q, hh - 1 / 3) * 255]);
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
    bird: [
      ".....bBBb....",
      "...bBBBBBBb..",
      "f.bBBBBBBEPb.",
      "fbBBBBBBBBEPG",
      "fbBBBBBBBBBb.",
      ".FFbBBBBBb...",
      "..FFFFb.b....",
      ".....bb......",
    ],
    fish: [
      "...........MMM........",
      "..F......MMMMM........",
      "..FF...bbBBBBBBBbb....",
      "...FFbBBBBMBBMBBBBBb..",
      "..FFBBBBBBMBBMBBBBBBb.",
      ".FFbBBBLLMBBMBBBBBBEPb",
      "FFFbBBLLLMBBMBBBBBBEPM",
      ".FFbBBBLLMBBMBBBBBBEPb",
      "..FFBBBBBBMBBMBBBBBBb.",
      "...FFbBBBBMBBMBBBBBb..",
      "..FF...bbBBBBBBBbb....",
      "..F......MMMMM........",
      "...........MMM........",
    ],
    longfish: [
      ".........FF.........",
      "f.....bbBBBBBBbb....",
      "ff..bBBBBBBBBBBBBb..",
      "ffbBBLLBBBBBBBBBBEPb",
      "ffbBBLLBBBBBBBBBBEPM",
      "ff..bBBBBBBBBBBBBb..",
      "f.....bbBBBBBBbb.F..",
      ".........FF.........",
    ],
    round: [
      "...A.A.A.A...",
      "..bBBBBBBBb..",
      ".bBBBBBBBBBb.",
      "AbBLLBBBBBEPA",
      ".bBLLBBBBBEPM",
      "AbBBBBBBBBBBA",
      ".bBBBBBBBBBb.",
      "..bBBBBBBBb..",
      "...A.A.A.A...",
    ],
    shark: [
      "...........FF..........",
      "..........FFFF.........",
      "F........FFFFFF........",
      "FFF.....bBBBBBBBbb.....",
      "FFbbBBBBBBBBBBBBBBBbb..",
      "fbBBBBBBBBBBBBBBBBBBBEP",
      "fbBBLLLLLLLLLLLLBWMWMW",
      "FFbbBBBBBBBBBBBBBWMWMW",
      "FFF......bBBBBBBb......",
      "F..........AAAA.......",
      "...........AA.........",
    ],
    sword: [
      "..........FF............",
      "f.....bBBBBBBBBb........A",
      "ffbBBBBBBBBBBBBBBEPAAAAAA",
      "ffbBBLLLLLLBBBBBBEPAAAAAA",
      "ffbBBBBBBBBBBBBBBBb.....A",
      "f.....bBBBBBBBBb..FF.....",
    ],
    hammer: [
      "..................bEPb.",
      "................bBBBBBb.",
      "F..........bbBBBBBBBBb.",
      "FFFbbBBBBBBBBBBBBBBMMBb.",
      "FFFbBLLLLLLLLLBBBBBMMBb.",
      "F..........bbBBBBBBBBb.",
      "................bBBBBBb.",
      "..................bEPb.",
    ],
    whale: [
      "F.........................",
      "FFF.....bbBBBBBBBBBBbb.....",
      "FFFFbbBBBBBBBBBBBBBBBBBBb..",
      "FFBBBBBBBBBBBBBBBBBBBBBBEPb",
      "FFBBBBBBBBBBBBBBBBBBBBBBEPM",
      "FFFBLLLLLLLLLLLLLLLLLLBBb..",
      "FFF.bbLLLLLLLLLLLLLLBbb....",
      "F......bFFFb.....bb........",
    ],
    turtle: [
      "....bbAAAAAbb....",
      "..bBAAAAAAAAAB...",
      ".FBBAAbAAbAAABEPb",
      ".FBBAAAbbAAAABEPB",
      ".FBBAAbAAbAAABBb.",
      "..bBAAAAAAAAAB...",
      "...FF......FF....",
    ],
    ray: [
      "........BB........",
      ".....bBBBBBBb.....",
      "..bBBBBBBBBBBBBb..",
      "bBBBBBBBBBBBBBBBBb",
      "BBBBBLLLLLLBBBBBEP",
      "bBBBBBBBBBBBBBBBBb",
      "..bBBBBBBBBBBBBb..",
      ".....bBBBBBBb..AA.",
      "........BB...AA...",
      "............AA....",
    ],
    eel: [
      ".................bBBBb...",
      "..........bBBb..bBBBBBBb.",
      "....bBBb.bBBBBbbBBBLLBBEP",
      "..bBBBBBBBBLLBBBBBBBBBBPM",
      "fbBBBBLLBBBBBBBBBBBBBBBb.",
      "fbBBBBBBBBBBBBBBBBBBBBb..",
      "..bbBBBBbbb..bbBBBBbb....",
      "....bbb........bbb.......",
    ],
    squid: [
      "......BB......",
      ".....bBBb.....",
      "....bBBBBb....",
      "...bBLLLLBb...",
      "..bBBBBBBBBb..",
      "..bBEPBBEPBb..",
      "..bBBBBBBBBb..",
      "...bBBBBBBb...",
      "..AA.AAAA.AA..",
      ".A..A.AA.A..A.",
      "A...A.AA.A...A",
    ],
    octopus: [
      "...bBBBBb...",
      ".bBBBBBBBBb.",
      "bBBEPBBEPBBb",
      "bBLLBBBBLLBb",
      "bBBBBBBBBBBb",
      ".bBBBBBBBBb.",
      "AA.AA.AA.AA",
      "A.A.A.A.A.A",
      "A..A...A..A",
    ],
    jelly: [
      "...bBBBBb...",
      ".bBLLLLLLBb.",
      "bBLLLLLLLLBb",
      "bBLLLLLLLLBb",
      "bGBGBGBGBGBb",
      ".G.G.G.G.G.G",
      "G..G.G.G..G.",
      ".G..G...G..G",
      "G...G..G...G",
    ],
    seahorse: [
      "..bBBBb..",
      ".bBEPBBb.",
      ".bBBBBBA.",
      "..bBBBb..",
      "...bBBb..",
      "..bBBb...",
      ".bBBb....",
      ".bBBb....",
      "..bBBb...",
      "...bBb...",
    ],
    otter: [
      "..........bBBBb.",
      "f........bBBBEPb",
      "ff..bBBBBBBBBEPB",
      "ffbBBLLLLLLBBBBb",
      "ff..bBBBBBBBBBb.",
      "f.....bb...bb...",
    ],
    angler: [
      ".......G....",
      ".......GG...",
      "....bbBBb...",
      "..bBBBBBBb..",
      ".bBBEPBWAWb.",
      "fbBBBBBMMMb.",
      "fbBBLLBWAWb.",
      ".bBBBBBBBb..",
      "..bBBBBBb...",
    ],
    lantern: [
      ".....bBBBb....",
      "...bBBBBBBbG..",
      "f.bBBGBBBBEPb.",
      "ffBLLBGBBBEPbM",
      "ffBLLBBGBBBBb.",
      "f.bBBBGBBBBb..",
      "...bBBGBBBb...",
      ".....bBBBb....",
    ],
    narwhal: [
      "f......bBBBBBBBBBBBb.......",
      "ff..bBBBBBBBBBBBBBBBBb.....",
      "ffbBBBBBBBBBBBBBBBBBBBEP.AAAAA",
      "ffbBLLLLLLLLLLLLLLLBBBBPM....",
      "ffbBBBBBBBBBBBBBBBBBBBBb.....",
      "f...bbBBBBBBBBBBBBbb........",
    ],
    coelacanth: [
      "......FFF......",
      "f...bBBBBBBBb..",
      "fbbBBBBBBBBBBEP",
      "fBBBLLBBBBBBBPM",
      "fbbBBBBBBBBBBEP",
      "f...bBBBBBBBb..",
      "...F.FF..FF.F..",
      "......FFF......",
    ],
    mosasaur: [
      "F..........bBBBBBBBBBb....",
      "FFF....bbBBBBBBBBBBBBBBb..",
      "FFbbBBBBBBBBBBBBBBBBBBBBEP",
      "FFbBBBLLLLLLLLLLLLLLBBMMMM",
      "FFbbBBBBBBBBBBBBBBBBBBBBEP",
      "FFF....bbBBBBBBBBBBBBBBb..",
      "F.....FF........FF.......",
      "......FF........FF.......",
    ],
    armored: [
      "f....bBBBBb..AAAAAA..",
      "ff.bBBBBBBBAAAAAAAAA.",
      "ffBBBLLBBBAAAAEPAAAAb",
      "ffBBBBBBBBAAMMMMMMAAb",
      "ffBBBLLBBBAAAAEPAAAAb",
      "ff.bBBBBBBBAAAAAAAAA.",
      "f....bBBBBb..AAAAAA..",
    ],
    trilobite: [
      "...bAAAAAAb...",
      ".bBBBBBBBBBBb.",
      "bBEPBbBBbBEPBb",
      "bBBBbBBbBBBBBb",
      "bBBBbBBbBBBBBb",
      "bBBBbBBbBBBBBb",
      ".bBBBBBBBBBBb.",
      "..AA.AA.AA.A..",
    ],
    ammonite: [
      "...bBBBBb...",
      ".bBBLLLLBBb.",
      "bBLLbbbLLBBb",
      "bBLbBBBbLBBb",
      "bBLbBbBbLBBb",
      "bBLbBBBbLBBb",
      "bBLLbbbLLBBb",
      ".bBBLLLLBBb.",
      "..AAA.AAA...",
    ],
    dolphin: [
      "..........bBBb...",
      "f.....bbBBBBBBBb.",
      "ffbBBBBBBBBBBBBEP",
      "ffBBLLLLLLLLBBBBM",
      "ffbBBBBBBBBBBBBb.",
      "f...bbBBBBBb.....",
      ".......FF........",
    ],
    clione: [
      "..G.....G..",
      ".GGG...GGG.",
      "..GG.b.GG..",
      "...bBBBb...",
      "..bBLLBBb..",
      "..bBLLBBb..",
      "...bBBBb...",
      "....bBb....",
      ".....b.....",
    ],
    // ---- boss skins (each rises with its OWN distinct silhouette) ----
    orca: [
      "...........FFF.........",
      "..........FFFFF........",
      "F.....bbBBBBBBBBBBBbb..",
      "FFFbbBBBBBBBBBBBBBBBBBb",
      "FFbBBBBBBBBBBBBBBBBBBEP",
      "FFFbBBBBBBBBBBBBBBAABPM",
      "F.bBAAAAAAAAAAAAAAAABb.",
      "...bbAAAAAAAAAAAAbbbb..",
      "......FFF...AAAA.......",
    ],
    manowar: [
      "....bBLLLLBb....",
      "..bBLLLLLLLLBb..",
      ".bBLLLWWLLLLLBb.",
      "bBLLLLLLLLLLLLBb",
      "bBBLLLLLLLLLLBBb",
      ".bBBBBBBBBBBBBb.",
      "..A.A.A.A.A.A...",
      ".A...A...A...A..",
      "A..A..A...A..A.A",
      ".A..A....A..A..A",
      "A..A..A..A....A.",
    ],
    siphonophore: [
      "..bBb..bBb..bBb..bBb.bBEP",
      ".bBLBb.bBLBb.bBLBb.bBLBPM",
      "bBLLLBbBLLLBbBLLLBbBLLLBb",
      ".bBLBb.bBLBb.bBLBb.bBLBb.",
      "..A.....A....A....A......",
      ".A.....A....A....A......",
      "A.....A....A....A.......",
    ],
    megalodon: [
      "............FFFF.......",
      "...........FFFFFF......",
      "F.......bbBBBBBBBBbb...",
      "FFbbBBBBBBBBBBBBBBBBBb.",
      "FbBBBBBBBBBBBBBBBBBBBEPb",
      "FbBBLLLLLLLLLLLLBWMWMWMW",
      "FbBBBBBBBBBBBBBBBWMWMWMW",
      "FFbbBBBBBBBBBBBBBBBBbb..",
      "F.......bbBBBBBBbb.....",
      "...........AAA.AAA.....",
    ],
    roc: [
      "...........FFF..........",
      "..........FFFFFF........",
      "f........FFFFFFFFb......",
      "f.....bBBBBBBBBBBBBb....",
      "f...bBBBBBBBBBBBBBBEPG..",
      "f..bBBBBBBBBBBBBBBBBBPGG",
      "f...bBBBBBBBBBBBBBBBb...",
      "f....FFbBBBBBBBbFF......",
      ".......AAA...AAA.......",
      "......A.A.....A.A.......",
    ],
    spidercrab: [
      "A.................A...",
      ".A...A.......A...A....",
      "..A...A.....A...A.....",
      "...A...bBBBBb..A......",
      "..A..bBEPBBEPBb.A.....",
      ".A..bBBBBBBBBBBb.A....",
      "A..bBBBBBBBBBBBBb..A..",
      "..A.bBBBBBBBBBBb.A....",
      ".A...A.bBBBBb.A...A...",
      "A...A...A..A...A...A..",
      "...A...A....A...A.....",
    ],
    // ---- nocturnal creatures (glowy night-only species) ----
    lanternjaw: [
      "..........GG....",
      "..........G.....",
      "....bbBBbG......",
      "..bBBBBBBBb.....",
      ".bBBBEPBBBBb....",
      ".bBBBBBBBBWMW...",
      ".bBBLLBBBBWMW...",
      ".bBBBBBBBBWMW...",
      "..bBBBBBBBb.....",
      "...FFbBBb.......",
    ],
    dragonfish: [
      "....................bBb.",
      "..................bBBBEP",
      "fbBBBBBBBBBBBBBBBBBBBWMW",
      "fbBGBBGBBGBBGBBGBBBBBb.",
      "fbBBBBBBBBBBBBBBBBBBb..",
      "................G......",
    ],
    moonfish: [
      "......F......",
      ".....FF......",
      "...bBBBBb....",
      ".bBBBBBBBBb..",
      "bBBBLLBBBBEPb",
      "bBBLLLLBBBBPM",
      "bBBBLLBBBBBb.",
      ".bBBBBBBBBb..",
      "...bBBBBb....",
      ".....FF......",
      "......F......",
    ],
    catfish: [
      "f.....bbBBBBBbb....",
      "f..bBBBBBBBBBBBb...",
      "fbBBBBBBBBBBBBBEPbA",
      "fbBBLLLLLLLLBBBBPMA",
      "fbBBBBBBBBBBBBBEPbA",
      "f..bBBBBBBBBBBBb...",
      "f....FF...FF.......",
    ],
    glowjelly: [
      "...GGGGGG...",
      "..GLLLLLLG..",
      ".GLLLLLLLLG.",
      "GLLLLLLLLLLG",
      "GBLLLLLLLLBG",
      ".GBGBGBGBG..",
      "..G.G.G.G...",
      ".G..G.G..G..",
      "G..G...G..G.",
      ".G..G.G...G.",
      "G...G..G..G.",
    ],
    seamoth: [
      "FF...........FF",
      "FFFF.......FFFF",
      ".FFFFbBBBbFFFF.",
      "..FFbBEPBBbFF..",
      "...bBBBBBBBb...",
      "..FFbBBBBBbFF..",
      ".FFFFbBBBbFFFF.",
      "FFFF.......FFFF",
      "FF...........FF",
    ],
    ghostray: [
      "........BB........",
      ".....bBBBBBBb.....",
      "..bBBGBBBBGBBBBb..",
      "bBBBBBBBBBBBBBBBBb",
      "BBGBBBLLLLBBGBBBEP",
      "bBBBBBBBBBBBBBBBBb",
      "..bBBGBBBBGBBBBb..",
      ".....bBBBBBBb..AA.",
      "........BB...AA...",
      "............AA....",
    ],
    stargazer: [
      "...E...E....",
      "..bBBBBBBBb.",
      ".bBBBBBBBBBb",
      "bBEPBBBBEPBb",
      "bBBBBBBBBBBb",
      "bWMWMWMWMWMb",
      ".bBBBBBBBBb.",
      "..FF....FF..",
    ],
    vampsquid: [
      "....bBBBb....",
      "..bBBBBBBBb..",
      ".bBEPBBEPBb.",
      ".bBBBBBBBBb.",
      "GbBBBBBBBBbG",
      "GGbBBBBBBbGG",
      ".GAAAAAAAAG.",
      ".A.A.A.A.A.A",
      "A..A.A.A..A.",
    ],
    glowworm: [
      "..bBb..bBb..bBb..bBEP",
      ".bBGBb.bBGBb.bBGBbBGPM",
      "bBGGGBbBGGGBbBGGGBBGb.",
      ".bBGBb.bBGBb.bBGBb.b..",
      "..bBb...bBb...bBb.....",
    ],
    owl: [
      ".bb.....bb.",
      "bBBb...bBBb",
      ".bBBBBBBBb.",
      "bBEPBBBEPBb",
      "bBBBWBBWBBb",
      "bBBBBWWBBBb",
      ".bBBBBBBBb.",
      "..bBBBBBb..",
      "...F...F...",
    ],
    slug: [
      "..G.....G..",
      ".GAG...GAG.",
      "..bBBBBBBb.",
      ".bBLGLGLGBb",
      "bBBBBBBBBBBb",
      "bBBBBBBBBBEP",
      ".bbbbbbbbbb.",
    ],
    // ---- new-area boss & special-fish skins ----
    skeletonshark: [
      "............FF........",
      "F.........WWWWW.......",
      "FFF...W.W.W.W.WWWb....",
      "FFWWWWWWWWWWWWWWWWWWb.",
      "FWWWWWWWWWWWWWWWMMPWb.",
      "FFWWWWWWWWWWWWWWWWWWb.",
      "FFF...W.W.W.W.WWWb....",
      "F.........WWWWW.......",
      "...........FF........",
    ],
    bacteriawhale: [
      "F.........................",
      "FFF..G..bbBBBBBBBBBBbb..G..",
      "FFFFbbBBBBBGBBBBBBBBBBBb...",
      "FFBBBGBBBBBBBBBBBBBGBBBEPb",
      "FFBBBBBBBBGBBBBBBBBBBBBEPM",
      "FFFBLLLLLLLLGLLLLLLLLLBBb.",
      "FFF.bbLLLLGLLLLLLLLLBbb....",
      "F......bFFFb.....bb........",
    ],
    crocodile: [
      ".AAAA.AAAA.AAAA.AAA......",
      "fbBBBBBBBBBBBBBBBBBbEPb...",
      "fbBBBBBBBBBBBBBBBBBBMWMWMW",
      "fbBBLLLLLLLLLLLLLBBBMWMWMW",
      "fbBBBBBBBBBBBBBBBBBBb.....",
      "..bb...bb....bb...bb......",
    ],
    kaiju: [
      ".....A...A...A..........",
      "....AAA.AAA.AAA.........",
      "f..bBBBBBBBBBBBBbEPb....",
      "fbBBBBBBBBBBBBBBBBBMWMW.",
      "fbBBLLLLLLLLLLLBBBBMWMW.",
      "fbBBBBBBBBBBBBBBBBBb....",
      "f..bBBb....bBBb........",
      "...bb.b....b.bb........",
    ],
    wallpaperfish: [
      "..bBBBBBBBBBb..",
      ".bBLBLBLBLBLBb.",
      "bBLBLBLBLBLBLEP",
      "bBBBBBBBBBBBBPM",
      "bBLBLBLBLBLBLEP",
      ".bBLBLBLBLBLBb.",
      "..bBBBBBBBBBb..",
    ],
    cctv: [
      "...........bbbb.",
      "bBBBBBBBBBbBGGGb",
      "bBLLBBBBBBBBGGGb",
      "bBBBBBBBBBbBBBb.",
      "bBBBBBBBBBb.....",
      "....A...A......",
    ],
    clam: [
      "...bBBBBBBb...",
      ".bBBBBBBBBBBb.",
      "bBBLLLLLLLLBBb",
      "bBLLLLWWLLLLBb",
      "bBBLLLLLLLLBBb",
      ".bBBBBBBBBBBb.",
      "..AAAAAAAAAA..",
    ],
    // ---- unique common-fish sprites ----
    clownfish: [
      "...........MMM........",
      "..F......MMMMM........",
      "..FF...bbBWWBBWWBbb...",
      "...FFbBBWWBBWWBBBBBb..",
      "..FFBBBWWBBWWBBBBBBBb.",
      ".FFbBBWWBBWWBBBBBBBEPb",
      "FFFbBBWWBBWWBBBBBBBEPM",
      ".FFbBBWWBBWWBBBBBBBEPb",
      "..FFBBBWWBBWWBBBBBBBb.",
      "...FFbBBWWBBWWBBBBBb..",
      "..FF...bbBWWBBWWBbb...",
      "..F......MMMMM........",
      "...........MMM........",
    ],
    codfish: [
      "...........bbBBBb.....",
      "f.......bbBBBBBBBBb...",
      "ff..bbBBBBBBBBBBBBBb..",
      "ffbBBBBBBBBBBBBBBBBEPb",
      "ffBBLLLLLLLLLLLLLBBEPM",
      "ffbBBBBBBBBBBBBBBBBBb.",
      "ff..bbBBBBBBBBBBBBb...",
      "f.....A.bbBBBBBbb.....",
      ".......FF............",
    ],
    puffer: [
      "...A.A.A.A.A...",
      "..AbBBBBBBBbA..",
      ".AbBBBBBBBBBbA.",
      "AbBBLLBBBBBEPbA",
      ".bBLLLBBBBBEPM.",
      "AbBBBBBBBBBBBbA",
      ".AbBBBBBBBBBbA.",
      "..AbBBBBBBBbA..",
      "...A.A.A.A.A...",
    ],
    perch: [
      "....A.A.A.A.A....",
      "f.bbBBBBBBBBBbb..",
      "fbBBMBBMBBMBBBBEP",
      "fBBBMBBMBBMBBBBPM",
      "fbBBMBBMBBMBBBBEP",
      "f.bbBBBBBBBBBbb..",
      "....FF....FF.....",
    ],
    mackerel: [
      "f....bbBBBBBBBBbb....",
      "ffbBBMBMBMBMBMBBBBBEP",
      "ffBBLLLLLLLLLLLLBBBPM",
      "ffbBBMBMBMBMBMBBBBBEP",
      "f....bbBBBBBBBBbb....",
      "...FF...........FF..",
    ],
    sardine: [
      "f...bbBBBBbb...",
      "fbBBBBBBBBBBEP",
      "fBBLLLLLLLBBPM",
      "fbBBBBBBBBBBEP",
      "f...bbBBBBbb...",
      ".FF........FF.",
    ],
    guppy: [
      "FFF...bBBBb..",
      "FFFFbBBBBBBEP",
      "FFFFBBLLBBBPM",
      "FFFFbBBBBBBEP",
      "FFF...bBBBb..",
    ],
    trout: [
      "f....bbBBBBBBBBbb....",
      "ffbBBBABBBABBBABBBBEP",
      "ffBBLLLLLLLLLLLLLBBPM",
      "ffbBBABBBABBBABBBBBEP",
      "f....bbBBBBBBBBbb....",
      "...FF..........FF...",
    ],
    goby: [
      "....bbBBBBb...",
      "f.bBBBBBBBBBb.",
      "fbBBBBLLBBBBEP",
      "fbBBBBBBBBBBPM",
      "fbBBBBBBBBBBb.",
      "f..bbBBBBbb...",
      "....FFFF.....",
    ],
    parrotfish: [
      "f....bbBBBBBBbb....",
      "ffbBBBBBBBBBBBBBb..",
      "ffBBLBLBLBLBBBBBEPb",
      "ffBBBLBLBLBBBBBBWPM",
      "ffBBLBLBLBLBBBBBEPb",
      "ffbBBBBBBBBBBBBBb..",
      "f....bbBBBBBBbb....",
      "...FF........FF...",
    ],
    hatchetfish: [
      "....bBb....",
      "...bBEPb...",
      "..bBBBBBb..",
      ".bBLLLLLBEP",
      "bBLLLLLLBPM",
      "bBLLLLLLBb.",
      ".bGGGGGGb..",
      "..bb..bb...",
    ],
    barreleye: [
      "...GGGGG......",
      "..GEPGEPG.....",
      ".GGGGGGGGb....",
      "bBBBBBBBBBBBb.",
      "bBBLLLLLLBBBEP",
      "bBBBBBBBBBBBPM",
      ".bBBBBBBBBBb..",
      "..FF.....FF...",
    ],
    lionfish: [
      "A.F.A.F.A.F...",
      ".AFbBBBbFA.F..",
      "F.AbBBBBbAF...",
      ".FbBEPBBBbF.AF",
      "AFbBBBBBBbFPMA",
      ".FbBBBBBBbF.AF",
      "F.AbBBBbAF.F..",
      ".A.F.A.F.A.F..",
    ],
    triggerfish: [
      "....FFF.......",
      "...FBBBF......",
      "..bBBBBBBb....",
      ".bBBBBBBBBBb..",
      "bBBLLBBBBBBEPb",
      ".bBBBBBBBBBPM.",
      "..bBBBBBBBb...",
      "...FBBBF......",
      "....FFF.......",
    ],
    fangtooth: [
      "..bBBBBb..",
      ".bBBBBBBb.",
      "bBBEPBBBBb",
      "bBBBBBBBEP",
      "bWBBBBBBWM",
      "bWBBBBBBWb",
      ".bBBBBBBb.",
      "..bBBBBb..",
    ],
    pike: [
      "f.........bBBBBb....",
      "ffbBBBBBBBBBBBBBbEP.",
      "ffBBLLLLLLLLLLBBBBPM",
      "ffbBBBBBBBBBBBBBbEP.",
      "f.....FFbBBBBBb.....",
      "...........F.......",
    ],
    tuna: [
      "F.........bbBBBBbb....",
      "FFFbbBBBBBBBBBBBBBBEP.",
      "FFBBBBLLLLLLLLLLBBBPM",
      "FFFbbBBBBBBBBBBBBBBEP.",
      "F.........bbBBBBbb..A.",
      "....FF............A..",
    ],
    // ---- unique sprites for bosses / secrets / legendaries (no two alike) ----
    spermwhale: [
      "F..........bBBBBBBBBBBb..",
      "FFF....bbBBBBBBBBBBBBBBb.",
      "FFbBBBBBBBBBBBBBBBBBBBBBb",
      "FBBBBBBBBBBBBBBBBBBBBBBEP",
      "FBBBBBBBBBBBBBBBBBBBLLBPM",
      "FFFBLLLLLLLLLLLLLLLLLBBb.",
      "F...bbLLLLLLLLLLLbbb.....",
      "F......FFFb......bb......",
    ],
    galaxywhale: [
      "F....G..............G....",
      "FFF..G.bbBBBBBBBBBBbb..G..",
      "FFFFbbBBGBBBBBBBGBBBBBBBb.",
      "FFBBBBBBBBBGBBBBBBBBBBBBEP",
      "FFBBBGBBBBBBBBBBGBBBBBBBPM",
      "FFFBLLGLLLLLGLLLLLLGLLBBb.",
      "FFF.bbLLLLLLLLLLLLLBbb....",
      "F......bFFFb.....bb.......",
    ],
    voidwhale: [
      "F.........................",
      "FFF.....bbBBBBBBBBBBbb.....",
      "FFFFbbBBBBBBBBBBBBBBBBBBb..",
      "FFBBBBBBBMMMMMMMMBBBBBBBEP",
      "FFBBBBBBMGGGGGGMBBBBBBBBEPM",
      "FFFBBBBBBMMMMMMMMBBBBBBBb..",
      "FFF.bbBBBBBBBBBBBBBBBbb....",
      "F......bFFFb.....bb........",
    ],
    wraithwhale: [
      "F.........................",
      "FFF.....WbWbWbWbWbWbWb.....",
      "FFFFbWbWbWbWbWbWbWbWbWWb..",
      "FFBBWBWBWBWBWBWBWBWBWBWBEP",
      "FFBBWBWBWBWBWBWBWBWBWBWBPM",
      "FFFBWbWbWbWbWbWbWbWbWbBb...",
      "FFF.bWbWbWbWbWbWbWbbb......",
      "F......bFFFb.....bb........",
    ],
    stormwhale: [
      "F.....A...A...A...........",
      "FFF..AA..AA..AA.bBBbb......",
      "FFFFbbBBBBBBBBBBBBBBBBBBb..",
      "FFBBBBBBBBBBBBBBBBBBBBBBEP",
      "FFBBBBBBBBBBBBBBBBBBBBBBPM",
      "FFFBLLLLLLLLLLLLLLLLLLBBb.",
      "FFF.bbLLLLLLLLLLLLLLBbb....",
      "F......bFFFb.....bb........",
    ],
    ghostwhale: [
      "F.........A...............",
      "FFF.....bAAAb.bBBBBBBbb....",
      "FFFFbbBBBBBBBBBBBBBBBBBBb..",
      "FFBBBBBBBBBBBBBBBBBBBBBBEP",
      "FFLLLLLLLLLLLLLLLLLLLLLLPM",
      "FFFLLLLLLLLLLLLLLLLLLLLb...",
      "FFF..LLLLLLLLLLLLLLLbb.....",
      "F......bFFFb.....bb........",
    ],
    whitesquid: [
      "....bBBBb....",
      "..bBBBBBBBb..",
      ".bBEPBBEPBb.",
      ".bBBBBBBBBb.",
      ".bBLLLLLLBb.",
      "..bBBBBBBb..",
      "AAAA.AAAA.A",
      ".A.A.A.A.A.",
      "A..A...A..A",
    ],
    cuttlefish: [
      "GbBBBBBBBBbG",
      "GbBBBBBBBBbG",
      "GbBWPBBWPBbG",
      "GbBBBBBBBBbG",
      "GbBLLLLLLBbG",
      ".bBBBBBBBBb.",
      ".AA.AA.AA.A.",
      "A..A..A..A..",
    ],
    prismboss: [
      "...GbBBBBbG...",
      "..bBBBBBBBBb..",
      ".bBEPBBBBEPBb.",
      ".bBBBBBBBBBBb.",
      ".bBLLLLLLLLBb.",
      "..bBGBGBGBGb..",
      ".AAA.AAA.AAA.",
      "A.A.A.A.A.A.A",
      ".A..A.A.A..A.",
      "A..A.....A..A",
    ],
    greenlandshark: [
      "f...........FF........",
      "f.....bbBBBBBBBBBBbb...",
      "ffbBBBBBBBBBBBBBBBBBBb.",
      "fbBBBBBBBBBBBBBBBBBBGEP",
      "fbBBLLLLLLLLLLLLLLBBPM",
      "ffbBBBBBBBBBBBBBBBBBb.",
      "f....bbBBBBBBBBBbb.....",
      "............AA........",
    ],
    apexmega: [
      "...........FFFF.........",
      "..........FFFFFF........",
      "F......bbBBBBBBBBbb.....",
      "FFbbBBBBBBBBBBBBBBBBEPb.",
      "FbBBBBBBBBBBBBBBBBBBEPWMWMW",
      "FbBBLLLLLLLLLLLBBBBPMWMWMW",
      "FbBBBBBBBBBBBBBBBBBWMWMWMW",
      "FFbbBBBBBBBBBBBBBBBbb...",
      "F.....bbBBBBBBbb.......",
      "..........AAAA.........",
    ],
    youngkraken: [
      ".....GG.GG.....",
      "....bBBBBBBb....",
      "...bBBBBBBBBb...",
      "...bBGPBBGPBb...",
      "...bBBBMMBBBb...",
      "....bBBBBBBb....",
      "...A.bBBBb.A...",
      "..A.A.A.A.A.A..",
      ".A...A.A.A...A.",
      "A....A...A....A",
    ],
    davyjones: [
      "......A.A.A.........",
      ".....bBBBBBb........",
      "f...bBBBBBBBBbb.....",
      "fbBBBBBBLLBBBBBBEPb.",
      "fbBBBBBBBBBBBBBBBPM.",
      "fbBBBBBBBBBBBBBBBb..",
      "f..MMbBBBBBbMM......",
      "...M.M...M.M.......",
      "..M..M...M..M......",
    ],
    rigtitan: [
      ".....A...A...A.........",
      "....WWW.WWW.WWW........",
      "f..bBBBBBBBBBBBBbEPb...",
      "fbBBWBBWBBWBBWBBBBMWMW.",
      "fbBBLLLLLLLLLLBBBBMWMW.",
      "fbBBWBBWBBWBBWBBBb.....",
      "f..bBBb....bBBb.......",
      "...WW.W....W.WW.......",
    ],
    oarfish: [
      ".A...A...A...A...A.bBb.",
      "AAA.AAA.AAA.AAA.AAbBBEP",
      "fbBBBBBBBBBBBBBBBBBBBPM",
      "fbBLLLLLLLLLLLLLLLBBBb.",
      "fbBBBBBBBBBBBBBBBBBBBb.",
      "f....A...A...A........",
    ],
    deeplev: [
      ".................bBBBb...",
      "..........bBBb..bBBBBBb.",
      "....bBBb.bBBBBbbBBLLBBEP",
      "..bBBBBBBBBLLBBBBBBGGBPM",
      "fbBBBBLLBBBBBBBBBBBBBBb.",
      "fbBBBBBBBBBBBBBBBBBBBb..",
      "..bbBBBBbbb..bbBBBBbb...",
      "....bbb........bbb......",
    ],
    celestserp: [
      ".................bGBBb..",
      "..........bGBb..bBGBBBEP",
      "....bGBb.bBGBBbbBBGBBBPM",
      "..bBGBBGBBLLBBGBBGBBGBb.",
      "fbBBBBGBBBBBBBGBBBBGBBb.",
      "fbBGBBBBBGBBBBBBBGBBBb..",
      "..bbBBBBbbb..bbBBBBbb...",
      "....bbb........bbb......",
    ],
    rivergiant: [
      ".................bBBBb..",
      "..........bBBb..bBBBBEPb",
      "....bBBb.bBBBBbbBBBBBPMW",
      "..bBBBBBBBBLLBBBBBBBBBb.",
      "fbBBBBLLBBBBBBBBBBBBBBb.",
      "fbBBBBBBBBBBBBBBBBBBBb..",
      "..bbBBBBbbb..bbBBBBbb...",
      "....bbb........bbb......",
    ],
    // one grand serpentine wyrm, recoloured for every wyrm (magma/frost/cavern)
    wyrm: [
      "..........................A.A.A....",
      "fb...........A...A...A...bAAGAAb....",
      "f.bb.......bAb.bAb.bAb..bBBGGBBb....",
      "..bBBbb..bBBBBbBBBBbBBBbBBBBBBBBEPb.",
      "fFbBLLLLLLLLLLLLLLLLLLLBBBLLLBBBMWWW",
      "f.bBBBBBBBBBBBBBBBBBBBBBBBBBBBBBMWW.",
      "FFb..bBGBb...bBGBb...bBGBb.bBBBBb...",
      ".......A.......A.......A............",
    ],
    ancientlev: [
      "..W.W.W.W.W.W.W...bBb..",
      ".WbWbWbWbWbWbWbW.bBBEP.",
      "fbBBBBBBBBBBBBBBBBBBBPM",
      "fbBBBBBBBBBBBBBBBBBBBb.",
      "fbWbWbWbWbWbWbWbWbbb...",
      "f....FF.....FF........",
    ],
    // ---- more unique species sprites (variety pass) ----
    manta: [
      "AA..............AA",
      ".bBBb........bBBb..",
      "bBBBBBBBBBBBBBBBBBB",
      "BBBBBLLLLLLBBBBBBEP",
      "bBBBBBBBBBBBBBBBBBB",
      ".bBBBBBBBBBBBBBBBb.",
      "...bBBBBBBBBBBb..AA",
      ".....bBBBBBb....A..",
    ],
    mola: [
      "....FFF......",
      "..bBBBBBb....",
      ".bBBBBBBBBb..",
      "bBBBBBBBBBBEP",
      "bBLLBBBBBBBPM",
      "bBBBBBBBBBBb.",
      ".bBBBBBBBBb..",
      "..bBBBBBb....",
      "....FFF......",
    ],
    whaleshark: [
      "f.........FFF.........",
      "f....bbBBBBBBBBBBbb...",
      "ffbBWBWBWBWBWBWBWBWBb.",
      "fbBBBBBBBBBBBBBBBBBBEP",
      "fbBLLLLLLLLLLLLLLBBPM",
      "ffbBWBWBWBWBWBWBWBWBb.",
      "f....bbBBBBBBBBBBbb...",
      "..........AAA........",
    ],
    giantsquid: [
      "......BB......",
      ".....bBBb.....",
      "....bBLLBb....",
      "..bBBBBBBBBb..",
      "..bBEPBBEPBb..",
      "..bBBBBBBBBb..",
      "...bBBBBBBb...",
      "..AAAAAAAAAA..",
      ".A.A.AA.A.A.AA",
      "A...A.AA.A...A",
      "....A.AA.A....",
      "...A..AA..A...",
      "...A..AA..A...",
    ],
    sturgeon: [
      "f.........bBBBBb.....",
      "ffbAbAbAbAbBBBBBbA...",
      "ffBBBBBBBBBBBBBBBBEPb",
      "ffBBLLLLLLLLLLBBBWWWW",
      "ffBBBBBBBBBBBBBBBBEPb",
      "ffbAbAbAbAbBBBBBbA...",
      "f.....FF......FF.....",
    ],
    helicoprion: [
      "f.....bbBBBBBBBBbb...",
      "ffbBBBBBBBBBBBBBBBBb.",
      "ffBBBBBBBBBBBBBBBBBEP",
      "ffBBLLLLLLLLLLBBWWWWb",
      "ffBBBBBBBBBBBBBBWMW..",
      "ffbBBBBBBBBBBBBBBWb..",
      "f....bbBBBBBBBbb.....",
      "..........AA........",
    ],
    ichthyosaur: [
      "..........bBBb...",
      "f.....bbBBBBBBBb.",
      "ffbBBBBBBBBBBBBEP",
      "ffBBLLLLLLLLBBWWW",
      "ffbBBBBBBBBBBBBb.",
      "f..FF.bBBBBb.FF..",
      ".......FF........",
    ],
    seaspider: [
      "A...A...A...A",
      ".A.A.A.A.A.A.",
      "..A.bBBBb.A..",
      ".A.bBEPBBb.A.",
      "A..bBBBBBb..A",
      ".A.bBBBBBb.A.",
      "..A.bBBBb.A..",
      ".A.A.A.A.A.A.",
      "A...A...A...A",
    ],
    flyingfish: [
      "FFFFFF.........",
      ".FFFFFFb.......",
      "f.bBBBBBBBBBBEP",
      "ffBBLLLLLLLBBPM",
      "f.bBBBBBBBBBBb.",
      ".FFFFFFb.......",
      "FFFFFF.........",
    ],
    mahimahi: [
      "...bBBBBBBBBBBb.....",
      "f.bBBBBBBBBBBBBBb...",
      "ffBBBBBBBBBBBBBBBEP.",
      "ffBBLLLLLLLLLLBBBPM",
      "ffBBBBBBBBBBBBBBBb..",
      "f...bbBBBBBBBBbb...A",
      "......FF........A..",
    ],
    butterflyfish: [
      "...FFF......",
      "..bBBBBb....",
      ".bBMBBMBBb..",
      "bBBMBBMBBBEP",
      "bBMBBMBBBBPM",
      "bBBMBBMBBBb.",
      ".bBMBBMBBb..",
      "..bBBBBb....",
      "...FFF......",
    ],
    moorishidol: [
      ".....F............",
      ".....FF...........",
      "..bBBFFb..........",
      ".bBMBBMBBb........",
      "bBBMBBMBBBbWWW....",
      "bBMBBMBBBBEP......",
      "bBBMBBMBBBPM......",
      ".bBMBBMBBb........",
      "..bBBBBb..........",
      "...FF.............",
    ],
    stonetitan: [
      "..A...A.A...A.A...A..",
      ".bBBb.bBBBbbBBBb.bBb.",
      "fbBBBBBBBBBBBBBBBBEPb",
      "fbBBBBBBBBBBBBBBBBBMW",
      "fbBBBBBBBBBBBBBBBBBb.",
      "f.AAbBBBBBBBBBBbAA...",
      "...bb..........bb...",
    ],
    steed: [
      "....A.A.A....",
      "...bBBBBb....",
      "..bBEPBBBA...",
      "..bBBBBBBA...",
      "...bBBBBb....",
      "....bBBBb...",
      "....bBLBb...",
      "...bBBLBb...",
      "...bBBBb....",
      "..bBBBb.....",
      "..bBBb......",
      "...bBBb.....",
      "....bBBb....",
      ".....bb.....",
    ],
    cinderboss: [
      "....A.A.A.A.A.........",
      "...bBBBBBBBBBBb.......",
      "..bBGBBGBBGBBGBBb.....",
      "f.bBBBBBBBBBBBBBBBEPb.",
      "fbBBGBBGBBGBBGBBBBBPMW",
      "fbBBBBBBBBBBBBBBBBBBb.",
      "f..AAbBBBbAA.AAbBBbAA.",
      "....bb........bb......",
    ],
    leatherback: [
      "......bbBBBBBBBBbb......",
      "....bBAABBAABBAABBBBb...",
      "..bBBAABBAABBAABBBBBBb..",
      "FFbBAABBAABBAABBBBBBBBEPb",
      "FFBBAABBAABBAABBBBBBBBBPM",
      "FFbBAABBAABBAABBBBBBBBEPb",
      "..bBBAABBAABBAABBBBBBb..",
      "....bBAABBAABBAABBBBb...",
      "...FFb..........bFF.....",
      "....F..............F....",
    ],
    macaw: [
      "..FF.........bBb..",
      ".FFFF......bBBBBEPG",
      "..FFFFbBBBBBBBBBPG",
      "...FFFbBBBBBBBb...",
      "AAAAAAAAbBBBb.....",
      ".AAAAAAAA.........",
    ],
    koi: [
      "FF....bbBBBBBbb....",
      "FFFbBBBWWBBWWBBBb..",
      "FFBBBBBBBBBBBBBBBEP",
      "FFBBWWBBLLBBWWBBBPM",
      "FFBBBBBBBBBBBBBBBb.",
      "FFFbBBBWWBBWWBBBb..",
      "FF....bbBBBBBbb....",
    ],
    salmon: [
      "f....bbBBBBBBBBbb....",
      "ffbBBBBABBBABBBBBEPb",
      "ffBBLLLLLLLLLLLBBWPM",
      "ffbBBBABBBABBBBBBEPb",
      "f....bbBBBBBBBBbb....",
      "...FF...........FF..",
    ],
    // ---- distinct bird bodies (so a location's birds don't all match) ----
    gull: [
      "...FF.........FF....",
      "..FFFF.......FFFF...",
      "...FFFFbBBBBbFFFF...",
      ".....bBBBBBBBBbEPG..",
      ".....bBBBBBBBBBBPGG.",
      "......bBBBBBBBb.....",
      ".......F....F......",
    ],
    duck: [
      "..FFF.......FFF....",
      ".FFFFFbBBBBbFFFFF..",
      "...bBBBBBBBBBbEPGGG",
      "...bBBBBBBBBBBBPGGG",
      "....bBBLLLLBBb.....",
      ".....bBBBBBBb......",
      "......A....A.......",
    ],
    songbird: [
      "....F......",
      "...FFbBBb..",
      "..FFbBBBBEPG",
      "..FbBBBBBBPG",
      "...bBBBBBb.",
      "....bBBBb..",
      ".....A.A...",
    ],
    raptor: [
      ".FFF..........FFF.",
      "FFFFFF......FFFFFF",
      ".FFFFFbBBBBBbFFFF.",
      "...bBBBBBBBBBbEPG.",
      "...bBBBBBBBBBBPGG.",
      "....bBBBBBBBb.....",
      ".....AA..AA.......",
      "....A.A..A.A......",
    ],
    seabird: [
      "FFFF............FFFF",
      ".FFFFFb......bFFFFF.",
      "...FFFbBBBBBbFFF....",
      ".....bBBBBBBBbEPG...",
      ".....bBBBBBBBBBPG...",
      "......bBBBBBBb......",
      ".......F....F......",
    ],
    snail: [
      ".............A..A.",
      ".............A..A.",
      "...bbbbb....bbb...",
      "..bBLLLBBb.bBBBb..",
      ".bBLbbbLBBbBBBBEP.",
      ".bBLbBbLBBBBBBBBPM",
      ".bBLbbbLBBBBBBBBb.",
      "..bBLLLBBBBBBBBb..",
      "...bbBBBBBBBBBb...",
      "....AAAAAAAAAA....",
    ],
    flatfish: [
      "....E.E.......",
      "..bBBBBBBBBBb.",
      "fbBBBBBBBBBBBBb",
      "fBBLLLLLLLLLLBM",
      "fbBBBBBBBBBBBBb",
      "..bBBBBBBBBBb.",
      "....FF..FF....",
    ],
    tang: [
      ".....FFF.....",
      "...FFBBBFF...",
      "f.bBBBBBBBb..",
      "fbBBBLLBBBBEP",
      "fbBBBLLBBBBPM",
      "fbBBBBBBBBBEP",
      "f.bBBBBBBBb..",
      "...FFBBBFF...",
      ".....FFF.....",
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
    crab: [
      "AA..........AA",
      "AAAb......bAAA",
      ".AAb......bAA.",
      "...bbBBBBbb...",
      "..bBBBBBBBBb..",
      ".bBEPBBBBEPBb.",
      "bBBBBBBBBBBBBb",
      "bBBBBBBBBBBBBb",
      "b.b.b.bb.b.b.b",
      ".b.b......b.b.",
    ],
    hermitcrab: [
      ".......bbBBBb.",
      "....bBBLLLLBBb",
      "AAAbBLbbbbLBBb",
      ".AbBBLbBBbLBBb",
      "AAEPbLbbbbLBBb",
      ".AEPBBLLLLBBb.",
      "..bbBbBBBb....",
      ".b.b.b.b......",
    ],
    leviathanking: [
      "..........A.A.A...........",
      ".........AAAAAAA.........",
      "........bBBBBBBBb........",
      "f......bBBBBBBBBBBBb.....",
      "f...bBBBBBBBBBBBBBBBBEPb.",
      "fbBBBBBBBLLLLLLBBBBBBBPMW",
      "f...bBBBBBBBBBBBBBBBBb...",
      "f......bBBbBBBBbBBb......",
      "..AAbBBbA....AbBBbAA.....",
      ".....bb........bb.......",
    ],
    dragon: [
      ".................AA.....",
      ".....A.....A...bBBbEPb.",
      "f...bBb...bBBb.bBBBBPMW",
      "fbBBBBBbbBBBBBbBBLLBBb.",
      "fbBLLBBBBBBLLBBBBBBBb..",
      "fbBBBBBBBBBBBBBBBBb....",
      "..AbBbA..AbBbA..A......",
      "...A......A............",
    ],
    seadragon: [
      "...........F..bBbEP.",
      "..F.....F..FbBBBBBPM",
      "F.FbBb.F.bBBLLBBb...",
      ".FbBBBBbFbBBBBBb.F..",
      "F.FbBBBBbBBBBb.F.F..",
      ".F..bBBBBBBb.F..F...",
      "..F..bBBBb.F...F....",
      "...F..bBb.F.........",
      ".....F.b.F.........",
    ],
    crane: [
      "........bBbGGG",
      "........bEPb..",
      ".......bBb....",
      "......bBb.....",
      ".....bBb......",
      "....bBBBBb....",
      "..FbBBBBBBb...",
      "...bBLLLBBb...",
      "....bBBBb.....",
      ".....A.A......",
      ".....A.A......",
      "....AA.AA.....",
    ],
    heron: [
      ".......bBbMMMM",
      ".......bEPb...",
      "......bBb.....",
      ".....bBb......",
      "....bBBb......",
      "..FFbBBBBb....",
      "...bBLLLBBb...",
      "....bBBBb.....",
      ".....A.A......",
      ".....A.A......",
      "....AA.AA.....",
    ],
    stork: [
      "........bBBbMMM",
      "........bEPb...",
      ".......bBBb....",
      ".......bBb.....",
      "......bBBb.....",
      ".....bBBBBb....",
      "...FbBBBBBBb...",
      "..FFbBLLLBBb...",
      "...bBBBBBBb....",
      "....bBBBb......",
      ".....A.A.......",
      ".....A.A.......",
      "....AA.AA......",
    ],
    lobster: [
      "A.............A",
      ".A...bBBBBb...A",
      "A.A.bBEPBEPb.A.",
      ".AAbBBBBBBBBbAA",
      "..bBBBBBBBBBBb.",
      "..bBBBBBBBBBBb.",
      "...bBBBBBBBBb..",
      "....bbbbbbbb...",
      "...A.A.A.A.A...",
    ],
    starfish: [
      "......AA......",
      ".....ABBA.....",
      "....ABBBBA....",
      "AAABBBBBBBBAAA",
      ".ABBBLLLLBBBA.",
      "..ABBLLLLBBA..",
      "..ABBBBBBBBA..",
      ".ABBA.AA.ABBA.",
      "AAA....A...AAA",
    ],
    urchin: [
      "...A.A.A.A...",
      "..A.bBBBb.A..",
      "A.AbBBBBBbA.A",
      ".AbBBLLBBBbA.",
      "A.bBBLLBBBb.A",
      "A.AbBBBBBbA.A",
      "..A.bBBBb.A..",
      "...A.A.A.A...",
    ],
    bug: [
      "..b.......b..",
      "...bBBBBBBb...",
      "f.bBEPBBEPBb.f",
      "fbBBBBBBBBBBbf",
      "fbBBbBBBBbBBbf",
      "f.bBBBBBBBBb.f",
      "...bbBBBBbb...",
      "..f.f.ff.f.f..",
    ],
    blob: [
      ".....bBBBBb.....",
      "...bBBBBBBBBb...",
      "..bBBBBBBBBBBb..",
      "..bBEPBBBBEPBb..",
      "..bBBBBLLBBBBb..",
      ".bBBBBLLLLBBBBb.",
      ".bBBBBBLLBBBBBb.",
      "..bBBMMMMMMBBb..",
      "..bBBBBBBBBBBb..",
      "...bBBBBBBBBb...",
      "....bBBBBBBb....",
      ".....bbBBbb.....",
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
    fish: "fish", round: "round", shark: "shark", sword: "sword", hammer: "hammer", bird: "bird",
    whale: "whale", turtle: "turtle", ray: "ray", eel: "eel", squid: "squid",
    octopus: "octopus", jelly: "jelly", seahorse: "seahorse", otter: "otter",
    angler: "angler", lantern: "lantern", kraken: "kraken", blob: "blob",
    crab: "crab", lobster: "lobster", starfish: "starfish", urchin: "urchin", bug: "bug",
    narwhal: "narwhal", coelacanth: "coelacanth", mosasaur: "mosasaur", armored: "armored",
    trilobite: "trilobite", ammonite: "ammonite", tang: "tang", flatfish: "flatfish",
    dolphin: "dolphin", clione: "clione",
    orca: "orca", manowar: "manowar", siphonophore: "siphonophore", megalodon: "megalodon",
    roc: "roc", spidercrab: "spidercrab",
    lanternjaw: "lanternjaw", dragonfish: "dragonfish", moonfish: "moonfish", catfish: "catfish",
    glowjelly: "glowjelly", seamoth: "seamoth", ghostray: "ghostray", stargazer: "stargazer",
    vampsquid: "vampsquid", glowworm: "glowworm", owl: "owl", slug: "slug",
    skeletonshark: "skeletonshark", bacteriawhale: "bacteriawhale", crocodile: "crocodile",
    kaiju: "kaiju", wallpaperfish: "wallpaperfish", cctv: "cctv", clam: "clam",
    clownfish: "clownfish", codfish: "codfish", puffer: "puffer", perch: "perch",
    mackerel: "mackerel", sardine: "sardine", guppy: "guppy", trout: "trout", goby: "goby", snail: "snail",
    hermitcrab: "hermitcrab", crane: "crane", heron: "heron", stork: "stork",
    dragon: "dragon", seadragon: "seadragon", leviathanking: "leviathanking",
    parrotfish: "parrotfish", hatchetfish: "hatchetfish", barreleye: "barreleye", lionfish: "lionfish",
    triggerfish: "triggerfish", fangtooth: "fangtooth", pike: "pike", tuna: "tuna",
    spermwhale: "spermwhale", galaxywhale: "galaxywhale", voidwhale: "voidwhale", wraithwhale: "wraithwhale",
    stormwhale: "stormwhale", ghostwhale: "ghostwhale", whitesquid: "whitesquid", cuttlefish: "cuttlefish",
    prismboss: "prismboss", greenlandshark: "greenlandshark", apexmega: "apexmega", youngkraken: "youngkraken",
    davyjones: "davyjones", rigtitan: "rigtitan", oarfish: "oarfish", deeplev: "deeplev",
    celestserp: "celestserp", rivergiant: "rivergiant", frostwyrm: "wyrm", ancientlev: "ancientlev",
    wyrm: "wyrm", cavewyrm: "wyrm",
    manta: "manta", mola: "mola", whaleshark: "whaleshark", giantsquid: "giantsquid", sturgeon: "sturgeon",
    helicoprion: "helicoprion", ichthyosaur: "ichthyosaur", seaspider: "seaspider", flyingfish: "flyingfish",
    mahimahi: "mahimahi", butterflyfish: "butterflyfish", moorishidol: "moorishidol",
    koi: "koi", salmon: "salmon", leatherback: "leatherback", macaw: "macaw",
    cinderboss: "cinderboss", magmawyrm: "wyrm", stonetitan: "stonetitan", steed: "steed",
    gull: "gull", duck: "duck", songbird: "songbird", raptor: "raptor", seabird: "seabird",
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
    dims: function (a) { var s = SPR[a] || SPR.fish; return { w: s.w, h: s.h }; },
  };
})();
