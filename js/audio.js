/* ===========================================================================
 * Deep Sea Diver — Generative Audio
 * All sound is synthesised live with the Web Audio API (no audio files):
 *   - a distinct gentle, cozy music bed per area
 *   - surface/menu ambience: rolling waves + occasional gull calls
 * Honest note: this is procedural "generative" music, not a recorded score.
 * ======================================================================== */
(function () {
  "use strict";

  var ctx = null;
  var master = null;
  var muted = false;
  var started = false;

  // currently-playing persistent voices + scheduler
  var voices = [];          // { nodes:[], gain }
  var stepTimer = null;
  var gullTimer = null;
  var mode = null;          // "menu" | area id

  // ----- area music recipes ---------------------------------------------
  // scale = semitone offsets; root in Hz; ms per step; pad = chord semitones
  var TRACKS = {
    menu:      { root: 196.0, scale: [0, 4, 7, 9, 12, 16], step: 620, wave: "sine",     pad: [0, 7, 12],  arp: 0.35, gain: 0.5 },
    coral:     { root: 261.6, scale: [0, 2, 4, 7, 9, 12], step: 460, wave: "triangle", pad: [0, 7, 16],  arp: 0.55, gain: 0.55 },
    kelp:      { root: 196.0, scale: [0, 2, 3, 7, 9, 10], step: 560, wave: "sine",     pad: [0, 3, 7],   arp: 0.45, gain: 0.5 },
    trench:    { root: 130.8, scale: [0, 3, 5, 7, 10, 12], step: 760, wave: "sine",     pad: [0, 7, 10],  arp: 0.3,  gain: 0.45 },
    sanctuary: { root: 329.6, scale: [0, 2, 4, 6, 9, 11], step: 360, wave: "triangle", pad: [0, 4, 7, 11], arp: 0.6, gain: 0.5 },
  };

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.22;
      // a touch of space via feedback delay
      var delay = ctx.createDelay();
      delay.delayTime.value = 0.28;
      var fb = ctx.createGain();
      fb.gain.value = 0.25;
      var wet = ctx.createGain();
      wet.gain.value = 0.18;
      master.connect(ctx.destination);
      master.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  var _noise = null;
  function noiseBuffer() {
    if (_noise) return _noise;
    var len = ctx.sampleRate * 2;
    _noise = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = _noise.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) { // brownish noise (softer)
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    return _noise;
  }

  function ntof(root, semi) { return root * Math.pow(2, semi / 12); }

  // one plucked/soft note
  function note(freq, when, dur, type, vol, pan) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan || 0; o.connect(g); g.connect(p); p.connect(master); }
    else { o.connect(g); g.connect(master); }
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), when + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  // sustained pad chord
  function pad(root, chord, type, vol) {
    var group = { nodes: [], gain: ctx.createGain() };
    group.gain.gain.value = 0;
    group.gain.connect(master);
    group.gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.5);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 700;
    lp.connect(group.gain);
    // slow filter LFO
    var lfo = ctx.createOscillator(); var lg = ctx.createGain();
    lfo.frequency.value = 0.06; lg.gain.value = 300;
    lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    group.nodes.push(lfo);
    chord.forEach(function (semi, i) {
      var o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = ntof(root, semi);
      o.detune.value = (i - 1) * 4;
      o.connect(lp); o.start();
      group.nodes.push(o);
    });
    return group;
  }

  // rolling waves (filtered noise with slow swell) + a soft pad
  function waves() {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(); src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
    var g = ctx.createGain(); g.gain.value = 0.0;
    src.connect(lp); lp.connect(g); g.connect(master);
    // swell LFO
    var lfo = ctx.createOscillator(); var lg = ctx.createGain();
    lfo.frequency.value = 0.13; lg.gain.value = 0.16;
    var base = ctx.createConstantSource(); base.offset.value = 0.18;
    lfo.connect(lg); lg.connect(g.gain); base.connect(g.gain);
    src.start(); lfo.start(); base.start();
    return { nodes: [src, lfo, base], gain: g };
  }

  function gull() {
    if (!ctx || muted) return;
    var t = ctx.currentTime;
    var calls = 1 + (Math.random() * 2 | 0);
    for (var c = 0; c < calls; c++) {
      var base = 900 + Math.random() * 500;
      var o = ctx.createOscillator(); var g = ctx.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * 1.5, t + 0.08);
      o.frequency.linearRampToValueAtTime(base * 0.9, t + 0.18);
      var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      var lp = ctx.createBiquadFilter(); lp.type = "bandpass"; lp.frequency.value = base * 1.2; lp.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(lp); lp.connect(g);
      if (p) { p.pan.value = Math.random() * 1.6 - 0.8; g.connect(p); p.connect(master); } else g.connect(master);
      o.start(t); o.stop(t + 0.3);
      t += 0.22 + Math.random() * 0.12;
    }
  }

  function clearAll(fade) {
    if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
    if (gullTimer) { clearTimeout(gullTimer); gullTimer = null; }
    var now = ctx ? ctx.currentTime : 0;
    voices.forEach(function (v) {
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setValueAtTime(v.gain.gain.value, now);
        v.gain.gain.linearRampToValueAtTime(0, now + (fade || 0.6));
        v.nodes.forEach(function (n) { try { n.stop(now + (fade || 0.6) + 0.1); } catch (e) {} });
      } catch (e) {}
    });
    voices = [];
  }

  function startTrack(id) {
    if (!ensure()) return;
    if (mode === id) return;
    mode = id;
    clearAll(0.6);
    var cfg = TRACKS[id] || TRACKS.menu;

    var pg = pad(cfg.root, cfg.pad, cfg.wave, 0.05 * cfg.gain * 4);
    voices.push(pg);

    if (id === "menu") {
      voices.push(waves());
      var scheduleGull = function () {
        gullTimer = setTimeout(function () { gull(); scheduleGull(); }, 4000 + Math.random() * 9000);
      };
      scheduleGull();
    }

    // arpeggio scheduler
    var step = 0;
    stepTimer = setInterval(function () {
      if (muted || !ctx) return;
      if (Math.random() < cfg.arp) {
        var semi = cfg.scale[(Math.random() * cfg.scale.length) | 0] + (Math.random() < 0.3 ? 12 : 0);
        note(ntof(cfg.root, semi) * 2, ctx.currentTime, 0.5 + Math.random() * 0.4, cfg.wave, 0.05 * cfg.gain * 2, Math.random() * 1.2 - 0.6);
      }
      // occasional bass pulse
      if (step % 8 === 0) note(ntof(cfg.root, 0) / 2, ctx.currentTime, 1.2, "sine", 0.05, 0);
      step++;
    }, cfg.step);
  }

  window.AUDIO = {
    init: function (startMuted) {
      muted = !!startMuted;
      ensure();
    },
    resume: function () {
      if (ensure() && ctx.state === "suspended") ctx.resume();
      started = true;
    },
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.linearRampToValueAtTime(muted ? 0 : 0.22, (ctx ? ctx.currentTime : 0) + 0.2);
    },
    toggleMute: function () { this.setMuted(!muted); return muted; },
    isMuted: function () { return muted; },
    playArea: function (areaId) { this.resume(); startTrack(areaId); },
    playMenu: function () { this.resume(); startTrack("menu"); },
    stopAll: function () { clearAll(0.4); mode = null; },
  };
})();
