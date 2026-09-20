#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const p=path.join(__dirname,'..','js','game.js');
let s=fs.readFileSync(p,'utf8');
function rep(from,to,label){
  if(!s.includes(from)){
    if(s.includes(to)){console.log('= already patched:',label);return;}
    throw new Error('Missing shiny patch target: '+label);
  }
  s=s.replace(from,to);console.log('+ patched:',label);
}
rep(
`    if (f.isKraken) return { color: f.shiny ? "#fff2a0" : "#ff5b7f", alpha: 0.55 };\n    if (f.legendary) return { color: f.shiny ? "#fff2a0" : "#ffd24a", alpha: 0.5 };\n    if (f.shiny) return { color: "#fff0a0", alpha: 0.38 };`,
`    // Recast shinies are palette variants, not a light source. Natural/legendary\n    // glows remain independent of shiny status.\n    if (f.isKraken) return { color: "#ff5b7f", alpha: 0.55 };\n    if (f.legendary) return { color: "#ffd24a", alpha: 0.5 };`,
'fish shiny glow');
rep(
`    if (state.buddy.shiny) drawGlow(x, y, th, "#fff0a0", 0.4);`,
`    // Shiny buddies use their alternate palette; no artificial shiny aura.`,
'buddy shiny glow');
rep(
`      var biolum = c.shiny || c.def.area === "sanctuary";\n      if (biolum) drawGlow(x, y, th * 0.9, c.shiny ? "#fff0a0" : c.def.color, c.shiny ? 0.4 : 0.22);`,
`      var biolum = c.def.area === "sanctuary";\n      if (biolum) drawGlow(x, y, th * 0.9, c.def.color, 0.22);`,
'creature shiny glow');
rep(
`      if (b.shiny) drawGlow(x, y, th * 1.1, "#fff0a0", 0.4);`,
`      // Recast shiny birds are identified by palette, not glow.`,
'bird shiny glow');
rep(
`      if (b.shiny && Math.sin(run.time * 3 + b.phase) > 0.6) { ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fillRect((x + th * 0.3) | 0, (y - th * 0.3) | 0, 2, 2); }`,
`      // No literal sparkle particle: the alternate palette is the shiny tell.`,
'bird shiny sparkle');
rep(
`    if (e.shiny) drawGlow(x, y, th * 0.9, "#fff0a0", 0.4);`,
`    // Aquarium shinies keep the same lighting as normals; their palette changes.`,
'aquarium tank shiny glow');
rep(
`    if (e.shiny && Math.sin(aqua.time * 3 + e.phase) > 0.6) { ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect((x + th * 0.3) | 0, (y - th * 0.3) | 0, 2, 2); }`,
`    // No aquarium shiny sparkle particle in Recast.`,
'aquarium tank sparkle');
rep(
`    drawGlow(W / 2, H / 2 - 10, Math.min(W, H) * 0.5, e.shiny ? "#fff0a0" : mix(e.def.color, "#ffffff", 0.4), 0.18);`,
`    drawGlow(W / 2, H / 2 - 10, Math.min(W, H) * 0.5, mix(e.def.color, "#ffffff", 0.4), 0.18);`,
'aquarium focus spotlight');
rep(
`      if (e.shiny) drawGlow(cx, cy + bob, d.h * scale * 0.6, "#fff0a0", 0.4);`,
`      // Close-up shiny identity comes from the alternate palette itself.`,
'aquarium focus shiny glow');
fs.writeFileSync(p,s);
console.log('Recast shiny core consistency patch complete.');
