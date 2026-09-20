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
if (!D) throw new Error('GAMEDATA missing');

const errors = [];
const fail = (cond, msg) => { if (!cond) errors.push(msg); };
const locations = D.LOCATIONS || {};
const locIds = new Set(Object.keys(locations));
const fish = D.FISH || [];

// Ordinary location prerequisite graph: all references must exist and no cycles.
const visiting = new Set(), visited = new Set();
function visitArea(id, trail) {
  if (visited.has(id)) return;
  if (visiting.has(id)) { errors.push(`Area prerequisite cycle: ${trail.concat(id).join(' -> ')}`); return; }
  const loc = locations[id];
  if (!loc) { errors.push(`Missing location in prerequisite graph: ${id}`); return; }
  visiting.add(id);
  for (const req of (loc.requireAreas || [])) {
    fail(locIds.has(req), `${id} requires nonexistent area ${req}`);
    if (locIds.has(req)) visitArea(req, trail.concat(id));
  }
  visiting.delete(id); visited.add(id);
}
for (const id of locIds) visitArea(id, []);

// Hidden-site hint catalogue.
const guideMatch = gameSource.match(/var SECRET_SITE_GUIDE\s*=\s*\[([\s\S]*?)\n\s*\];/);
fail(!!guideMatch, 'Could not parse SECRET_SITE_GUIDE');
const guideAreas = new Map();
if (guideMatch) {
  const re = /\{\s*area:\s*["']([^"']+)["']\s*,\s*requires:\s*["']([^"']+)["']\s*,\s*price:\s*(\d+)/g;
  for (const m of guideMatch[1].matchAll(re)) {
    const area = m[1], req = m[2], price = Number(m[3]);
    fail(locIds.has(area), `Secret-site guide points to missing area ${area}`);
    fail(locIds.has(req), `Secret-site guide for ${area} requires missing area ${req}`);
    fail(area !== req, `Secret-site guide for ${area} requires itself`);
    fail(Number.isFinite(price) && price >= 0, `Secret-site guide for ${area} has invalid price`);
    fail(!guideAreas.has(area), `Duplicate secret-site guide entry for ${area}`);
    guideAreas.set(area, { req, price });
  }
}

// Physical secret passages.
const passageMatch = gameSource.match(/var SECRET_PASSAGES\s*=\s*\[([\s\S]*?)\n\s*\];/);
fail(!!passageMatch, 'Could not parse SECRET_PASSAGES');
const passageTargets = new Set();
if (passageMatch) {
  const re = /\{\s*from:\s*["']([^"']+)["']\s*,\s*to:\s*["']([^"']+)["']/g;
  for (const m of passageMatch[1].matchAll(re)) {
    const from = m[1], to = m[2];
    fail(locIds.has(from), `Secret passage starts in missing area ${from}`);
    fail(locIds.has(to), `Secret passage ends in missing area ${to}`);
    fail(from !== to, `Secret passage ${from} loops into itself`);
    passageTargets.add(to);
  }
}

// Secret worlds may be opened through unlockSecretArea("id", ...). The first
// audit only looked for direct state.areas.id assignments and therefore missed
// the game's deliberately centralised unlock helper.
const helperTargets = new Set();
for (const m of gameSource.matchAll(/unlockSecretArea\(\s*["']([^"']+)["']/g)) {
  if (m[1] !== 'id') helperTargets.add(m[1]);
}
const directTargets = new Set();
for (const m of gameSource.matchAll(/state\.areas\.([A-Za-z0-9_]+)\s*=\s*true/g)) directTargets.add(m[1]);
const hasUnlockRoute = id => passageTargets.has(id) || helperTargets.has(id) || directTargets.has(id);

const secretAreas = Object.keys(locations).filter(id => locations[id].secret);
for (const id of secretAreas) {
  // Sanctuary is post-Kraken; every other hidden site needs an in-game rumour.
  if (id !== 'sanctuary') fail(guideAreas.has(id), `Secret area ${id} has no purchasable location hint`);
  fail(hasUnlockRoute(id), `Secret area ${id} has no concrete unlock route`);
}
for (const [id, g] of guideAreas) fail(g.req !== 'sanctuary', `Pre-Kraken hint for ${id} depends on post-game Sanctuary`);

// Verify the six non-passage mechanisms that are required by the completion
// collection are actually present and their enabling object/tool is obtainable.
const requiredMechanics = [
  [/unlockSecretArea\(["']grotto["']/, 'Ancient Grotto unlock is missing'],
  [/jewelCount\(\)\s*>=\s*4/, 'Ancient Grotto four-jewel gate is missing'],
  [/unlockSecretArea\(["']jungle["']/, 'Emerald Jungle unlock is missing'],
  [/counts\.coconutpuffer[\s\S]{0,200}>=\s*20/, 'Emerald Jungle 20 Coconut Puffer gate is missing'],
  [/unlockSecretArea\(["']alien["']/, 'Xeno Planet unlock is missing'],
  [/ufoTreasures\s*>=\s*100/, 'Xeno Planet 100-artifact gate is missing'],
  [/unlockSecretArea\(["']oilrig["']/, 'Oil Rig unlock is missing'],
  [/state\.items\.cagekey/, 'Oil Rig Cage Key requirement is missing'],
  [/hasKey:\s*true/, 'Cage Key has no world placement'],
  [/unlockSecretArea\(["']flooded["']/, 'Flooded Freighter unlock is missing'],
  [/cargoSearched\s*\|\|\s*0\)\s*>=\s*3/, 'Flooded Freighter three-cargo gate is missing'],
  [/unlockSecretArea\(["']olympus["']/, 'Olympus unlock is missing'],
  [/state\.items\.stormsummoner/, 'Olympus Storm Summoner requirement is missing'],
  [/data-buytool=["']stormsummoner:150000["']/, 'Storm Summoner is not purchasable'],
];
for (const [re, msg] of requiredMechanics) fail(re.test(gameSource), msg);

// Every authored secret-fish condition key must be interpreted by the engine.
const condFn = gameSource.match(/function secretConditionMet\(f, depthM\)\s*\{([\s\S]*?)\n\s*return true;\n\s*\}/);
fail(!!condFn, 'Could not parse secretConditionMet()');
const handledConditionKeys = new Set();
if (condFn) for (const m of condFn[1].matchAll(/\bc\.([A-Za-z0-9_]+)/g)) handledConditionKeys.add(m[1]);
const authoredConditionKeys = new Set();
for (const f of fish) {
  if (!f.condition) continue;
  for (const key of Object.keys(f.condition)) authoredConditionKeys.add(key);
  const loc = locations[f.area];
  if (loc && f.condition.minDepth != null) fail(f.condition.minDepth <= loc.maxDepth, `${f.id} secret condition needs ${f.condition.minDepth}m but ${f.area} ends at ${loc.maxDepth}m`);
  if (f.condition.minDepth != null && f.condition.maxDepth != null) fail(f.condition.minDepth <= f.condition.maxDepth, `${f.id} has inverted secret depth range`);
}
for (const key of authoredConditionKeys) fail(handledConditionKeys.has(key), `Fish data uses unimplemented secret condition key: ${key}`);

// Curated fake-out and real Kraken collections must consist of pre-Kraken,
// catchable content. Sanctuary is deliberately post-game and ignored by the
// restoration's canonical completion helper.
function checkCatchable(id, label) {
  const f = D.FISH_BY_ID[id];
  fail(!!f, `${label} references missing fish ${id}`);
  if (!f) return;
  const loc = locations[f.area];
  fail(!!loc, `${label} fish ${id} uses missing area ${f.area}`);
  if (!loc) return;
  fail(!f.isKraken && !f.isBlob, `${label} incorrectly requires endgame fish ${id}`);
  fail(!f.areaBoss && !f.secretBoss, `${label} incorrectly requires boss ${id}`);
  fail(!f.secret, `${label} incorrectly requires optional secret fish ${id}`);
  fail((f.minDepth || 0) <= loc.maxDepth, `${label} fish ${id} cannot reach its minimum depth`);
  if (loc.secret && f.area !== 'sanctuary') {
    fail(guideAreas.has(f.area), `${label} needs ${id} in secret area ${f.area}, but that area has no hint`);
    fail(hasUnlockRoute(f.area), `${label} needs ${id} in secret area ${f.area}, but that area has no unlock route`);
  }
}
for (const id of (D.REQUIRED_FISH || [])) checkCatchable(id, 'REQUIRED_FISH');
for (const id of (D.COMPLETION_FISH || [])) {
  const f = D.FISH_BY_ID[id];
  if (f && f.area === 'sanctuary') continue;
  checkCatchable(id, 'COMPLETION_FISH');
}

// Day/night content must have an actual alternation path.
if (fish.some(f => f.day || f.night)) fail(/state\.nextNight\s*=\s*!state\.nextNight/.test(gameSource), 'Day/night fish exist but nextNight is never alternated');

// Runtime-referenced upgrade tracks must exist.
for (const track of ['oxygen','fins','net','reel','inventory','suit','light','scoop','trap','hammer','shovel','sling','knife','gloves']) {
  fail(!!D.UPGRADES[track], `Runtime references missing upgrade track ${track}`);
}

// Restoration invariants.
fail(/function completionProgressFor\(profile\)/.test(gameSource), 'Canonical completionProgressFor() helper missing');
fail(/version:\s*3/.test(gameSource), 'Restoration save schema is not version 3');
fail(/function fillMissing\(dst, defaults\)/.test(gameSource), 'Deep old-save migration helper missing');

console.log('--- Deep Sea Diver strict reachability audit v2 ---');
console.log(`Locations: ${locIds.size} (${secretAreas.length} secret)`);
console.log(`Hidden-site hints: ${guideAreas.size}`);
console.log(`Passage unlocks: ${passageTargets.size}; helper unlocks: ${helperTargets.size}`);
console.log(`Authored condition keys: ${[...authoredConditionKeys].sort().join(', ') || '(none)'}`);
console.log(`Required fish: ${(D.REQUIRED_FISH || []).length}; completion fish: ${(D.COMPLETION_FISH || []).length}`);
if (errors.length) {
  console.error(`\nFAILURES (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('Strict reachability audit passed.');
