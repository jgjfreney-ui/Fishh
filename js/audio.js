/* ===========================================================================
 * Deep Sea Diver — Generative Audio (v3, cheerful)
 * Bright, bouncy chiptune in the spirit of cozy handheld games (Kirby-ish):
 * MAJOR keys only, a clear major-pentatonic melody (which basically can't
 * sound scary), bouncy bass + chord stabs, light reverb. The menu adds gentle
 * waves + occasional gulls. All synthesised live — no audio files.
 * ======================================================================== */
(function () {
  "use strict";

  var ctx = null, master = null, dryBus = null, reverbSend = null;
  var muted = false;
  var voices = [];
  var schedTimer = null, gullTimer = null;
  var mode = null, nextTime = 0, step = 0, melIdx = 4, cfgCur = null;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var PENTA = [0, 2, 4, 7, 9]; // major pentatonic — always pleasant
  function penta(base, idx) { return base + PENTA[((idx % 5) + 5) % 5] + 12 * Math.floor(idx / 5); }

  // bright major triads relative to a tonic
  function triad(tonic, deg) {
    if (deg === "IV") return [tonic + 5, tonic + 9, tonic + 12];
    if (deg === "V") return [tonic + 7, tonic + 11, tonic + 14];
    return [tonic, tonic + 4, tonic + 7]; // I
  }
  function bassRoot(tonic, deg) {
    if (deg === "IV") return tonic - 7;
    if (deg === "V") return tonic - 5;
    return tonic - 12;
  }

  var TRACKS = {
    menu:      { tonic: 60, bpm: 116, density: 0.5, lead: "triangle", bells: false, waves: true,  prog: ["I", "IV", "V", "V"] },
    coral:     { tonic: 60, bpm: 130, density: 0.6, lead: "square",   bells: false, waves: false, prog: ["I", "IV", "V", "I"] },
    kelp:      { tonic: 57, bpm: 110, density: 0.5, lead: "triangle", bells: false, waves: false, prog: ["I", "IV", "I", "V"] },
    trench:    { tonic: 48, bpm: 96,  density: 0.42, lead: "triangle", bells: false, waves: false, prog: ["I", "IV", "V", "I"] },
    sanctuary: { tonic: 64, bpm: 132, density: 0.6, lead: "square",   bells: true,  waves: false, prog: ["I", "V", "IV", "I"] },
  };

  // ---- audio graph ------------------------------------------------------
  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.3;
      var comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      dryBus = ctx.createGain(); dryBus.gain.value = 0.92; dryBus.connect(master);
      var conv = ctx.createConvolver(); conv.buffer = impulse(0.6, 3.2); // short, tasteful
      var wet = ctx.createGain(); wet.gain.value = 0.22; conv.connect(wet); wet.connect(master);
      reverbSend = ctx.createGain(); reverbSend.gain.value = 0.18; reverbSend.connect(conv);
      return true;
    } catch (e) { return false; }
  }

  function impulse(sec, decay) {
    var rate = ctx.sampleRate, len = (rate * sec) | 0, buf = ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  var _noise = null;
  function noiseBuffer() {
    if (_noise) return _noise;
    var len = ctx.sampleRate * 2; _noise = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = _noise.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    return _noise;
  }
  function vgain() { var g = ctx.createGain(); g.connect(dryBus); g.connect(reverbSend); return g; }

  // short, bright note (lead / stab / bell)
  function blip(midi, t, dur, type, vol, cutoff) {
    var o = ctx.createOscillator(), g = vgain(), lp = ctx.createBiquadFilter();
    o.type = type || "square"; o.frequency.value = mtof(midi);
    lp.type = "lowpass"; lp.frequency.value = cutoff || 2200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vol * 0.6, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); o.start(t); o.stop(t + dur + 0.04);
  }
  // rounded bass
  function bass(midi, t, dur, vol) {
    var o = ctx.createOscillator(), g = vgain(), lp = ctx.createBiquadFilter();
    o.type = "triangle"; o.frequency.value = mtof(midi);
    lp.type = "lowpass"; lp.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }

  // ---- menu ambience ----------------------------------------------------
  function startWaves() {
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 470;
    var g = ctx.createGain(); g.gain.value = 0.14;
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.12; lg.gain.value = 0.1; lfo.connect(lg); lg.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(master); src.start(); lfo.start();
    voices.push({ nodes: [src, lfo], gain: g });
  }
  function gull() {
    if (!ctx || muted) return;
    var t = ctx.currentTime, calls = 1 + ((Math.random() * 2) | 0);
    for (var c = 0; c < calls; c++) {
      var base = 900 + Math.random() * 400;
      var o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * 1.5, t + 0.08);
      o.frequency.linearRampToValueAtTime(base * 0.95, t + 0.18);
      bp.type = "bandpass"; bp.frequency.value = base * 1.2; bp.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.04, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(bp); bp.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.3); t += 0.22 + Math.random() * 0.12;
    }
  }
  function scheduleGulls() { gullTimer = setTimeout(function () { gull(); scheduleGulls(); }, 6000 + Math.random() * 9000); }

  // ---- sequencer (steady, bouncy) --------------------------------------
  function scheduler() {
    if (!ctx || !cfgCur) return;
    var spb = 60 / cfgCur.bpm, eighth = spb / 2;
    while (nextTime < ctx.currentTime + 0.15) { stepFn(step, nextTime, spb, eighth); nextTime += eighth; step++; }
  }
  function stepFn(s, t, spb, eighth) {
    if (muted) return;
    var cfg = cfgCur, per = 8, pos = s % per;
    var deg = cfg.prog[Math.floor(s / per) % cfg.prog.length];
    var tonic = cfg.tonic, ch = triad(tonic, deg);
    // bouncy bass: root on the beat, fifth on the "and"
    if (pos % 2 === 0) bass(bassRoot(tonic, deg), t, spb * 0.42, 0.14);
    else if (pos % 2 === 1) bass(bassRoot(tonic, deg) + 7, t, spb * 0.3, 0.09);
    // chord stabs on the offbeats (oom-PAH)
    if (pos === 2 || pos === 6) ch.forEach(function (m) { blip(m + 12, t, eighth * 0.8, "triangle", 0.04, 1800); });
    // sparkle bells
    if (cfg.bells) { blip(penta(tonic + 12, s) + 12, t, eighth * 1.3, "triangle", 0.045, 3000); }
    // lead melody — steady eighths over major pentatonic (can't sound scary)
    if (!cfg.bells && Math.random() < cfg.density) {
      melIdx += [-2, -1, 0, 0, 1, 1, 2][(Math.random() * 7) | 0];
      melIdx = Math.max(0, Math.min(9, melIdx));
      var m2 = penta(tonic + 12, melIdx);
      blip(m2, t, eighth * (Math.random() < 0.25 ? 1.8 : 0.9), cfg.lead, 0.05, 2400);
    }
  }

  function clearSchedule() {
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    if (gullTimer) { clearTimeout(gullTimer); gullTimer = null; }
    var now = ctx ? ctx.currentTime : 0;
    voices.forEach(function (v) {
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setValueAtTime(v.gain.gain.value, now);
        v.gain.gain.linearRampToValueAtTime(0, now + 0.5);
        v.nodes.forEach(function (n) { try { n.stop(now + 0.6); } catch (e) {} });
      } catch (e) {}
    });
    voices = [];
  }

  function startTrack(id) {
    if (!ensure()) return;
    if (mode === id) return;
    mode = id; cfgCur = TRACKS[id] || TRACKS.menu;
    clearSchedule();
    step = 0; melIdx = 4; nextTime = ctx.currentTime + 0.12;
    if (cfgCur.waves) { startWaves(); scheduleGulls(); }
    schedTimer = setInterval(scheduler, 25);
  }

  window.AUDIO = {
    init: function (m) { muted = !!m; ensure(); },
    resume: function () { if (ensure() && ctx.state === "suspended") ctx.resume(); },
    setMuted: function (m) { muted = !!m; if (master) master.gain.linearRampToValueAtTime(muted ? 0 : 0.3, (ctx ? ctx.currentTime : 0) + 0.2); },
    toggleMute: function () { this.setMuted(!muted); return muted; },
    isMuted: function () { return muted; },
    playArea: function (a) { this.resume(); startTrack(a); },
    playMenu: function () { this.resume(); startTrack("menu"); },
    stopAll: function () { clearSchedule(); cfgCur = null; mode = null; },
  };
})();
