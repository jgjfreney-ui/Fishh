#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const foregroundSrc = fs.readFileSync(path.join(root, 'js', 'remaster-foreground.js'), 'utf8');
const gameSrc = fs.readFileSync(path.join(root, 'js', 'game.js'), 'utf8');

// Static guard for the exact phone-visible regression that prompted this test.
if (foregroundSrc.includes("R(-11,-8,17,13,'rgba(3,12,18,.92)')") || foregroundSrc.includes('bold outline mass first')) {
  throw new Error('Legacy opaque diver backplate has returned');
}
if (!foregroundSrc.includes("RECAST_DIVER_FOREGROUND_VERSION='2.0'")) {
  throw new Error('Recast diver foreground v2 transparency/color fix missing');
}

const dom = new JSDOM('<!doctype html><html><body><div id="stage"><canvas id="game"></canvas></div></body></html>', {
  url: 'https://deepsea.local/', runScripts: 'outside-only', pretendToBeVisual: true
});
const w = dom.window;
Object.defineProperty(w, 'devicePixelRatio', { configurable: true, value: 1 });
Object.defineProperty(w, 'innerWidth', { configurable: true, value: 960 });
Object.defineProperty(w, 'innerHeight', { configurable: true, value: 540 });
const stage = w.document.getElementById('stage');
Object.defineProperty(stage, 'clientWidth', { configurable: true, get: () => 960 });
Object.defineProperty(stage, 'clientHeight', { configurable: true, get: () => 540 });

let raf = null;
w.requestAnimationFrame = cb => { raf = cb; return 1; };
w.cancelAnimationFrame = () => {};

const calls = [];
function gradient(){ return { addColorStop(){} }; }
function makeCtx(canvas){
  const ctx = {
    canvas, fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1,
    globalCompositeOperation: 'source-over', imageSmoothingEnabled: false,
    save(){}, restore(){}, translate(){}, rotate(){}, scale(){}, setTransform(){}, clearRect(){},
    beginPath(){}, closePath(){}, moveTo(){}, lineTo(){}, arc(){}, ellipse(){}, quadraticCurveTo(){}, stroke(){}, fill(){},
    createLinearGradient: gradient, createRadialGradient: gradient,
    fillRect(x,y,ww,hh){ calls.push({ style: String(this.fillStyle), x:+x, y:+y, w:+ww, h:+hh, alpha:+this.globalAlpha }); }
  };
  return ctx;
}
w.HTMLCanvasElement.prototype.getContext = function(){ return this.__ctx || (this.__ctx = makeCtx(this)); };

w.GAMEDATA = {
  PXPM: 4,
  LOCATIONS: { coral: { id:'coral', worldWidth:1800, maxDepth:300, topColor:'#3b9fc0', deepColor:'#05243a' } }
};

const run = {
  area: 'coral', loc: w.GAMEDATA.LOCATIONS.coral,
  diver: { x: 900, y: 360, vx: 14, vy: -5, face: 1 },
  netFx: [], cloakActive: 0
};
const state = {
  diver: { skin:2, suit:'#1f7d9c', suitAccent:'#ffd24a', suitTrim:'#bfe9ff', look:'round' },
  upgrades: { oxygen:6, fins:6, inventory:4, light:4, net:4, scoop:4, hammer:2, shovel:2, knife:2 },
  items: { goggles:true, heatsuit:true, coldsuit:true, crabcrown:true }, itemsOff: {}
};
w.DEEPSEA = { run: () => run, state: () => state };
w.eval(foregroundSrc + '\n//# sourceURL=js/remaster-foreground.js');
if (typeof raf !== 'function') throw new Error('Foreground renderer did not schedule a frame');

function block(marker){
  const start = gameSrc.indexOf(marker);
  if (start < 0) return '';
  const end = gameSrc.indexOf('];', start);
  return end < 0 ? gameSrc.slice(start) : gameSrc.slice(start, end + 2);
}
function colorsFrom(text){ return [...text.matchAll(/\bcolor:\s*"([^"]+)"/g)].map(m => m[1]); }
const suitColors = [...new Set([
  ...colorsFrom(block('var SUITS = [')),
  ...colorsFrom(block('var LOCATION_SUITS = [')),
  '#1f7d9c', 'rgb(31, 125, 156)', 'camo'
])];
if (suitColors.length < 8) throw new Error('Visual sanity test discovered too few diver suit colors: ' + suitColors.length);

function cssRGBA(style){
  let m;
  style = String(style || '').trim();
  if ((m = style.match(/^#([0-9a-f]{6})$/i))) {
    const h=m[1]; return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),1];
  }
  if ((m = style.match(/^#([0-9a-f]{3})$/i))) {
    const h=m[1]; return [parseInt(h[0]+h[0],16),parseInt(h[1]+h[1],16),parseInt(h[2]+h[2],16),1];
  }
  if ((m = style.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?/i))) {
    return [+m[1],+m[2],+m[3],m[4] == null ? 1 : +m[4]];
  }
  return null;
}
function validateFrame(label, expectedSkin){
  if (!calls.length) throw new Error('No diver pixels rendered for ' + label);
  for (const c of calls) {
    if (![c.x,c.y,c.w,c.h,c.alpha].every(Number.isFinite) || c.w <= 0 || c.h <= 0) throw new Error('Invalid diver rectangle for ' + label);
    if (/NaN|undefined|null/i.test(c.style)) throw new Error('Invalid CSS color generated for ' + label + ': ' + c.style);
    const rgba = cssRGBA(c.style);
    if (rgba) {
      const area = c.w * c.h;
      if (rgba[3] >= .8 && Math.max(rgba[0],rgba[1],rgba[2]) < 40 && area > 650) {
        throw new Error('Oversized opaque near-black rectangle detected for ' + label + ': ' + c.style + ' area=' + area);
      }
    }
  }
  if (expectedSkin && !calls.some(c => c.style.toLowerCase() === expectedSkin.toLowerCase())) {
    throw new Error('Skin tone did not reach the Recast diver renderer: ' + expectedSkin);
  }
}

for (const suit of suitColors) {
  calls.length = 0;
  state.diver.suit = suit;
  state.diver.suitAccent = 'rgb(255, 210, 74)';
  state.diver.suitTrim = 'rgba(191, 233, 255, 1)';
  state.diver.skin = 2;
  raf(1000);
  validateFrame('suit ' + suit, '#d39a6e');
  if (suit !== 'camo' && !calls.some(c => c.style.toLowerCase() === suit.toLowerCase())) {
    throw new Error('Suit color did not render directly: ' + suit);
  }
}

const skins = ['#f4c9a3','#e8b088','#d39a6e','#b87a4f','#8d5524','#5a3318'];
for (let i=0;i<skins.length;i++) {
  calls.length = 0;
  state.diver.suit = '#6a3aa0';
  state.diver.skin = i;
  raf(1500 + i);
  validateFrame('skin ' + i, skins[i]);
}

// Also allow a saved/custom CSS skin color without collapsing to the fallback.
calls.length = 0;
state.diver.skin = 'rgb(201, 146, 103)';
raf(1700);
validateFrame('custom rgb skin', 'rgb(201, 146, 103)');

console.log('Recast visual sanity passed: ' + suitColors.length + ' suit colors, 6 stock skin tones, custom RGB colors, and no oversized dark diver backplates.');
dom.window.close();
