/* ===========================================================================
 * Ocean of Discovery — Remaster Audio Layer
 * Adds a very soft atmospheric harmony/texture bed to the restored procedural
 * soundtrack. It never replaces the original melodies and fails gracefully on
 * browsers without WebAudio.
 * ======================================================================== */
(function () {
  "use strict";

  if (!window.AUDIO || window.AUDIO.__remastered) return;
  var A = window.AUDIO;

  var base = {
    init: A.init.bind(A), resume: A.resume.bind(A), setMuted: A.setMuted.bind(A),
    setMusicMuted: A.setMusicMuted.bind(A), stopAll: A.stopAll.bind(A),
    playArea: A.playArea.bind(A), playMenu: A.playMenu.bind(A),
    playBoss: A.playBoss.bind(A), playBlob: A.playBlob.bind(A),
    rumble: A.rumble.bind(A), ui: A.ui.bind(A)
  };

  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, timer = null, current = null;
  var muted = false, musicMuted = false;

  var PROFILES = {
    menu:      { root: 60, mode: "major", pace: 5.6, air: 0.65, sparkle: 0.45 },
    coral:     { root: 60, mode: "major", pace: 4.8, air: 0.70, sparkle: 0.42 },
    river:     { root: 62, mode: "major", pace: 5.2, air: 0.62, sparkle: 0.35 },
    forest:    { root: 57, mode: "major", pace: 6.4, air: 0.52, sparkle: 0.32 },
    secretcave:{ root: 55, mode: "minor", pace: 7.0, air: 0.42, sparkle: 0.38 },
    kelp:      { root: 57, mode: "major", pace: 6.1, air: 0.56, sparkle: 0.25 },
    arctic:    { root: 69, mode: "major", pace: 7.4, air: 0.68, sparkle: 0.72 },
    desert:    { root: 57, mode: "egy",   pace: 6.2, air: 0.42, sparkle: 0.28 },
    opensea:   { root: 60, mode: "major", pace: 7.2, air: 0.70, sparkle: 0.20 },
    ancient:   { root: 50, mode: "minor", pace: 7.0, air: 0.35, sparkle: 0.20 },
    prism:     { root: 64, mode: "major", pace: 5.0, air: 0.66, sparkle: 0.78 },
    swamp:     { root: 55, mode: "minor", pace: 6.6, air: 0.40, sparkle: 0.18 },
    boneyard:  { root: 50, mode: "minor", pace: 8.0, air: 0.35, sparkle: 0.30 },
    storm:     { root: 50, mode: "minor", pace: 5.2, air: 0.32, sparkle: 0.15 },
    mountain:  { root: 60, mode: "major", pace: 6.8, air: 0.72, sparkle: 0.54 },
    olympus:   { root: 72, mode: "major", pace: 5.7, air: 0.78, sparkle: 0.82 },
    jungle:    { root: 55, mode: "major", pace: 4.7, air: 0.52, sparkle: 0.36 },
    alien:     { root: 63, mode: "minor", pace: 8.2, air: 0.56, sparkle: 0.70 },
    grotto:    { root: 60, mode: "egy",   pace: 7.0, air: 0.57, sparkle: 0.66 },
    ashen:     { root: 47, mode: "minor", pace: 5.8, air: 0.28, sparkle: 0.12 },
    pirate:    { root: 52, mode: "minor", pace: 5.0, air: 0.34, sparkle: 0.24 },
    backrooms: { root: 49, mode: "minor", pace: 9.5, air: 0.24, sparkle: 0.08 },
    japan:     { root: 66, mode: "major", pace: 6.1, air: 0.62, sparkle: 0.58 },
    oilrig:    { root: 48, mode: "minor", pace: 5.6, air: 0.24, sparkle: 0.12 },
    flooded:   { root: 45, mode: "minor", pace: 7.8, air: 0.32, sparkle: 0.18 },
    cave:      { root: 53, mode: "minor", pace: 7.8, air: 0.40, sparkle: 0.36 },
    cloud:     { root: 72, mode: "major", pace: 6.2, air: 0.80, sparkle: 0.75 },
    trench:    { root: 48, mode: "minor", pace: 7.4, air: 0.32, sparkle: 0.28 },
    sanctuary: { root: 67, mode: "major", pace: 6.8, air: 0.76, sparkle: 0.86 },
    boss:      { root: 45, mode: "minor", pace: 3.8, air: 0.22, sparkle: 0.08 },
    blob:      { root: 50, mode: "major", pace: 4.3, air: 0.50, sparkle: 0.48 }
  };

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function ensure() {
    if (ctx || !AC) return !!ctx;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.055;
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 3300; lp.Q.value = 0.3;
      master.connect(lp); lp.connect(ctx.destination);
      return true;
    } catch (e) { ctx = null; master = null; return false; }
  }

  function wake() {
    if (!ensure()) return;
    try { if (ctx.state === "suspended") ctx.resume(); } catch (e) {}
  }

  function stopLayer() {
    if (timer) { clearTimeout(timer); timer = null; }
    current = null;
  }

  function note(freq, at, dur, vol, type) {
    if (!ctx || !master || muted || musicMuted) return;
    try {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      var lp = ctx.createBiquadFilter();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, at);
      lp.type = "lowpass"; lp.frequency.value = type === "triangle" ? 2400 : 1500;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + Math.min(0.7, dur * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(lp); lp.connect(g); g.connect(master);
      o.start(at); o.stop(at + dur + 0.08);
    } catch (e) {}
  }

  function chime(freq, at, vol) {
    if (!ctx || !master || muted || musicMuted) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.7);
      o.connect(g); g.connect(master); o.start(at); o.stop(at + 1.75);
    } catch (e) {}
  }

  function intervals(mode) {
    if (mode === "minor") return [0, 3, 7, 10];
    if (mode === "egy") return [0, 1, 7, 10];
    return [0, 4, 7, 11];
  }

  function scheduleLayer(token) {
    if (!ctx || !current || token !== current.token) return;
    var p = current.profile;
    var iv = intervals(p.mode);
    var now = ctx.currentTime + 0.05;
    var night = current.night;
    var root = p.root - (night ? 12 : 0);

    // A very soft two-note wash underneath the original tune.
    var a = iv[(current.step + 0) % iv.length];
    var b = iv[(current.step + 2) % iv.length] + 12;
    note(midi(root + a), now, p.pace * 0.88, 0.050 * p.air, "sine");
    note(midi(root + b), now + 0.22, p.pace * 0.72, 0.028 * p.air, "triangle");

    // Occasional high droplet / glass tone gives each biome extra air without
    // changing the original melody. Chance is deterministic enough to stay calm.
    if (p.sparkle > 0 && Math.random() < p.sparkle) {
      var pick = iv[(current.step + 1) % iv.length] + 24;
      chime(midi(p.root + pick), now + 0.7 + Math.random() * 1.5, 0.020 + p.sparkle * 0.014);
    }

    current.step++;
    timer = setTimeout(function () { scheduleLayer(token); }, p.pace * 1000);
  }

  function begin(id, night) {
    wake();
    stopLayer();
    var p = PROFILES[id] || PROFILES.menu;
    current = { id: id, night: !!night, profile: p, step: 0, token: Date.now() + Math.random() };
    scheduleLayer(current.token);
  }

  A.init = function (m) { muted = !!m; base.init(m); wake(); };
  A.resume = function () { base.resume(); wake(); };
  A.setMuted = function (m) { muted = !!m; base.setMuted(m); if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.055, ctx.currentTime, 0.08); };
  A.setMusicMuted = function (m) { musicMuted = !!m; base.setMusicMuted(m); if (master && ctx) master.gain.setTargetAtTime(musicMuted ? 0 : 0.055, ctx.currentTime, 0.08); };
  A.playArea = function (id, night) { base.playArea(id, night); begin(id, night); };
  A.playMenu = function (night) { base.playMenu(night); begin("menu", night); };
  A.playBoss = function () { base.playBoss(); begin("boss", false); };
  A.playBlob = function () { base.playBlob(); begin("blob", false); };
  A.stopAll = function () { stopLayer(); base.stopAll(); };
  A.rumble = function () { base.rumble(); };
  A.ui = function (kind) { base.ui(kind); };

  // A first touch wakes the extra ambience on stricter mobile WebViews.
  document.addEventListener("pointerdown", wake, { passive: true });
  document.addEventListener("touchstart", wake, { passive: true });

  A.__remastered = true;
  A.remasterVersion = "2.0-m1";
})();
