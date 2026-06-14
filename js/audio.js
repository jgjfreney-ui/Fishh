/* ===========================================================================
 * Deep Sea Diver — Generative Audio (v2)
 * Synthesised live with the Web Audio API (no audio files). Each area is a
 * small cozy tune: pad chords + bass + a wandering melody, run through a
 * reverb for warmth. The surface/menu adds rolling waves + gull calls.
 * ======================================================================== */
(function () {
  "use strict";

  var ctx = null, master = null, dryBus = null, reverbSend = null;
  var muted = false;
  var voices = [];        // persistent ambience nodes (waves)
  var schedTimer = null, gullTimer = null;
  var mode = null;        // "menu" | area id
  var nextTime = 0, step = 0, melIdx = null, cfgCur = null;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ---- scales & chord progressions (kept in-key so it stays consonant) --
  function scaleFrom(root, steps, count) {
    var out = [], i = 0;
    while (out.length < count) {
      out.push(root + steps[i % steps.length] + 12 * Math.floor(i / steps.length));
      i++;
    }
    return out;
  }
  var MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];

  var TRACKS = {
    menu: {
      bpm: 70, density: 0.42, padVol: 1, cutoff: 1300, bells: false, waves: true,
      scale: scaleFrom(67, MAJ, 11),
      prog: [{ pad: [55, 59, 62], bass: 43 }, { pad: [50, 54, 57], bass: 38 },
             { pad: [52, 55, 59], bass: 40 }, { pad: [48, 52, 55], bass: 36 }],
    },
    coral: {
      bpm: 94, density: 0.55, padVol: 0.9, cutoff: 1600, bells: false,
      scale: scaleFrom(72, MAJ, 11),
      prog: [{ pad: [60, 64, 67], bass: 36 }, { pad: [57, 60, 64], bass: 33 },
             { pad: [53, 57, 60], bass: 41 }, { pad: [55, 59, 62], bass: 43 }],
    },
    kelp: {
      bpm: 74, density: 0.46, padVol: 1, cutoff: 1200, bells: false,
      scale: scaleFrom(69, MIN, 11),
      prog: [{ pad: [57, 60, 64], bass: 33 }, { pad: [53, 57, 60], bass: 41 },
             { pad: [60, 64, 67], bass: 36 }, { pad: [55, 59, 62], bass: 43 }],
    },
    trench: {
      bpm: 58, density: 0.26, padVol: 1.2, cutoff: 850, bells: false,
      scale: scaleFrom(62, MIN, 11),
      prog: [{ pad: [50, 53, 57], bass: 38 }, { pad: [46, 50, 53], bass: 34 },
             { pad: [55, 58, 62], bass: 31 }, { pad: [57, 61, 64], bass: 33 }],
    },
    sanctuary: {
      bpm: 100, density: 0.6, padVol: 0.8, cutoff: 2200, bells: true,
      scale: scaleFrom(76, MAJ, 11),
      prog: [{ pad: [64, 68, 71], bass: 40 }, { pad: [61, 64, 68], bass: 37 },
             { pad: [57, 61, 64], bass: 33 }, { pad: [59, 63, 66], bass: 35 }],
    },
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
      dryBus = ctx.createGain(); dryBus.gain.value = 0.85; dryBus.connect(master);
      var conv = ctx.createConvolver(); conv.buffer = impulse(2.4, 2.6);
      var wet = ctx.createGain(); wet.gain.value = 0.5; conv.connect(wet); wet.connect(master);
      reverbSend = ctx.createGain(); reverbSend.gain.value = 0.4; reverbSend.connect(conv);
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

  function padChord(midis, t, dur, vol) {
    midis.forEach(function (m, i) {
      var o = ctx.createOscillator(), g = vgain(), lp = ctx.createBiquadFilter();
      o.type = i % 2 ? "sine" : "triangle"; o.frequency.value = mtof(m); o.detune.value = (i - 1) * 3;
      lp.type = "lowpass"; lp.frequency.value = 1200;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.5);
      g.gain.setValueAtTime(vol, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(g); o.start(t); o.stop(t + dur + 0.1);
    });
  }

  function pluck(midi, t, dur, type, vol, cutoff) {
    var o = ctx.createOscillator(), g = vgain(), lp = ctx.createBiquadFilter();
    o.type = type || "triangle"; o.frequency.value = mtof(midi);
    lp.type = "lowpass"; lp.frequency.value = cutoff || 2000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }

  function lead(midi, t, dur, vol) {
    var o = ctx.createOscillator(), g = vgain(), lp = ctx.createBiquadFilter();
    o.type = "triangle"; o.frequency.value = mtof(midi);
    var vib = ctx.createOscillator(), vg = ctx.createGain();
    vib.frequency.value = 5; vg.gain.value = 4; vib.connect(vg); vg.connect(o.frequency);
    lp.type = "lowpass"; lp.frequency.value = 2600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g);
    o.start(t); o.stop(t + dur + 0.1); vib.start(t); vib.stop(t + dur + 0.1);
  }

  function nextMelody(cfg) {
    if (Math.random() < 0.3) return null; // rest = phrasing
    var sc = cfg.scale;
    if (melIdx == null) melIdx = (sc.length / 2) | 0;
    melIdx += [-2, -1, -1, 0, 1, 1, 2][(Math.random() * 7) | 0];
    melIdx = Math.max(0, Math.min(sc.length - 1, melIdx));
    return sc[melIdx];
  }

  // ---- waves & gulls (menu ambience) -----------------------------------
  function startWaves() {
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 480;
    var g = ctx.createGain(); g.gain.value = 0.18;
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.12; lg.gain.value = 0.13;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(); lfo.start();
    voices.push({ nodes: [src, lfo], gain: g });
  }
  function gull() {
    if (!ctx || muted) return;
    var t = ctx.currentTime, calls = 1 + ((Math.random() * 2) | 0);
    for (var c = 0; c < calls; c++) {
      var base = 850 + Math.random() * 500;
      var o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * 1.5, t + 0.08);
      o.frequency.linearRampToValueAtTime(base * 0.9, t + 0.18);
      bp.type = "bandpass"; bp.frequency.value = base * 1.2; bp.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(bp); bp.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.3); t += 0.22 + Math.random() * 0.12;
    }
  }
  function scheduleGulls() {
    gullTimer = setTimeout(function () { gull(); scheduleGulls(); }, 5000 + Math.random() * 10000);
  }

  // ---- scheduler --------------------------------------------------------
  function scheduler() {
    if (!ctx || !cfgCur) return;
    var spb = 60 / cfgCur.bpm, eighth = spb / 2;
    while (nextTime < ctx.currentTime + 0.15) {
      scheduleStep(step, nextTime, spb, eighth);
      nextTime += eighth; step++;
    }
  }
  function scheduleStep(s, t, spb, eighth) {
    if (muted) return;
    var cfg = cfgCur, per = 8, pos = s % per;
    var chord = cfg.prog[Math.floor(s / per) % cfg.prog.length];
    if (pos === 0) {
      padChord(chord.pad, t, spb * 4 * 0.98, 0.05 * cfg.padVol);
      pluck(chord.bass, t, spb * 0.9, "sine", 0.16, 500);
    } else if (pos === 4) {
      pluck(chord.bass, t, spb * 0.9, "sine", 0.12, 500);
    }
    if (cfg.bells) {
      var tone = chord.pad[s % chord.pad.length] + 12;
      lead(tone, t, eighth * 1.5, 0.045);
    } else if (Math.random() < cfg.density) {
      var n = nextMelody(cfg);
      if (n != null) lead(n, t, eighth * (Math.random() < 0.3 ? 2 : 1), 0.05);
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
        v.gain.gain.linearRampToValueAtTime(0, now + 0.6);
        v.nodes.forEach(function (n) { try { n.stop(now + 0.7); } catch (e) {} });
      } catch (e) {}
    });
    voices = [];
  }

  function startTrack(id) {
    if (!ensure()) return;
    if (mode === id) return;
    mode = id; cfgCur = TRACKS[id] || TRACKS.menu;
    clearSchedule();
    melIdx = null; step = 0; nextTime = ctx.currentTime + 0.12;
    if (cfgCur.waves) { startWaves(); scheduleGulls(); }
    schedTimer = setInterval(scheduler, 25);
  }

  window.AUDIO = {
    init: function (m) { muted = !!m; ensure(); },
    resume: function () { if (ensure() && ctx.state === "suspended") ctx.resume(); },
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.linearRampToValueAtTime(muted ? 0 : 0.3, (ctx ? ctx.currentTime : 0) + 0.2);
    },
    toggleMute: function () { this.setMuted(!muted); return muted; },
    isMuted: function () { return muted; },
    playArea: function (a) { this.resume(); startTrack(a); },
    playMenu: function () { this.resume(); startTrack("menu"); },
    stopAll: function () { clearSchedule(); cfgCur = null; mode = null; },
  };
})();
