#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');

const dataSource = fs.readFileSync('js/data.js', 'utf8');
const gameSource = fs.readFileSync('js/game.js', 'utf8');
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(dataSource, context, { filename: 'js/data.js' });
const D = context.window.GAMEDATA;

const errors = [];
const warnings = [];
const note = (kind, msg) => (kind === 'error' ? errors : warnings).push(msg);
const requireTrue = (cond, msg) => { if (!cond) errors.push(msg); };

if (!D) throw new Error('js/data.js did not expose window.GAMEDATA');

const areas = D.LOCATIONS || {};
const areaIds = new Set(Object.keys(areas));
const fish = D.FISH || [];
const fishIds = new Set();
const fishByArea = {};
const birdByArea = {};
const creatureByArea = {};

for (const [key, loc] of Object.entries(areas)) {
  requireTrue(loc && loc.id === key, `Location key/id mismatch: ${key} -> ${loc && loc.id}`);
  requireTrue(Number.isFinite(loc.maxDepth) && loc.maxDepth > 0, `Location ${key} has invalid maxDepth`);
  requireTrue(Number.isFinite(loc.worldWidth) && loc.worldWidth > 0, `Location ${key} has invalid worldWidth`);
  requireTrue(Number.isFinite(loc.cost) && loc.cost >= 0, `Location ${key} has invalid cost`);
  if (loc.requireAreas) {
    for (const req of loc.requireAreas) requireTrue(areaIds.has(req), `Location ${key} requires missing area ${req}`);
    requireTrue(!loc.requireAreas.includes(key), `Location ${key} requires itself`);
  }
}

for (const f of fish) {
  requireTrue(!!f.id, 'A fish entry is missing an id');
  if (!f.id) continue;
  requireTrue(!fishIds.has(f.id), `Duplicate fish id: ${f.id}`);
  fishIds.add(f.id);
  requireTrue(areaIds.has(f.area), `Fish ${f.id} points at missing area ${f.area}`);
  requireTrue(D.RARITY && D.RARITY[f.rarity], `Fish ${f.id} has invalid rarity ${f.rarity}`);
  requireTrue(typeof f.shape === 'string' && f.shape.length > 0, `Fish ${f.id} has no sprite shape`);
  requireTrue(Number.isFinite(f.size) && f.size > 0, `Fish ${f.id} has invalid size ${f.size}`);
  const loc = areas[f.area];
  if (loc && Number.isFinite(f.minDepth)) {
    requireTrue(f.minDepth <= loc.maxDepth, `Fish ${f.id} requires ${f.minDepth}m but ${f.area} ends at ${loc.maxDepth}m`);
    requireTrue(f.minDepth >= 0, `Fish ${f.id} has negative minDepth`);
  }
  fishByArea[f.area] = (fishByArea[f.area] || 0) + 1;
  if (f.bird) birdByArea[f.area] = (birdByArea[f.area] || 0) + 1;
  if (f.creature) creatureByArea[f.area] = (creatureByArea[f.area] || 0) + 1;
  if (f.day && f.night) errors.push(`Fish ${f.id} is both day-only and night-only`);
}

for (const id of D.REQUIRED_FISH || []) requireTrue(fishIds.has(id), `REQUIRED_FISH references missing id ${id}`);
for (const id of D.COMPLETION_FISH || []) requireTrue(fishIds.has(id), `COMPLETION_FISH references missing id ${id}`);
requireTrue(new Set(D.REQUIRED_FISH || []).size === (D.REQUIRED_FISH || []).length, 'REQUIRED_FISH contains duplicates');
requireTrue(new Set(D.COMPLETION_FISH || []).size === (D.COMPLETION_FISH || []).length, 'COMPLETION_FISH contains duplicates');

for (const id of D.BIRDS || []) {
  requireTrue(fishIds.has(id), `BIRDS references missing id ${id}`);
  requireTrue(D.FISH_BY_ID[id] && D.FISH_BY_ID[id].bird, `BIRDS entry ${id} is not flagged bird:true`);
}
for (const id of D.CREATURES || []) {
  requireTrue(fishIds.has(id), `CREATURES references missing id ${id}`);
  requireTrue(D.FISH_BY_ID[id] && D.FISH_BY_ID[id].creature, `CREATURES entry ${id} is not flagged creature:true`);
}

