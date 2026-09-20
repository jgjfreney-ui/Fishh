#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
  .replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g, '');
const dom = new JSDOM(html, {
  url: 'https://remaster.local/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
Object.defineProperty(window, 'innerWidth', { configurable: true, value: 960 });
Object.defineProperty(window, 'innerHeight', { configurable: true, value: 540 });
window.confirm = () => true;
window.alert = () => {};
window.prompt = () => null;
window.PointerEvent = window.MouseEvent;

const rafQueue = [];
window.requestAnimationFrame = fn => { rafQueue.push(fn); return rafQueue.length; };
window.cancelAnimationFrame = () => {};

function gradient() { return { addColorStop() {} }; }
function fakeContext(canvas) {
  const base = {
    canvas,
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createPattern: () => ({}),
    measureText: text => ({ width: String(text || '').length * 8 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(0, w * h * 4)), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(0, w * h * 4)), width: w, height: h }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
  };
  const noops = [
    'save','restore','beginPath','closePath','moveTo','lineTo','rect','roundRect','arc','ellipse',
    'quadraticCurveTo','bezierCurveTo','fill','stroke','clip','fillRect','strokeRect','clearRect',
    'translate','rotate','scale','transform','setTransform','resetTransform','drawImage','fillText','strokeText',
    'putImageData','setLineDash','strokeRoundedRect'
  ];
  for (const name of noops) base[name] = () => {};
  return new Proxy(base, {
    get(target, prop) { if (prop in target) return target[prop]; return undefined; },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}
window.HTMLCanvasElement.prototype.getContext = function () {
  if (!this.__ctx) this.__ctx = fakeContext(this);
  return this.__ctx;
};
window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
window.HTMLCanvasElement.prototype.getBoundingClientRect = function () {
  return { left:0, top:0, width:window.innerWidth, height:window.innerHeight, right:window.innerWidth, bottom:window.innerHeight };
};
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { configurable:true, get() { return window.innerWidth; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { configurable:true, get() { return window.innerHeight; } });

function evalFile(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  window.eval(`${src}\n//# sourceURL=${rel}`);
}

// Load the remaster layers in the same order as index.html.
evalFile('js/data.js');
evalFile('js/sprites.js');
evalFile('js/remaster-sprites.js');
if (!window.SPRITES.__remastered) throw new Error('Remaster sprite wrapper did not activate');

// Stub the restored AUDIO surface: this tests the remaster wrapper's no-WebAudio
// fallback, which is important for headless CI and restricted Android contexts.
window.AUDIO = {
  init(){}, resume(){}, setMuted(){}, setMusicMuted(){}, setSfxMuted(){},
  isMusicMuted(){ return false; }, isSfxMuted(){ return false; },
  toggleMute(){ return false; }, isMuted(){ return false; }, playArea(){}, playMenu(){},
  playBoss(){}, playBlob(){}, stopAll(){}, rumble(){}, ui(){}, sonar(){}, torpedoBeep(){}
};
evalFile('js/remaster-audio.js');
if (!window.AUDIO.__remastered) throw new Error('Remaster audio wrapper did not activate');
window.AUDIO.playArea('coral', false);
window.AUDIO.playMenu(false);

evalFile('js/game.js');
evalFile('js/remaster.js');

if (!window.REMASTER) throw new Error('window.REMASTER was not exposed');
if (window.REMASTER.version !== '2.0-m1') throw new Error('Unexpected remaster version');
const D = window.GAMEDATA;
const profileCount = Object.keys(window.REMASTER.profiles).length;
const locationCount = Object.keys(D.LOCATIONS).length;
if (profileCount !== locationCount) throw new Error(`Remaster profiles ${profileCount} != locations ${locationCount}`);
if (!window.document.getElementById('remaster-fx')) throw new Error('Remaster atmosphere canvas missing');

const api = window.DEEPSEA && window.DEEPSEA._test;
if (!api) throw new Error('DEEPSEA test API missing');
api.newGame();
api.devSave();

// Exercise the wrapped sprite renderer across every biome, day and night.
let frames = 0;
for (const area of Object.keys(D.LOCATIONS)) {
  window.DEEPSEA.state().nextNight = false;
  api.dive(area); api.frame(0.016); frames++;
  window.DEEPSEA.state().nextNight = true;
  api.dive(area); api.frame(0.016); frames++;
}

// Run the remaster animation callback once while a dive is active.
const remasterFrame = rafQueue.find(fn => fn && fn.name === 'render');
if (!remasterFrame) throw new Error('Remaster animation frame was not scheduled');
remasterFrame(1500);

// Aquarium close-up is where enlarged sprite treatment is most visible.
api.aquarium();
let info = api.aquaInfo();
let specimens = 0;
for (let tank = 0; tank < info.tanks; tank++) {
  if (tank > 0) api.aquaNav(1);
  api.aquaFrame(0.03);
  info = api.aquaInfo();
  if (info.entities > 0) {
    api.aquaFocus();
    for (let i = 0; i < info.entities; i++) {
      api.aquaFrame(0.03); specimens++; api.aquaNav(1);
    }
    api.aquaFocus();
  }
}
api.aquaExit();

// Celebration copy should replace the old Tools Update when a start panel exists.
const mock = window.document.createElement('div');
mock.className = 'panel start-panel';
mock.innerHTML = '<h1>Old</h1><p class="sub">Old</p><div class="update-banner">Tools Update</div>';
window.document.body.appendChild(mock);
window.REMASTER.refreshStart();
if (!/Remastered/.test(mock.querySelector('h1').textContent)) throw new Error('Remaster title copy not applied');
if (!mock.querySelector('.update-banner').classList.contains('rm-celebration')) throw new Error('Celebration banner not applied');
if (/Tools Update/.test(mock.textContent)) throw new Error('Stale Tools Update copy remains');

console.log('--- Ocean of Discovery Phase Two smoke ---');
console.log(`Remaster biome profiles: ${profileCount}`);
console.log(`Wrapped dive frames: ${frames}`);
console.log(`Aquarium specimens rendered with remaster sprites: ${specimens}`);
console.log(`Atmosphere canvas: present`);
console.log(`Celebration start screen: present`);
console.log('Phase Two remaster smoke passed.');
