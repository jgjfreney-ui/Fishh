#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
  .replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g, '');
const dom = new JSDOM(html, {
  url: 'https://deepsea.local/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
Object.defineProperty(window, 'innerWidth', { configurable: true, value: 960 });
Object.defineProperty(window, 'innerHeight', { configurable: true, value: 540 });
window.requestAnimationFrame = () => 1;
window.cancelAnimationFrame = () => {};
window.confirm = () => true;
window.alert = () => {};
window.prompt = () => null;
window.PointerEvent = window.MouseEvent;

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
    get(target, prop) {
      if (prop in target) return target[prop];
      return undefined;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

window.HTMLCanvasElement.prototype.getContext = function () {
  if (!this.__ctx) this.__ctx = fakeContext(this);
  return this.__ctx;
};
window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
window.HTMLCanvasElement.prototype.getBoundingClientRect = function () {
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, right: window.innerWidth, bottom: window.innerHeight };
};

function evalFile(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  window.eval(`${src}\n//# sourceURL=${rel}`);
}

evalFile('js/data.js');
evalFile('js/sprites.js');
// Deliberately omit audio.js: game.js is designed to work without AUDIO and
// this keeps the smoke test focused on gameplay/rendering rather than WebAudio.
evalFile('js/game.js');

const api = window.DEEPSEA && window.DEEPSEA._test;
if (!api) throw new Error('window.DEEPSEA._test was not exposed');
api.newGame();
api.devSave();

const D = window.GAMEDATA;
let frames = 0;
for (const area of Object.keys(D.LOCATIONS)) {
  // Day frame.
  window.DEEPSEA.state().nextNight = false;
  api.dive(area);
  for (let i = 0; i < 3; i++) { api.frame(0.016); frames++; }
  // Night frame exercises the darkness path in every biome.
  window.DEEPSEA.state().nextNight = true;
  window.DEEPSEA.state().nightVision = false;
  api.dive(area);
  for (let i = 0; i < 3; i++) { api.frame(0.016); frames++; }
}

// Explicitly hammer the Gloom Cavern with/without torch and goggles.
window.DEEPSEA.state().nextNight = true;
window.DEEPSEA.state().nightVision = false;
window.DEEPSEA.state().items.torch = false;
window.DEEPSEA.state().items.goggles = false;
api.dive('cave');
for (let i = 0; i < 5; i++) { api.frame(0.033); frames++; }
window.DEEPSEA.state().items.torch = true;
for (let i = 0; i < 5; i++) { api.frame(0.033); frames++; }
window.DEEPSEA.state().items.goggles = true;
window.DEEPSEA.state().nightVision = true;
for (let i = 0; i < 5; i++) { api.frame(0.033); frames++; }

// Aquarium: render every tank, then every normal + shiny specimen in close-up.
api.aquarium();
let info = api.aquaInfo();
if (!info || info.tanks < 1) throw new Error('Aquarium did not initialise');
const tankCount = info.tanks;
let specimens = 0;
for (let tank = 0; tank < tankCount; tank++) {
  if (tank > 0) api.aquaNav(1);
  api.aquaFrame(0.05);
  info = api.aquaInfo();
  if (info.entities > 0) {
    api.aquaFocus();
    for (let i = 0; i < info.entities; i++) {
      api.aquaFrame(0.05);
      specimens++;
      api.aquaNav(1);
    }
    api.aquaFocus();
  }
}
api.aquaExit();

console.log('--- Deep Sea Diver runtime smoke ---');
console.log(`Dive frames rendered: ${frames}`);
console.log(`Aquarium tanks rendered: ${tankCount}`);
console.log(`Close-up specimens rendered: ${specimens}`);
console.log(`Final scene: ${api.scene()}`);
console.log('Runtime smoke passed.');