for (const [id, count] of Object.entries(fishByArea)) {
  if (!count) warnings.push(`Area ${id} has no catchable content`);
}
for (const id of areaIds) {
  if (!fishByArea[id]) warnings.push(`Area ${id} has no fish/content entries`);
}

// Save schema must know about every location or old/new saves can silently hide content.
const areaBlock = gameSource.match(/areas:\s*\{([\s\S]*?)\},\s*\n\s*keyPieces:/);
if (areaBlock) {
  const saveAreaIds = new Set([...areaBlock[1].matchAll(/\b([a-zA-Z][a-zA-Z0-9_]*)\s*:/g)].map(m => m[1]));
  for (const id of areaIds) requireTrue(saveAreaIds.has(id), `defaultState().areas is missing ${id}`);
  for (const id of saveAreaIds) requireTrue(areaIds.has(id), `defaultState().areas contains stale id ${id}`);
} else {
  errors.push('Could not parse defaultState().areas');
}

// Catch circular collection gates explicitly.
const birdsFn = gameSource.match(/function allBirdsFound\(\)\s*\{([\s\S]*?)\n\s*\}/);
if (!birdsFn) errors.push('Could not find allBirdsFound()');
else if (birdByArea.cloud && !/f\.area\s*!==\s*["']cloud["']/.test(birdsFn[1])) {
  errors.push(`Cloud Reaches contains ${birdByArea.cloud} bird species but allBirdsFound() does not exclude cloud: circular unlock`);
}
const creaturesFn = gameSource.match(/function allCreaturesFound\(\)\s*\{([\s\S]*?)\n\s*\}/);
if (!creaturesFn) errors.push('Could not find allCreaturesFound()');
else if (creatureByArea.cave && !/f\.area\s*!==\s*["']cave["']/.test(creaturesFn[1])) {
  errors.push(`Gloom Cavern contains ${creatureByArea.cave} creature species but allCreaturesFound() does not exclude cave: circular unlock`);
}

// Validate static area references embedded in the engine.
const knownRefPatterns = [
  /\{\s*from:\s*["']([^"']+)["']\s*,\s*to:\s*["']([^"']+)["']/g,
  /\{\s*area:\s*["']([^"']+)["']\s*,\s*requires:\s*["']([^"']+)["']/g,
];
for (const re of knownRefPatterns) {
  for (const m of gameSource.matchAll(re)) {
    requireTrue(areaIds.has(m[1]), `Engine references missing area ${m[1]}`);
    requireTrue(areaIds.has(m[2]), `Engine references missing area ${m[2]}`);
  }
}

const bossBlock = gameSource.match(/var AREA_BOSS_BY_AREA\s*=\s*\{([\s\S]*?)\};/);
if (bossBlock) {
  for (const m of bossBlock[1].matchAll(/\b([a-zA-Z0-9_]+)\s*:\s*["']([^"']+)["']/g)) {
    const area = m[1], bossId = m[2], def = D.FISH_BY_ID[bossId];
    requireTrue(areaIds.has(area), `AREA_BOSS_BY_AREA uses missing area ${area}`);
    requireTrue(!!def, `AREA_BOSS_BY_AREA uses missing fish ${bossId}`);
    if (def) requireTrue(def.area === area, `Boss ${bossId} belongs to ${def.area}, mapped to ${area}`);
  }
} else warnings.push('Could not parse AREA_BOSS_BY_AREA');

// Upgrade data should never point out of bounds at runtime.
for (const [id, u] of Object.entries(D.UPGRADES || {})) {
  requireTrue(Array.isArray(u.levels) && u.levels.length > 0, `Upgrade ${id} has no levels`);
  if (!Array.isArray(u.levels)) continue;
  for (let i = 0; i < u.levels.length; i++) {
    requireTrue(Number.isFinite(u.levels[i].value), `Upgrade ${id} level ${i} has invalid value`);
    requireTrue(Number.isFinite(u.levels[i].cost) && u.levels[i].cost >= 0, `Upgrade ${id} level ${i} has invalid cost`);
  }
}

console.log('--- Deep Sea Diver restoration audit ---');
console.log(`Locations: ${areaIds.size}`);
console.log(`Content entries: ${fish.length}`);
console.log(`Birds by area: ${JSON.stringify(birdByArea)}`);
console.log(`Creatures by area: ${JSON.stringify(creatureByArea)}`);
if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.error(`\nERRORS (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('\nAudit passed: no structural/progression errors found.');
