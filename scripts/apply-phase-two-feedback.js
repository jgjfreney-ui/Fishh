#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path='js/game.js';
let s=fs.readFileSync(path,'utf8');
let changed=false;

const diverNeedle='    var moving = Math.abs(run.diver.vx) + Math.abs(run.diver.vy) > 5;';
if(!s.includes('window.REMASTER_DIVER_LAYER) return;')){
  if(!s.includes(diverNeedle)) throw new Error('Could not find diver remaster insertion point');
  s=s.replace(diverNeedle,'    // Phase Two foreground renderer owns the diver art; keep the engine aura/hitbox logic intact.\n    if (window.REMASTER_DIVER_LAYER) return;\n'+diverNeedle);
  changed=true;
}

const netNeedle='  function drawNetFx() {\n    for (var i = 0; i < run.netFx.length; i++) {';
if(!s.includes('window.REMASTER_NET_LAYER) return;')){
  if(!s.includes(netNeedle)) throw new Error('Could not find net remaster insertion point');
  s=s.replace(netNeedle,'  function drawNetFx() {\n    // Phase Two foreground renderer replaces the legacy circular scoop-net art.\n    if (window.REMASTER_NET_LAYER) return;\n    for (var i = 0; i < run.netFx.length; i++) {');
  changed=true;
}

const trapNeedle='  function drawTrap() {\n    if (!run.trap || !run.trap.active || run.trap.r <= 0) return;';
if(!s.includes('window.REMASTER_TRAP_LAYER) return;')){
  if(!s.includes(trapNeedle)) throw new Error('Could not find deployed-net remaster insertion point');
  s=s.replace(trapNeedle,'  function drawTrap() {\n    // Phase Two trap renderer replaces the legacy circular deployed-net grid.\n    if (window.REMASTER_TRAP_LAYER) return;\n    if (!run.trap || !run.trap.active || run.trap.r <= 0) return;');
  changed=true;
}

if(changed){
  fs.writeFileSync(path,s);
  console.log('Applied Phase Two on-device feedback patch.');
}else{
  console.log('Phase Two diver and both net renderer handoffs are already applied.');
}
