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
const warnings = [];
const fail = (cond, msg) => { if (!cond) errors.push(msg); };
const locations = D.LOCATIONS || {};
const locIds = new Set(Object.keys(locations));
const fish = D.FISH || [];

// 1) Paid-area prerequisite graph must be acyclic and only reference real areas.
const visiting = new Set();
const visited = new Set();
function visitArea(id, trail) {
  if (visited.has(id)) return;
  if (visiting.has(id)) {
    errors.push(`Area prerequisite cycle: ${trail.concat(id).join(' -> ')}`);
    return;
  }
  visiting.add(id);
  const loc = locations[id];
  if (!loc) { errors.push(`Missing location in prerequisite graph: ${id}`); visiting.delete(id); return; }
  for (const req of (loc.requireAreas || [])) {
    fail(locIds.has(req), `${id} requires nonexistent area ${req}`);
    if (locIds.has(req)) visitArea(req, trail.concat(id));
  }
  visiting.delete(id);
  visited.add(id);
}
for (const id of locIds) visitArea(id, []);

// 2) Parse hidden-site guide. Every pre-Kraken secret world should have a clue.
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

// 3) Parse floor/wall passages; these are valid concrete unlock routes.
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

// Find explicit state unlock assignments. Dynamic passage targets are handled above.
const explicitUnlocks = new Set();
for (const m of gameSource.matchAll(/state\.areas\.([A-Za-z0-9_]+)\s*=\s*true/g)) explicitUnlocks.add(m[1]);

const secretAreas = Object.keys(locations).filter(id => locations[id].secret);
for (const id of secretAreas) {
  // Sanctuary is explicitly post-Kraken and therefore intentionally has no pre-game rumour.
  if (id !== 'sanctuary') {
    fail(guideAreas.has(id), `Secret area ${id} has no purchasable location hint`);
  }
  fail(explicitUnlocks.has(id) || passageTargets.has(id), `Secret area ${id} has no concrete unlock assignment/passage`);
}

// Guide prerequisites themselves must not depend on the secret area they reveal and
// must be areas that can exist before the Kraken. Sanctuary is post-game only.
for (const [id, g] of guideAreas) {
  fail(g.req !== 'sanctuary', `Pre-Kraken hint for ${id} depends on post-game Sanctuary`);
}

// 4) Every condition key authored into fish data must actually be interpreted by
// secretConditionMet(). This catches content that can spawn only in theory.
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

// 5) The curated fake-out list and the real Kraken collection must be catchable.
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
    fail(explicitUnlocks.has(f.area) || passageTargets.has(f.area), `${label} needs ${id} in secret area ${f.area}, but that area has no unlock route`);
  }
}
for (const id of (D.REQUIRED_FISH || [])) checkCatchable(id, 'REQUIRED_FISH');
for (const id of (D.COMPLETION_FISH || [])) {
  const f = D.FISH_BY_ID[id];
  // Restoration completion intentionally excludes Sanctuary because it is post-Kraken.
  if (f && f.area === 'sanctuary') continue;
  checkCatchable(id, 'COMPLETION_FISH');
}

// 6) If the data contains day/night-only catches, dives must actually alternate.
const hasTimedFish = fish.some(f => f.day || f.night);
if (hasTimedFish) {
  fail(/state\.nextNight\s*=\s*!state\.nextNight/.test(gameSource), 'Day/night fish exist but nextNight is never alternated');
}

// 7) Mechanics referenced by progression must have real upgrade tracks.
for (const track of ['oxygen','fins','net','reel','inventory','suit','light','scoop','trap','hammer','shovel','sling','knife','gloves']) {
  fail(!!D.UPGRADES[track], `Runtime references missing upgrade track ${track}`);
}

// 8) Restoration-specific invariants: completion UI and save migration must be the
// same rule used by trueComplete(), otherwise players can see impossible percentages.
fail(/function completionProgressFor\(profile\)/.test(gameSource), 'Canonical completionProgressFor() helper missing');
fail(/version:\s*3/.test(gameSource), 'Restoration save schema is not version 3');
fail(/function fillMissing\(dst, defaults\)/.test(gameSource), 'Deep old-save migration helper missing');

console.log('--- Deep Sea Diver strict reachability audit ---');
console.log(`Locations: ${locIds.size} (${secretAreas.length} secret)`);
console.log(`Hidden-site hints: ${guideAreas.size}`);
console.log(`Secret passages: ${passageTargets.size}`);
console.log(`Authored secret condition keys: ${[...authoredConditionKeys].sort().join(', ') || '(none)'}`);
console.log(`Handled secret condition keys: ${[...handledConditionKeys].sort().join(', ') || '(none)'}`);
console.log(`Required fish: ${(D.REQUIRED_FISH || []).length}`);
console.log(`Completion fish: ${(D.COMPLETION_FISH || []).length}`);
if (warnings.length) for (const w of warnings) console.log(`WARNING: ${w}`);
if (errors.length) {
  console.error(`\nFAILURES (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('Strict reachability audit passed.');
